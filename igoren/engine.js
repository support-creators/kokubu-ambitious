// 盤のルールと描画は、国分アンビシャス囲碁アプリ v0.5.1 の GoEngine / drawBoard と同じ動きになるように写したもの。
// 対局CPU・進級・記録の送信は含まない。
const GoEngine = (() => {
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const other = c => (c === BLACK ? WHITE : BLACK);

  class Board {
    constructor(size = 9) {
      this.size = size;
      this.grid = new Int8Array(size * size);
      this.ko = -1;          // コウで打てない点
      this.turn = BLACK;
      this.captures = { [BLACK]: 0, [WHITE]: 0 }; // 取った石の数
      this.history = [];     // まった用
      this.lastMove = -1;
      this.passes = 0;
    }
    idx(x, y) { return y * this.size + x; }
    xy(i) { return [i % this.size, Math.floor(i / this.size)]; }
    get(i) { return this.grid[i]; }
    neighbors(i) {
      const s = this.size, x = i % s, y = (i / s) | 0, n = [];
      if (x > 0) n.push(i - 1);
      if (x < s - 1) n.push(i + 1);
      if (y > 0) n.push(i - s);
      if (y < s - 1) n.push(i + s);
      return n;
    }
    // つながった石とダメ（呼吸点）
    group(i) {
      const color = this.grid[i];
      const stones = [], libs = new Set(), seen = new Set([i]);
      const stack = [i];
      while (stack.length) {
        const p = stack.pop();
        stones.push(p);
        for (const q of this.neighbors(p)) {
          const c = this.grid[q];
          if (c === EMPTY) libs.add(q);
          else if (c === color && !seen.has(q)) { seen.add(q); stack.push(q); }
        }
      }
      return { color, stones, libs };
    }
    snapshot() {
      return { grid: this.grid.slice(), ko: this.ko, turn: this.turn,
        captures: { ...this.captures }, lastMove: this.lastMove, passes: this.passes };
    }
    restore(s) {
      this.grid = s.grid.slice(); this.ko = s.ko; this.turn = s.turn;
      this.captures = { ...s.captures }; this.lastMove = s.lastMove; this.passes = s.passes;
    }
    // 打てるか確認だけ（盤面は変えない）
    check(i, color = this.turn) {
      if (i < 0 || i >= this.grid.length) return { ok: false, reason: 'outside' };
      if (this.grid[i] !== EMPTY) return { ok: false, reason: 'occupied' };
      if (i === this.ko) return { ok: false, reason: 'ko' };
      const s = this.snapshot();
      const r = this._place(i, color);
      this.restore(s);
      return r;
    }
    _place(i, color) {
      this.grid[i] = color;
      const captured = [];
      for (const q of this.neighbors(i)) {
        if (this.grid[q] === other(color)) {
          const g = this.group(q);
          if (g.libs.size === 0) for (const st of g.stones) {
            if (this.grid[st] !== EMPTY) { this.grid[st] = EMPTY; captured.push(st); }
          }
        }
      }
      const mine = this.group(i);
      if (mine.libs.size === 0) { this.grid[i] = EMPTY; return { ok: false, reason: 'suicide' }; }
      // 単純コウ: 1子取りで、打った石が1子・ダメ1つ
      this.ko = (captured.length === 1 && mine.stones.length === 1 && mine.libs.size === 1)
        ? captured[0] : -1;
      this.captures[color] += captured.length;
      return { ok: true, captured };
    }
    play(i, color = this.turn) {
      const c = this.check(i, color);
      if (!c.ok) return c;
      this.history.push(this.snapshot());
      const r = this._place(i, color);
      this.lastMove = i; this.turn = other(color); this.passes = 0;
      return r;
    }
    pass() {
      this.history.push(this.snapshot());
      this.ko = -1; this.lastMove = -1; this.turn = other(this.turn); this.passes++;
    }
    undo() {
      if (!this.history.length) return false;
      this.restore(this.history.pop());
      return true;
    }
    // アタリ（ダメ1つ）の石の一覧
    atariStones() {
      const res = new Set(), seen = new Set();
      for (let i = 0; i < this.grid.length; i++) {
        if (this.grid[i] === EMPTY || seen.has(i)) continue;
        const g = this.group(i);
        g.stones.forEach(s => seen.add(s));
        if (g.libs.size === 1) g.stones.forEach(s => res.add(s));
      }
      return res;
    }
  }
  return { Board, EMPTY, BLACK, WHITE, other };
})();
const SVGNS = 'http://www.w3.org/2000/svg';
function starPoints(n) {
  if (n === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
  const a = 3, b = n - 4, c = (n - 1) / 2;
  return n === 13 ? [[a, a], [a, b], [b, a], [b, b], [c, c]]
    : [[a, a], [a, b], [b, a], [b, b], [c, c], [a, c], [c, a], [b, c], [c, b]];
}
function fullView(n) { return { x0: 0, y0: 0, x1: n - 1, y1: n - 1 }; }
// 石と答えの まわりだけを 見せる（9路は ぜんぶ）
function autoView(board, extra = []) {
  const n = board.size; if (n <= 9) return fullView(n);
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  const add = i => { const [x, y] = board.xy(i); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (let i = 0; i < n * n; i++) if (board.get(i)) add(i);
  extra.forEach(add);
  if (x1 < 0) return fullView(n);
  x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
  if (x0 <= 2) x0 = 0; if (y0 <= 2) y0 = 0; if (x1 >= n - 3) x1 = n - 1; if (y1 >= n - 3) y1 = n - 1;
  const grow = (a, b) => { while (b - a < 6) { if (a > 0) a--; if (b - a < 6 && b < n - 1) b++; } return [a, b]; };
  [x0, x1] = grow(x0, x1); [y0, y1] = grow(y0, y1);
  return { x0, y0, x1, y1 };
}
function geomOf(board, view) {
  const v = view || fullView(board.size);
  const cols = v.x1 - v.x0 + 1, rows = v.y1 - v.y0 + 1, m = Math.max(cols, rows);
  const cell = m <= 9 ? 44 : m <= 13 ? 32 : 24, pad = cell * .8;
  return { v, cell, pad, Wd: pad * 2 + cell * (cols - 1), Ht: pad * 2 + cell * (rows - 1) };
}
function drawBoard(svg, board, opt = {}) {
  const n = board.size, { v, cell, pad, Wd, Ht } = geomOf(board, opt.view);
  const px = x => pad + (x - v.x0) * cell, py = y => pad + (y - v.y0) * cell;
  const el = (t, a) => { const e = document.createElementNS(SVGNS, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
  const id = svg.id;
  svg.setAttribute('viewBox', `0 0 ${Wd} ${Ht}`); svg.innerHTML = '';
  el('defs', {}).innerHTML = `
    <radialGradient id="${id}gb" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#6b6b6b"/><stop offset=".55" stop-color="#151515"/></radialGradient>
    <radialGradient id="${id}gw" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e4e4e4"/><stop offset="1" stop-color="#c9c9c9"/></radialGradient>
    <linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecc77e"/><stop offset="1" stop-color="#d9a957"/></linearGradient>`;
  el('rect', { width: Wd, height: Ht, rx: cell * .3, fill: `url(#${id}k)` });
  const sw = Math.max(1, cell / 32);
  const lx0 = v.x0 === 0 ? px(v.x0) : px(v.x0) - cell * .6, lx1 = v.x1 === n - 1 ? px(v.x1) : px(v.x1) + cell * .6;
  const ly0 = v.y0 === 0 ? py(v.y0) : py(v.y0) - cell * .6, ly1 = v.y1 === n - 1 ? py(v.y1) : py(v.y1) + cell * .6;
  for (let y = v.y0; y <= v.y1; y++) el('line', { x1: lx0, y1: py(y), x2: lx1, y2: py(y), stroke: '#5a4020', 'stroke-width': (y === 0 || y === n - 1) ? sw * 2 : sw });
  for (let x = v.x0; x <= v.x1; x++) el('line', { x1: px(x), y1: ly0, x2: px(x), y2: ly1, stroke: '#5a4020', 'stroke-width': (x === 0 || x === n - 1) ? sw * 2 : sw });
  starPoints(n).forEach(([x, y]) => { if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) el('circle', { cx: px(x), cy: py(y), r: cell * .09, fill: '#5a4020' }); });
  const r = cell * .47, atari = opt.atari ? board.atariStones() : new Set(), labels = opt.labels || {};
  for (let i = 0; i < n * n; i++) {
    const c = board.get(i), [x, y] = board.xy(i);
    if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
    if (c) {
      el('circle', { cx: px(x) + cell * .04, cy: py(y) + cell * .06, r, fill: 'rgba(0,0,0,.25)' });
      el('circle', { cx: px(x), cy: py(y), r, fill: `url(#${id}${c === GoEngine.BLACK ? 'gb' : 'gw'})` });
      if (atari.has(i)) el('circle', { cx: px(x), cy: py(y), r: r * 1.02, fill: 'none', stroke: '#e5483f', 'stroke-width': cell * .09 });
      if (i === board.lastMove && labels[i] == null) el('circle', { cx: px(x), cy: py(y), r: r * .32, fill: 'none', stroke: c === GoEngine.BLACK ? '#fff' : '#222', 'stroke-width': cell * .06 });
    }
    if (labels[i] != null) {
      const t = el('text', { x: px(x), y: py(y) + cell * .17, 'text-anchor': 'middle', 'font-size': cell * .46, 'font-weight': 800,
        fill: c === GoEngine.BLACK ? '#fff' : c === GoEngine.WHITE ? '#222' : '#c0392b', 'font-family': 'sans-serif' });
      t.textContent = labels[i];
    }
  }
  if (opt.terr) for (let i = 0; i < n * n; i++) { // 地のしるし
    const o = opt.terr[i], [x, y] = board.xy(i);
    if (!o || (board.get(i) && !(opt.dead && opt.dead.includes(i))) || x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
    const s = cell * .32; el('rect', { x: px(x) - s / 2, y: py(y) - s / 2, width: s, height: s, rx: s * .15, fill: o === GoEngine.BLACK ? '#1a1a1a' : '#fff', stroke: '#555', 'stroke-width': cell * .03 });
  }
  if (opt.dead) opt.dead.forEach(i => { const [x, y] = board.xy(i); if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) el('circle', { cx: px(x), cy: py(y), r, fill: '#e2b96a', opacity: .55 }); });
  const mark = (i, f) => { if (i == null || i < 0) return; const [x, y] = board.xy(i); if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) return; f(px(x), py(y)); };
  mark(opt.mark, (X, Y) => { const d = cell * .28; el('path', { d: `M${X - d} ${Y - d}L${X + d} ${Y + d}M${X + d} ${Y - d}L${X - d} ${Y + d}`, stroke: '#e5483f', 'stroke-width': cell * .12, 'stroke-linecap': 'round' }); });
  mark(opt.circle, (X, Y) => el('circle', { cx: X, cy: Y, r: cell * .3, fill: 'none', stroke: '#2f8f5b', 'stroke-width': cell * .1 }));
  if (opt.hover != null && opt.hover >= 0 && !board.get(opt.hover))
    mark(opt.hover, (X, Y) => el('circle', { cx: X, cy: Y, r, fill: (opt.hoverColor || board.turn) === GoEngine.BLACK ? '#111' : '#fff', opacity: .4 }));
}
function pointAt(svg, board, e, view) {
  const { v, cell, pad, Wd, Ht } = geomOf(board, view), rect = svg.getBoundingClientRect();
  const x = Math.round(((e.clientX - rect.left) * Wd / rect.width - pad) / cell) + v.x0;
  const y = Math.round(((e.clientY - rect.top) * Ht / rect.height - pad) / cell) + v.y0;
  return (x < v.x0 || y < v.y0 || x > v.x1 || y > v.y1) ? -1 : board.idx(x, y);
}
// 8とおりの まわし・うらがえし
function tf(sym, s, n) {
  let x = s.charCodeAt(0) - 97, y = s.charCodeAt(1) - 97;
  if (sym & 4) [x, y] = [y, x];
  if (sym & 1) x = n - 1 - x;
  if (sym & 2) y = n - 1 - y;
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y);
}
function tfTree(t, sym, n) {
  const o = {};
  for (const k in t) { const v = t[k]; o[tf(sym, k, n)] = { ...v, ...(v.reply ? { reply: tf(sym, v.reply, n) } : {}), ...(v.next ? { next: tfTree(v.next, sym, n) } : {}) }; }
  return o;
}
const toIdx = (b, s) => b.idx(s.charCodeAt(0) - 97, s.charCodeAt(1) - 97);
const toSgf = (b, i) => { const [x, y] = b.xy(i); return String.fromCharCode(97 + x) + String.fromCharCode(97 + y); };
function treeKeys(t, out = []) { for (const k in t) { out.push(k); if (t[k].reply) out.push(t[k].reply); if (t[k].next) treeKeys(t[k].next, out); } return out; }

function coordOk(s, n) {
  if (typeof s !== 'string' || s.length !== 2) return false;
  const x = s.charCodeAt(0) - 97, y = s.charCodeAt(1) - 97;
  return x >= 0 && y >= 0 && x < n && y < n;
}
// 初期配置の重なり、盤外、手順の非合法がないかを見る。問題データは変えない。
function igorenCheckProblem(p) {
  const issues = [];
  const n = p.size;
  if (n !== 9 && n !== 13 && n !== 19) issues.push('size');
  if (p.toPlay !== 'B' && p.toPlay !== 'W') issues.push('turn');
  if (p.source !== 'igoroku') issues.push('source');
  const b0 = new GoEngine.Board(n);
  const seen = new Set();
  const put = (s, color, tag) => {
    if (!coordOk(s, n)) { issues.push(tag + ' bad ' + s); return; }
    const i = b0.idx(s.charCodeAt(0) - 97, s.charCodeAt(1) - 97);
    if (seen.has(s) || b0.grid[i]) issues.push(tag + ' overlap ' + s);
    seen.add(s);
    b0.grid[i] = color;
  };
  (p.B || []).forEach(s => put(s, GoEngine.BLACK, 'B'));
  (p.W || []).forEach(s => put(s, GoEngine.WHITE, 'W'));
  for (const map of [p.labels, p.marks, p.later]) {
    if (!map) continue;
    for (const s in map) if (!coordOk(s, n)) issues.push('mark bad ' + s);
  }
  b0.turn = p.toPlay === 'W' ? GoEngine.WHITE : GoEngine.BLACK;
  let solutions = 0;
  const playAt = (board, s) => {
    if (!coordOk(s, n)) return { ok: false, reason: 'outside' };
    return board.play(board.idx(s.charCodeAt(0) - 97, s.charCodeAt(1) - 97));
  };
  const walk = (tree, snap) => {
    for (const k in tree) {
      const node = tree[k];
      const b = new GoEngine.Board(n);
      b.restore(snap);
      const r = playAt(b, k);
      if (!r.ok) { issues.push('illegal ' + k + ' ' + r.reason); continue; }
      if (node.ok) { solutions++; continue; }
      if (node.ng) {
        if (node.refute) {
          const t = new GoEngine.Board(n);
          t.restore(b.snapshot());
          for (const s of node.refute) {
            const rr = playAt(t, s);
            if (!rr.ok) { issues.push('refute ' + s + ' ' + rr.reason); break; }
          }
        }
        continue;
      }
      if (!node.reply) { issues.push('no reply ' + k); continue; }
      const rr = playAt(b, node.reply);
      if (!rr.ok) { issues.push('reply ' + node.reply + ' ' + rr.reason); continue; }
      if (node.win) { solutions++; continue; }
      walk(node.next || {}, b.snapshot());
    }
  };
  walk(p.tree || {}, b0.snapshot());
  if (!solutions) issues.push('no solution');
  return issues;
}
globalThis.GoEngine = GoEngine;
globalThis.drawBoard = drawBoard;
globalThis.pointAt = pointAt;
globalThis.autoView = autoView;
globalThis.geomOf = geomOf;
globalThis.fullView = fullView;
globalThis.toIdx = toIdx;
globalThis.toSgf = toSgf;
globalThis.treeKeys = treeKeys;
globalThis.igorenCheckProblem = igorenCheckProblem;
