"""Bitboard search engine (fast path).

The board is held in two Python ints (black bits, white bits); bit i is
square i = row * 8 + col, so bit 0 is A1 and bit 63 is H8. This module
exposes the same value convention as engine.py: values are in units of
1/10 disc, and exact (fully solved) values equal the true disc
difference x 10.

engine.py remains the readable reference implementation for the rules;
this module exists because whole-game analysis needs the speed.
"""

FULL = 0xFFFFFFFFFFFFFFFF
NOT_A = 0xFEFEFEFEFEFEFEFE
NOT_H = 0x7F7F7F7F7F7F7F7F

# (shift, mask) per direction; shift > 0 means <<, shift < 0 means >>.
_DIRS = (
    (1, NOT_A),    # east
    (-1, NOT_H),   # west
    (8, FULL),     # south
    (-8, FULL),    # north
    (9, NOT_A),    # south-east
    (-9, NOT_H),   # north-west
    (7, NOT_H),    # south-west
    (-7, NOT_A),   # north-east
)


def _shift(bits, shift, mask):
    if shift > 0:
        return (bits << shift) & mask & FULL
    return (bits >> -shift) & mask


def legal_bits(own, opp):
    """Bitmask of legal moves for the player holding `own`."""
    empty = ~(own | opp) & FULL
    moves = 0
    for shift, mask in _DIRS:
        x = _shift(own, shift, mask) & opp
        x |= _shift(x, shift, mask) & opp
        x |= _shift(x, shift, mask) & opp
        x |= _shift(x, shift, mask) & opp
        x |= _shift(x, shift, mask) & opp
        x |= _shift(x, shift, mask) & opp
        moves |= _shift(x, shift, mask) & empty
    return moves


def flips_bits(own, opp, move_bit):
    """Bitmask of discs flipped when the `own` player plays `move_bit`."""
    flips = 0
    for shift, mask in _DIRS:
        run = 0
        x = _shift(move_bit, shift, mask)
        while x & opp:
            run |= x
            x = _shift(x, shift, mask)
        if x & own:
            flips |= run
    return flips


def bits_of(board, player):
    """Convert an engine.py list board into (own_bits, opp_bits) for `player`."""
    own = opp = 0
    for sq, v in enumerate(board):
        if v == player:
            own |= 1 << sq
        elif v != 0:
            opp |= 1 << sq
    return own, opp


def _popcount(x):
    return x.bit_count()


# Square weights indexed by bit, same table as engine.py.
from .engine import SQUARE_WEIGHTS, CORNERS, CORNER_ADJ  # noqa: E402

_CORNER_BITS = tuple(1 << c for c in CORNERS)
_CORNER_ADJ_BITS = {c: tuple(1 << a for a in CORNER_ADJ[c]) for c in CORNERS}
_X_SQUARES = (9, 14, 49, 54)


def evaluate_bits(own, opp):
    """Heuristic value for the `own` player, same scale as engine.evaluate."""
    score = 0
    for corner, cbit in zip(CORNERS, _CORNER_BITS):
        if own & cbit:
            score += 250
        elif opp & cbit:
            score -= 250
        else:
            for abit in _CORNER_ADJ_BITS[corner]:
                if own & abit:
                    score -= 12 if abit.bit_length() - 1 in _X_SQUARES else 18
                elif opp & abit:
                    score += 12 if abit.bit_length() - 1 in _X_SQUARES else 18
    w = 0
    b = own
    while b:
        lsb = b & -b
        w += SQUARE_WEIGHTS[lsb.bit_length() - 1]
        b ^= lsb
    b = opp
    while b:
        lsb = b & -b
        w -= SQUARE_WEIGHTS[lsb.bit_length() - 1]
        b ^= lsb
    score += w // 4
    score += (_popcount(legal_bits(own, opp)) - _popcount(legal_bits(opp, own))) * 8
    return score


class FastEngine:
    """Negamax + alpha-beta over bitboards, with a persistent TT.

    The transposition table is kept across calls so analysing a whole
    game (many neighbouring positions) reuses earlier work. Call
    clear_tt() to reset it.
    """

    def __init__(self, exact_empties=14):
        self.exact_empties = exact_empties
        self.tt = {}
        self.nodes = 0

    def clear_tt(self):
        self.tt = {}

    # -- public API mirroring engine.Engine -------------------------------
    def search(self, board, player, depth=None):
        """Return (best_square, value) for `player` on a list board."""
        own, opp = bits_of(board, player)
        empties = 64 - _popcount(own | opp)
        if depth is None or empties <= self.exact_empties:
            depth = empties
        moves = legal_bits(own, opp)
        if not moves:
            return None, self._negamax(own, opp, depth, -10000, 10000)
        best_sq, best_val = None, -10 ** 9
        alpha = -10000
        for sq, nown, nopp in self._ordered_children(own, opp, moves):
            val = -self._negamax(nown, nopp, depth - 1, -10000, -alpha)
            if val > best_val:
                best_sq, best_val = sq, val
            alpha = max(alpha, val)
        return best_sq, best_val

    def value_after(self, board, player, sq, depth=None):
        """Value for `player` after playing square `sq` on a list board."""
        own, opp = bits_of(board, player)
        empties = 64 - _popcount(own | opp)
        if depth is None or empties <= self.exact_empties:
            depth = empties
        bit = 1 << sq
        flips = flips_bits(own, opp, bit)
        nown = opp ^ flips
        nopp = own | bit | flips
        return -self._negamax(nown, nopp, depth - 1, -10000, 10000)

    # -- internals ---------------------------------------------------------
    def _ordered_children(self, own, opp, moves):
        children = []
        m = moves
        while m:
            lsb = m & -m
            sq = lsb.bit_length() - 1
            flips = flips_bits(own, opp, lsb)
            key = _popcount(flips) + SQUARE_WEIGHTS[sq] // 10
            if lsb in _CORNER_BITS:
                key += 50
            children.append((-key, sq, opp ^ flips, own | lsb | flips))
            m ^= lsb
        children.sort()
        return [(sq, nown, nopp) for _, sq, nown, nopp in children]

    def _negamax(self, own, opp, depth, alpha, beta):
        self.nodes += 1
        moves = legal_bits(own, opp)
        if not moves:
            if not legal_bits(opp, own):
                return (_popcount(own) - _popcount(opp)) * 10
            return -self._negamax(opp, own, depth, -beta, -alpha)
        if depth == 0:
            return evaluate_bits(own, opp)
        key = (own, opp, depth)
        hit = self.tt.get(key)
        if hit is not None:
            return hit
        best = -10 ** 9
        alpha0 = alpha
        for _sq, nown, nopp in self._ordered_children(own, opp, moves):
            val = -self._negamax(nown, nopp, depth - 1, -beta, -alpha)
            if val > best:
                best = val
            if best > alpha:
                alpha = best
            if alpha >= beta:
                break
        if alpha0 < best < beta:
            self.tt[key] = best
        return best
