#!/usr/bin/env python3
"""Analyse a finished game and print a weakness report.

Usage:
    python analyze_game.py --kifu E6F4... --color white
    python analyze_game.py --file games/game-001.txt --color black [--out report.md]
"""

import argparse
import sys
from pathlib import Path

from othello.analyze import analyse_game, format_report


def main():
    parser = argparse.ArgumentParser(description="対局の弱点を分析します")
    parser.add_argument("--kifu", help="棋譜文字列（例: E6F4E3...）")
    parser.add_argument("--file", help="棋譜が入ったテキストファイル")
    parser.add_argument("--color", choices=["black", "white"], required=True,
                        help="分析する側の色")
    parser.add_argument("--out", help="レポートの出力先（省略時は標準出力）")
    args = parser.parse_args()

    if args.file:
        kifu = Path(args.file).read_text(encoding="utf-8").strip()
    elif args.kifu:
        kifu = args.kifu.strip()
    else:
        parser.error("--kifu か --file のどちらかが必要です")
    color = 1 if args.color == "black" else 2
    analysis = analyse_game(kifu, color)
    report = format_report(analysis, kifu)
    if args.out:
        Path(args.out).write_text(report, encoding="utf-8")
        print(f"レポートを書き出しました: {args.out}")
    else:
        print(report)


if __name__ == "__main__":
    sys.exit(main())
