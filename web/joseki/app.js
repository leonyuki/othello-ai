"use strict";
/* 定石トレーナー: データ・エンジン・間隔反復ロジック（UIは後半） */

const JOSEKI = [
  { id: "tora", name: "虎定石", family: "虎系", take: "縦取り", seq: "F5D6C3D3C4", eval: -1.7,
    feature: "黒が白を上下に分断する形。上級者に好まれる本格派。",
    tip: "F5→D6の後、C3・D3・C4と打つと白が上下に割れる。3手目C3が虎の爪の入口と覚える。",
    image: "黒が中央に縦の線を作り、白が上下に分断されて挟まれた形。" },
  { id: "neko", name: "猫定石", family: "猫系", take: "縦取り", seq: "F5D6C4D3C5", eval: -2.9,
    feature: "猫系の代表格。バランスの取れた形になる。",
    tip: "虎と同じF5D6から3手目C4、4手目D3、5手目C5。3手目をC4にすると猫と覚える。",
    image: "白が縦に割れ、猫が背を丸めたように黒石がなめらかに並ぶ形。" },
  { id: "usagi", name: "兎定石", family: "兎系", take: "縦取り", seq: "F5D6C5F4E3", eval: -4.2,
    feature: "中央を割る「中割り」の形。最もよく使われる定石。",
    tip: "F5D6C5の後にF4・E3で中央を割る。最もよく使うので、まずこの形を基準に覚える。",
    image: "盤の中央が斜めに割れ、白石が散らばって兎が跳ねたような形。" },
  { id: "nousagi", name: "野兎定石", family: "野兎系", take: "縦取り", seq: "F5D6C6F4E6", eval: -3.8,
    feature: "兎の変化形。外側に広げて打つ。",
    tip: "兎と同じF5D6から、3手目C6で外側へ広げ、F4・E6と右上へ伸ばす。野生の兎の跳躍をイメージ。",
    image: "盤の外側へ黒石が広がり、白が斜めに伸びて跳ねた兎のような形。" },
  { id: "tsubame", name: "燕定石", family: "猫系", take: "縦取り", seq: "F5D6C4G5C6", eval: -1.9,
    feature: "猫系から白がG5へ伸ばす変化。",
    tip: "猫のC4まで同じで、4手目だけG5に変える。G5で翼を広げ、C6で締めくくる。",
    image: "盤の右側に黒石が翼のように広がり、燕が飛んでいるような形。" },
  { id: "kaba", name: "河馬定石", family: "猫系", take: "縦取り", seq: "F5D6C4F4C5", eval: -4.5,
    feature: "猫系から白がF4と大きく開く変化。",
    tip: "猫のF5D6C4まで同じで、4手目F4に変える。C5で仕上げ。F4が大きく開いた口に見える。",
    image: "盤の下側が大きく開き、河馬の口のように白が挟まれた形。" },
  { id: "inu", name: "犬定石", family: "虎系", take: "縦取り", seq: "F5D6C3F3D3", eval: -2.9,
    feature: "虎系から白がF3へ伸ばす変化。",
    tip: "虎と3手目C3まで同じ。4手目に白がD3でなくF3と横に伸ばし、5手目に黒がD3。虎との違いは4手目だけと覚える。",
    image: "白が上段に寄り、犬が前足を伸ばしたように黒石が横へ広がる形。" },
  { id: "ushi", name: "牛定石", family: "牛系", take: "斜め取り", seq: "F5F6E6", eval: -2.9,
    feature: "斜め取りから中央を割る、3手で完結する短い定石。",
    tip: "F5→F6→E6の3手で完結する短い定石。縦に2手並べて斜めに締める流れを一気に覚える。",
    image: "盤の中央右に黒石が三角形に集まり、白が小さく挟まれた形。" },
  { id: "hitsuji", name: "羊定石", family: "羊系", take: "斜め取り", seq: "F5F6D3C3C4", eval: -2.9,
    feature: "斜め取りから左へ伸ばす形。",
    tip: "F5F6から中央D3、C3、C4と左へ伸ばす。羊の毛がふわりと広がるように手が流れる。",
    image: "盤の左側へ黒石が細長く広がり、白がふわりと分散した形。" },
  { id: "nezumi", name: "鼠定石", family: "鼠系", take: "並び取り", seq: "F5F4E3", eval: -4.5,
    feature: "並び取りからE3で白を左右に分断する、3手完結の定石。",
    tip: "F5F4の後、E3で白を左右に分断して3手完結。E3を打つ瞬間を一番の決め手と覚える。",
    image: "白が横一列に左右へ分かれ、中央の黒石が細く挟む形。" },
];

/* --- エンジン（石: 0=空, 1=黒, 2=白） --- */
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
function initialBoard() {
  const b = new Array(64).fill(0);
  b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2; // D4白 E4黒 D5黒 E5白
  return b;
}
function flipsFor(board, sq, color) {
  if (board[sq] !== 0) return [];
  const opp = 3 - color, row = Math.floor(sq / 8), col = sq % 8, out = [];
  for (const [stepR, stepC] of DIRS) {
    let r = row + stepR, c = col + stepC;
    const cells = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === opp) {
      cells.push(r * 8 + c); r += stepR; c += stepC;
    }
    if (cells.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === color) out.push(...cells);
  }
  return out;
}
function legalMoves(board, color) {
  const res = [];
  for (let sq = 0; sq < 64; sq++) if (flipsFor(board, sq, color).length) res.push(sq);
  return res;
}
function applyMove(board, sq, color) {
  const flips = flipsFor(board, sq, color);
  if (!flips.length) return null;
  const b = board.slice();
  b[sq] = color;
  for (const f of flips) b[f] = color;
  return b;
}
function sqName(sq) { return "ABCDEFGH"[sq % 8] + (Math.floor(sq / 8) + 1); }
function sqFromName(name) {
  return (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 65);
}
function parseSeq(seq) {
  const moves = [];
  for (let i = 0; i < seq.length; i += 2) moves.push(sqFromName(seq.slice(i, i + 2)));
  return moves;
}
/* 手順を step 手目まで進めた盤面を返す（step=0 は初期局面）。不正手があれば null。 */
function replayMoves(seq, step) {
  let board = initialBoard(), color = 1;
  const moves = parseSeq(seq);
  const n = step === undefined ? moves.length : step;
  for (let i = 0; i < n; i++) {
    board = applyMove(board, moves[i], color);
    if (!board) return null;
    color = 3 - color;
  }
  return board;
}

/* --- 間隔反復（Leitner方式） --- */
const INTERVALS = [0, 1, 3, 7, 14, 30]; // box 0..5 に対応する次回までの日数
function fmtDate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayStr(offsetDays) {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return fmtDate(d);
}
function addDays(dateStr, days) {
  const p = dateStr.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}
function newItem() { return { box: 0, attempts: 0, correct: 0, last: null, due: todayStr(0) }; }
function gradeItem(item, isCorrect, today) {
  const it = Object.assign({}, item);
  it.attempts += 1;
  if (isCorrect) { it.correct += 1; it.box = Math.min(5, it.box + 1); }
  else { it.box = Math.max(0, it.box - 1); }
  const days = isCorrect ? INTERVALS[it.box] : Math.max(1, INTERVALS[it.box]);
  it.due = addDays(today, days);
  it.last = today;
  return it;
}
function statusOf(item) {
  if (!item || item.attempts === 0) return "new";
  return item.box >= 4 ? "mastered" : "learning";
}
const STATUS_LABEL = { new: "未テスト", learning: "学習中", mastered: "覚えた" };

/* 今日のテスト（5問）の対象定石を選ぶ: 期限到来→未テスト→boxが低い順 */
function pickDailyJoseki(items, today, count) {
  const all = JOSEKI.map(j => ({ j, it: items[j.id] || newItem() }));
  const due = all.filter(x => x.it.attempts > 0 && x.it.due <= today)
                 .sort((a, b) => (a.it.due < b.it.due ? -1 : a.it.due > b.it.due ? 1 : a.it.box - b.it.box));
  const fresh = all.filter(x => x.it.attempts === 0);
  const rest = all.filter(x => x.it.attempts > 0 && x.it.due > today)
                  .sort((a, b) => a.it.box - b.it.box);
  const picked = [];
  for (const x of [...due, ...fresh, ...rest]) {
    if (picked.length >= count) break;
    if (!picked.includes(x.j)) picked.push(x.j);
  }
  return picked;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { JOSEKI, initialBoard, legalMoves, applyMove, replayMoves, parseSeq, sqName, sqFromName, INTERVALS, gradeItem, statusOf, newItem, pickDailyJoseki };
}

/* --- UI（ブラウザでのみ動作） --- */
if (typeof document !== "undefined") {
  const STORE_KEY = "josekiTrainerV1";
  const $ = (id) => document.getElementById(id);
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };

  let store = loadStore();
  function loadStore() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.items) return s; } catch (e) {}
    return { items: {}, daily: { date: null, done: 0, correct: 0, finished: false } };
  }
  function saveStore() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
  function itemOf(id) { if (!store.items[id]) store.items[id] = newItem(); return store.items[id]; }
  function byId(id) { return JOSEKI.find(j => j.id === id); }

  function renderBoard(el, board, opts) {
    opts = opts || {};
    el.innerHTML = "";
    for (let sq = 0; sq < 64; sq++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (opts.lastMove === sq) cell.classList.add("last-move");
      if (board[sq]) {
        const d = document.createElement("div");
        d.className = "disc " + (board[sq] === 1 ? "black" : "white");
        cell.appendChild(d);
      } else if (opts.hints && opts.hints.includes(sq)) {
        const h = document.createElement("div"); h.className = "hint-dot"; cell.appendChild(h);
      }
      if (opts.playable && opts.playable.includes(sq)) {
        cell.classList.add("playable");
        cell.addEventListener("click", () => opts.onTap(sq, cell));
      }
      el.appendChild(cell);
    }
  }
  function empties(board) { const r = []; for (let i = 0; i < 64; i++) if (!board[i]) r.push(i); return r; }
  function chipHTML(item) {
    const st = statusOf(item);
    return `<span class="chip ${st}">${STATUS_LABEL[st]}</span>`;
  }
  function boxDots(box) { return "●".repeat(box) + "○".repeat(5 - box); }

  /* タブ */
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
      if (btn.dataset.tab === "progress") renderProgress();
      if (btn.dataset.tab === "test") renderDailyStatus();
      stopAutoPlay();
    });
  });

  /* 学習モード */
  let studyId = "tora", studyStep = 0, playTimer = null;
  function stopAutoPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; $("btn-play").textContent = "自動再生"; } }
  function selectJoseki(id) {
    studyId = id; studyStep = 0; stopAutoPlay();
    const j = byId(id), it = itemOf(id);
    $("detail-name").textContent = j.name;
    $("detail-meta").textContent = `${j.take}・${j.family}／評価値 ${j.eval > 0 ? "+" : ""}${j.eval}（黒視点・石差）`;
    $("detail-seq").textContent = j.seq;
    $("detail-feature").textContent = j.feature;
    $("detail-tip").textContent = j.tip;
    $("detail-image").textContent = j.image;
    $("detail-status").innerHTML = `状態: ${chipHTML(it)} 習熟度 <span class="boxdots">${boxDots(it.box)}</span> 正解 ${it.correct}/${it.attempts} 回`;
    renderStudy();
  }
  function renderStudy() {
    const j = byId(studyId), moves = parseSeq(j.seq);
    const board = replayMoves(j.seq, studyStep);
    renderBoard($("board-learn"), board, { lastMove: studyStep > 0 ? moves[studyStep - 1] : -1 });
    $("study-info").textContent = studyStep === 0 ? "初期局面" :
      `${studyStep}手目: ${sqName(moves[studyStep - 1])}（${studyStep % 2 === 1 ? "黒" : "白"}）`;
  }
  $("btn-first").addEventListener("click", () => { stopAutoPlay(); studyStep = 0; renderStudy(); });
  $("btn-prev").addEventListener("click", () => { stopAutoPlay(); if (studyStep > 0) { studyStep--; renderStudy(); } });
  $("btn-next").addEventListener("click", () => { stopAutoPlay(); const n = parseSeq(byId(studyId).seq).length; if (studyStep < n) { studyStep++; renderStudy(); } });
  $("btn-last").addEventListener("click", () => { stopAutoPlay(); studyStep = parseSeq(byId(studyId).seq).length; renderStudy(); });
  $("btn-play").addEventListener("click", () => {
    if (playTimer) { stopAutoPlay(); return; }
    const n = parseSeq(byId(studyId).seq).length;
    if (studyStep >= n) studyStep = 0;
    $("btn-play").textContent = "停止";
    playTimer = setInterval(() => {
      if (studyStep < n) { studyStep++; renderStudy(); }
      if (studyStep >= n) stopAutoPlay();
    }, 900);
    renderStudy();
  });
  function renderJosekiList() {
    const el = $("joseki-list");
    el.innerHTML = "";
    for (const j of JOSEKI) {
      const it = itemOf(j.id);
      const card = document.createElement("button");
      card.className = "card";
      card.innerHTML = `<h4>${j.name} ${chipHTML(it)}</h4><p>${j.take}・${j.family}／${j.seq}</p><p>${j.feature}</p>`;
      card.addEventListener("click", () => selectJoseki(j.id));
      el.appendChild(card);
    }
  }

  /* テスト */
  const FORMAT_LABEL = { next: "次の一手", replay: "手順再現", name: "名前当て" };
  let session = null;
  function renderDailyStatus() {
    const today = todayStr(0);
    const dueCount = JOSEKI.filter(j => { const it = store.items[j.id]; return it && it.attempts > 0 && it.due <= today; }).length;
    if (store.daily.date === today && store.daily.finished) {
      $("daily-status").textContent = `今日のテストは完了しました（${store.daily.correct}/5 正解）。`;
      $("btn-daily").textContent = "もう一度受ける（5問）";
    } else {
      $("daily-status").textContent = `未実施です。再出題の期限が来ている定石: ${dueCount}件`;
      $("btn-daily").textContent = "今日のテストを始める（5問）";
    }
  }
  function makeQuestion(joseki, format) {
    const moves = parseSeq(joseki.seq);
    if (format === "next") {
      const prefix = 1 + Math.floor(Math.random() * (moves.length - 1));
      return { joseki, format, prefix, answer: moves[prefix] };
    }
    if (format === "replay") return { joseki, format, step: 0, mistakes: 0, board: initialBoard() };
    const others = shuffle(JOSEKI.filter(j => j.id !== joseki.id)).slice(0, 3);
    return { joseki, format, choices: shuffle([joseki].concat(others)) };
  }
  function startDaily() {
    const picked = pickDailyJoseki(store.items, todayStr(0), 5);
    const formats = shuffle(["next", "replay", "name", "next", "replay"]);
    session = { mode: "daily", queue: picked.map((j, i) => makeQuestion(j, formats[i % formats.length])), idx: 0, results: [], current: null, answered: false };
    showPlay(); nextQuestion();
  }
  function startFree(format) {
    session = { mode: "free", format, queue: [], idx: 0, results: [], current: null, answered: false };
    showPlay(); nextQuestion();
  }
  function showPlay() {
    $("test-home").classList.add("hidden");
    $("test-result").classList.add("hidden");
    $("test-play").classList.remove("hidden");
  }
  function showHome() {
    $("test-play").classList.add("hidden");
    $("test-result").classList.add("hidden");
    $("test-home").classList.remove("hidden");
    renderDailyStatus(); renderJosekiList();
  }
  function nextQuestion() {
    if (session.mode === "daily" && session.idx >= session.queue.length) { showResults(); return; }
    let q;
    if (session.mode === "daily") q = session.queue[session.idx];
    else {
      const j = JOSEKI[Math.floor(Math.random() * JOSEKI.length)];
      const f = session.format === "mix" ? ["next", "replay", "name"][Math.floor(Math.random() * 3)] : session.format;
      q = makeQuestion(j, f);
    }
    session.current = q; session.answered = false;
    renderQuestion(q);
  }
  function renderQuestion(q) {
    const j = q.joseki, moves = parseSeq(j.seq);
    $("q-progress").textContent = session.mode === "daily" ? `今日のテスト ${session.idx + 1} / ${session.queue.length}` : `自由テスト（終了 ${session.results.length} 問）`;
    $("q-title").textContent = FORMAT_LABEL[q.format];
    $("q-feedback").textContent = ""; $("q-feedback").className = "feedback";
    $("btn-next-q").classList.add("hidden");
    $("q-choices").classList.add("hidden"); $("q-choices").innerHTML = "";
    $("board-test").classList.remove("hidden");
    if (q.format === "next") {
      const board = replayMoves(j.seq, q.prefix);
      const color = q.prefix % 2 === 0 ? 1 : 2;
      $("q-text").textContent = `${j.name}の ${q.prefix} 手目まで進んだ局面です。${color === 1 ? "黒" : "白"}の次の一手を打ってください。`;
      renderBoard($("board-test"), board, { hints: legalMoves(board, color), playable: empties(board), lastMove: moves[q.prefix - 1], onTap: (sq, cell) => answerNext(q, sq, cell) });
    } else if (q.format === "replay") {
      $("q-text").textContent = `${j.name}を最初から最後まで打ってください。`;
      renderReplay(q);
    } else {
      const board = replayMoves(j.seq);
      $("q-text").textContent = "この形の定石はどれでしょう？";
      renderBoard($("board-test"), board, { lastMove: moves[moves.length - 1] });
      const box = $("q-choices");
      box.classList.remove("hidden");
      for (const c of q.choices) {
        const b = document.createElement("button");
        b.textContent = c.name;
        b.addEventListener("click", () => answerName(q, c, b));
        box.appendChild(b);
      }
    }
  }
  function renderReplay(q) {
    const moves = parseSeq(q.joseki.seq);
    const color = q.step % 2 === 0 ? 1 : 2;
    renderBoard($("board-test"), q.board, {
      hints: legalMoves(q.board, color), playable: empties(q.board),
      lastMove: q.step > 0 ? moves[q.step - 1] : -1,
      onTap: (sq, cell) => answerReplay(q, sq, cell),
    });
  }
  function flash(cell, ok) {
    cell.classList.add(ok ? "correct-flash" : "wrong-flash");
    setTimeout(() => cell.classList.remove("correct-flash", "wrong-flash"), 700);
  }
  function finishQuestion(q, isCorrect, feedbackHTML) {
    session.answered = true;
    const it = gradeItem(itemOf(q.joseki.id), isCorrect, todayStr(0));
    store.items[q.joseki.id] = it; saveStore();
    session.results.push({ joseki: q.joseki, format: q.format, correct: isCorrect });
    const fb = $("q-feedback");
    fb.innerHTML = feedbackHTML;
    fb.className = "feedback " + (isCorrect ? "ok" : "ng");
    $("btn-next-q").classList.remove("hidden");
    $("btn-next-q").textContent = session.mode === "daily" && session.idx + 1 >= session.queue.length ? "結果を見る" : "次の問題へ";
  }
  function answerNext(q, sq, cell) {
    if (session.answered) return;
    const ok = sq === q.answer;
    flash(cell, ok);
    finishQuestion(q, ok, ok ? `正解！ ${sqName(q.answer)} です。` :
      `不正解。正解は ${sqName(q.answer)}（${q.joseki.name}: ${q.joseki.seq}）`);
    const board = replayMoves(q.joseki.seq, q.prefix + 1);
    renderBoard($("board-test"), board, { lastMove: q.answer });
  }
  function answerReplay(q, sq, cell) {
    if (session.answered) return;
    const moves = parseSeq(q.joseki.seq);
    const color = q.step % 2 === 0 ? 1 : 2;
    if (sq === moves[q.step]) {
      flash(cell, true);
      q.board = applyMove(q.board, sq, color);
      q.step++;
      if (q.step >= moves.length) {
        const perfect = q.mistakes === 0;
        finishQuestion(q, perfect, perfect ? `完璧です！ ${q.joseki.name}を打ち切りました。` :
          `打ち切りました（ミス ${q.mistakes} 回）。手順: ${q.joseki.seq}`);
      } else renderReplay(q);
    } else {
      flash(cell, false);
      q.mistakes++;
      $("q-feedback").textContent = `違います（ミス ${q.mistakes} 回）。正しい手を探してください。`;
      $("q-feedback").className = "feedback ng";
    }
  }
  function answerName(q, chosen, btn) {
    if (session.answered) return;
    const ok = chosen.id === q.joseki.id;
    btn.classList.add(ok ? "correct-flash" : "wrong-flash");
    finishQuestion(q, ok, ok ? `正解！ ${q.joseki.name}です。${q.joseki.feature}` :
      `不正解。正解は ${q.joseki.name}（${q.joseki.seq}）。${q.joseki.feature}`);
  }
  $("btn-giveup").addEventListener("click", () => {
    const q = session && session.current;
    if (!q || session.answered) return;
    if (q.format === "next") finishQuestion(q, false, `正解は ${sqName(q.answer)}（${q.joseki.name}: ${q.joseki.seq}）`);
    else if (q.format === "replay") finishQuestion(q, false, `${q.joseki.name}の手順: ${q.joseki.seq}`);
    else finishQuestion(q, false, `正解は ${q.joseki.name}（${q.joseki.seq}）。${q.joseki.feature}`);
  });
  $("btn-next-q").addEventListener("click", () => { session.idx++; nextQuestion(); });
  $("btn-quit-test").addEventListener("click", () => { session = null; showHome(); });
  $("btn-daily").addEventListener("click", startDaily);
  document.querySelectorAll("[data-free]").forEach(b => b.addEventListener("click", () => startFree(b.dataset.free)));
  $("btn-back-home").addEventListener("click", showHome);
  function showResults() {
    const correct = session.results.filter(r => r.correct).length;
    store.daily = { date: todayStr(0), done: session.results.length, correct, finished: true };
    saveStore();
    $("test-play").classList.add("hidden");
    $("test-result").classList.remove("hidden");
    $("result-summary").textContent = `${session.results.length}問中 ${correct}問正解でした。`;
    const el = $("result-list");
    el.innerHTML = "";
    for (const r of session.results) {
      const it = itemOf(r.joseki.id);
      const p = document.createElement("p");
      p.innerHTML = `${r.correct ? "○" : "×"} ${r.joseki.name}（${FORMAT_LABEL[r.format]}） ${chipHTML(it)}`;
      el.appendChild(p);
    }
    renderJosekiList();
  }

  /* 進捗 */
  function renderProgress() {
    const counts = { new: 0, learning: 0, mastered: 0 };
    for (const j of JOSEKI) counts[statusOf(store.items[j.id])]++;
    $("progress-summary").textContent = `覚えた ${counts.mastered} / 学習中 ${counts.learning} / 未テスト ${counts.new}（全${JOSEKI.length}定石）`;
    const el = $("progress-list");
    el.innerHTML = "";
    for (const j of JOSEKI) {
      const it = itemOf(j.id);
      const rate = it.attempts ? Math.round(it.correct / it.attempts * 100) : "-";
      const card = document.createElement("button");
      card.className = "card";
      card.innerHTML = `<h4>${j.name} ${chipHTML(it)}</h4>` +
        `<p>習熟度 <span class="boxdots">${boxDots(it.box)}</span>／正解率 ${rate}%（${it.correct}/${it.attempts}）</p>` +
        `<p>次回テスト: ${it.attempts === 0 ? "未実施（今日のテスト対象）" : it.due <= todayStr(0) ? "期限到来" : it.due}</p>`;
      card.addEventListener("click", () => {
        document.querySelector('.tab[data-tab="learn"]').click();
        selectJoseki(j.id);
      });
      el.appendChild(card);
    }
  }
  $("btn-reset").addEventListener("click", () => {
    if (!confirm("テスト記録をすべて消します。よろしいですか？")) return;
    localStorage.removeItem(STORE_KEY);
    store = loadStore();
    renderJosekiList(); renderDailyStatus(); renderProgress(); selectJoseki(studyId);
  });

  renderJosekiList();
  selectJoseki("tora");
  renderDailyStatus();
}
