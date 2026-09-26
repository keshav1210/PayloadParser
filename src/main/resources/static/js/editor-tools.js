/* ============================================================
   editor-tools.js - undo/redo, autosave and find for the editor pages.
   Loaded after jsonxmlformatter.js, which calls EditorTools.hook().
   ============================================================ */

'use strict';

const EditorTools = (() => {
  const DRAFT_KEY = 'jxe.draft:' + location.pathname;
  const MAX_DRAFT_CHARS = 2000000;     // stay well inside the ~5 MB localStorage quota
  const MAX_HISTORY = 50;

  const undoStack = [];
  const redoStack = [];
  let suppress = false;          // true while we restore text ourselves
  let lastProgrammatic = false;  // last change came from Format/Repair/Sort/… (native undo can't revert it)
  let saveTimer = null;
  let ready = false;
  let undoBtn, redoBtn;

  // ── called by jsonxmlformatter.js ─────────────────────────────────────────
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

  // ── Undo / redo for whole-document changes ────────────────────────────────
  // Typing is handled by the browser's own undo; this covers Format, Minify,
  // Repair, Sort, Clear, Load Sample, file uploads and pastes that replace everything.
  function showInEditor(text) {
    suppress = true;
    try {
      let lang = 'plain';
      const detected = detectFormat(text);
      if (detected === 'json') { try { parseJsonAst(text); lang = 'json'; } catch (_) { /* invalid */ } }
      if (detected === 'xml')  { try { parseXmlDocument(text); lang = 'xml'; } catch (_) { /* invalid */ } }
      if (lang !== 'plain') setFormatType(lang);
      if (text) setLeft(text, lang); else clearAll();
    } finally {
      suppress = false;
    }
    if (text.trim()) formatCode(false, null, null, null, true);   // refresh the right panel
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

  // ── Autosave (this browser only) ──────────────────────────────────────────
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
    } catch (_) { /* storage full or disabled */ }
  }

  function restoreDraft() {
    if (new URLSearchParams(location.search).has('drop')) return;   // a shared drop is loading
    if (getEditorText().trim()) return;
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { /* ignore */ }
    if (!draft || !draft.text || !draft.text.trim()) return;
    if (draft.type) setFormatType(draft.type);
    showInEditor(draft.text);
    undoStack.length = 0;
    updateButtons();
    setStatus(inputStatus, null, '↺ Restored your text from last time. Click Clear to start fresh.');
  }

  // ── Setup ────────────────────────────────────────────────────────────────
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


/* ─────────────────────────────── Find ─────────────────────────────── */
const Find = (() => {
  const MAX_MATCHES = 10000;
  const MAX_PAINTED = 2000;
  const HAS_HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  const state = {};   // side → { bar, input, count, caseBtn, matches, current, caseSensitive, timer }

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
    const prev = el('button', 'find-btn', '↑');
    prev.title = 'Previous match (Shift+Enter)';
    const next = el('button', 'find-btn', '↓');
    next.title = 'Next match (Enter)';
    const close = el('button', 'find-btn', '✕');
    close.title = 'Close (Esc)';
    [caseBtn, prev, next, close].forEach(b => { b.type = 'button'; });
    bar.append(input, count, caseBtn, prev, next, close);
    header.after(bar);

    const st = { side, bar, input, count, caseBtn, matches: [], current: -1, caseSensitive: false, timer: null, mode: 'code' };
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
    prev.addEventListener('click', () => step(st, -1));
    next.addEventListener('click', () => step(st, 1));
    close.addEventListener('click', () => closeBar(side));
    return st;
  }

  function open(side) {
    const st = state[side];
    if (!st) return;
    st.bar.hidden = false;
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

    const needle = st.caseSensitive ? q : q.toLowerCase();
    if (st.mode === 'code') {
      const code = panelEls(st.side).code;
      const lines = Array.from(code.children, c => c.textContent);
      for (let li = 0; li < lines.length && st.matches.length < MAX_MATCHES; li++) {
        const hay = st.caseSensitive ? lines[li] : lines[li].toLowerCase();
        let idx = hay.indexOf(needle);
        while (idx !== -1 && st.matches.length < MAX_MATCHES) {
          st.matches.push({ li, ci: idx, len: q.length });
          idx = hay.indexOf(needle, idx + Math.max(1, needle.length));
        }
      }
    } else if (currentAst) {
      const test = s => (st.caseSensitive ? s : s.toLowerCase()).includes(needle);
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

    // keep the position near the previous match when the document changes
    let start = 0;
    if (!resetCurrent && previous && st.mode === 'code') {
      const k = st.matches.findIndex(m => m.li > previous.li || (m.li === previous.li && m.ci >= previous.ci));
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

  // Unfold any folded block that hides this line
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

  // Re-run the search when the searched panel's content changes
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
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f' || e.shiftKey || e.altKey) return;
      const active = document.activeElement;
      const inLeft = active && document.getElementById('leftPanel')?.contains(active);
      const inRight = active && document.getElementById('rightPanel')?.contains(active);
      if (!inLeft && !inRight) return;          // elsewhere: keep the browser's own find
      e.preventDefault();
      open(inLeft ? 'left' : 'right');
    });
  }

  return { init, open, close: closeBar, onDocChange };
})();


/* ─────────────────────────────── JSONPath query ─────────────────────────────── */
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
    // below the find bar if there is one, otherwise under the header
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

  // Keep the results in sync while the query bar is open
  function onDocChange(side) {
    if (!active || rendering || side !== 'right') return;
    clearTimeout(timer);
    timer = setTimeout(run, 60);
  }

  return { init, open, close: closeBar, onDocChange, run };
})();
