// いごれん。答え合わせは元アプリの練習と同じ（せいかいの木、失敗、印のない分岐、あいての返事）。
(function () {
  'use strict';
  const KEY = 'igoren.v1';
  let DATA = null;
  const main = document.getElementById('main');
  const back = document.getElementById('back');
  const title = document.getElementById('title');
  const crumb = document.getElementById('crumb');

  if (typeof GoEngine === 'undefined') {
    main.textContent = 'もんだいが よめませんでした';
    return;
  }

  let problems = [];
  let books = [];
  let groups = [];
  let encPack = null;
  let opening = false;
  const bookById = id => books.find(b => b.id === id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let store = loadStore();
  let screen = 'home';
  let bookId = null;
  let play = null;
  let preferFit = false;
  let preferLarge = false;
  let downPt = null;
  const timers = new Set();
  const ui = {};

  function loadStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { solved: {} };
      const s = JSON.parse(raw);
      if (!s || typeof s.solved !== 'object' || !s.solved) return { solved: {} };
      return { solved: s.solved };
    } catch (e) {
      return { solved: {} };
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ solved: store.solved })); } catch (e) {}
  }
  function solvedCount(list) {
    let n = 0;
    for (const p of list) if (store.solved[p.id]) n++;
    return n;
  }
  function bookProblems(id) {
    return problems.filter(p => p.book === id);
  }
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers.clear();
  }
  function el(tag, attrs, kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'disabled') node.disabled = !!v;
        else if (v != null) node.setAttribute(k, v);
      }
    }
    (kids || []).forEach(c => { if (c) node.appendChild(c); });
    return node;
  }
  function goBack() {
    clearTimers();
    if (play) play.token++;
    if (screen === 'play' && bookId) showList(bookId);
    else showHome();
  }
  back.addEventListener('click', goBack);
  // 変更：スマホの回転やアドレスバーの出入りでも、盤の大きさを合わせ直す。
  function onViewportResize() {
    if (!play || !ui.svg) return;
    applyBoardWidth();
  }
  window.addEventListener('resize', onViewportResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);

  function showHome() {
    clearTimers();
    screen = 'home';
    main.classList.remove('playing'); // 変更：固定ボタン帯は問題画面だけに出す。
    play = null;
    bookId = null;
    back.hidden = true;
    title.textContent = 'いごれん';
    crumb.hidden = false;
    crumb.textContent = 'いごの もんだい';
    main.replaceChildren();
    const done = solvedCount(problems);
    const allDone = done === problems.length;
    const none = done === 0;
    const hero = el('button', {
      type: 'button',
      class: 'hero',
      id: 'nextBtn',
      text: allDone ? 'もういちど いちから' : none ? 'さいしょの もんだい' : 'つぎの もんだい'
    });
    hero.addEventListener('click', () => {
      const p = problems.find(x => !store.solved[x.id]) || problems[0];
      openProblem(p);
    });
    const summary = el('div', { class: 'summary' });
    summary.appendChild(el('p', { text: 'できた ' + done + ' / ' + problems.length }));
    const meter = el('div', { class: 'meter' });
    const bar = el('span');
    bar.style.width = (problems.length ? Math.round(done / problems.length * 100) : 0) + '%';
    meter.appendChild(bar);
    summary.appendChild(meter);
    main.append(hero, summary, el('p', { class: 'lead', text: 'もんだいを えらんで、ばんの うえを おしてね。' }));
    for (const g of groups) {
      main.appendChild(el('h2', { class: 'group-name', text: g.name }));
      const box = el('div', { class: 'books' });
      for (const b of books) {
        if (b.group !== g.id) continue;
        const list = bookProblems(b.id);
        const n = solvedCount(list);
        const btn = el('button', { type: 'button', class: 'book' + (n === list.length ? ' done' : ''), 'data-book': b.id });
        btn.append(
          el('span', { class: 'name', text: b.name }),
          el('span', { class: 'meta', text: b.note + '・' + list.length + 'もん' }),
          el('span', { class: 'meta', text: n === list.length ? 'ぜんぶ できた' : 'できた ' + n + ' / ' + list.length })
        );
        btn.addEventListener('click', () => showList(b.id));
        box.appendChild(btn);
      }
      main.appendChild(box);
    }
    window.scrollTo(0, 0);
  }

  function showList(id) {
    clearTimers();
    screen = 'list';
    main.classList.remove('playing'); // 変更
    play = null;
    bookId = id;
    const book = bookById(id);
    const list = bookProblems(id);
    back.hidden = false;
    title.textContent = book.name;
    const n = solvedCount(list);
    crumb.hidden = false;
    crumb.textContent = 'できた ' + n + ' / ' + list.length;
    main.replaceChildren();
    const open = list.find(p => !store.solved[p.id]) || list[0];
    const jump = el('button', {
      type: 'button',
      class: 'hero',
      id: 'listNext',
      text: n === list.length ? 'もういちど いちから' : n === 0 ? 'さいしょの もんだい' : 'つぎの もんだい'
    });
    jump.addEventListener('click', () => openProblem(open));
    main.appendChild(jump);
    const grid = el('div', { class: 'nums' });
    list.forEach(p => {
      const btn = el('button', {
        type: 'button',
        class: 'num' + (p.label.length >= 4 ? ' long' : '') + (store.solved[p.id] ? ' ok' : ''),
        'data-id': p.id
      });
      btn.appendChild(el('span', { text: p.label }));
      if (store.solved[p.id]) btn.appendChild(el('span', { class: 'star', text: '★', 'aria-hidden': 'true' }));
      btn.setAttribute('aria-label', store.solved[p.id] ? p.label + ' できた' : p.label);
      btn.addEventListener('click', () => openProblem(p));
      grid.appendChild(btn);
    });
    main.appendChild(grid);
    window.scrollTo(0, 0);
  }

  function openProblem(p) {
    const list = bookProblems(p.book);
    showPlay(list, list.findIndex(x => x.id === p.id));
  }

  function showPlay(list, index) {
    clearTimers();
    screen = 'play';
    main.classList.add('playing'); // 変更：スマホのボタン帯ぶんの余白を確保する。
    bookId = list[index].book;
    back.hidden = false;
    main.replaceChildren();
    const scroll = el('div', { class: 'board-scroll' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'board');
    svg.setAttribute('class', 'board');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'ばん');
    scroll.appendChild(svg);
    const card = el('div', { class: 'board-card' }, [scroll]);
    const panel = el('div', { class: 'panel' });
    const big = el('p', { class: 'kicker' });
    const nonum = el('p', { class: 'subline' });
    const same = el('p', { class: 'subline' });
    const ptitle = el('h2', { class: 'ptitle' });
    const sub = el('p', { class: 'subline' });
    const turn = el('p', { class: 'turn' });
    const stone = el('i', { class: 'st b', 'aria-hidden': 'true' });
    const turnText = el('span');
    turn.append(stone, turnText);
    const chip = el('span', { class: 'chip', text: 'できた' });
    const msg = el('div', { class: 'msg', role: 'status' });
    const explain = el('p', { class: 'explain' });
    const zoom = el('button', { type: 'button', class: 'zoom', text: 'ぜんたいを みる' });
    const actions = el('div', { class: 'actions' });
    const hint = el('button', { type: 'button', text: 'ヒント' });
    const retry = el('button', { type: 'button', text: 'もういちど' });
    const answer = el('button', { type: 'button', text: 'こたえを みる' });
    const prev = el('button', { type: 'button', text: 'まえへ' });
    const next = el('button', { type: 'button', class: 'main', text: 'つぎへ' });
    actions.append(hint, retry, answer, prev, next);
    panel.append(big, nonum, same, ptitle, sub, turn, chip, zoom, msg, explain, actions);
    const wrap = el('div', { class: 'play' }, [card, panel]);
    main.appendChild(wrap);
    Object.assign(ui, { scroll, svg, big, nonum, same, ptitle, sub, turn, stone, turnText, chip, msg, explain, zoom, actions, hint, retry, answer, prev, next }); // 変更：高さの計測用。
    hint.addEventListener('click', () => {
      if (!play || play.state !== 'play') return;
      play.hint = true;
      setMsg(play.problem.hint || 'よく みてみよう', 'hint');
      paint();
    });
    retry.addEventListener('click', onRetry);
    answer.addEventListener('click', showAnswer);
    prev.addEventListener('click', () => { if (play && play.index > 0) load(play.index - 1); });
    next.addEventListener('click', () => {
      if (!play) return;
      if (play.index < play.list.length - 1) load(play.index + 1);
      else showList(play.problem.book);
    });
    zoom.addEventListener('click', () => {
      if (narrowScreen()) preferLarge = !preferLarge;
      else preferFit = !preferFit;
      applyBoardWidth();
      requestAnimationFrame(centerScroll);
    });
    svg.addEventListener('pointerdown', e => { downPt = { x: e.clientX, y: e.clientY }; });
    svg.addEventListener('pointerleave', () => {
      downPt = null;
      if (!play || play.hover == null) return;
      play.hover = null;
      draw();
    });
    svg.addEventListener('pointermove', e => {
      if (!play || play.state !== 'play' || e.pointerType !== 'mouse') return;
      const i = pointAt(svg, play.board, e, play.view);
      if (i === play.hover) return;
      play.hover = i;
      draw();
    });
    svg.addEventListener('click', onBoardClick);
    play = { list, token: 0 };
    load(index);
  }

  function load(index) {
    clearTimers();
    if (narrowScreen()) preferLarge = false; // 変更：つぎの問題は必ず盤全体から見せる。
    const problem = play.list[index];
    const board = new GoEngine.Board(problem.size);
    (problem.B || []).forEach(s => { board.grid[toIdx(board, s)] = GoEngine.BLACK; });
    (problem.W || []).forEach(s => { board.grid[toIdx(board, s)] = GoEngine.WHITE; });
    board.turn = problem.toPlay === 'W' ? GoEngine.WHITE : GoEngine.BLACK;
    const labels = {};
    for (const s in (problem.marks || {})) labels[toIdx(board, s)] = problem.marks[s];
    for (const s in (problem.labels || {})) labels[toIdx(board, s)] = problem.labels[s];
    const laterMap = {};
    for (const s in (problem.later || {})) laterMap[toIdx(board, s)] = problem.later[s];
    const extra = treeKeys(problem.tree).concat(
      Object.keys(problem.labels || {}),
      Object.keys(problem.marks || {}),
      Object.keys(problem.later || {})
    ).map(s => toIdx(board, s));
    const view = autoView(board, extra);
    Object.assign(play, {
      index, problem, board, view,
      tree: problem.tree, node: problem.tree,
      labels, baseLabels: { ...labels }, later: laterMap,
      start: board.snapshot(),
      state: 'play', missed: false, shown: false, hint: false,
      mark: null, circle: null, hover: null,
      token: (play.token || 0) + 1,
      msg: 'どこに うつかな？', kind: ''
    });
    title.textContent = bookById(problem.book).name;
    crumb.hidden = false;
    crumb.textContent = (index + 1) + ' / ' + play.list.length;
    setExplain('');
    paint();
    requestAnimationFrame(() => { applyBoardWidth(); centerScroll(); });
    window.scrollTo(0, 0);
  }

  function resetBoard() {
    play.board.restore(play.start);
    play.board.history = [];
    play.node = play.tree;
    play.labels = { ...play.baseLabels };
    play.mark = null;
    play.circle = null;
    play.hover = null;
  }

  function setMsg(text, kind) {
    if (play) { play.msg = text; play.kind = kind || ''; }
    if (!ui.msg) return;
    ui.msg.textContent = text;
    ui.msg.className = 'msg' + (kind ? ' ' + kind : '');
  }
  function setExplain(text) {
    if (!ui.explain) return;
    ui.explain.hidden = !text;
    ui.explain.textContent = text || '';
  }

  function narrowScreen() {
    return window.matchMedia('(max-width: 899px)').matches;
  }
  // スマホは、はじめに盤ぜんたいを画面の幅へ合わせる。1マスが28pxより小さくなるときだけ大きくする。
  function minCss(view) {
    const cols = view.x1 - view.x0 + 1;
    if (!narrowScreen()) return 48 * (cols + 0.6);
    const g = geomOf(play.board, view);
    return 28 * g.Wd / g.cell;
  }
  function applyBoardWidth() {
    if (!play || !ui.svg) return;
    // 変更：スマホは画面の「残りの高さ」も使って盤を縮める。
    // SVGの実際の幅と縦横比をそろえるので、pointAt の座標計算は変えない。
    if (narrowScreen()) {
      const g = geomOf(play.board, play.view);
      const avail = ui.scroll.clientWidth;
      if (!avail) return;
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const boardTop = ui.scroll.getBoundingClientRect().top + window.scrollY;
      const actionHeight = ui.actions.getBoundingClientRect().height;
      const turnHeight = ui.turn.getBoundingClientRect().height;
      const msgHeight = ui.msg.getBoundingClientRect().height;
      // 変更：横向きでは手番とメッセージを盤の右へ置き、盤の高さを確保する。
      const landscape = window.matchMedia('(orientation: landscape) and (max-height: 550px)').matches;
      const otherHeight = landscape ? 12 : turnHeight + msgHeight + 38;
      const room = Math.max(120, Math.floor(viewportHeight - boardTop - actionHeight - otherHeight));
      const fitWidth = Math.max(1, Math.floor(Math.min(avail, room * g.Wd / g.Ht)));
      const need = minCss(play.view);
      const tight = need > fitWidth + 2;
      const wide = preferLarge && tight;
      const width = wide ? Math.ceil(need) : fitWidth;
      ui.svg.style.minWidth = '0';
      ui.svg.style.width = width + 'px';
      ui.svg.style.height = 'auto';
      ui.scroll.style.maxHeight = room + 'px';
      ui.scroll.style.overflowX = wide ? 'auto' : 'hidden';
      ui.scroll.style.overflowY = wide ? 'auto' : 'hidden';
      ui.zoom.hidden = !tight;
      ui.zoom.textContent = wide ? 'ぜんたいを みる' : 'おおきく みる';
      return;
    }
    // パソコンの表示と操作は変更しない。
    const need = minCss(play.view);
    const avail = ui.scroll.clientWidth || 0;
    const tight = avail > 0 && need > avail + 2;
    const fit = preferFit;
    ui.svg.style.minWidth = (fit && tight) ? '0px' : need + 'px';
    ui.svg.style.width = '100%';
    ui.svg.style.height = '';
    ui.scroll.style.maxHeight = '';
    ui.zoom.hidden = !tight;
    ui.zoom.textContent = fit ? 'おおきく みる' : 'ぜんたいを みる';
    ui.scroll.style.overflowX = '';
    ui.scroll.style.overflowY = '';
  }
  function centerScroll() {
    if (!play || !ui.scroll) return;
    const b = play.board, v = play.view, svg = ui.svg, sc = ui.scroll;
    if (!sc.clientWidth) return;
    let x0 = v.x1, y0 = v.y1, x1 = v.x0, y1 = v.y0, any = false;
    for (let i = 0; i < b.grid.length; i++) {
      if (!b.get(i)) continue;
      const [x, y] = b.xy(i);
      if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
      any = true;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (!any) return;
    const g = geomOf(b, v);
    const scale = svg.clientWidth / g.Wd;
    const cx = (g.pad + ((x0 + x1) / 2 - v.x0) * g.cell) * scale;
    const cy = (g.pad + ((y0 + y1) / 2 - v.y0) * g.cell) * scale;
    sc.scrollLeft = cx - sc.clientWidth / 2;
    sc.scrollTop = cy - sc.clientHeight / 2;
  }
  function draw() {
    if (!play) return;
    applyBoardWidth();
    drawBoard(ui.svg, play.board, {
      atari: !!play.hint,
      mark: play.mark,
      circle: play.circle,
      view: play.view,
      labels: play.labels,
      hover: play.hover,
      hoverColor: play.board.turn
    });
  }
  function paint() {
    const p = play.problem;
    const black = p.toPlay !== 'W';
    ui.big.textContent = p.label === 'なし' ? 'もんだい' : 'もんだい ' + p.label;
    ui.nonum.hidden = p.label !== 'なし';
    ui.nonum.textContent = 'ほんの ばんごうは かいてないよ';
    ui.same.hidden = !p.sameNum;
    ui.same.textContent = 'おなじ ばんごうの もんだいが もうひとつ あるよ';
    ui.ptitle.textContent = p.title;
    ui.sub.hidden = !p.sub;
    ui.sub.textContent = p.sub || '';
    ui.stone.className = 'st ' + (black ? 'b' : 'w');
    ui.turnText.textContent = (black ? 'くろ' : 'しろ') + 'の ばん' + (p.steps > 1 ? '（' + p.steps + 'て よもう）' : '');
    ui.chip.hidden = !store.solved[p.id];
    setMsg(play.msg, play.kind);
    const s = play.state;
    ui.hint.hidden = !(s === 'play' && !play.hint);
    ui.retry.hidden = !(s === 'wrong' || s === 'done' || s === 'shown');
    ui.answer.hidden = !(s === 'play' || s === 'wrong');
    ui.prev.disabled = play.index === 0;
    ui.next.textContent = play.index === play.list.length - 1 ? 'いちらんへ' : 'つぎへ';
    draw();
  }

  function onRetry() {
    if (!play) return;
    play.token++;
    clearTimers();
    resetBoard();
    play.state = 'play';
    setExplain('');
    setMsg('どこに うつかな？');
    paint();
  }

  function succeed(i) {
    play.state = 'done';
    play.circle = i;
    const fresh = !play.missed && !play.shown;
    if (!play.shown) {
      store.solved[play.problem.id] = 1;
      save();
    }
    if (fresh && play.hint) setMsg('せいかい！ ヒントで できたね', 'good');
    else if (fresh) setMsg('せいかい！', 'good');
    else setMsg('せいかい！ つぎは いちかいで できるかな', 'good');
    Object.assign(play.labels, play.later);
    setExplain(play.problem.explain || '');
    sound(fresh ? 'ok' : 'stone');
    paint();
  }

  function fail(i, node) {
    play.state = 'wrong';
    play.missed = true;
    const reply = node && node.refute && node.refute[0];
    if (reply) play.labels[i] = '1';
    else play.mark = i;
    setMsg('ざんねん！ もういちど かんがえてみよう', 'warn');
    setExplain(node && node.why ? node.why : '');
    sound('ng');
    paint();
    if (!reply) return;
    const token = play.token;
    const mine = play.problem;
    later(() => {
      if (!play || play.token !== token || play.problem !== mine || play.state !== 'wrong') return;
      const ri = toIdx(play.board, reply);
      if (play.board.play(ri).ok) {
        play.labels[ri] = '2';
        sound('stone');
        draw();
      }
    }, reduceMotion ? 0 : 650);
  }

  function onBoardClick(e) {
    if (!play || play.state !== 'play') return;
    if (downPt && Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 12) return;
    const i = pointAt(ui.svg, play.board, e, play.view);
    if (i < 0 || play.board.get(i)) return;
    const key = toSgf(play.board, i);
    const node = play.node[key];
    if (play.problem.choice && play.node === play.tree && !/^[A-Z]$/.test(play.labels[i] || '')) {
      setMsg('じるしの ついた ところから えらんでね', 'hint');
      return;
    }
    const r = play.board.play(i);
    if (!r.ok) {
      sound('ng');
      setMsg(r.reason === 'ko' ? 'こうだよ。そこは まだ うてないよ' : 'そこは うてないよ', 'warn');
      return;
    }
    if (node && node.unk) {
      play.board.undo();
      sound('stone');
      setMsg('その ても ありそう。でも べつの てを さがしてね', 'hint');
      return;
    }
    delete play.labels[i];
    play.hover = null;
    if (!node || node.ng) return fail(i, node);
    sound(r.captured && r.captured.length ? 'ok' : 'stone');
    if (node.ok) return succeed(i);
    play.state = 'wait';
    setMsg('あいての ばん', 'hint');
    paint();
    const token = play.token;
    const mine = play.problem;
    later(() => {
      if (!play || play.token !== token || play.problem !== mine) return;
      const ri = toIdx(play.board, node.reply);
      if (play.board.play(ri).ok) delete play.labels[ri];
      sound('stone');
      if (node.win) return succeed(i);
      play.node = node.next || {};
      play.state = 'play';
      setMsg('つぎは どこに うつ？');
      paint();
    }, reduceMotion ? 0 : 560);
  }

  function answerPath(tree) {
    for (const k in tree) if (tree[k].ok) return [k];
    for (const k in tree) {
      const n = tree[k];
      if (n.ng || !n.reply) continue;
      if (n.win) return [k, n.reply];
      const rest = answerPath(n.next || {});
      if (rest) return [k, n.reply].concat(rest);
    }
    return null;
  }
  function showAnswer() {
    if (!play || (play.state !== 'play' && play.state !== 'wrong')) return;
    play.token++;
    clearTimers();
    resetBoard();
    play.shown = true;
    play.state = 'showing';
    setExplain('');
    setMsg('こたえは こうだよ', 'hint');
    paint();
    const path = answerPath(play.tree) || [];
    const token = play.token;
    const mine = play.problem;
    let j = 0;
    const step = () => {
      if (!play || play.token !== token || play.problem !== mine) return;
      if (j >= path.length) {
        play.state = 'shown';
        Object.assign(play.labels, play.later);
        setExplain(play.problem.explain || '');
        paint();
        return;
      }
      const i = toIdx(play.board, path[j]);
      if (!play.board.play(i).ok) {
        play.state = 'shown';
        setMsg('うまく うてません', 'warn');
        paint();
        return;
      }
      play.labels[i] = String(j + 1);
      sound('stone');
      j++;
      draw();
      later(step, reduceMotion ? 0 : 700);
    };
    later(step, reduceMotion ? 0 : 400);
  }

  let audio;
  function sound(type) {
    try {
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      const resumed = audio.resume();
      if (resumed && resumed.catch) resumed.catch(() => {});
      const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.connect(g); g.connect(audio.destination);
      if (type === 'ok') {
        o.type = 'sine';
        [660, 880, 1320].forEach((f, k) => o.frequency.setValueAtTime(f, t + k * 0.08));
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        o.start(t); o.stop(t + 0.36);
      } else if (type === 'ng') {
        o.type = 'square';
        o.frequency.setValueAtTime(180, t);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      } else {
        o.type = 'triangle';
        o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(320, t + 0.05);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o.start(t); o.stop(t + 0.1);
      }
    } catch (e) {}
  }

  function b64ToBytes(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function loadPack() {
    if (encPack) return encPack;
    const res = await fetch('problems.enc.json', { cache: 'no-store' });
    if (!res.ok) {
      const err = new Error('load');
      throw err;
    }
    encPack = await res.json();
    return encPack;
  }
  async function decryptPack(pack, password) {
    if (!pack || pack.v !== 1 || pack.kdf !== 'PBKDF2-SHA256') throw new Error('format');
    const iterations = pack.iterations;
    if (!Number.isInteger(iterations) || iterations < 600000) throw new Error('format');
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64ToBytes(pack.salt), iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(pack.iv) },
      key,
      b64ToBytes(pack.data)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function begin(data) {
    DATA = data;
    problems = data.problems;
    books = data.books;
    groups = data.groups;
    window.IGOREN = data;
    showHome();
    globalThis.igoren = {
      get play() { return play; },
      get store() { return store; },
      key: KEY,
      problems: data.problems,
      openProblem,
      showHome,
      showList
    };
  }
  async function onUnlock(e) {
    e.preventDefault();
    if (opening) return;
    const input = document.getElementById('pass');
    const msg = document.getElementById('gateMsg');
    const button = document.getElementById('gateGo');
    const password = input.value;
    msg.hidden = false;
    if (!password) {
      msg.textContent = 'あいことばを いれてね';
      msg.className = 'msg hint';
      return;
    }
    opening = true;
    button.disabled = true;
    msg.textContent = 'あけています';
    msg.className = 'msg';
    try {
      const data = await decryptPack(await loadPack(), password);
      input.value = '';
      if (!data || !Array.isArray(data.problems)) throw new Error('shape');
      begin(data);
    } catch (err) {
      opening = false;
      button.disabled = false;
      msg.className = 'msg warn';
      if (err && err.message === 'load') msg.textContent = 'もんだいが よめませんでした';
      else if (err && err.name === 'OperationError') msg.textContent = 'あいことばが ちがうよ';
      else msg.textContent = 'もんだいが ひらけませんでした';
    }
  }
  function showGate() {
    screen = 'gate';
    main.classList.remove('playing'); // 変更
    play = null;
    bookId = null;
    back.hidden = true;
    title.textContent = 'いごれん';
    crumb.hidden = false;
    crumb.textContent = 'あいことばを いれてね';
    main.replaceChildren();
    const form = el('form', { class: 'gate', id: 'gateForm' });
    form.append(
      el('label', { for: 'pass', text: 'あいことば' }),
      el('input', { id: 'pass', type: 'password', autocomplete: 'current-password', autocapitalize: 'off', spellcheck: 'false' }),
      el('button', { type: 'submit', class: 'hero', id: 'gateGo', text: 'はじめる' }),
      el('p', { class: 'msg', id: 'gateMsg', role: 'status', hidden: 'hidden' })
    );
    form.addEventListener('submit', onUnlock);
    main.appendChild(form);
    window.scrollTo(0, 0);
  }
  showGate();
})();
