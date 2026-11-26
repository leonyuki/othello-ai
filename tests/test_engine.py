import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from othello.analyze import analyse_game, replay
from othello.engine import coord, initial_board, legal_moves

SAMPLE = (Path(__file__).resolve().parent.parent / "games" / "sample-game-001.txt")


class TestEngine(unittest.TestCase):
    def test_initial_legal_moves(self):
        moves = {coord(sq) for sq, _ in legal_moves(initial_board(), 1)}
        self.assertEqual(moves, {"D3", "C4", "F5", "E6"})

    def test_replay_sample_game(self):
        kifu = SAMPLE.read_text(encoding="utf-8").strip()
        history, final_board = replay(kifu)
        self.assertEqual(len(history), 60)
        self.assertEqual(final_board.count(1), 37)
        self.assertEqual(final_board.count(2), 27)

    def test_analyser_finds_endgame_blunder(self):
        # In the sample game, White's 54th move G2 threw away a win
        # (best was G1). The endgame is solved exactly, so the analyser
        # must flag move 54 as a blunder for White.
        kifu = SAMPLE.read_text(encoding="utf-8").strip()
        # Shallow midgame search keeps the test fast; move 54 sits in the
        # exactly-solved endgame, so it is flagged regardless.
        analysis = analyse_game(kifu, 2, midgame_depth=4)
        flagged = {b["no"] for b in analysis["blunders"]}
        self.assertIn(54, flagged)
        self.assertEqual(analysis["final_score"], (37, 27))
        self.assertEqual(analysis["result"], "loss")


if __name__ == "__main__":
    unittest.main()
