/* ============================================================
   jsonxmlformatter.js  –  shared logic for JSON, XML, JSON/XML editors
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────────
let currentAst     = null;   // AST of the last successfully parsed input (for tree view)
let lastOutput     = null;   // { text, lang } currently represented by the right panel
let expandedPanel  = null;
const folds = {
  left:  { list: [], atLine: {} },
  right: { list: [], atLine: {} }
};

const INDENT_KEY       = 'jxe.indent';
const LINE_HEIGHT      = 21;
const FOLD_LINE_LIMIT  = 20000;   // skip fold tracking above this many lines
const TREE_FULL_EXPAND = 3000;    // expand every tree node below this many nodes

// ── DOM refs (assigned after DOM ready) ───────────────────────────────────────
let codeEditor, lineNumbers, foldIconsEl,
    rightCodeEditor, rightLineNumbers, rightFoldIcons,
    rightEditorWrapper, rightTreeContent,
    inputStatus, outputStatus,
    formatTypeEl, formatType2El, viewTypeEl;

// ── Init (called once DOM is ready) ──────────────────────────────────────────
function initEditor() {
  codeEditor        = document.getElementById('codeEditor');
  lineNumbers       = document.getElementById('lineNumbers');
  foldIconsEl       = document.getElementById('foldIcons');
  rightCodeEditor   = document.getElementById('rightCodeEditor');
  rightLineNumbers  = document.getElementById('rightLineNumbers');
  rightFoldIcons    = document.getElementById('rightFoldIcons');
  rightEditorWrapper= document.getElementById('rightEditorWrapper');
  rightTreeContent  = document.getElementById('rightTreeContent');
  inputStatus       = document.getElementById('inputStatus');
  outputStatus      = document.getElementById('outputStatus');
  formatTypeEl      = document.getElementById('formatType');
  formatType2El     = document.getElementById('formatType2');
  viewTypeEl        = document.getElementById('viewType');

  if (!codeEditor) return;

  codeEditor.dataset.placeholder = 'Paste or type your data here, or drop a file…';
  codeEditor.addEventListener('input',   handleEditorInput);
  codeEditor.addEventListener('scroll',  syncLeftScroll);
  codeEditor.addEventListener('paste',   handlePaste);
  codeEditor.addEventListener('keydown', handleEditorKeydown);
  codeEditor.addEventListener('dragover', e => { e.preventDefault(); codeEditor.classList.add('drag-over'); });
  codeEditor.addEventListener('dragleave', () => codeEditor.classList.remove('drag-over'));
  codeEditor.addEventListener('drop', handleFileDrop);

  codeEditor.addEventListener('copy', e => handleCopy(e, codeEditor, false));
  codeEditor.addEventListener('cut',  e => handleCopy(e, codeEditor, true));

  if (rightCodeEditor) {
    rightCodeEditor.addEventListener('scroll', syncRightScroll);
    rightCodeEditor.addEventListener('copy', e => handleCopy(e, rightCodeEditor, false));
    // Make Ctrl+A select only the output, not the whole page
    rightCodeEditor.tabIndex = 0;
    rightCodeEditor.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllIn(rightCodeEditor);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Backslash') {
        e.preventDefault();
        jumpToMatch();
      }
    });
  }
  if (foldIconsEl)     foldIconsEl.addEventListener('click', e => onFoldIconClick(e, 'left'));
  if (rightFoldIcons)  rightFoldIcons.addEventListener('click', e => onFoldIconClick(e, 'right'));

  // Keep both format selects in sync (either one may be the visible one)
  if (formatType2El) formatType2El.addEventListener('change', () => setFormatType(formatType2El.value));
  if (formatTypeEl)  formatTypeEl.addEventListener('change',  () => setFormatType(formatTypeEl.value));
  updateFormatButtons();

  const indentEl = document.getElementById('indentSize');
  if (indentEl) {
    try {
      const saved = localStorage.getItem(INDENT_KEY);
      if (saved && hasOption(indentEl, saved)) indentEl.value = saved;
    } catch (_) { /* storage unavailable */ }
    indentEl.addEventListener('change', () => {
      try { localStorage.setItem(INDENT_KEY, indentEl.value); } catch (_) { /* ignore */ }
      if (getEditorText().trim()) formatCode(false, null, null);
    });
  }

  const csvBtn = document.getElementById('downloadCsvBtn');
  if (csvBtn) csvBtn.addEventListener('click', exportCSV);

  if (rightTreeContent) rightTreeContent.style.color = '';

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && expandedPanel && !document.querySelector('.sd-overlay.show')) {
      toggleExpand(expandedPanel);
    }
  });

  document.addEventListener('selectionchange', markSelectedFolds);

  injectPanelActions();
  updateLineNumbers();
  showTreeView();
  checkAndLoadSharedDrop();
}

document.addEventListener('DOMContentLoaded', initEditor);

// ── Panel action buttons (copy / upload / download) ──────────────────────────
function injectPanelActions() {
  const leftHeader  = document.getElementById('leftPanelHeader');
  const rightHeader = document.getElementById('rightPanelHeader');

  if (leftHeader) {
    const bar = makeActionBar();
    if (!document.getElementById('csvUploadInput')) {
      const file = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
      file.accept = '.json,.xml,.txt,.yaml,.yml,.toml,.csv,.properties,application/json,text/xml,text/plain';
      file.addEventListener('change', () => {
        if (file.files && file.files[0]) loadFileIntoEditor(file.files[0]);
        file.value = '';
      });
      bar.appendChild(file);
      bar.appendChild(makeActionBtn('⭱ Upload', 'Open a file from your computer', () => file.click()));
    }
    bar.appendChild(makeActionBtn('⎘ Copy', 'Copy editor content', () => copyText(getEditorText(), inputStatus)));
    leftHeader.insertBefore(bar, document.getElementById('leftExpandBtn'));
  }

  if (rightHeader) {
    const bar = makeActionBar();
    bar.appendChild(makeActionBtn('⎘ Copy', 'Copy output', () => copyText(getOutputText(), outputStatus)));
    bar.appendChild(makeActionBtn('⭳ Download', 'Download output as a file', downloadOutput));
    rightHeader.insertBefore(bar, document.getElementById('rightExpandBtn'));
  }
}

function makeActionBar() {
  const bar = document.createElement('div');
  bar.className = 'panel-actions';
  return bar;
}

function makeActionBtn(label, title, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

function copyText(text, statusEl) {
  if (!text || !text.trim()) { setStatus(statusEl, null, '⚠ Nothing to copy'); return; }
  const done = () => setStatus(statusEl, true, '✓ Copied to clipboard');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text) ? done() : setStatus(statusEl, false, '✗ Copy failed'));
  } else if (fallbackCopy(text)) {
    done();
  } else {
    setStatus(statusEl, false, '✗ Copy failed');
  }
}

function fallbackCopy(text) {
  const ta = Object.assign(document.createElement('textarea'), { value: text });
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

const FILE_EXT = { json: 'json', xml: 'xml', yaml: 'yaml', toml: 'toml', csv: 'csv', sql: 'sql', property: 'properties' };
const MIME     = { json: 'application/json', xml: 'application/xml', csv: 'text/csv' };

function downloadOutput() {
  const text = getOutputText();
  if (!text.trim()) { setStatus(outputStatus, null, '⚠ Nothing to download'); return; }
  const lang = (lastOutput && lastOutput.lang) || 'txt';
  downloadFile(text, 'output.' + (FILE_EXT[lang] || 'txt'), (MIME[lang] || 'text/plain') + ';charset=utf-8');
}

function downloadFile(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a   = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleFileDrop(e) {
  codeEditor.classList.remove('drag-over');
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;               // plain text drag → let the browser handle it
  e.preventDefault();
  loadFileIntoEditor(file);
}

function loadFileIntoEditor(file) {
  if (file.size > 20 * 1024 * 1024) {
    setStatus(inputStatus, false, '✗ File is too large (max 20 MB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    setEditorText(String(reader.result || ''));
    formatCode(false, null, null);
  };
  reader.onerror = () => setStatus(inputStatus, false, '✗ Could not read file');
  reader.readAsText(file);
}

// ── Scroll sync ───────────────────────────────────────────────────────────────
function syncLeftScroll() {
  if (lineNumbers)  lineNumbers.scrollTop  = codeEditor.scrollTop;
  if (foldIconsEl)  foldIconsEl.scrollTop  = codeEditor.scrollTop;
}

function syncRightScroll() {
  if (rightLineNumbers) rightLineNumbers.scrollTop = rightCodeEditor.scrollTop;
  if (rightFoldIcons)   rightFoldIcons.scrollTop   = rightCodeEditor.scrollTop;
}

// ── Editor keyboard & paste ───────────────────────────────────────────────────
function handleEditorKeydown(e) {
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    document.execCommand('insertText', false, '  ');
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
    // Native select-all stops at the last *visible* character, dropping folded lines
    e.preventDefault();
    selectAllIn(codeEditor);
  } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Backslash') {
    e.preventDefault();
    jumpToMatch();
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    formatCode(false, null, null);
  }
}

function handlePaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r\n?/g, '\n');
  if (!text) return;

  const sel = window.getSelection();
  const replacesAll = !getEditorText().trim() ||
    (sel.rangeCount && sel.getRangeAt(0).toString().length >= codeEditor.textContent.length);

  if (replacesAll) {
    // Fast path: replacing everything (the usual case) — rebuild instead of editing the DOM
    setEditorText(text);
    placeCaretAtEnd(codeEditor);
    handleEditorInput();
  } else if (text.length < 200000) {
    document.execCommand('insertText', false, text);   // keeps native undo
  } else {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    handleEditorInput();
  }
}

// The browser skips display:none (folded) lines when copying, so build the
// clipboard text from the selected DOM, which still contains them.
function handleCopy(e, container, isCut) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const text = extractText(range.cloneContents());
  if (!e.clipboardData) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', text);
  if (isCut) document.execCommand('delete');
}

// Hidden (folded) lines can't show a selection highlight, so highlight the
// "{ … }" marker of every folded block the selection fully spans.
function selectAllIn(container) {
  const range = document.createRange();
  range.selectNodeContents(container);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Right-click → "Select all" can't be intercepted and gets clipped at the last
// visible character when the document ends in a folded block. Detect a selection
// running from the very start to the end of that folded head and extend it.
function fixClippedSelectAll(range) {
  ['left', 'right'].forEach(side => {
    const code = panelEls(side).code;
    if (!code || !code.contains(range.commonAncestorContainer) || !hasFoldedLines(side)) return;
    const rows = code.children;
    const last = rows.length - 1;
    const fold = folds[side].list.find(f => f.folded && f.end === last && rows[f.start].style.display !== 'none');
    if (!fold) return;

    // No text between the editor start and the selection start …
    const before = document.createRange();
    before.setStart(code, 0);
    before.setEnd(range.startContainer, range.startOffset);
    // … and none between the selection end and the end of the folded head line
    const after = document.createRange();
    after.setStart(range.endContainer, range.endOffset);
    after.setEnd(rows[fold.start], rows[fold.start].childNodes.length);

    if (!before.toString() && !after.toString() && !range.intersectsNode(rows[last])) {
      selectAllIn(code);
    }
  });
}

function markSelectedFolds() {
  const sel = window.getSelection();
  const range = sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : null;
  if (range) fixClippedSelectAll(range);
  ['left', 'right'].forEach(side => {
    const code = panelEls(side).code;
    if (!code) return;
    const rows = code.children;
    folds[side].list.forEach(f => {
      const head = rows[f.start];
      if (!head) return;
      const selected = !!range && f.folded && range.intersectsNode(head) && !!rows[f.end] && range.intersectsNode(rows[f.end]);
      head.classList.toggle('fold-selected', selected);
    });
  });
}

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── Get / set raw text of the left editor ─────────────────────────────────────
// Walks the contenteditable DOM the way the browser lays it out (block elements
// and <br> become line breaks). Unlike innerText it also includes folded lines.
function getEditorText() {
  return codeEditor ? extractText(codeEditor) : '';
}

function extractText(root) {
  const lines = [''];
  let fresh = true;            // current line is empty and was opened by a boundary
  let endedByBlock = false;    // last line was only added to close a block

  const isBlock = n => n.nodeName === 'DIV' || n.nodeName === 'P';

  function walk(node) {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === Node.TEXT_NODE) {
        const parts = c.nodeValue.split('\n');
        for (let k = 0; k < parts.length; k++) {
          if (k > 0) { lines.push(''); fresh = true; }
          if (parts[k]) { lines[lines.length - 1] += parts[k]; fresh = false; }
          endedByBlock = false;
        }
      } else if (c.nodeName === 'BR') {
        if (!c.nextSibling && c.parentNode !== root && isBlock(c.parentNode)) {
          fresh = false;                       // placeholder <br> keeps an empty line alive
        } else {
          lines.push(''); fresh = true;
        }
        endedByBlock = false;
      } else if (isBlock(c)) {
        if (!fresh) { lines.push(''); fresh = true; }
        endedByBlock = false;
        walk(c);
        if (!fresh) { lines.push(''); fresh = true; endedByBlock = true; }
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        walk(c);
      }
    }
  }

  walk(root);
  if (endedByBlock && lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

function setEditorText(text) {
  editorHook('replace', text);
  bumpDoc('left');
  const r = renderLines(text, 'plain', 'left');
  codeEditor.innerHTML  = r.code;
  lineNumbers.innerHTML = r.numbers;
  if (foldIconsEl) foldIconsEl.innerHTML = r.icons;
  folds.left = r.folds;
}

// ── Line numbers ──────────────────────────────────────────────────────────────
function updateLineNumbers() {
  if (!codeEditor || !lineNumbers) return;
  const count = Math.max(1, getEditorText().split('\n').length);
  lineNumbers.innerHTML = numberColumn(count);
}

function numberColumn(count) {
  const parts = new Array(count);
  for (let i = 0; i < count; i++) parts[i] = `<div class="code-line">${i + 1}</div>`;
  return parts.join('');
}

// ── Show / hide right panel modes ─────────────────────────────────────────────
function showTextView() {
  if (rightEditorWrapper) rightEditorWrapper.style.display = 'flex';
  if (rightTreeContent)   rightTreeContent.style.display   = 'none';
}

function showTreeView() {
  if (rightEditorWrapper) rightEditorWrapper.style.display = 'none';
  if (rightTreeContent)   rightTreeContent.style.display   = 'block';
}

// ── Escaping ──────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════════════════════════════
//  JSON — strict parser with precise error positions and lossless output
//  (keeps big integers, 1.0, unicode escapes and duplicate keys exactly as typed)
// ══════════════════════════════════════════════════════════════════════════════
function parseJsonAst(text) {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let lastComma = -1;
  const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

  function fail(message, pos) {
    throw { isParseError: true, message, pos: pos === undefined ? i : pos };
  }
  function found(pos) {
    if (pos >= n) return 'end of input';
    const ch = text[pos];
    if (ch === '\n') return 'a line break';
    return `'${ch}'`;
  }
  function ws() {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  }

  function value() {
    ws();
    if (i >= n) fail('Unexpected end of input — expected a value');
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    if (text.startsWith('true', i))  { i += 4; return { type: 'boolean', raw: 'true' }; }
    if (text.startsWith('false', i)) { i += 5; return { type: 'boolean', raw: 'false' }; }
    if (text.startsWith('null', i))  { i += 4; return { type: 'null', raw: 'null' }; }
    if (c === "'") fail('Strings must be wrapped in double quotes (") — single quotes are not valid JSON');
    if (/[A-Za-z_$]/.test(c)) {
      const word = text.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];
      if (word === 'undefined' || word === 'NaN' || word === 'Infinity') fail(`'${word}' is not a valid JSON value`);
      fail(`Unexpected word '${word}' — strings must be wrapped in double quotes`);
    }
    fail(`Expected a value but found ${found(i)}`);
  }

  function object() {
    i++;
    const entries = [];
    ws();
    if (text[i] === '}') { i++; return { type: 'object', entries }; }
    for (;;) {
      ws();
      if (text[i] !== '"') {
        if (i >= n)                       fail("Unexpected end of input — expected a property name or '}'");
        if (text[i] === '}' && entries.length) fail("Trailing comma is not allowed before '}'", lastComma);
        if (text[i] === "'")              fail('Property names must be wrapped in double quotes (")');
        if (/[A-Za-z_$]/.test(text[i]))   fail('Property names must be wrapped in double quotes (")');
        fail(`Expected a property name but found ${found(i)}`);
      }
      const key = string();
      ws();
      if (text[i] !== ':') fail(`Expected ':' after property name but found ${found(i)}`);
      i++;
      entries.push({ key, value: value() });
      ws();
      if (text[i] === ',') { lastComma = i; i++; continue; }
      if (text[i] === '}') { i++; return { type: 'object', entries }; }
      if (i >= n)          fail("Unexpected end of input — missing '}'");
      if (text[i] === '"') fail("Missing ',' between properties");
      fail(`Expected ',' or '}' after property value but found ${found(i)}`);
    }
  }

  function array() {
    i++;
    const items = [];
    ws();
    if (text[i] === ']') { i++; return { type: 'array', items }; }
    for (;;) {
      ws();
      if (text[i] === ']' && items.length) fail("Trailing comma is not allowed before ']'", lastComma);
      items.push(value());
      ws();
      if (text[i] === ',') { lastComma = i; i++; continue; }
      if (text[i] === ']') { i++; return { type: 'array', items }; }
      if (i >= n)          fail("Unexpected end of input — missing ']'");
      if (/["{\[\d\-tfn]/.test(text[i])) fail("Missing ',' between array items");
      fail(`Expected ',' or ']' after array item but found ${found(i)}`);
    }
  }

  function string() {
    const start = i++;
    for (;;) {
      if (i >= n) fail('Unterminated string — missing closing "', start);
      const c = text.charCodeAt(i);
      if (c === 34) { i++; break; }
      if (c === 92) {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.substr(i + 2, 4))) fail('Invalid unicode escape — expected \\u followed by 4 hex digits');
          i += 6;
        } else if (e !== undefined && '"\\/bfnrt'.indexOf(e) !== -1) {
          i += 2;
        } else {
          fail(`Invalid escape sequence '\\${e === undefined ? '' : e}'`);
        }
        continue;
      }
      if (c < 32) fail(c === 10 ? 'Unterminated string — line breaks inside strings must be escaped as \\n'
                                : 'Control characters inside strings must be escaped');
      i++;
    }
    return { type: 'string', raw: text.slice(start, i) };
  }

  function number() {
    const start = i;
    NUM.lastIndex = i;
    const m = NUM.exec(text);
    if (!m) fail('Invalid number');
    i += m[0].length;
    if (i < n && /[0-9.eExX]/.test(text[i])) fail(`Invalid number '${text.slice(start, i + 1)}'`, start);
    return { type: 'number', raw: m[0] };
  }

  let root;
  try {
    root = value();
  } catch (e) {
    if (e instanceof RangeError) fail('JSON is nested too deeply to parse', i);
    throw e;
  }
  ws();
  if (i < n) {
    if (text[i] === ',') fail('Unexpected \',\' after the end of the JSON document');
    fail(`Unexpected ${found(i)} after the end of the JSON document — only one root value is allowed`);
  }
  return root;
}

// indent === '' → minified
function astToText(ast, indent) {
  const out = [];
  const nl  = indent ? '\n' : '';
  const sep = indent ? ': ' : ':';

  (function write(node, pad) {
    if (node.type === 'object') {
      if (!node.entries.length) { out.push('{}'); return; }
      const inner = pad + indent;
      out.push('{');
      node.entries.forEach((e, k) => {
        out.push(k ? ',' + nl + inner : nl + inner, e.key.raw, sep);
        write(e.value, inner);
      });
      out.push(nl + pad + '}');
    } else if (node.type === 'array') {
      if (!node.items.length) { out.push('[]'); return; }
      const inner = pad + indent;
      out.push('[');
      node.items.forEach((item, k) => {
        out.push(k ? ',' + nl + inner : nl + inner);
        write(item, inner);
      });
      out.push(nl + pad + ']');
    } else {
      out.push(node.raw);
    }
  })(ast, '');

  return out.join('');
}

// Plain JS value → AST (used for the XML tree view)
function valueToAst(v) {
  if (Array.isArray(v)) return { type: 'array', items: v.map(valueToAst) };
  if (v !== null && typeof v === 'object') {
    return {
      type: 'object',
      entries: Object.keys(v).map(k => ({ key: { type: 'string', raw: JSON.stringify(k) }, value: valueToAst(v[k]) }))
    };
  }
  if (typeof v === 'string')  return { type: 'string', raw: JSON.stringify(v) };
  if (typeof v === 'number')  return { type: 'number', raw: String(v) };
  if (typeof v === 'boolean') return { type: 'boolean', raw: String(v) };
  return { type: 'null', raw: 'null' };
}

function unquote(raw) {
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

// ══════════════════════════════════════════════════════════════════════════════
//  XML — DOM based formatter / minifier with clean error reporting
// ══════════════════════════════════════════════════════════════════════════════
function parseXmlDocument(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) {
    const raw = err.textContent || '';
    let line = null, col = null, message = raw;
    let m = raw.match(/error on line (\d+) at column (\d+):\s*([^\n]*)/i);          // Chrome / Safari
    if (m) { line = +m[1]; col = +m[2]; message = m[3]; }
    else if ((m = raw.match(/Line Number (\d+), Column (\d+)/i))) {                  // Firefox
      line = +m[1]; col = +m[2];
      message = raw.split('\n')[0].replace(/^XML Parsing Error:\s*/i, '');
    }
    message = message.trim().replace(/\s+/g, ' ') || 'Invalid XML';
    throw { isParseError: true, message, line, col };
  }
  return doc;
}

function escXmlText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escXmlAttr(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

// Returns { text, doc }; throws a parse error for malformed XML.
function xmlFormat(xml, minify) {
  const doc  = parseXmlDocument(xml);
  const unit = minify ? '' : getIndent();
  const nl   = minify ? '' : '\n';
  const out  = [];

  const decl = xml.match(/^\s*(<\?xml[\s\S]*?\?>)/);
  if (decl) out.push(decl[1]);

  function isTextLike(n) { return n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE; }

  function write(node, pad) {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE: {
        let open = '<' + node.nodeName;
        for (const a of node.attributes) open += ` ${a.name}="${escXmlAttr(a.value)}"`;
        const kids = Array.from(node.childNodes).filter(k => !(k.nodeType === Node.TEXT_NODE && !k.nodeValue.trim()));
        if (!kids.length) { out.push(pad + open + '/>'); return; }
        if (kids.every(isTextLike)) {
          const inner = kids.map(k => k.nodeType === Node.CDATA_SECTION_NODE
            ? `<![CDATA[${k.nodeValue}]]>` : escXmlText(minify ? k.nodeValue.trim() : k.nodeValue.trim())).join('');
          out.push(pad + open + '>' + inner + '</' + node.nodeName + '>');
          return;
        }
        out.push(pad + open + '>');
        kids.forEach(k => write(k, pad + unit));
        out.push(pad + '</' + node.nodeName + '>');
        return;
      }
      case Node.TEXT_NODE:
        out.push(pad + escXmlText(node.nodeValue.trim()));
        return;
      case Node.CDATA_SECTION_NODE:
        out.push(pad + `<![CDATA[${node.nodeValue}]]>`);
        return;
      case Node.COMMENT_NODE:
        out.push(pad + `<!--${node.nodeValue}-->`);
        return;
      case Node.PROCESSING_INSTRUCTION_NODE:
        out.push(pad + `<?${node.target}${node.data ? ' ' + node.data : ''}?>`);
        return;
      case Node.DOCUMENT_TYPE_NODE:
        out.push(pad + new XMLSerializer().serializeToString(node));
        return;
    }
  }

  doc.childNodes.forEach(n => write(n, ''));
  return { text: out.join(nl), doc };
}

// Kept for backwards compatibility with inline page scripts
function formatXML(xml) { return xmlFormat(xml, false).text; }

function validateXML(xml) {
  try { parseXmlDocument(xml); return { valid: true }; }
  catch (e) { return { valid: false, error: e.message }; }
}

function xmlDocToObject(doc) {
  function convert(node) {
    const obj = {};
    for (const a of node.attributes) obj['@' + a.name] = a.value;
    const kids = Array.from(node.childNodes);
    const text = kids.filter(k => k.nodeType === Node.TEXT_NODE || k.nodeType === Node.CDATA_SECTION_NODE)
                     .map(k => k.nodeValue).join('').trim();
    const elements = kids.filter(k => k.nodeType === Node.ELEMENT_NODE);

    if (!elements.length && !node.attributes.length) return text;
    if (text) obj['#text'] = text;
    for (const child of elements) {
      const name = child.nodeName, val = convert(child);
      if (!(name in obj))              obj[name] = val;
      else if (Array.isArray(obj[name])) obj[name].push(val);
      else                              obj[name] = [obj[name], val];
    }
    return obj;
  }
  const root = doc.documentElement;
  return { [root.nodeName]: convert(root) };
}

// Kept for backwards compatibility
function parseXMLToObject(xml) { return xmlDocToObject(parseXmlDocument(xml)); }

// ══════════════════════════════════════════════════════════════════════════════
//  Syntax highlighting
// ══════════════════════════════════════════════════════════════════════════════
const JSON_TOKEN = /("(?:\\.|[^\\"])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],]/g;

function highlightSyntax(line) {
  if (!line) return '';
  let out = '', last = 0, m;
  JSON_TOKEN.lastIndex = 0;
  while ((m = JSON_TOKEN.exec(line))) {
    out += escapeHtml(line.slice(last, m.index));
    const tok = m[0];
    let cls;
    if (m[1]) {
      if (m[2]) {
        out += `<span class="key">${escapeHtml(m[1])}</span>${m[2]}`;
        last = JSON_TOKEN.lastIndex;
        continue;
      }
      cls = 'string';
    } else if (tok === 'true' || tok === 'false') cls = 'boolean';
    else if (tok === 'null') cls = 'null';
    else if ('{}[],'.indexOf(tok) !== -1) cls = 'bracket';
    else cls = 'number';
    out += `<span class="${cls}">${escapeHtml(tok)}</span>`;
    last = JSON_TOKEN.lastIndex;
  }
  return out + escapeHtml(line.slice(last));
}

function highlightXMLLine(line) {
  if (!line) return '';
  let out = '', i = 0;
  const n = line.length;
  while (i < n) {
    if (line.startsWith('<!--', i)) {
      const end = line.indexOf('-->', i + 4);
      const j = end < 0 ? n : end + 3;
      out += `<span class="xml-comment">${escapeHtml(line.slice(i, j))}</span>`;
      i = j;
    } else if (line.startsWith('<![CDATA[', i)) {
      const end = line.indexOf(']]>', i);
      const j = end < 0 ? n : end + 3;
      out += `<span class="xml-cdata">${escapeHtml(line.slice(i, j))}</span>`;
      i = j;
    } else if (line[i] === '<') {
      let j = i + 1, quote = null;
      while (j < n && (quote || line[j] !== '>')) {
        if (quote) { if (line[j] === quote) quote = null; }
        else if (line[j] === '"' || line[j] === "'") quote = line[j];
        j++;
      }
      j = Math.min(n, j + 1);
      out += highlightXmlTag(line.slice(i, j));
      i = j;
    } else {
      const next = line.indexOf('<', i);
      const j = next < 0 ? n : next;
      const text = line.slice(i, j);
      out += text.trim() ? `<span class="xml-text">${escapeHtml(text)}</span>` : escapeHtml(text);
      i = j;
    }
  }
  return out;
}

function highlightXmlTag(tag) {
  const m = tag.match(/^(<[\/?!]?)([^\s\/>?]*)([\s\S]*?)([\/?]?>)?$/);
  if (!m) return escapeHtml(tag);
  let out = `<span class="bracket">${escapeHtml(m[1])}</span><span class="xml-tag">${escapeHtml(m[2])}</span>`;
  const attrs = m[3] || '';
  const re = /([^\s=]+)(\s*=\s*)("[^"]*"?|'[^']*'?)/g;
  let last = 0, a;
  while ((a = re.exec(attrs))) {
    out += escapeHtml(attrs.slice(last, a.index)) +
      `<span class="xml-attr">${escapeHtml(a[1])}</span>${escapeHtml(a[2])}<span class="xml-attr-value">${escapeHtml(a[3])}</span>`;
    last = re.lastIndex;
  }
  out += escapeHtml(attrs.slice(last));
  if (m[4]) out += `<span class="bracket">${escapeHtml(m[4])}</span>`;
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Line rendering with code folding (shared by both panels)
// ══════════════════════════════════════════════════════════════════════════════
function isFoldOpener(trimmed, lang) {
  if (lang === 'json') return /[{\[]$/.test(trimmed);
  if (lang === 'xml') {
    return /^<[^\/!?][^>]*>$/.test(trimmed) && !trimmed.endsWith('/>') && trimmed.indexOf('</') === -1;
  }
  return false;
}

function isFoldCloser(trimmed, lang) {
  if (lang === 'json') return /^[}\]],?$/.test(trimmed);
  if (lang === 'xml')  return /^<\/[^>]+>$/.test(trimmed);
  return false;
}

function renderLines(text, lang, side) {
  const lines    = text.split('\n');
  const foldable = (lang === 'json' || lang === 'xml') && lines.length <= FOLD_LINE_LIMIT;
  const code = new Array(lines.length), nums = new Array(lines.length), icons = new Array(lines.length);
  const list = [], atLine = {}, stack = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    let lineHtml;
    if (lang === 'json') {
      const indent = line.length - line.trimStart().length;
      lineHtml = line.slice(0, indent) + highlightSyntax(line.slice(indent));
    } else if (lang === 'xml') {
      lineHtml = highlightXMLLine(line);
    } else {
      lineHtml = escapeHtml(line);
    }

    let icon = '';
    if (foldable) {
      const trimmed = line.trim();
      if (isFoldCloser(trimmed, lang) && stack.length) {
        list[stack.pop()].end = idx;
      } else if (isFoldOpener(trimmed, lang)) {
        const id = list.length;
        list.push({ start: idx, end: idx, folded: false });
        atLine[idx] = list[id];
        stack.push(id);
        icon = '<span data-fold title="Collapse / expand">▾</span>';
      }
    }

    code[idx]  = `<div class="code-line">${lineHtml}</div>`;
    nums[idx]  = `<div class="code-line">${idx + 1}</div>`;
    icons[idx] = `<div class="fold-arrow">${icon}</div>`;
  }

  return {
    code: code.join(''), numbers: nums.join(''), icons: icons.join(''),
    folds: { list: list.filter(f => f.end > f.start), atLine }
  };
}

function panelEls(side) {
  return side === 'left'
    ? { code: codeEditor, nums: lineNumbers, icons: foldIconsEl }
    : { code: rightCodeEditor, nums: rightLineNumbers, icons: rightFoldIcons };
}

function onFoldIconClick(e, side) {
  const t = e.target.closest('[data-fold]');
  if (!t) return;
  toggleFold(side, t);
}

function toggleFold(side, iconEl) {
  const els  = panelEls(side);
  const row  = iconEl.parentNode;
  const idx  = Array.prototype.indexOf.call(els.icons.children, row);
  const fold = folds[side].atLine[idx];
  if (!fold || fold.end <= fold.start) return;

  fold.folded = !fold.folded;
  iconEl.textContent = fold.folded ? '▸' : '▾';
  const codeRows = els.code.children, numRows = els.nums.children, iconRows = els.icons.children;
  const head = codeRows[fold.start];
  if (head) {
    head.classList.toggle('folded', fold.folded);
    // Show the closing bracket / tag inline ("{ … }") via CSS, so it never becomes editor text
    if (fold.folded) head.dataset.foldTail = codeRows[fold.end] ? codeRows[fold.end].textContent.trim() : '';
    else delete head.dataset.foldTail;
  }

  const setRow = (i, display) => {
    if (codeRows[i]) codeRows[i].style.display = display;
    if (numRows[i])  numRows[i].style.display  = display;
    if (iconRows[i]) iconRows[i].style.display = display;
  };

  if (fold.folded) {
    for (let i = fold.start + 1; i <= fold.end; i++) setRow(i, 'none');
  } else {
    let i = fold.start + 1;
    while (i <= fold.end) {
      setRow(i, '');
      const inner = folds[side].atLine[i];
      i = inner && inner.folded ? inner.end + 1 : i + 1;
    }
  }
  markSelectedFolds();
}

function hasFoldedLines(side) {
  return folds[side].list.some(f => f.folded);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Bracket / tag matching
//  Put the cursor on { } [ ] or inside an XML tag: the tag and its partner are
//  highlighted (plus both line numbers), in the editor and in the Text View.
//  Ctrl+Shift+\ jumps to the partner.
// ══════════════════════════════════════════════════════════════════════════════
const docVersion = { left: 0, right: 0 };
const matchCache = { left: null, right: null };
const HAS_HIGHLIGHT_API = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
let fallbackMarked = [];
let markedLineNums = [];

// Lets editor-tools.js (undo, autosave, find) react to editor changes
function editorHook(type, arg) {
  if (typeof EditorTools !== 'undefined') EditorTools.hook(type, arg);
}

function bumpDoc(side) {
  docVersion[side]++;
  editorHook('doc', side);
}

function matchLang(side) {
  if (side === 'right') return lastOutput ? lastOutput.lang : null;
  return formatTypeEl ? formatTypeEl.value : 'json';
}

// Build (once per document version) the list of matching pairs
function getMatchIndex(side) {
  const els = panelEls(side);
  const lang = matchLang(side);
  const cached = matchCache[side];
  if (cached && cached.version === docVersion[side] && cached.lang === lang) return cached;

  const lines = Array.from(els.code.children, c => c.textContent);
  const index = { version: docVersion[side], lang, lines, pairs: new Map(), tags: [] };

  if (lang === 'json') {
    const stack = [];
    lines.forEach((line, li) => {
      let inStr = false;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (inStr) {
          if (ch === '\\') ci++;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{' || ch === '[') stack.push({ li, ci, ch });
        else if (ch === '}' || ch === ']') {
          const want = ch === '}' ? '{' : '[';
          const close = { li, ci, len: 1 };
          if (stack.length && stack[stack.length - 1].ch === want) {
            const open = stack.pop();
            const o = { li: open.li, ci: open.ci, len: 1 };
            index.pairs.set(open.li + ':' + open.ci, { self: o, other: close });
            index.pairs.set(li + ':' + ci, { self: close, other: o });
          } else {
            index.pairs.set(li + ':' + ci, { self: close, other: null });
          }
        }
      }
    });
    stack.forEach(open => index.pairs.set(open.li + ':' + open.ci, { self: { li: open.li, ci: open.ci, len: 1 }, other: null }));
  } else if (lang === 'xml') {
    const TAG = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<(\/?)([A-Za-z_:][\w:.\-]*)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g;
    const stack = [];
    lines.forEach((line, li) => {
      let m;
      TAG.lastIndex = 0;
      while ((m = TAG.exec(line))) {
        if (!m[2]) continue;                         // comment, CDATA, PI, doctype
        const tag = { li, ci: m.index, len: m[0].length, name: m[2], other: null };
        if (m[3]) { index.tags.push(tag); continue; }   // self-closing: no partner
        if (!m[1]) { stack.push(tag); index.tags.push(tag); continue; }
        let j = stack.length - 1;
        while (j >= 0 && stack[j].name !== tag.name) j--;
        if (j >= 0) {
          const open = stack[j];
          stack.length = j;
          open.other = tag;
          tag.other = open;
        }
        index.tags.push(tag);
      }
    });
  }

  matchCache[side] = index;
  return index;
}

// Caret → { side, li, col } when it sits inside one of the code panels
function caretPosition() {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return null;
  const node = sel.focusNode;
  for (const side of ['left', 'right']) {
    const code = panelEls(side).code;
    if (!code || !code.contains(node) || code === node) continue;
    let line = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (line && line.parentElement !== code) line = line.parentElement;
    if (!line || !line.classList.contains('code-line')) return null;
    const li = Array.prototype.indexOf.call(code.children, line);
    const r = document.createRange();
    r.setStart(line, 0);
    r.setEnd(sel.focusNode, sel.focusOffset);
    return { side, li, col: r.toString().length };
  }
  return null;
}

function findMatch(pos) {
  const index = getMatchIndex(pos.side);
  if (index.lang === 'json') {
    // bracket just before the caret wins, then the one just after it
    for (const ci of [pos.col - 1, pos.col]) {
      const hit = index.pairs.get(pos.li + ':' + ci);
      if (hit) return { self: hit.self, other: hit.other };
    }
  } else if (index.lang === 'xml') {
    const tag = index.tags.find(t => t.li === pos.li && pos.col > t.ci && pos.col < t.ci + t.len)
             || index.tags.find(t => t.li === pos.li && (pos.col === t.ci || pos.col === t.ci + t.len));
    if (tag) {
      if (!tag.other && /\/>$/.test(index.lines[tag.li].slice(tag.ci, tag.ci + tag.len))) return null;
      return { self: tag, other: tag.other };
    }
  }
  return null;
}

// (line, column, length) → DOM Range inside the rendered line
function textRange(code, li, ci, len) {
  const line = code.children[li];
  if (!line) return null;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0, startSet = false, node;
  while ((node = walker.nextNode())) {
    const end = pos + node.nodeValue.length;
    if (!startSet && ci < end) { range.setStart(node, ci - pos); startSet = true; }
    if (startSet && ci + len <= end) { range.setEnd(node, ci + len - pos); return range; }
    pos = end;
  }
  return null;
}

function clearMatchHighlight() {
  if (HAS_HIGHLIGHT_API) {
    CSS.highlights.delete('bracket-match');
    CSS.highlights.delete('bracket-unmatched');
  }
  fallbackMarked.forEach(e => e.classList.remove('match-hl', 'match-bad'));
  fallbackMarked = [];
  markedLineNums.forEach(e => e.classList.remove('match-line'));
  markedLineNums = [];
  document.querySelectorAll('.match-info').forEach(e => e.remove());
}

function updateMatchHighlight() {
  clearMatchHighlight();
  const pos = caretPosition();
  if (!pos) return;
  const match = findMatch(pos);
  if (!match) return;

  const els = panelEls(pos.side);
  const parts = [match.self, match.other].filter(Boolean);
  const ranges = parts.map(p => textRange(els.code, p.li, p.ci, p.len)).filter(Boolean);
  const good = !!match.other;

  if (HAS_HIGHLIGHT_API) {
    CSS.highlights.set(good ? 'bracket-match' : 'bracket-unmatched', new Highlight(...ranges));
  } else {
    // Older browsers: colour the syntax-highlight spans that contain the tag
    ranges.forEach(r => {
      const walker = document.createTreeWalker(r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (r.intersectsNode(n) && n.parentElement && n.parentElement.tagName === 'SPAN') {
          n.parentElement.classList.add(good ? 'match-hl' : 'match-bad');
          fallbackMarked.push(n.parentElement);
        }
      }
    });
  }

  parts.forEach(p => {
    const num = els.nums && els.nums.children[p.li];
    if (num) { num.classList.add('match-line'); markedLineNums.push(num); }
  });

  // Tell the user where the partner is (it may be far off screen)
  const statusEl = pos.side === 'left' ? inputStatus : outputStatus;
  if (statusEl) {
    const info = document.createElement('span');
    info.className = 'match-info';
    if (good) {
      const other = match.other;
      const snippet = getMatchIndex(pos.side).lines[other.li].slice(other.ci, other.ci + Math.min(other.len, 30));
      info.textContent = `Matches ${snippet}${other.len > 30 ? '…' : ''} on line ${other.li + 1}  ·  Ctrl+Shift+\\ to jump`;
    } else {
      info.textContent = 'No matching bracket or tag';
      info.classList.add('bad');
    }
    statusEl.appendChild(info);
  }
}

// Ctrl+Shift+\ : move the caret to the partner and scroll it into view
function jumpToMatch() {
  const pos = caretPosition();
  if (!pos) return false;
  const match = findMatch(pos);
  if (!match || !match.other) return false;
  const els = panelEls(pos.side);
  const o = match.other;
  // JSON: caret right after the bracket; XML: caret just inside the tag
  const r = o.len === 1 ? textRange(els.code, o.li, o.ci, 1) : textRange(els.code, o.li, o.ci + 1, 0);
  if (!r) return false;
  r.collapse(o.len !== 1);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  const line = els.code.children[o.li];
  if (line) {
    const top = line.offsetTop;
    if (top < els.code.scrollTop || top > els.code.scrollTop + els.code.clientHeight - LINE_HEIGHT * 2) {
      els.code.scrollTop = Math.max(0, top - els.code.clientHeight / 2);
    }
  }
  return true;
}

let matchTimer = null;
document.addEventListener('selectionchange', () => {
  clearTimeout(matchTimer);
  matchTimer = setTimeout(updateMatchHighlight, 30);
});

function setLeft(text, lang) {
  editorHook('replace', text);
  bumpDoc('left');
  const r = renderLines(text, lang, 'left');
  codeEditor.innerHTML  = r.code;
  lineNumbers.innerHTML = r.numbers;
  if (foldIconsEl) foldIconsEl.innerHTML = r.icons;
  folds.left = r.folds;
  codeEditor.scrollTop = 0;
  syncLeftScroll();
}

// Right panel Text View
function showOutputText(text, lang) {
  bumpDoc('right');
  const hl = lang === 'json' || lang === 'xml' ? lang : 'plain';
  const r  = renderLines(text, hl, 'right');
  rightFoldIcons.innerHTML   = r.icons;
  rightLineNumbers.innerHTML = r.numbers;
  rightCodeEditor.innerHTML  = r.code;
  folds.right = r.folds;
  rightCodeEditor.scrollTop  = 0;
  syncRightScroll();
  lastOutput = { text, lang };
  showTextView();
}

// Backwards-compatible name
function populateTextView(formatted) {
  showOutputText(formatted, formatted.trimStart().startsWith('<') ? 'xml' : 'json');
}

function getOutputText() {
  return lastOutput ? lastOutput.text : '';
}

// ══════════════════════════════════════════════════════════════════════════════
//  Tree view (lazy – children are only built when a node is expanded)
// ══════════════════════════════════════════════════════════════════════════════
function countNodes(ast, limit) {
  let count = 0;
  const stack = [ast];
  while (stack.length && count <= limit) {
    const n = stack.pop();
    count++;
    if (n.type === 'object') n.entries.forEach(e => stack.push(e.value));
    else if (n.type === 'array') n.items.forEach(x => stack.push(x));
  }
  return count;
}

// path (array of keys / indexes) → { row, node, setOpen } for every row built so far
let treeRegistry = new Map();
const pathKey = path => JSON.stringify(path);

// ['customer', 'address', 0, 'city'] → $.customer.address[0].city
function jsonPath(path) {
  return '$' + path.map(p => typeof p === 'number' ? `[${p}]`
    : /^[A-Za-z_$][\w$]*$/.test(p) ? '.' + p
    : `['${String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`).join('');
}

function renderTree(ast) {
  showTreeView();
  rightTreeContent.textContent = '';
  treeRegistry = new Map();
  const expandDepth = countNodes(ast, TREE_FULL_EXPAND) <= TREE_FULL_EXPAND ? Infinity : 2;
  const frag = document.createDocumentFragment();
  buildTreeNode(ast, null, 0, frag, expandDepth, []);
  rightTreeContent.appendChild(frag);
  rightTreeContent.scrollTop = 0;
  editorHook('doc', 'right');
}

// Open every ancestor of `path` (building rows as needed) and return its entry
function revealTreePath(path) {
  for (let i = 0; i < path.length; i++) {
    const entry = treeRegistry.get(pathKey(path.slice(0, i)));
    if (entry && entry.setOpen) entry.setOpen(true);
  }
  return treeRegistry.get(pathKey(path));
}

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

function buildTreeNode(node, key, depth, parentEl, expandDepth, path) {
  const row = el('div', 'tree-row');
  row.style.paddingLeft = (depth * 18) + 'px';
  const entry = { row, node, setOpen: null };
  treeRegistry.set(pathKey(path), entry);

  // Hover button: copy this node's JSONPath
  const copyPath = el('button', 'tree-copy', 'copy path');
  copyPath.type = 'button';
  copyPath.title = jsonPath(path);
  copyPath.addEventListener('click', e => {
    e.stopPropagation();
    copyText(jsonPath(path), outputStatus);
  });

  const isContainer = node.type === 'object' || node.type === 'array';
  const children    = node.type === 'object' ? node.entries : node.type === 'array' ? node.items : null;
  const toggle      = el('span', 'tree-expand', isContainer && children.length ? '▾' : '');
  row.appendChild(toggle);

  if (key !== null) {
    row.appendChild(el('span', 'tree-key', key));
    row.appendChild(el('span', 'tree-colon', ': '));
  }

  if (!isContainer) {
    const cls = { string: 'tree-string', number: 'tree-number', boolean: 'tree-boolean' }[node.type] || 'tree-null';
    row.appendChild(el('span', cls, node.raw));
    row.appendChild(copyPath);
    parentEl.appendChild(row);
    return;
  }

  const open = node.type === 'object' ? '{' : '[';
  const close = node.type === 'object' ? '}' : ']';
  const label = node.type === 'object'
    ? children.length + (children.length === 1 ? ' prop' : ' props')
    : children.length + (children.length === 1 ? ' item' : ' items');
  row.appendChild(el('span', 'bracket', open));
  row.appendChild(el('span', 'tree-count', label));
  row.appendChild(el('span', 'bracket', close));
  row.appendChild(copyPath);
  parentEl.appendChild(row);
  if (!children.length) return;

  const box = el('div', 'tree-children');
  parentEl.appendChild(box);
  let built = false;

  const setOpen = (isOpen) => {
    if (isOpen && !built) {
      const frag = document.createDocumentFragment();
      if (node.type === 'object') {
        children.forEach(e => {
          const k = unquote(e.key.raw);
          buildTreeNode(e.value, k, depth + 1, frag, expandDepth, path.concat(k));
        });
      } else {
        children.forEach((item, i) => buildTreeNode(item, String(i), depth + 1, frag, expandDepth, path.concat(i)));
      }
      box.appendChild(frag);
      built = true;
    }
    box.style.display = isOpen ? '' : 'none';
    toggle.textContent = isOpen ? '▾' : '▸';
    row.classList.toggle('collapsed', !isOpen);
  };
  entry.setOpen = setOpen;

  row.classList.add('tree-branch');
  row.addEventListener('click', () => setOpen(box.style.display === 'none'));
  setOpen(depth < expandDepth);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Format / minify / errors
// ══════════════════════════════════════════════════════════════════════════════
function hasOption(select, value) {
  return !!select && Array.from(select.options).some(o => o.value === value);
}

function setFormatType(value) {
  if (hasOption(formatTypeEl, value))  formatTypeEl.value  = value;
  if (hasOption(formatType2El, value)) formatType2El.value = value;
  updateFormatButtons();
}

// Buttons marked data-for="json|xml" only make sense for one input format
function updateFormatButtons() {
  const type = formatTypeEl ? formatTypeEl.value : null;
  if (!type) return;
  document.querySelectorAll('[data-for]').forEach(b => { b.hidden = b.dataset.for !== type; });
}

function getIndent() {
  const el = document.getElementById('indentSize');
  const v = el ? el.value : '2';
  return v === 'tab' ? '\t' : ' '.repeat(parseInt(v, 10) || 2);
}

function detectFormat(text) {
  const t = text.replace(/^﻿/, '').trimStart();
  if (t[0] === '<') return 'xml';
  if (t[0] === '{' || t[0] === '[') return 'json';
  return null;
}

// Switches the format selector when the content is obviously JSON or XML
function resolveInputType(text) {
  const current = formatTypeEl ? formatTypeEl.value : 'json';
  let detected = detectFormat(text);
  // On pages that offer YAML: "key: value" lines or a leading "---" mean YAML
  if (!detected && hasOption(formatTypeEl, 'yaml') && /^\s*(---|[\w"'.-][^\n]*:(\s|$)|- )/.test(text)) detected = 'yaml';
  if (detected && detected !== current && hasOption(formatTypeEl, detected)) setFormatType(detected);
  return formatTypeEl ? formatTypeEl.value : (detected || 'json');
}

/**
 * formatCode(isConverterReq, data, convertedType, isFromSample, autoformat)
 *  - no args / false       → format the left editor content (left + right updated)
 *  - isConverterReq only   → `data` is a conversion result, shown in the right panel
 *  - with isFromSample     → `data` replaces the editor content (sample, repair, sort)
 *  - autoformat            → live preview while typing: right panel only
 */
function formatCode(isConverterReq, data, convertedType, isFromSample, autoformat) {
  if (!codeEditor) return;
  const isConversion = !!isConverterReq && !isFromSample;
  const input = isConverterReq ? data : getEditorText();

  if (input == null || !input.trim()) {
    if (!isConverterReq && !autoformat) setStatus(inputStatus, null, '⚠ Please enter some data first');
    return;
  }

  let type;
  if (isConverterReq) {
    type = convertedType;
    if (isFromSample) setFormatType(type);
  } else {
    type = resolveInputType(input);
  }
  const renderLeft = !isConversion && !autoformat;
  const viewType   = viewTypeEl ? viewTypeEl.value : 'tree';

  if (type === 'json' || type === 'xml') {
    let formatted, ast;
    try {
      if (type === 'json') {
        ast = parseJsonAst(input);
        if (ast.type === 'string') {             // JSON document embedded in a JSON string
          try { ast = parseJsonAst(JSON.parse(ast.raw)); } catch (_) { /* keep as string */ }
        }
        formatted = astToText(ast, getIndent());
      } else {
        if (/^["']?[{\[]/.test(input.trim())) {
          throw { isParseError: true, message: 'This looks like JSON, not XML — switch the format to JSON', line: 1, col: 1 };
        }
        const r = xmlFormat(input, false);
        formatted = r.text;
        ast = valueToAst(xmlDocToObject(r.doc));
      }
    } catch (err) {
      if (!err || !err.isParseError) throw err;
      if (isConversion) { showOutputText(input, type); return; }   // show server output as-is
      showParseError(type, input, err, renderLeft);
      return;
    }

    if (renderLeft) setLeft(formatted, type);

    if (isConversion) {
      showOutputText(formatted, type);
      setStatus(outputStatus, true, '✓ Converted to ' + type.toUpperCase());
      return;
    }

    currentAst = ast;
    if (viewType === 'tree') {
      renderTree(ast);
      lastOutput = { text: formatted, lang: type };
    } else {
      showOutputText(formatted, type);
    }

    const label = type.toUpperCase();
    setStatus(inputStatus, true, autoformat ? `✓ Valid ${label}` : `✓ Valid ${label} — formatted`);
    setStatus(outputStatus, true, `✓ ${viewType === 'tree' ? 'Tree' : 'Text'} view · ${formatted.split('\n').length.toLocaleString()} lines · ${formatBytes(formatted.length)}`);
    return;
  }

  // Plain output (YAML, TOML, CSV, SQL, properties …)
  if (renderLeft) setLeft(input, 'plain');
  showOutputText(input, type);
  if (isConversion) setStatus(outputStatus, true, '✓ Converted to ' + String(type).toUpperCase());
  else {
    setStatus(inputStatus, true, '✓ Ready');
    setStatus(outputStatus, true, '✓ View generated');
  }
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function lineColFromPos(text, pos) {
  let line = 1, lineStart = 0;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) { line++; lineStart = i + 1; }
  }
  return { line, col: pos - lineStart + 1 };
}

function showParseError(lang, input, err, renderLeft) {
  let line = err.line, col = err.col;
  if (err.pos !== undefined) ({ line, col } = lineColFromPos(input, err.pos));

  const where = line ? `line ${line}, column ${col}` : '';
  setStatus(inputStatus, false, `✗ Invalid ${lang.toUpperCase()}${where ? ' — ' + where : ''}: ${err.message}`);
  setStatus(outputStatus, false, '✗ Fix the error to see the output');

  currentAst = null;
  lastOutput = null;
  showTreeView();
  rightTreeContent.textContent = '';

  const box = el('div', 'error');
  box.appendChild(el('strong', null, where ? `Parse error on ${where}` : 'Parse error'));
  box.appendChild(el('div', 'error-message', err.message));

  if (line) {
    const all  = input.split('\n');
    const from = Math.max(1, line - 2);
    const width = String(line).length;
    let snippet = '';
    for (let l = from; l <= line; l++) {
      snippet += `${String(l).padStart(width)} | ${(all[l - 1] || '').replace(/\t/g, ' ')}\n`;
    }
    snippet += `${' '.repeat(width)} | ${' '.repeat(Math.max(0, (col || 1) - 1))}^`;
    box.appendChild(el('pre', 'error-snippet', snippet));
  }
  if (lang === 'json') {
    box.appendChild(el('div', 'error-tip', 'Tip: click “Repair” to automatically fix common mistakes such as missing quotes or trailing commas.'));
  }
  rightTreeContent.appendChild(box);

  if (renderLeft) {
    setLeft(input, 'plain');
    if (line) {
      const row = codeEditor.children[line - 1];
      const num = lineNumbers.children[line - 1];
      if (row) row.classList.add('error-line');
      if (num) num.classList.add('error-line');
      codeEditor.scrollTop = Math.max(0, (line - 5) * LINE_HEIGHT);
      syncLeftScroll();
    }
  }
}

// Backwards-compatible name
function handleParseError(e, input) {
  showParseError('json', input, { message: e.message || String(e) }, false);
}

// ── Minify ────────────────────────────────────────────────────────────────────
function minifyCode() {
  const input = getEditorText();
  if (!input.trim()) { setStatus(inputStatus, null, '⚠ Please enter some data first'); return; }
  const type = resolveInputType(input);
  if (type !== 'json' && type !== 'xml') { setStatus(inputStatus, null, '⚠ Minify supports JSON and XML only'); return; }

  let minified;
  try {
    if (type === 'json') {
      const ast = parseJsonAst(input);
      minified = astToText(ast, '');
      currentAst = ast;
    } else {
      const r = xmlFormat(input, true);
      minified = r.text;
      currentAst = valueToAst(xmlDocToObject(r.doc));
    }
  } catch (err) {
    if (!err || !err.isParseError) throw err;
    showParseError(type, input, err, true);
    return;
  }

  setLeft(minified, type);
  if (codeEditor.firstElementChild) codeEditor.firstElementChild.classList.add('minified-line');

  showOutputText(minified, type);
  if (rightCodeEditor.firstElementChild) rightCodeEditor.firstElementChild.classList.add('minified-line');
  if (viewTypeEl) viewTypeEl.value = 'formated';

  const saved = input.length - minified.length;
  setStatus(inputStatus, true, `✓ ${type.toUpperCase()} minified — ${formatBytes(minified.length)} (saved ${formatBytes(Math.max(0, saved))})`);
  setStatus(outputStatus, true, '✓ View updated');
}

// ── Clear all ─────────────────────────────────────────────────────────────────
function clearAll() {
  editorHook('replace', '');
  bumpDoc('left');
  bumpDoc('right');
  clearMatchHighlight();
  if (codeEditor) codeEditor.textContent = '';
  if (foldIconsEl) foldIconsEl.innerHTML = '';
  if (lineNumbers) lineNumbers.innerHTML = numberColumn(1);
  if (rightFoldIcons) rightFoldIcons.innerHTML = '';
  if (rightLineNumbers) rightLineNumbers.innerHTML = numberColumn(1);
  if (rightCodeEditor) rightCodeEditor.innerHTML = '';
  showTreeView();
  if (rightTreeContent) rightTreeContent.innerHTML = '<div class="placeholder">Tree view will appear here after formatting</div>';
  currentAst = null;
  lastOutput = null;
  folds.left  = { list: [], atLine: {} };
  folds.right = { list: [], atLine: {} };
  if (inputStatus)  inputStatus.textContent  = 'Cleared';
  if (outputStatus) outputStatus.textContent = 'Cleared';
  if (codeEditor) codeEditor.focus();
}

// ── Load sample ───────────────────────────────────────────────────────────────
const SAMPLE_JSON = `{
  "customer": {
    "id": "55000",
    "name": "Charter Group",
    "active": true,
    "balance": 1250.75,
    "manager": null,
    "address": [
      { "street": "100 Main",     "city": "Framingham", "state": "MA", "zip": "01701" },
      { "street": "720 Prospect", "city": "Framingham", "state": "MA", "zip": "01701" },
      { "street": "120 Ridge",                          "state": "MA", "zip": "01760" }
    ]
  }
}`;

const SAMPLE_XML = `<?xml version="1.0"?>
<customers>
   <customer id="55000">
      <name>Charter Group</name>
      <address>
         <street>100 Main</street>
         <city>Framingham</city>
         <state>MA</state>
         <zip>01701</zip>
      </address>
      <address>
         <street>720 Prospect</street>
         <city>Framingham</city>
         <state>MA</state>
         <zip>01701</zip>
      </address>
   </customer>
</customers>`;

const SAMPLE_YAML = `# Service configuration
server:
  port: 8080
  host: 0.0.0.0
database:
  url: jdbc:postgresql://localhost:5432/app
  pool:
    min: 2
    max: 10
features:
  - search
  - exports
debug: false
`;

function loadSample() {
  const type = formatTypeEl ? formatTypeEl.value : 'json';
  if (type === 'yaml') { formatCode(true, SAMPLE_YAML, 'yaml', true); return; }
  if (type === 'xml') formatCode(true, SAMPLE_XML, 'xml', true);
  else                formatCode(true, SAMPLE_JSON, 'json', true);
}

// ── Change view type (Tree ↔ Text) ────────────────────────────────────────────
function changeViewType() {
  if (!getEditorText().trim()) return;
  formatCode(false, null, null, null, true);
}

// ── Debounced input handler for live validation ─────────────────────────────
let inputDebounceTimer = null;
function handleEditorInput() {
  bumpDoc('left');
  editorHook('edit');
  clearTimeout(inputDebounceTimer);

  // Line indexes change while editing: drop stale fold markers / error marks
  if (hasFoldedLines('left')) {
    Array.from(codeEditor.children).forEach(c => { c.style.display = ''; c.classList.remove('folded'); });
  }
  folds.left = { list: [], atLine: {} };
  if (foldIconsEl) foldIconsEl.innerHTML = '';
  codeEditor.querySelectorAll('.error-line').forEach(r => r.classList.remove('error-line'));

  updateLineNumbers();
  syncLeftScroll();
  const size = codeEditor.textContent.length;
  inputDebounceTimer = setTimeout(() => {
    formatCode(false, null, null, null, true);
  }, size > 1000000 ? 900 : 300);
}

// ── Format data (API call) ────────────────────────────────────────────────────
function formatData(type, filters) {
  const input = getEditorText();
  if (!input.trim()) { setStatus(inputStatus, null, '⚠ Please enter some data first'); return; }
  const selectedType = resolveInputType(input);

  if (type === 'REPAIR') {
    if (selectedType === 'yaml') {
      setStatus(inputStatus, null, '⚠ Repair works on JSON and XML. For YAML, click Validate YAML to see the exact error.');
      return;
    }
    repairInput(input, selectedType === 'xml' ? 'xml' : 'json');
    return;
  }

  let apiType = type;
  if (selectedType === 'yaml' && type === 'YAML') apiType = 'YAML_FORMAT';
  else if (selectedType === 'yaml' && type === 'JSON') apiType = 'YAML_TO_JSON';
  else if (['TOML', 'YAML', 'CSV', 'SQL'].includes(type)) {
    apiType = selectedType.toUpperCase() + '_TO_' + type;
  }
  if (apiType === 'YAML_FORMAT' || apiType === 'YAML_TO_JSON') setFormatType('yaml');

  setStatus(outputStatus, null, '⏳ Processing…');

  fetch('/data/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: apiType, data: input, filters: filters || null })
  })
  .then(async r => {
    if (r.status === 429 || (r.redirected && /\/429$/.test(r.url))) {
      throw new Error('Too many requests — please wait a moment and try again.');
    }
    try { return await r.json(); }
    catch (_) { throw new Error(`Unexpected server response (HTTP ${r.status})`); }
  })
  .then(res => {
    if (!res.success) {
      // YAML errors come back as "line N, column M: message" → highlight that line
      const pos = /line (\d+), column (\d+): (.*)/.exec(res.message || '');
      if (pos && (apiType === 'YAML_FORMAT' || apiType === 'YAML_TO_JSON')) {
        showParseError('yaml', input, { isParseError: true, line: +pos[1], col: +pos[2], message: pos[3] }, true);
        return;
      }
      showOutputError('Failed: ' + (res.message || 'Unknown error'));
      return;
    }
    let fmt = 'json';
    if (['JSON_TO_XML', 'XML_SORT', 'CSV_TO_XML'].includes(apiType))   fmt = 'xml';
    else if (['JSON_TO_YAML', 'XML_TO_YAML', 'PROPERTY_TO_YAML', 'YAML_FORMAT'].includes(apiType)) fmt = 'yaml';
    else if (['JSON_TO_TOML', 'XML_TO_TOML'].includes(apiType))                     fmt = 'toml';
    else if (['JSON_TO_CSV', 'XML_TO_CSV'].includes(apiType))                       fmt = 'csv';
    else if (['JSON_TO_SQL', 'XML_TO_SQL', 'CSV_TO_SQL'].includes(apiType))         fmt = 'sql';
    else if (apiType === 'YAML_TO_PROPERTY')                                        fmt = 'property';

    const cleanData = String(res.parsedData == null ? '' : res.parsedData).replace(/\r\n/g, '\n');
    if (['JSON_SORT', 'XML_SORT'].includes(type)) {
      formatCode(true, cleanData, fmt, true);          // result replaces the editor content
      setStatus(inputStatus, true, `✓ ${fmt.toUpperCase()} sorted`);
    } else if (apiType === 'YAML_FORMAT') {
      formatCode(true, cleanData, 'yaml', true);
      setStatus(inputStatus, true, '✓ Valid YAML, re-indented (comments are not kept)');
    } else {
      formatCode(true, cleanData, fmt, false);         // conversion → right panel
    }
  })
  .catch(err => showOutputError(err && err.message ? err.message : 'Network error while processing'));
}

// ── Repair (runs in the browser, see repair.js) ───────────────────────────────
function repairInput(input, type) {
  const label = type.toUpperCase();
  const repairer = type === 'xml'
    ? (typeof XmlRepair !== 'undefined' ? XmlRepair : null)
    : (typeof JsonRepair !== 'undefined' ? JsonRepair : null);
  if (!repairer) {
    showOutputError('Repair is not available on this page');
    return;
  }

  let result;
  try {
    result = repairer.repair(input);
  } catch (e) {
    setStatus(inputStatus, false, `✗ Could not repair the ${label}: ${e.message}`);
    showOutputError(`Could not repair the ${label}: ${e.message}`);
    return;
  }

  // Load the repaired text; formatCode reports any error that is still left
  formatCode(true, result.text, type, true);
  if (!currentAst) {
    setStatus(inputStatus, false, `✗ Repair fixed ${result.fixes.length} kind(s) of problem, but the ${label} is still invalid. See the error on the right.`);
    return;
  }

  if (!result.fixes.length) {
    setStatus(inputStatus, true, `✓ Nothing to repair: the ${label} was already valid`);
    return;
  }
  setStatus(inputStatus, true, `✓ ${label} repaired: ${result.fixes.join(' · ')}`);

  // Short report above the tree so the user can see what changed
  if (rightTreeContent && rightTreeContent.style.display !== 'none') {
    const box = el('div', 'repair-report');
    box.appendChild(el('strong', null, `Repaired ${label}`));
    const ul = document.createElement('ul');
    result.fixes.forEach(f => ul.appendChild(el('li', null, f)));
    box.appendChild(ul);
    const close = el('button', 'repair-report-close', '×');
    close.type = 'button';
    close.title = 'Dismiss';
    close.addEventListener('click', () => box.remove());
    box.appendChild(close);
    rightTreeContent.insertBefore(box, rightTreeContent.firstChild);
  }
}

function showOutputError(message) {
  showTreeView();
  rightTreeContent.textContent = '';
  rightTreeContent.appendChild(el('div', 'error', message));
  setStatus(outputStatus, false, '✗ ' + message);
  lastOutput = null;
}

// ── Panel expand / collapse ───────────────────────────────────────────────────
function toggleExpand(side) {
  const container      = document.getElementById('mainContainer');
  const leftPanel      = document.getElementById('leftPanel');
  const middleControls = document.getElementById('middleControls');
  const rightPanel     = document.getElementById('rightPanel');
  const leftIcon       = document.getElementById('leftExpandIcon');
  const rightIcon      = document.getElementById('rightExpandIcon');
  const leftHeader     = document.getElementById('leftPanelHeader');
  const rightHeader    = document.getElementById('rightPanelHeader');

  container.classList.remove('expanded-left', 'expanded-right');
  [leftPanel, middleControls, rightPanel].forEach(p => p && p.classList.remove('hidden'));
  [leftHeader, rightHeader].forEach(h => h && h.classList.remove('expanded-header'));
  if (leftIcon)  leftIcon.textContent  = '⛶';
  if (rightIcon) rightIcon.textContent = '⛶';

  if (expandedPanel === side) {
    document.body.classList.remove('panel-expanded');
    expandedPanel = null;
    return;
  }

  document.body.classList.add('panel-expanded');
  container.classList.add(side === 'left' ? 'expanded-left' : 'expanded-right');
  if (middleControls) middleControls.classList.add('hidden');
  if (side === 'left') {
    if (rightPanel) rightPanel.classList.add('hidden');
    if (leftHeader) leftHeader.classList.add('expanded-header');
    if (leftIcon)   leftIcon.textContent = '✕';
  } else {
    if (leftPanel)   leftPanel.classList.add('hidden');
    if (rightHeader) rightHeader.classList.add('expanded-header');
    if (rightIcon)   rightIcon.textContent = '✕';
  }
  expandedPanel = side;
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
  const text = getOutputText().trim();
  if (!text) { alert('Nothing to export yet — convert your data to CSV first.'); return; }
  const isCsv = lastOutput && lastOutput.lang === 'csv';
  const first = text.split(/\r?\n/)[0];
  if (!isCsv && !/[,;\t]/.test(first)) {
    alert('The output is not CSV — click "Convert to CSV" first.');
    return;
  }
  downloadFile(text, 'data.csv', 'text/csv;charset=utf-8');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(el, success, msg) {
  if (!el) return;
  const span = document.createElement('span');
  span.className = success === true ? 'success' : success === false ? 'error-text' : 'warning';
  span.textContent = msg;
  span.title = msg;
  el.textContent = '';
  el.appendChild(span);
}

// ── SQL Modal ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const convertToSqlBtn       = document.getElementById('convertToSqlBtn');
  const sqlModalOverlay       = document.getElementById('sqlModalOverlay');
  const sqlModalCloseBtn      = document.getElementById('sqlModalCloseBtn');
  const sqlModalCancelBtn     = document.getElementById('sqlModalCancelBtn');
  const sqlGenerateBtn        = document.getElementById('sqlGenerateBtn');
  const sqlTableNameInput     = document.getElementById('sqlTableName');
  const sqlDbTypeSelect       = document.getElementById('sqlDbType');
  const sqlIncludeNullsCheck  = document.getElementById('sqlIncludeNulls');

  // Only wire up if modal elements exist on this page
  if (!convertToSqlBtn || !sqlModalOverlay) return;

  function openSqlModal() {
    if (!getEditorText().trim()) { setStatus(inputStatus, null, '⚠ Please enter some data first'); return; }
    if (!sqlTableNameInput.value) sqlTableNameInput.value = 'users';
    sqlModalOverlay.style.display = 'flex';
    sqlTableNameInput.focus();
    sqlTableNameInput.select();
  }

  function closeSqlModal() {
    sqlModalOverlay.style.display = 'none';
  }

  function generate() {
    const tableName = (sqlTableNameInput.value || 'users').trim();
    if (!/^[A-Za-z_][\w.]*$/.test(tableName)) {
      sqlTableNameInput.setCustomValidity('Use letters, digits and underscores only');
      sqlTableNameInput.reportValidity();
      return;
    }
    sqlTableNameInput.setCustomValidity('');
    formatData('SQL', { tableName, dialect: sqlDbTypeSelect.value, includeNulls: sqlIncludeNullsCheck.checked });
    closeSqlModal();
  }

  convertToSqlBtn.addEventListener('click', openSqlModal);
  sqlModalCloseBtn.addEventListener('click', closeSqlModal);
  sqlModalCancelBtn.addEventListener('click', closeSqlModal);
  sqlGenerateBtn.addEventListener('click', generate);
  sqlTableNameInput.addEventListener('input', () => sqlTableNameInput.setCustomValidity(''));
  sqlTableNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });

  sqlModalOverlay.addEventListener('click', e => {
    if (e.target === sqlModalOverlay) closeSqlModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sqlModalOverlay.style.display !== 'none') closeSqlModal();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  Share modal
// ══════════════════════════════════════════════════════════════════════════════
const SD_EP = window.location.origin + '/data/share/text';
let _sdSource = 'input';

function openShareModal(source) {
  _sdSource = source || 'input';
  document.getElementById('sdForm').style.display    = 'block';
  document.getElementById('sdLoader').classList.remove('show');
  document.getElementById('sdSuccess').style.display = 'none';
  document.getElementById('sdError').style.display   = 'none';
  document.getElementById('sdError').textContent     = '';
  document.getElementById('sdOneTime').checked       = false;
  const emailInput = document.getElementById('sdEmail');
  if (emailInput) emailInput.value = '';
  const emailStatus = document.getElementById('sdEmailStatus');
  if (emailStatus) {
    emailStatus.style.display = 'none';
    emailStatus.textContent = '';
  }
  setSdSource(_sdSource);
  document.getElementById('sdOverlay').classList.add('show');
}

function closeSdModal() {
  document.getElementById('sdOverlay').classList.remove('show');
}

function setSdSource(src) {
  _sdSource = src;
  document.getElementById('sdSrcInput') .classList.toggle('active', src === 'input');
  document.getElementById('sdSrcOutput').classList.toggle('active', src === 'output');
}

function getSdContent() {
  return (_sdSource === 'input' ? getEditorText() : getOutputText()).trim();
}

function showSdError(message) {
  const err = document.getElementById('sdError');
  err.textContent = message;
  err.style.display = 'block';
}

async function doShare(sendEmail) {
  const text = getSdContent();
  if (!text) {
    showSdError(_sdSource === 'output'
      ? '⚠ Nothing to share — the output panel is empty. Format or convert something first.'
      : '⚠ Nothing to share — the editor is empty.');
    return;
  }

  const emailInput = document.getElementById('sdEmail');
  const email = emailInput ? emailInput.value.trim() : '';

  if (sendEmail && !email) {
    showSdError('⚠ Please enter a recipient email to send on mail.');
    if (emailInput) emailInput.focus();
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSdError('⚠ Please enter a valid email address.');
    if (emailInput) emailInput.focus();
    return;
  }

  const oneTime = document.getElementById('sdOneTime').checked;

  document.getElementById('sdForm').style.display  = 'none';
  document.getElementById('sdLoader').classList.add('show');
  document.getElementById('sdError').style.display = 'none';

  try {
    const payload = { text, oneTimeDownload: oneTime, sourcePage: window.location.pathname };
    if (email) payload.email = email;

    const res = await fetch(SD_EP, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (res.status === 429 || (res.redirected && /\/429$/.test(res.url))) {
      throw new Error('Too many requests — please wait a moment and try again.');
    }
    let json;
    try { json = await res.json(); }
    catch (_) { throw new Error('Unexpected server response (HTTP ' + res.status + ')'); }
    if (!res.ok || !json.success) throw new Error(json.message || 'Server error ' + res.status);

    document.getElementById('sdLoader').classList.remove('show');
    document.getElementById('sdSuccess').style.display = 'block';

    const token = json.token || (json.url ? json.url.substring(json.url.lastIndexOf('/') + 1) : '');
    const keyEl = document.getElementById('sdKeyText');
    if (keyEl) keyEl.textContent = token;

    document.getElementById('sdUrlText').textContent = json.url;
    document.getElementById('sdSuccessSub').textContent =
      `${text.length.toLocaleString()} chars · ${_sdSource} panel` + (oneTime ? ' · one-time' : '');

    const statusEl = document.getElementById('sdEmailStatus');
    if (statusEl) {
      statusEl.style.display = 'none';
      if (email && json.emailSent) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(0,200,150,.12)';
        statusEl.style.borderColor = 'rgba(0,200,150,.3)';
        statusEl.style.color = '#00ddb3';
        statusEl.textContent = `✓ Drop sent to ${email}`;
      } else if (email && json.mailtoUrl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(255,170,0,.1)';
        statusEl.style.borderColor = 'rgba(255,170,0,.3)';
        statusEl.style.color = '#ffb84d';
        statusEl.textContent = `✉ Opening email client for ${email}...`;
        window.open(json.mailtoUrl, '_blank');
      }
    }
  } catch (err) {
    document.getElementById('sdLoader').classList.remove('show');
    document.getElementById('sdForm').style.display = 'block';
    showSdError('⚠ ' + err.message);
  }
}

function flashCopied(btn, label) {
  if (!btn) return;
  btn.textContent = '✓ Copied!';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2200);
}

function sdCopyUrl() {
  const url = document.getElementById('sdUrlText').textContent;
  const btn = document.getElementById('sdCopyBtn');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => flashCopied(btn, '⎘ Copy Link'));
  } else if (fallbackCopy(url)) {
    flashCopied(btn, '⎘ Copy Link');
  }
}

function sdCopyKey() {
  const keyEl = document.getElementById('sdKeyText');
  const key = keyEl ? keyEl.textContent : '';
  if (!key || key === '-----') return;
  const btn = document.getElementById('sdCopyKeyBtn');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(key).then(() => flashCopied(btn, '⎘ Copy Key'));
  } else if (fallbackCopy(key)) {
    flashCopied(btn, '⎘ Copy Key');
  }
}

// ── Auto-load shared drop if ?drop=token is present in URL ──────────────────
async function checkAndLoadSharedDrop() {
  const dropToken = new URLSearchParams(window.location.search).get('drop');
  if (!dropToken) return;

  try {
    const res = await fetch('/data/shared/' + encodeURIComponent(dropToken));
    if (!res.ok) {
      showDropToast('⚠ Could not load shared drop (link may be expired or already used).', 'error');
      return;
    }
    const content = await res.text();
    setEditorText(content.replace(/\r\n?/g, '\n'));
    try { formatCode(false, null, null); } catch (e) { console.warn('Auto-format skipped:', e); }
    showDropToast('✓ Shared content loaded into editor!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (err) {
    console.error('Failed to load drop:', err);
    showDropToast('⚠ Error loading drop: ' + err.message, 'error');
  }
}

function showDropToast(msg, type) {
  let toast = document.getElementById('sdToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sdToast';
    toast.style.cssText = `
      position: fixed; top: 20px; right: 24px; z-index: 9999;
      padding: 12px 20px; border-radius: 10px; font-family: inherit;
      font-size: 0.88rem; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex; align-items: center; gap: 10px;
    `;
    document.body.appendChild(toast);
  }
  if (type === 'error') {
    toast.style.background = '#251015';
    toast.style.color = '#ff6b81';
    toast.style.border = '1px solid #ff4f6a';
  } else {
    toast.style.background = '#0e2420';
    toast.style.color = '#00ddb3';
    toast.style.border = '1px solid #00c896';
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
  }, 4000);
}

// Close share modal on backdrop click / Escape
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('sdOverlay');
  if (!overlay) return;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSdModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('show')) closeSdModal();
  });
});
