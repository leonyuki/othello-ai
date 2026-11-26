#!/usr/bin/env python3
"""Play against the Othello AI in the terminal.

Usage:
    python play.py [--color black|white] [--level 1-4]

The game record (kifu) is saved under games/ at the end, and a short
weakness summary of your moves is printed.
"""

import argparse
import random
import sys
from datetime import datetime
from pathlib import Path

from othello.analyze import analyse_game, format_report
from othello.engine import (Engine, apply_move, board_to_string, coord,
                            initial_board, legal_moves, opponent, parse_coord)

LEVELS = {
    1: {"depth": 2, "exact": 10, "epsilon": 0.35, "label": "入門（読み2手＋ランダム）"},
    2: {"depth": 4, "exact": 12, "epsilon": 0.10, "label": "中級（読み4手）"},
    3: {"depth": 6, "exact": 12, "epsilon": 0.0, "label": "上級（読み6手＋終盤完全読み）"},
    4: {"depth": 8, "exact": 14, "epsilon": 0.0, "label": "最強（読み8手＋終盤完全読み）"},
}


def ai_move(engine, board, player, level_cfg, rng):
    values = engine.move_values(board, player, depth=level_cfg["depth"])
    if not values:
        return None
    best = max(values.values())
    if level_cfg["epsilon"] and rng.random() < level_cfg["epsilon"]:
        return rng.choice(list(values))
    # Among near-best moves pick the best (ties broken arbitrarily).
    return max(values, key=values.get) if best is not None else None


def main():
    parser = argparse.ArgumentParser(description="Othello AI と対戦します")
    parser.add_argument("--color", choices=["black", "white"], default="black",
                        help="あなたの色（既定: black）")
    parser.add_argument("--level", type=int, choices=[1, 2, 3, 4], default=2,
                        help="AIの強さ 1-4（既定: 2）")
    args = parser.parse_args()

    human = 1 if args.color == "black" else 2
    cfg = LEVELS[args.level]
    engine = Engine(exact_empties=cfg["exact"])
    rng = random.Random()
    board = initial_board()
    player = 1
    kifu = []
    print(f"あなたは {'黒（先手）' if human == 1 else '白（後手）'}、AIレベル {args.level}：{cfg['label']}")
    while True:
        moves = legal_moves(board, player)
        if not moves:
            if not legal_moves(board, opponent(player)):
                break
            print(f"{'黒' if player == 1 else '白'}はパスです")
            player = opponent(player)
            continue
        print(board_to_string(board))
        if player == human:
            legal = {sq: f for sq, f in moves}
            print("合法手:", ", ".join(coord(sq) for sq in legal))
            while True:
                text = input("あなたの手（例: E6、終了は q）: ")
                if text.strip().lower() == "q":
                    print("対局を中断しました")
                    return
                sq = parse_coord(text)
                if sq in legal:
                    break
                print("そのマスには打てません")
            flips = legal[sq]
        else:
            sq = ai_move(engine, board, player, cfg, rng)
            flips = dict(moves)[sq]
            print(f"AI の手: {coord(sq)}")
        board = apply_move(board, sq, player, flips)
        kifu.append(coord(sq))
        player = opponent(player)

    black, white = board.count(1), board.count(2)
    print(board_to_string(board))
    print(f"終局：黒 {black} - {white} 白")
    transcript = "".join(kifu)
    print(f"棋譜: {transcript}")
    games_dir = Path(__file__).parent / "games"
    games_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = games_dir / f"game-{stamp}.txt"
    path.write_text(transcript + "\n", encoding="utf-8")
    print(f"棋譜を保存しました: {path}")
    print("\nあなたの手を分析しています…")
    analysis = analyse_game(transcript, human)
    print(format_report(analysis, transcript))


if __name__ == "__main__":
    sys.exit(main())
