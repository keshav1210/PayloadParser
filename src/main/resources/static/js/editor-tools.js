
'use strict';

const EditorTools = (() => {
  const DRAFT_KEY = 'jxe.draft:' + location.pathname;
  const MAX_DRAFT_CHARS = 2000000;
  const MAX_HISTORY = 50;

  const undoStack = [];
  const redoStack = [];
  let suppress = false;
  let lastProgrammatic = false;
  let saveTimer = null;
  let ready = false;
  let undoBtn, redoBtn;

  function hook(type, arg) {
    if (!ready) return;
    if (type === 'replace') {
      if (!suppress) {
        const current = getEditorText();
        if (current.trim() && current !== arg) {
          if (undoStack[undoStack.length - 1] !== current) undoStack.push(current);
          if (undoStack.length > MAX_HISTORY) undoStack.shift();
          redoStack.length = 0;
        }
        lastProgrammatic = true;
      }
      updateButtons();
      scheduleSave();
    } else if (type === 'edit') {
      lastProgrammatic = false;
      scheduleSave();
    } else if (type === 'doc') {
      Find.onDocChange(arg);
      Query.onDocChange(arg);
    }
  }

  function showInEditor(text) {
    suppress = true;
    try {
      let lang = 'plain';
      const detected = detectFormat(text);
      if (detected === 'json') { try { parseJsonAst(text); lang = 'json'; } catch (_) {  } }
      if (detected === 'xml')  { try { parseXmlDocument(text); lang = 'xml'; } catch (_) {  } }
      if (lang !== 'plain') setFormatType(lang);
      if (text) setLeft(text, lang); else clearAll();
    } finally {
      suppress = false;
    }
    if (text.trim()) formatCode(false, null, null, null, true);
    lastProgrammatic = true;
    updateButtons();
    scheduleSave();
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(getEditorText());
    showInEditor(undoStack.pop());
    setStatus(inputStatus, true, '↶ Undone');
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(getEditorText());
    showInEditor(redoStack.pop());
    setStatus(inputStatus, true, '↷ Redone');
    return true;
  }

  function updateButtons() {
    if (undoBtn) undoBtn.disabled = !undoStack.length;
    if (redoBtn) redoBtn.disabled = !redoStack.length;
  }

  function onKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey && lastProgrammatic && undoStack.length) {
      e.preventDefault();
      undo();
    } else if ((k === 'y' || (k === 'z' && e.shiftKey)) && lastProgrammatic && redoStack.length) {
      e.preventDefault();
      redo();
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 700);
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    try {
      const text = getEditorText();
      if (!text.trim() || text.length > MAX_DRAFT_CHARS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        text,
        type: formatTypeEl ? formatTypeEl.value : null,
        savedAt: Date.now(),
      }));
    } catch (_) {  }
  }

  function restoreDraft() {
    if (new URLSearchParams(location.search).has('drop')) return;
    if (getEditorText().trim()) return;
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) {  }
    if (!draft || !draft.text || !draft.text.trim()) return;
    if (draft.type) setFormatType(draft.type);
    showInEditor(draft.text);
    undoStack.length = 0;
    updateButtons();
    setStatus(inputStatus, null, '↺ Restored your text from last time. Click Clear to start fresh.');
  }

  function init() {
    if (typeof codeEditor === 'undefined' || !codeEditor) return;

    const leftBar = document.querySelector('#leftPanelHeader .panel-actions');
    if (leftBar) {
      undoBtn = makeActionBtn('↶', 'Undo Format / Repair / Sort / Clear (Ctrl+Z)', undo);
      redoBtn = makeActionBtn('↷', 'Redo (Ctrl+Y)', redo);
      undoBtn.classList.add('icon-only');
      redoBtn.classList.add('icon-only');
      leftBar.insertBefore(redoBtn, leftBar.firstChild);
      leftBar.insertBefore(undoBtn, leftBar.firstChild);
      leftBar.appendChild(makeActionBtn('⌕ Find', 'Find in the editor (Ctrl+F)', () => Find.open('left')));
      leftBar.appendChild(makeActionBtn('⇄ Replace', 'Find and replace in the editor (Ctrl+H)', () => Find.open('left', true)));
    }
    const rightBar = document.querySelector('#rightPanelHeader .panel-actions');
    if (rightBar) {
      rightBar.insertBefore(makeActionBtn('⌕ Find', 'Find in the output (Ctrl+F)', () => Find.open('right')), rightBar.firstChild);
      if (typeof JsonPath !== 'undefined') {
        rightBar.insertBefore(makeActionBtn('$ Query', 'Filter the data with a JSONPath query', () => Query.open()), rightBar.firstChild);
      }
    }

    codeEditor.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', saveDraft);
    ready = true;
    Find.init();
    Query.init();
    restoreDraft();
    updateButtons();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { hook, undo, redo, saveDraft };
})();


const Find = (() => {
  const MAX_MATCHES = 10000;
  const MAX_PAINTED = 2000;
  const HAS_HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  const state = {};

  function makeBar(side) {
    const panel = document.getElementById(side === 'left' ? 'leftPanel' : 'rightPanel');
    const header = document.getElementById(side === 'left' ? 'leftPanelHeader' : 'rightPanelHeader');
    if (!panel || !header) return null;

    const bar = el('div', 'find-bar');
    bar.hidden = true;
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = side === 'left' ? 'Find in editor' : 'Find in output';
    input.setAttribute('aria-label', input.placeholder);
    const count = el('span', 'find-count', '');
    const caseBtn = el('button', 'find-btn', 'Aa');
    caseBtn.title = 'Match case';
    caseBtn.setAttribute('aria-pressed', 'false');
    const regexBtn = el('button', 'find-btn', '.*');
    regexBtn.title = 'Use a regular expression';
    regexBtn.setAttribute('aria-pressed', 'false');
    const prev = el('button', 'find-btn', '↑');
    prev.title = 'Previous match (Shift+Enter)';
    const next = el('button', 'find-btn', '↓');
    next.title = 'Next match (Enter)';
    const close = el('button', 'find-btn', '✕');
    close.title = 'Close (Esc)';
    const buttons = [caseBtn, regexBtn, prev, next, close];
    let replaceToggle = null;
    if (side === 'left') {
      replaceToggle = el('button', 'find-btn', '⇄');
      replaceToggle.title = 'Find and replace (Ctrl+H)';
      replaceToggle.setAttribute('aria-pressed', 'false');
      buttons.unshift(replaceToggle);
    }
    buttons.forEach(b => { b.type = 'button'; });
    bar.append(input, count, ...buttons);
    header.after(bar);

    const st = { side, bar, input, count, caseBtn, regexBtn, matches: [], current: -1, caseSensitive: false, regex: false, timer: null, mode: 'code', after: null };

    if (side === 'left') {
      const rbar = el('div', 'find-bar replace-bar');
      rbar.hidden = true;
      const rinput = document.createElement('input');
      rinput.type = 'text';
      rinput.placeholder = 'Replace with';
      rinput.setAttribute('aria-label', 'Replace with');
      rinput.spellcheck = false;
      const one = el('button', 'find-btn find-act', 'Replace');
      one.title = 'Replace this match and go to the next one (Enter)';
      const all = el('button', 'find-btn find-act', 'Replace all');
      all.title = 'Replace every match (Ctrl+Alt+Enter)';
      [one, all].forEach(b => { b.type = 'button'; });
      rbar.append(rinput, one, all);
      bar.after(rbar);
      Object.assign(st, { rbar, rinput, replaceToggle });
      replaceToggle.addEventListener('click', () => showReplace(st, rbar.hidden));
      one.addEventListener('click', () => replaceOne(st));
      all.addEventListener('click', () => replaceAll(st));
      rinput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.altKey) { e.preventDefault(); replaceAll(st); }
        else if (e.key === 'Enter') { e.preventDefault(); replaceOne(st); }
        else if (e.key === 'Escape') { e.preventDefault(); closeBar(side); }
      });
    }

    input.addEventListener('input', () => { clearTimeout(st.timer); st.timer = setTimeout(() => run(st, true), 120); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); step(st, e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); closeBar(side); }
    });
    caseBtn.addEventListener('click', () => {
      st.caseSensitive = !st.caseSensitive;
      caseBtn.classList.toggle('on', st.caseSensitive);
      caseBtn.setAttribute('aria-pressed', String(st.caseSensitive));
      run(st, true);
    });
    regexBtn.addEventListener('click', () => {
      st.regex = !st.regex;
      regexBtn.classList.toggle('on', st.regex);
      regexBtn.setAttribute('aria-pressed', String(st.regex));
      run(st, true);
    });
    prev.addEventListener('click', () => step(st, -1));
    next.addEventListener('click', () => step(st, 1));
    close.addEventListener('click', () => closeBar(side));
    return st;
  }

  function showReplace(st, show) {
    if (!st.rbar) return;
    st.rbar.hidden = !show;
    st.replaceToggle.classList.toggle('on', show);
    st.replaceToggle.setAttribute('aria-pressed', String(show));
  }

  function buildRegex(st, flags = 'g') {
    const q = st.input.value;
    if (!q) return null;
    const src = st.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return new RegExp(src, flags + (st.caseSensitive ? '' : 'i') + 'u'); }
    catch (_) { return undefined; }
  }

  function writeEditor(st, text) {
    const top = codeEditor.scrollTop, left = codeEditor.scrollLeft;
    let lang = 'plain';
    const detected = detectFormat(text);
    if (detected === 'json') { try { parseJsonAst(text); lang = 'json'; } catch (_) { } }
    if (detected === 'xml') { try { parseXmlDocument(text); lang = 'xml'; } catch (_) { } }
    setLeft(text, lang);
    codeEditor.scrollTop = top;
    codeEditor.scrollLeft = left;
    syncLeftScroll();
    if (text.trim()) formatCode(false, null, null, null, true);
    clearTimeout(st.timer);
  }

  function replaceOne(st) {
    if (!st.matches.length) run(st, true);
    if (!st.matches.length || st.mode !== 'code') return;
    const m = st.matches[st.current < 0 ? 0 : st.current];
    const lines = getEditorText().split('\n');
    const line = lines[m.li];
    if (line === undefined) return;
    const repl = st.rinput.value;
    let updated;
    if (st.regex) {
      const re = buildRegex(st, 'y');
      if (!re) return;
      re.lastIndex = m.ci;
      updated = line.replace(re, repl);
    } else {
      updated = line.slice(0, m.ci) + repl + line.slice(m.ci + m.len);
    }
    if (updated === line) { step(st, 1); return; }
    const newLen = updated.length - (line.length - m.len);
    lines[m.li] = updated;
    writeEditor(st, lines.join('\n'));
    st.after = { li: m.li, ci: m.ci + Math.max(newLen, 0) + (newLen === 0 && m.len === 0 ? 1 : 0) };
    run(st, false);
  }

  function replaceAll(st) {
    const re = buildRegex(st);
    if (!re) { if (re === undefined) st.count.textContent = 'Invalid regex'; return; }
    const repl = st.rinput.value;
    let total = 0;
    const lines = getEditorText().split('\n').map(line => {
      re.lastIndex = 0;
      const hits = line.match(re);
      if (!hits) return line;
      total += hits.length;
      re.lastIndex = 0;
      return st.regex ? line.replace(re, repl) : line.replace(re, () => repl);
    });
    if (!total) { run(st, true); return; }
    writeEditor(st, lines.join('\n'));
    run(st, true);
    setStatus(inputStatus, true, `⇄ Replaced ${total.toLocaleString('en-US')} match${total === 1 ? '' : 'es'}. Press Ctrl+Z or ↶ to undo.`);
  }

  function open(side, withReplace) {
    const st = state[side];
    if (!st) return;
    st.bar.hidden = false;
    if (withReplace) showReplace(st, true);
    const sel = window.getSelection().toString();
    if (sel && sel.length < 100 && !sel.includes('\n')) st.input.value = sel;
    st.input.focus();
    st.input.select();
    run(st, true);
  }

  function closeBar(side) {
    const st = state[side];
    if (!st || st.bar.hidden) return;
    st.bar.hidden = true;
    showReplace(st, false);
    clearPaint(side);
    st.matches = [];
    st.current = -1;
    const focusTarget = side === 'left' ? codeEditor : (rightCodeEditor || rightTreeContent);
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function treeMode(side) {
    return side === 'right' && rightTreeContent && rightTreeContent.style.display !== 'none';
  }

  function run(st, resetCurrent) {
    const q = st.input.value;
    const previous = st.matches[st.current];
    st.matches = [];
    st.mode = treeMode(st.side) ? 'tree' : 'code';
    clearPaint(st.side);
    if (!q) { st.count.textContent = ''; st.current = -1; return; }

    const re = buildRegex(st);
    if (!re) {
      st.current = -1;
      st.count.textContent = 'Invalid regex';
      st.bar.classList.add('none');
      return;
    }
    if (st.mode === 'code') {
      const code = panelEls(st.side).code;
      const lines = Array.from(code.children, c => c.textContent);
      for (let li = 0; li < lines.length && st.matches.length < MAX_MATCHES; li++) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(lines[li])) && st.matches.length < MAX_MATCHES) {
          if (!m[0].length) { re.lastIndex++; continue; }
          st.matches.push({ li, ci: m.index, len: m[0].length });
        }
      }
    } else if (currentAst) {
      const single = buildRegex(st, '');
      const test = s => single.test(s);
      (function walk(node, path) {
        if (st.matches.length >= MAX_MATCHES) return;
        if (node.type === 'object') {
          node.entries.forEach(e => {
            const k = unquote(e.key.raw);
            if (test(k)) st.matches.push({ path: path.concat(k) });
            else if (!(e.value.type === 'object' || e.value.type === 'array') && test(leafText(e.value))) st.matches.push({ path: path.concat(k) });
            walk(e.value, path.concat(k));
          });
        } else if (node.type === 'array') {
          node.items.forEach((item, i) => {
            if (!(item.type === 'object' || item.type === 'array') && test(leafText(item))) st.matches.push({ path: path.concat(i) });
            walk(item, path.concat(i));
          });
        }
      })(currentAst, []);
    }

    if (!st.matches.length) {
      st.current = -1;
      st.count.textContent = 'No results';
      st.bar.classList.add('none');
      return;
    }
    st.bar.classList.remove('none');

    let start = 0;
    const from = st.after || previous;
    st.after = null;
    if (!resetCurrent && from && st.mode === 'code') {
      const k = st.matches.findIndex(m => m.li > from.li || (m.li === from.li && m.ci >= from.ci));
      start = k < 0 ? 0 : k;
    }
    paintAll(st);
    goTo(st, start);
  }

  function leafText(node) {
    return node.type === 'string' ? unquote(node.raw) : node.raw;
  }

  function step(st, dir) {
    if (!st.matches.length) { run(st, true); return; }
    goTo(st, (st.current + dir + st.matches.length) % st.matches.length);
  }

  function goTo(st, i) {
    st.current = i;
    const m = st.matches[i];
    st.count.textContent = `${i + 1} of ${st.matches.length}${st.matches.length >= MAX_MATCHES ? '+' : ''}`;

    if (st.mode === 'tree') {
      rightTreeContent.querySelectorAll('.find-row-current').forEach(r => r.classList.remove('find-row-current'));
      const entry = revealTreePath(m.path);
      if (entry) {
        entry.row.classList.add('find-row-current');
        scrollIntoPanel(rightTreeContent, entry.row);
      }
      return;
    }

    revealLine(st.side, m.li);
    const code = panelEls(st.side).code;
    const range = textRange(code, m.li, m.ci, m.len);
    if (HAS_HL && range) CSS.highlights.set('find-current-' + st.side, new Highlight(range));
    const line = code.children[m.li];
    if (line) scrollIntoPanel(code, line, range);
  }

  function revealLine(side, li) {
    folds[side].list.forEach(f => {
      if (f.folded && li > f.start && li <= f.end) {
        const icon = panelEls(side).icons.children[f.start];
        const toggle = icon && icon.querySelector('[data-fold]');
        if (toggle) toggleFold(side, toggle);
      }
    });
  }

  function scrollIntoPanel(container, row, range) {
    const top = row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    if (top < container.scrollTop + 20 || top > container.scrollTop + container.clientHeight - 60) {
      container.scrollTop = Math.max(0, top - container.clientHeight / 3);
    }
    if (range) {
      const r = range.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      if (r.left < c.left + 40 || r.right > c.right - 20) {
        container.scrollLeft += r.left - c.left - c.width / 3;
      }
    }
  }

  function paintAll(st) {
    if (!HAS_HL || st.mode !== 'code') return;
    const code = panelEls(st.side).code;
    const ranges = [];
    for (let k = 0; k < st.matches.length && k < MAX_PAINTED; k++) {
      const m = st.matches[k];
      const r = textRange(code, m.li, m.ci, m.len);
      if (r) ranges.push(r);
    }
    CSS.highlights.set('find-' + st.side, new Highlight(...ranges));
  }

  function clearPaint(side) {
    if (HAS_HL) {
      CSS.highlights.delete('find-' + side);
      CSS.highlights.delete('find-current-' + side);
    }
    if (side === 'right' && rightTreeContent) {
      rightTreeContent.querySelectorAll('.find-row-current').forEach(r => r.classList.remove('find-row-current'));
    }
  }

  function onDocChange(side) {
    const st = state[side];
    if (!st || st.bar.hidden || !st.input.value) return;
    clearTimeout(st.timer);
    st.timer = setTimeout(() => run(st, false), 200);
  }

  function init() {
    state.left = makeBar('left');
    state.right = makeBar('right');

    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'f' && key !== 'h') return;
      const active = document.activeElement;
      const inLeft = active && document.getElementById('leftPanel')?.contains(active);
      const inRight = active && document.getElementById('rightPanel')?.contains(active);
      if (key === 'h') {
        if (!inLeft) return;
        e.preventDefault();
        open('left', true);
        return;
      }
      if (!inLeft && !inRight) return;
      e.preventDefault();
      open(inLeft ? 'left' : 'right');
    });
  }

  return { init, open, close: closeBar, onDocChange };
})();


const Query = (() => {
  let bar, input, info, pathsToggle;
  let active = false, rendering = false, timer = null;

  const HELP = 'Examples:  $.customer.name   $..city   $.items[*].sku   $.items[0:2]   ' +
               '$.items[?(@.price < 10)]   $..[?(@.email =~ /example\.com$/i)]   $.items.length';

  function init() {
    const header = document.getElementById('rightPanelHeader');
    if (!header || typeof JsonPath === 'undefined') return;
    bar = el('div', 'find-bar query-bar');
    bar.hidden = true;
    const label = el('span', 'query-label', '$');
    input = document.createElement('input');
    input.type = 'text';
    input.spellcheck = false;
    input.placeholder = '$.items[?(@.price < 10)].name';
    input.setAttribute('aria-label', 'JSONPath query');
    input.title = HELP;
    info = el('span', 'find-count', '');
    const pathsWrap = el('label', 'query-paths');
    pathsToggle = document.createElement('input');
    pathsToggle.type = 'checkbox';
    pathsWrap.append(pathsToggle, ' paths');
    pathsWrap.title = 'Show the path of each match instead of its value';
    const help = el('button', 'find-btn', '?');
    help.type = 'button';
    help.title = HELP;
    help.addEventListener('click', () => { input.value = input.value || '$..city'; run(); input.focus(); });
    const close = el('button', 'find-btn', '✕');
    close.type = 'button';
    close.title = 'Close the query and show the whole document (Esc)';
    close.addEventListener('click', closeBar);
    bar.append(label, input, info, pathsWrap, help, close);
    const findBar = header.nextElementSibling && header.nextElementSibling.classList.contains('find-bar') ? header.nextElementSibling : header;
    findBar.after(bar);

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
      if (e.key === 'Escape') { e.preventDefault(); closeBar(); }
    });
    pathsToggle.addEventListener('change', run);
  }

  function open() {
    if (!bar) return;
    bar.hidden = false;
    input.focus();
    input.select();
    if (input.value.trim()) run();
  }

  function closeBar() {
    if (!bar) return;
    bar.hidden = true;
    const wasActive = active;
    active = false;
    if (wasActive && getEditorText().trim()) formatCode(false, null, null, null, true);
  }

  function run() {
    const q = input.value.trim();
    bar.classList.remove('none');
    if (!q) {
      info.textContent = '';
      if (active) { active = false; formatCode(false, null, null, null, true); }
      return;
    }
    if (!currentAst) {
      info.textContent = 'Fix the input first';
      bar.classList.add('none');
      return;
    }
    let results;
    try {
      results = JsonPath.query(currentAst, q);
    } catch (e) {
      info.textContent = e.message;
      bar.classList.add('none');
      return;
    }
    active = true;
    rendering = true;
    try {
      const text = pathsToggle.checked
        ? JSON.stringify(results.map(r => jsonPath(r.path)), null, 2)
        : astToText({ type: 'array', items: results.map(r => r.node) }, getIndent());
      showOutputText(text, 'json');
    } finally {
      rendering = false;
    }
    info.textContent = `${results.length} match${results.length === 1 ? '' : 'es'}`;
    setStatus(outputStatus, true, `JSONPath ${q}  ·  ${results.length} match${results.length === 1 ? '' : 'es'}`);
  }

  function onDocChange(side) {
    if (!active || rendering || side !== 'right') return;
    clearTimeout(timer);
    timer = setTimeout(run, 60);
  }

  return { init, open, close: closeBar, onDocChange, run };
})();
