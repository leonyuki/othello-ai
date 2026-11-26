#!/usr/bin/env python3
"""AI vs AI self-play: a smoke test and demo of the engine."""

import random
import sys

from othello.engine import (Engine, apply_move, coord, initial_board,
                            legal_moves, opponent)


def main():
    rng = random.Random(42)
    engines = {1: Engine(exact_empties=12), 2: Engine(exact_empties=12)}
    board = initial_board()
    player = 1
    kifu = []
    while True:
        moves = legal_moves(board, player)
        if not moves:
            if not legal_moves(board, opponent(player)):
                break
            player = opponent(player)
            continue
        values = engines[player].move_values(board, player, depth=4)
        # Slight randomness keeps self-play games varied.
        best = max(values.values())
        near = [sq for sq, v in values.items() if v >= best - 5]
        sq = rng.choice(near)
        board = apply_move(board, sq, player, dict(moves)[sq])
        kifu.append(coord(sq))
        player = opponent(player)
    print("棋譜:", "".join(kifu))
    print(f"終局：黒 {board.count(1)} - {board.count(2)} 白")


if __name__ == "__main__":
    sys.exit(main())
