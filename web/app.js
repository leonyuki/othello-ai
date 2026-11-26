'use strict';

/* ===== Othello engine (JavaScript port of othello/engine.py) ===== */

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const RAYS = [];
for (let sq = 0; sq < 64; sq++) {
  const r = Math.floor(sq / 8), c = sq % 8;
  const perSq = [];
  for (const [dr, dc] of DIRS) {
    const ray = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      ray.push(nr * 8 + nc);
      nr += dr; nc += dc;
    }
    perSq.push(ray);
  }
  RAYS.push(perSq);
}

const CORNERS = [0, 7, 56, 63];
const CORNER_ADJ = { 0: [1, 8, 9], 7: [6, 14, 15], 56: [48, 49, 57], 63: [54, 55, 62] };
const X_SQUARES = new Set([9, 14, 49, 54]);
const SQUARE_WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

const opponent = (p) => 3 - p;
const coord = (sq) => 'ABCDEFGH'[sq % 8] + String(Math.floor(sq / 8) + 1);

function initialBoard() {
  const b = new Array(64).fill(0);
  b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2;
  return b;
}

function flipsFor(board, sq, player) {
  if (board[sq] !== 0) return [];
  const opp = opponent(player);
  const flipped = [];
  for (const ray of RAYS[sq]) {
    const run = [];
    for (const s of ray) {
      if (board[s] === opp) run.push(s);
      else if (board[s] === player) { flipped.push(...run); break; }
      else break;
    }
  }
  return flipped;
}

function legalMoves(board, player) {
  const moves = new Map();
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq] === 0) {
      const f = flipsFor(board, sq, player);
      if (f.length) moves.set(sq, f);
    }
  }
  return moves;
}

function applyMove(board, sq, player, flips) {
  const b = board.slice();
  b[sq] = player;
  for (const s of flips) b[s] = player;
  return b;
}

function evaluate(board, player) {
  const opp = opponent(player);
  let score = 0;
  for (const corner of CORNERS) {
    if (board[corner] === player) score += 250;
    else if (board[corner] === opp) score -= 250;
    else {
      for (const adj of CORNER_ADJ[corner]) {
        const pen = X_SQUARES.has(adj) ? 12 : 18;
        if (board[adj] === player) score -= pen;
        else if (board[adj] === opp) score += pen;
      }
    }
  }
  let w = 0;
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq] === player) w += SQUARE_WEIGHTS[sq];
    else if (board[sq] === opp) w -= SQUARE_WEIGHTS[sq];
  }
  score += Math.floor(w / 4);
  score += (legalMoves(board, player).size - legalMoves(board, opp).size) * 8;
  return score;
}

function orderedMoves(board, player, moves) {
  return [...moves.entries()].sort((a, b) => {
    const ka = a[1].length + SQUARE_WEIGHTS[a[0]] / 10 + (CORNERS.includes(a[0]) ? 50 : 0);
    const kb = b[1].length + SQUARE_WEIGHTS[b[0]] / 10 + (CORNERS.includes(b[0]) ? 50 : 0);
    return kb - ka;
  });
}

function negamax(board, player, depth, alpha, beta, tt) {
  const moves = legalMoves(board, player);
  const opp = opponent(player);
  if (moves.size === 0) {
    if (legalMoves(board, opp).size === 0) {
      let diff = 0;
      for (const v of board) { if (v === player) diff++; else if (v === opp) diff--; }
      return diff * 10;
    }
    return -negamax(board, opp, depth, -beta, -alpha, tt);
  }
  if (depth === 0) return evaluate(board, player);
  const key = board.join('') + player + ':' + depth;
  const hit = tt.get(key);
  if (hit !== undefined) return hit;
  let best = -Infinity;
  const alpha0 = alpha;
  for (const [sq, flips] of orderedMoves(board, player, moves)) {
    const val = -negamax(applyMove(board, sq, player, flips), opp, depth - 1, -beta, -alpha, tt);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (alpha0 < best && best < beta) tt.set(key, best);
  return best;
}

const LEVELS = {
  1: { depth: 2, exact: 10, epsilon: 0.35, label: 'レベル1 入門' },
  2: { depth: 4, exact: 12, epsilon: 0.10, label: 'レベル2 中級' },
  3: { depth: 6, exact: 12, epsilon: 0.0, label: 'レベル3 上級' },
  4: { depth: 7, exact: 14, epsilon: 0.0, label: 'レベル4 最強' },
};

function aiBestMove(board, player, level) {
  const cfg = LEVELS[level];
  const empties = board.filter((v) => v === 0).length;
  const depth = empties <= cfg.exact ? empties : cfg.depth;
  const moves = legalMoves(board, player);
  if (moves.size === 0) return null;
  const tt = new Map();
  let bestSq = null, bestVal = -Infinity, alpha = -10000;
  for (const [sq, flips] of orderedMoves(board, player, moves)) {
    const val = -negamax(applyMove(board, sq, player, flips), opponent(player), depth - 1, -10000, -alpha, tt);
    if (val > bestVal) { bestSq = sq; bestVal = val; }
    alpha = Math.max(alpha, val);
  }
  if (cfg.epsilon && Math.random() < cfg.epsilon) {
    const keys = [...moves.keys()];
    return keys[Math.floor(Math.random() * keys.length)];
  }
  return bestSq;
}

/* ===== Game UI ===== */

const state = {
  board: initialBoard(),
  turn: 1,
  human: 1,
  level: 2,
  history: [], // squares in order
  boards: [],  // board before each move (for undo)
  over: false,
  thinking: false,
};

function el(id) { return document.getElementById(id); }

function render() {
  const boardEl = el('board');
  boardEl.innerHTML = '';
  const moves = (!state.over && state.turn === state.human && !state.thinking)
    ? legalMoves(state.board, state.turn) : new Map();
  const lastSq = state.history.length ? state.history[state.history.length - 1] : -1;
  for (let sq = 0; sq < 64; sq++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.setAttribute('aria-label', coord(sq));
    const v = state.board[sq];
    if (v !== 0) {
      const disc = document.createElement('span');
      disc.className = 'disc ' + (v === 1 ? 'black' : 'white') + (sq === lastSq ? ' last' : '');
      cell.appendChild(disc);
    } else if (moves.has(sq)) {
      const hint = document.createElement('span');
      hint.className = 'hint';
      cell.appendChild(hint);
      cell.classList.add('playable');
      cell.addEventListener('click', () => onHumanMove(sq));
    }
    boardEl.appendChild(cell);
  }
  const black = state.board.filter((v) => v === 1).length;
  const white = state.board.filter((v) => v === 2).length;
  el('score').textContent = `黒 ${black} - ${white} 白`;
  el('kifu').value = state.history.map(coord).join('');
  let status;
  if (state.over) {
    const mine = state.human === 1 ? black : white;
    const theirs = state.human === 1 ? white : black;
    status = mine > theirs ? `終局：あなたの勝ち（${black} - ${white}）`
      : mine < theirs ? `終局：AIの勝ち（${black} - ${white}）`
      : `終局：引き分け（${black} - ${white}）`;
  } else if (state.thinking) {
    status = 'AIが考え中…';
  } else if (state.turn === state.human) {
    status = `あなたの番です（${state.human === 1 ? '黒' : '白'}）`;
  } else {
    status = 'AIの番です';
  }
  el('status').textContent = status;
}

function playMove(sq) {
  const flips = legalMoves(state.board, state.turn).get(sq);
  state.boards.push(state.board);
  state.board = applyMove(state.board, sq, state.turn, flips);
  state.history.push(sq);
  state.turn = opponent(state.turn);
}

function advance() {
  // Handle passes and AI turns until it is the human's move or the game ends.
  render();
  while (!state.over) {
    const moves = legalMoves(state.board, state.turn);
    if (moves.size === 0) {
      if (legalMoves(state.board, opponent(state.turn)).size === 0) {
        state.over = true;
        render();
        return;
      }
      const who = state.turn === state.human ? 'あなた' : 'AI';
      state.turn = opponent(state.turn);
      render();
      el('status').textContent = `${who}はパスです`;
      continue;
    }
    if (state.turn === state.human) { render(); return; }
    state.thinking = true;
    render();
    setTimeout(() => {
      const sq = aiBestMove(state.board, state.turn, state.level);
      state.thinking = false;
      if (sq !== null) playMove(sq);
      advance();
    }, 250);
    return;
  }
}

function onHumanMove(sq) {
  if (state.over || state.thinking || state.turn !== state.human) return;
  playMove(sq);
  advance();
}

function newGame() {
  state.board = initialBoard();
  state.turn = 1;
  state.human = Number(el('color').value);
  state.level = Number(el('level').value);
  state.history = [];
  state.boards = [];
  state.over = false;
  state.thinking = false;
  advance();
}

function undo() {
  if (state.thinking || state.history.length === 0) return;
  // Take back moves until it is the human's turn again (normally 2 plies).
  let plies = 0;
  while (state.history.length > 0) {
    state.board = state.boards.pop();
    state.history.pop();
    state.turn = opponent(state.turn);
    plies++;
    if (state.turn === state.human && plies >= 2) break;
    if (state.turn === state.human && state.history.length === 0) break;
  }
  state.over = false;
  render();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    el('new-game').addEventListener('click', newGame);
    el('undo').addEventListener('click', undo);
    el('copy-kifu').addEventListener('click', async () => {
      el('kifu').select();
      try { await navigator.clipboard.writeText(el('kifu').value); } catch (e) { document.execCommand('copy'); }
      el('copy-kifu').textContent = 'コピーしました';
      setTimeout(() => { el('copy-kifu').textContent = '棋譜をコピー'; }, 1500);
    });
    el('mail-result').addEventListener('click', () => {
      const black = state.board.filter((v) => v === 1).length;
      const white = state.board.filter((v) => v === 2).length;
      const subject = 'オセロ対局結果';
      const lines = [
        'オセロの対局が終わりました。解析をお願いします。',
        '',
        `棋譜: ${state.history.map(coord).join('')}`,
        `自分の色: ${state.human === 1 ? '黒（先手）' : '白（後手）'}`,
        `結果: 黒 ${black} - ${white} 白（Web版AI レベル${state.level}との対戦）`,
      ];
      const url = 'mailto:muse-yuki0831@muse.ai'
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(lines.join('\n'));
      window.location.href = url;
    });
    newGame();
  });
}

if (typeof module !== 'undefined') {
  module.exports = { initialBoard, legalMoves, flipsFor, applyMove, aiBestMove, coord, LEVELS };
}
