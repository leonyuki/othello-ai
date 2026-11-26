"""Weakness analysis for a finished game.

Given a game record (Othello Quest style transcript) and the colour of the
player to analyse, every move of that player is scored with the engine:
the value of the played move is compared with the best available move.
Large drops are reported as blunders, grouped by game phase, so the
player can see *where* their stones are being lost.
"""

from .engine import (apply_move, coord, disc_diff, initial_board,
                     legal_moves, opponent, parse_coord, value_to_discs)
from .fast import FastEngine

PHASES = ((20, "序盤（1〜20手）"), (44, "中盤（21〜44手）"), (60, "終盤（45手〜）"))


def phase_of(move_no):
    for limit, name in PHASES:
        if move_no <= limit:
            return name
    return PHASES[-1][1]


def parse_kifu(kifu):
    """Parse a transcript like 'E6F4...' into a list of squares."""
    kifu = kifu.strip().replace(" ", "").replace(";", "")
    squares = []
    for i in range(0, len(kifu) - 1, 2):
        sq = parse_coord(kifu[i:i + 2])
        if sq is None:
            raise ValueError(f"不正な棋譜です: {kifu[i:i + 2]}")
        squares.append(sq)
    return squares


def replay(kifu):
    """Replay a transcript. Returns a list of per-move dicts and the final board.

    Passes are handled automatically: if the side to move has no legal move,
    the turn goes to the opponent (recorded with 'pass': True on the next move
    of the player who actually moves is not needed; passes are implicit).
    """
    squares = parse_kifu(kifu) if isinstance(kifu, str) else list(kifu)
    board = initial_board()
    player = 1
    history = []
    for sq in squares:
        moves = legal_moves(board, player)
        if not moves:
            player = opponent(player)
            moves = legal_moves(board, player)
        flips = dict(moves).get(sq)
        if flips is None:
            raise ValueError(f"{len(history) + 1}手目 {coord(sq)} は合法手ではありません")
        history.append({
            "no": len(history) + 1,
            "player": player,
            "square": sq,
            "move": coord(sq),
            "board_before": board[:],
            "empties_before": board.count(0),
        })
        board = apply_move(board, sq, player, flips)
        player = opponent(player)
    return history, board


def analyse_game(kifu, my_color, engine=None, blunder_threshold=6.0,
                 midgame_depth=7):
    """Analyse one game from `my_color`'s perspective (1=black, 2=white).

    Returns a dict with per-move evaluations for the analysed player,
    the blunder list, and per-phase loss totals. Endgame positions
    (<= engine.exact_empties empties) are solved exactly; earlier
    positions use a depth-limited search, so midgame numbers are estimates.
    """
    if engine is None:
        engine = FastEngine(exact_empties=12)
    history, final_board = replay(kifu)
    my_moves = []
    blunders = []
    phase_loss = {name: 0.0 for _, name in PHASES}
    phase_blunders = {name: 0 for _, name in PHASES}
    for entry in history:
        if entry["player"] != my_color:
            continue
        board = entry["board_before"]
        exact = entry["empties_before"] <= engine.exact_empties
        depth = None if exact else midgame_depth
        best_sq, best_raw = engine.search(board, my_color, depth=depth)
        played_sq = entry["square"]
        played_raw = engine.value_after(board, my_color, played_sq, depth=depth)
        played_val = value_to_discs(played_raw)
        best_val = value_to_discs(best_raw)
        loss = best_val - played_val
        record = {
            "no": entry["no"],
            "move": entry["move"],
            "best": coord(best_sq),
            "played_value": played_val,
            "best_value": best_val,
            "loss": loss,
            "exact": exact,
            "phase": phase_of(entry["no"]),
        }
        my_moves.append(record)
        if loss >= blunder_threshold:
            blunders.append(record)
            phase_loss[record["phase"]] += loss
            phase_blunders[record["phase"]] += 1
    black = final_board.count(1)
    white = final_board.count(2)
    return {
        "my_color": my_color,
        "final_score": (black, white),
        "result": "win" if disc_diff(final_board, my_color) > 0 else
                  ("loss" if disc_diff(final_board, my_color) < 0 else "draw"),
        "moves": my_moves,
        "blunders": sorted(blunders, key=lambda b: -b["loss"]),
        "phase_loss": phase_loss,
        "phase_blunders": phase_blunders,
        "total_loss": sum(b["loss"] for b in blunders),
    }


def format_report(analysis, kifu=None):
    color_name = "黒（先手）" if analysis["my_color"] == 1 else "白（後手）"
    black, white = analysis["final_score"]
    lines = [
        "# 対局分析レポート",
        "",
        f"- あなたの色：{color_name}",
        f"- 最終スコア：黒 {black} - {white} 白（{analysis['result']}）",
        f"- 悪手（損失6石以上）：{len(analysis['blunders'])}件"
        f"（うち完全読み {sum(1 for b in analysis['blunders'] if b['exact'])}件）",
        "",
        "## フェーズ別の損失（悪手のみ集計）",
        "",
    ]
    for _, name in PHASES:
        lines.append(f"- {name}：悪手 {analysis['phase_blunders'][name]}件、"
                     f"損失 {analysis['phase_loss'][name]:.0f}石")
    lines += ["", "## 大きな悪手（損失順）", ""]
    if analysis["blunders"]:
        for b in analysis["blunders"]:
            exact_mark = "完全読み" if b["exact"] else "推定"
            lines.append(
                f"- {b['no']}手目 {b['move']}（正解 {b['best']}）："
                f"{b['best_value']:+.0f} → {b['played_value']:+.0f}、"
                f"{b['loss']:.0f}石損（{b['phase']}、{exact_mark}）")
    else:
        lines.append("- 閾値以上の悪手はありませんでした。")
    lines += [
        "",
        "## 読み方",
        "",
        "- 終盤（空きマスが少ない局面）は完全読みで正確な石差です。",
        "- 中盤以前は探索深さに制限があるため推定値です。大きな損失の手が課題候補です。",
        "- まずは損失の大きいフェーズから、悪手の局面をドリルで反復するのが有効です。",
    ]
    if kifu:
        lines += ["", f"棋譜：{kifu}"]
    return "\n".join(lines) + "\n"
