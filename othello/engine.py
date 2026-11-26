"""Othello board logic and a negamax AI engine.

Board representation: a list of 64 ints, index = row * 8 + col.
Values: 0 = empty, 1 = black, 2 = white.
"""

DIRECTIONS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

# Precomputed rays: RAYS[sq][d] = squares from sq in direction d (nearest first).
RAYS = []
for _sq in range(64):
    _r, _c = divmod(_sq, 8)
    _per_sq = []
    for _dr, _dc in DIRECTIONS:
        _ray = []
        _nr, _nc = _r + _dr, _c + _dc
        while 0 <= _nr < 8 and 0 <= _nc < 8:
            _ray.append(_nr * 8 + _nc)
            _nr += _dr
            _nc += _dc
        _per_sq.append(_ray)
    RAYS.append(_per_sq)

CORNERS = (0, 7, 56, 63)
# Squares adjacent to each corner (C and X squares).
CORNER_ADJ = {
    0: (1, 8, 9),
    7: (6, 14, 15),
    56: (48, 49, 57),
    63: (54, 55, 62),
}

# Static square weights (from black's perspective, symmetric).
SQUARE_WEIGHTS = [
    120, -20,  20,   5,   5,  20, -20, 120,
    -20, -40,  -5,  -5,  -5,  -5, -40, -20,
     20,  -5,  15,   3,   3,  15,  -5,  20,
      5,  -5,   3,   3,   3,   3,  -5,   5,
      5,  -5,   3,   3,   3,   3,  -5,   5,
     20,  -5,  15,   3,   3,  15,  -5,  20,
    -20, -40,  -5,  -5,  -5,  -5, -40, -20,
    120, -20,  20,   5,   5,  20, -20, 120,
]


def opponent(player):
    return 3 - player


def initial_board():
    board = [0] * 64
    board[27] = 2  # D4 white
    board[28] = 1  # E4 black
    board[35] = 1  # D5 black
    board[36] = 2  # E5 white
    return board


def flips_for(board, sq, player):
    """Return the list of discs flipped if `player` plays at `sq`, or []."""
    if board[sq] != 0:
        return []
    opp = opponent(player)
    flipped = []
    for ray in RAYS[sq]:
        run = []
        for s in ray:
            if board[s] == opp:
                run.append(s)
            elif board[s] == player:
                flipped.extend(run)
                break
            else:
                break
    return flipped


def legal_moves(board, player):
    """Return a list of (square, flips) for every legal move."""
    moves = []
    for sq in range(64):
        if board[sq] == 0:
            f = flips_for(board, sq, player)
            if f:
                moves.append((sq, f))
    return moves


def apply_move(board, sq, player, flips=None):
    """Return a new board after `player` plays at `sq`."""
    if flips is None:
        flips = flips_for(board, sq, player)
    new_board = board[:]
    new_board[sq] = player
    for s in flips:
        new_board[s] = player
    return new_board


def disc_diff(board, player):
    """Disc count difference from `player`'s perspective."""
    mine = board.count(player)
    theirs = board.count(opponent(player))
    return mine - theirs


def coord(sq):
    return "ABCDEFGH"[sq % 8] + str(sq // 8 + 1)


def parse_coord(text):
    text = text.strip().upper()
    if len(text) != 2 or text[0] not in "ABCDEFGH" or text[1] not in "12345678":
        return None
    return (int(text[1]) - 1) * 8 + "ABCDEFGH".index(text[0])


def board_to_string(board):
    rows = []
    for r in range(8):
        rows.append(" ".join("●" if v == 1 else ("○" if v == 2 else "·")
                             for v in board[r * 8:(r + 1) * 8]))
    return "  A B C D E F G H\n" + "\n".join(f"{r + 1} {row}" for r, row in enumerate(rows))


def evaluate(board, player):
    """Heuristic evaluation from `player`'s perspective, in rough disc units x10.

    Components: corner occupancy (with adjacency penalties that vanish once
    the corner is taken), mobility, and static square weights.
    """
    opp = opponent(player)
    score = 0
    # Corners and their neighbourhoods.
    for corner in CORNERS:
        if board[corner] == player:
            score += 250
        elif board[corner] == opp:
            score -= 250
        else:
            for adj in CORNER_ADJ[corner]:
                if board[adj] == player:
                    score -= 12 if adj in (9, 14, 49, 54) else 18
                elif board[adj] == opp:
                    score += 12 if adj in (9, 14, 49, 54) else 18
    # Static weights.
    w = 0
    for sq in range(64):
        if board[sq] == player:
            w += SQUARE_WEIGHTS[sq]
        elif board[sq] == opp:
            w -= SQUARE_WEIGHTS[sq]
    score += w // 4
    # Mobility.
    my_moves = len(legal_moves(board, player))
    opp_moves = len(legal_moves(board, opp))
    score += (my_moves - opp_moves) * 8
    return score


class Engine:
    """Negamax search with alpha-beta pruning and a transposition table."""

    def __init__(self, exact_empties=14):
        self.exact_empties = exact_empties
        self.tt = {}
        self.nodes = 0

    def search(self, board, player, depth=None):
        """Return (best_square, value) for `player`.

        Value is from `player`'s perspective in disc units (exact when the
        position is solved to the end, otherwise evaluate()/10).
        """
        empties = board.count(0)
        if depth is None or empties <= self.exact_empties:
            depth = empties
        self.tt = {}
        self.nodes = 0
        moves = legal_moves(board, player)
        if not moves:
            return None, self._negamax(board, player, depth, -1000, 1000)
        best_sq, best_val = None, -10 ** 9
        alpha = -1000
        for sq, flips in self._ordered(board, player, moves):
            child = apply_move(board, sq, player, flips)
            val = -self._negamax(child, opponent(player), depth - 1, -1000, -alpha)
            if val > best_val:
                best_sq, best_val = sq, val
            alpha = max(alpha, val)
        return best_sq, best_val

    def value_after(self, board, player, sq, depth=None):
        """Value (player's perspective) of playing `sq`, searched to `depth`."""
        empties = board.count(0)
        if depth is None or empties <= self.exact_empties:
            depth = empties
        self.tt = {}
        self.nodes = 0
        flips = flips_for(board, sq, player)
        child = apply_move(board, sq, player, flips)
        return -self._negamax(child, opponent(player), depth - 1, -1000, 1000)

    def move_values(self, board, player, depth=None):
        """Return {square: value} for every legal move (player's perspective)."""
        empties = board.count(0)
        if depth is None or empties <= self.exact_empties:
            depth = empties
        self.tt = {}
        self.nodes = 0
        values = {}
        for sq, flips in legal_moves(board, player):
            child = apply_move(board, sq, player, flips)
            values[sq] = -self._negamax(child, opponent(player), depth - 1, -1000, 1000)
        return values

    def _ordered(self, board, player, moves):
        def key(item):
            sq, flips = item
            s = len(flips)
            if sq in CORNERS:
                s += 50
            s += SQUARE_WEIGHTS[sq] // 10
            return -s
        return sorted(moves, key=key)

    def _negamax(self, board, player, depth, alpha, beta):
        self.nodes += 1
        moves = legal_moves(board, player)
        opp = opponent(player)
        if not moves:
            if not legal_moves(board, opp):
                return disc_diff(board, player) * 10
            return -self._negamax(board, opp, depth, -beta, -alpha)
        if depth == 0:
            return evaluate(board, player)
        key = (bytes(board), player, depth)
        if key in self.tt:
            return self.tt[key]
        best = -10 ** 9
        for sq, flips in self._ordered(board, player, moves):
            child = apply_move(board, sq, player, flips)
            val = -self._negamax(child, opp, depth - 1, -beta, -alpha)
            if val > best:
                best = val
            if best > alpha:
                alpha = best
            if alpha >= beta:
                break
        if alpha < beta:
            self.tt[key] = best
        return best


# Values returned by search are in "evaluate units" where 10 = 1 disc for
# exact scores. Heuristic values use the same scale by construction.
def value_to_discs(value):
    return value / 10.0
