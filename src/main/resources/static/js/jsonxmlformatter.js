/* ============================================================
   jsonxmlformatter.js  –  shared logic for JSON, XML, JSON/XML editors
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────────
let currentData           = null;
let expandedStates        = {};
let foldStates            = {};
let foldHierarchy         = {};
let rightPanelFoldStates  = {};
let rightPanelFoldHierarchy = {};
let expandedPanel         = null;

// ── DOM refs (assigned after DOM ready) ───────────────────────────────────────
let codeEditor, lineNumbers, foldIconsEl,
    rightCodeEditor, rightLineNumbers, rightFoldIcons,
    rightEditorWrapper, rightTreeContent,
    inputStatus, outputStatus,
    formatTypeEl, viewTypeEl;

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
  viewTypeEl        = document.getElementById('viewType');

  if (!codeEditor) return;

  codeEditor.addEventListener('input',  updateLineNumbers);
  codeEditor.addEventListener('scroll', syncLeftScroll);
  codeEditor.addEventListener('paste',  handlePaste);

  if (rightCodeEditor) {
    rightCodeEditor.addEventListener('scroll', syncRightScroll);
    rightCodeEditor.addEventListener('input',  updateRightLineNumbers);
  }

  // CSV export button
  const csvBtn = document.getElementById('downloadCsvBtn');
  if (csvBtn) csvBtn.addEventListener('click', exportCSV);

  updateLineNumbers();
  showTreeView();
}

document.addEventListener('DOMContentLoaded', initEditor);

// ── Scroll sync ───────────────────────────────────────────────────────────────
function syncLeftScroll() {
  if (lineNumbers)  lineNumbers.scrollTop  = codeEditor.scrollTop;
  if (foldIconsEl)  foldIconsEl.scrollTop  = codeEditor.scrollTop;
}

function syncRightScroll() {
  if (rightLineNumbers) rightLineNumbers.scrollTop = rightCodeEditor.scrollTop;
  if (rightFoldIcons)   rightFoldIcons.scrollTop   = rightCodeEditor.scrollTop;
}

// ── Paste (plain text only) ───────────────────────────────────────────────────
function handlePaste(e) {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
}

// ── Get raw text from left editor ─────────────────────────────────────────────
function getEditorText() {
  const lines = codeEditor.querySelectorAll('.code-line');
  if (lines.length > 0) {
    return Array.from(lines).map(l => l.textContent).join('\n');
  }

  const children = Array.from(codeEditor.childNodes);
  if (children.length === 0) return '';
  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
    return children[0].textContent;
  }

  let text = '';
  children.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeName === 'BR') {
      text += '\n';
    } else if (node.nodeName === 'DIV') {
      if (text.length && !text.endsWith('\n')) text += '\n';
      text += node.textContent || '';
    }
  });
  return text;
}

// ── Left panel line numbers ───────────────────────────────────────────────────
function updateLineNumbers() {
  if (!codeEditor || !lineNumbers) return;
  const codeLines = codeEditor.querySelectorAll('.code-line');
  let count;
  if (codeLines.length > 0) {
    count = codeLines.length;
  } else {
    const html = codeEditor.innerHTML;
    const divs = (html.match(/<div[^>]*>/gi) || []).length;
    const brs  = (html.match(/<br[^>]*>/gi)  || []).length;
    count = (divs === 0 && brs === 0) ? 1 : (divs > 0 ? divs + 1 : brs + 1);
  }
  lineNumbers.textContent = Array.from({length: count}, (_, i) => i + 1).join('\n') + '\n';
  if (!Object.keys(foldHierarchy).length && foldIconsEl) foldIconsEl.innerHTML = '';
}

// ── Right panel line numbers ──────────────────────────────────────────────────
function updateRightLineNumbers() {
  if (!rightLineNumbers || !rightCodeEditor) return;
  const count = rightCodeEditor.querySelectorAll('.code-line').length;
  rightLineNumbers.textContent = Array.from({length: count}, (_, i) => i + 1).join('\n') + '\n';
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

// ── Syntax highlight (JSON) ───────────────────────────────────────────────────
function highlightSyntax(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g,  '<span class="key">"$1"</span>:')
    .replace(/:\s*"([^"]*)"/g, ': <span class="string">"$1"</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="number">$1</span>')
    .replace(/:\s*(true|false)/g,  ': <span class="boolean">$1</span>')
    .replace(/:\s*(null)/g,        ': <span class="null">$1</span>')
    .replace(/([{}\[\]])/g,        '<span class="bracket">$1</span>')
    .replace(/,(?![^"]*"(?:[^"]*"[^"]*")*[^"]*$)/g, '<span class="bracket">,</span>');
}

// ── Syntax highlight (XML) ────────────────────────────────────────────────────
function highlightXMLLine(line) {
  let r = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // processing instruction
  r = r.replace(/(&lt;\?xml\s+)(.*?)(\?&gt;)/g, (_,s,attrs,e) =>
    `<span class="bracket">&lt;?</span><span class="xml-tag">xml</span> ` +
    attrs.trim().replace(/([\w:-]+)\s*=\s*"([^"]*)"/g,
      '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>') +
    ` <span class="bracket">?&gt;</span>`);
  // opening tags
  r = r.replace(/(&lt;)([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)(&gt;)/g,
    (_,lt,tag,attrs,slash,gt) => {
      let h = `<span class="bracket">&lt;</span><span class="xml-tag">${tag}</span>`;
      if (attrs.trim()) h += ' ' + attrs.trim().replace(/([\w:-]+)\s*=\s*"([^"]*)"/g,
        '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
      if (slash) h += '<span class="bracket">/</span>';
      return h + '<span class="bracket">&gt;</span>';
    });
  // closing tags
  r = r.replace(/(&lt;\/)([\w:-]+)(&gt;)/g,
    '<span class="bracket">&lt;/</span><span class="xml-tag">$2</span><span class="bracket">&gt;</span>');
  // text nodes
  r = r.replace(/(&gt;)([^&<]+)(&lt;)/g, (m, gt, content, lt) =>
    content.trim() ? `${gt}<span class="xml-text">${content}</span>${lt}` : m);
  return r;
}

// ── Render colored code – left panel (no right-panel fold icons) ──────────────
function renderColoredCode(json) {
  const lines = json.split('\n');
  let codeHtml = '', numbersHtml = '';
  let fId = 0, stack = [];
  foldHierarchy = {};

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const indent  = line.length - line.trimStart().length;
    const spaces  = ' '.repeat(indent);
    const lineNum = idx + 1;
    const parent  = stack.length ? stack[stack.length - 1] : null;

    const parentAttr = parent ? ` data-parent="${parent}"` : '';

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const id = 'fold_' + (fId++);
      stack.push(id);
      if (parent) {
        if (!foldHierarchy[parent]) foldHierarchy[parent] = [];
        foldHierarchy[parent].push(id);
      }
      codeHtml    += `<div class="code-line"${parentAttr}>${spaces}${highlightSyntax(trimmed)}</div>`;
      numbersHtml += `<div class="code-line"${parentAttr}>${lineNum}</div>`;
    } else if (/^[}\]],?$/.test(trimmed)) {
      stack.pop();
      const newParent = stack.length ? stack[stack.length - 1] : null;
      const np = newParent ? ` data-parent="${newParent}"` : '';
      codeHtml    += `<div class="code-line"${np}>${spaces}${highlightSyntax(trimmed)}</div>`;
      numbersHtml += `<div class="code-line"${np}>${lineNum}</div>`;
    } else {
      codeHtml    += `<div class="code-line"${parentAttr}>${spaces}${highlightSyntax(trimmed)}</div>`;
      numbersHtml += `<div class="code-line"${parentAttr}>${lineNum}</div>`;
    }
  });

  return { code: codeHtml, numbers: numbersHtml };
}

// ── Render colored code with fold icons – right panel Text View ───────────────
function renderColoredCodeWithFolds(text) {
  const lines  = text.split('\n');
  const isXML  = text.trimStart().startsWith('<');
  let codeHtml = '', numbersHtml = '', iconsHtml = '';
  let fId = 0, stack = [];
  rightPanelFoldHierarchy = {};

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const indent  = line.length - line.trimStart().length;
    const spaces  = ' '.repeat(indent);
    const lineNum = idx + 1;
    const parent  = stack.length ? stack[stack.length - 1] : null;
    const parentAttr = parent ? ` data-right-parent="${parent}"` : '';

    // For XML: use XML highlighter on full line (preserves indentation);
    // For JSON: use JSON highlighter on trimmed line + manual indent
    const highlighted = isXML ? highlightXMLLine(line) : spaces + highlightSyntax(trimmed);

    // Only JSON gets fold tracking (XML fold is complex, skip for now)
    const hasBrace = !isXML && (trimmed.startsWith('{') || trimmed.startsWith('[') ||
                                trimmed.includes('{')   || trimmed.includes('['));

    if (hasBrace) {
      const id = 'right_fold_' + (fId++);
      stack.push(id);
      if (parent) {
        if (!rightPanelFoldHierarchy[parent]) rightPanelFoldHierarchy[parent] = [];
        rightPanelFoldHierarchy[parent].push(id);
      }
      codeHtml    += `<div class="code-line"${parentAttr}>${highlighted}</div>`;
      numbersHtml += `<div class="code-line"${parentAttr}>${lineNum}</div>`;
      iconsHtml   += `<div class="fold-arrow"${parentAttr} id="right_arrow_${id}" onclick="toggleRightPanelFold('${id}')">▼</div>`;
    } else if (!isXML && /^[}\]],?$/.test(trimmed)) {
      stack.pop();
      const newParent = stack.length ? stack[stack.length - 1] : null;
      const np = newParent ? ` data-right-parent="${newParent}"` : '';
      codeHtml    += `<div class="code-line"${np}>${highlighted}</div>`;
      numbersHtml += `<div class="code-line"${np}>${lineNum}</div>`;
      iconsHtml   += `<div class="fold-arrow"${np}></div>`;
    } else {
      codeHtml    += `<div class="code-line"${parentAttr}>${highlighted}</div>`;
      numbersHtml += `<div class="code-line"${parentAttr}>${lineNum}</div>`;
      iconsHtml   += `<div class="fold-arrow"${parentAttr}></div>`;
    }
  });

  return { code: codeHtml, numbers: numbersHtml, icons: iconsHtml };
}

// ── Populate right panel Text View ────────────────────────────────────────────
function populateTextView(formatted) {
  const r = renderColoredCodeWithFolds(formatted);
  rightFoldIcons.innerHTML   = r.icons;
  rightLineNumbers.innerHTML = r.numbers;
  rightCodeEditor.innerHTML  = r.code;
  rightPanelFoldStates = {};
  showTextView();
}

// ── Left panel fold ───────────────────────────────────────────────────────────
function toggleFold(foldId) {
  foldStates[foldId] = !foldStates[foldId];
  const arrow = document.getElementById('arrow_' + foldId);
  if (foldStates[foldId]) {
    arrow.textContent = '▶';
    hideAllDescendants(foldId);
  } else {
    arrow.textContent = '▼';
    showDirectChildren(foldId);
  }
}

function hideAllDescendants(foldId) {
  document.querySelectorAll(`[data-parent="${foldId}"]`).forEach(el => el.style.display = 'none');
  (foldHierarchy[foldId] || []).forEach(childId => {
    const a = document.getElementById('arrow_' + childId);
    if (a) a.style.display = 'none';
    hideAllDescendants(childId);
  });
}

function showDirectChildren(foldId) {
  document.querySelectorAll(`[data-parent="${foldId}"]`).forEach(el => el.style.display = 'block');
  (foldHierarchy[foldId] || []).forEach(childId => {
    const a = document.getElementById('arrow_' + childId);
    if (a) a.style.display = 'block';
    if (!foldStates[childId]) showDirectChildren(childId);
  });
}

// ── Right panel fold ──────────────────────────────────────────────────────────
function toggleRightPanelFold(foldId) {
  rightPanelFoldStates[foldId] = !rightPanelFoldStates[foldId];
  const arrow = document.getElementById('right_arrow_' + foldId);
  if (rightPanelFoldStates[foldId]) {
    arrow.textContent = '▶';
    hideRightDescendants(foldId);
  } else {
    arrow.textContent = '▼';
    showRightDirectChildren(foldId);
  }
}

function hideRightDescendants(foldId) {
  document.querySelectorAll(`[data-right-parent="${foldId}"]`).forEach(el => el.style.display = 'none');
  (rightPanelFoldHierarchy[foldId] || []).forEach(childId => {
    const a = document.getElementById('right_arrow_' + childId);
    if (a) a.style.display = 'none';
    hideRightDescendants(childId);
  });
}

function showRightDirectChildren(foldId) {
  document.querySelectorAll(`[data-right-parent="${foldId}"]`).forEach(el => el.style.display = 'block');
  (rightPanelFoldHierarchy[foldId] || []).forEach(childId => {
    const a = document.getElementById('right_arrow_' + childId);
    if (a) a.style.display = 'block';
    if (!rightPanelFoldStates[childId]) showRightDirectChildren(childId);
  });
}

// ── XML utilities ─────────────────────────────────────────────────────────────
function formatXML(xml) {
  let formatted = '', indent = '';
  xml.split(/>\s*</).forEach(node => {
    if (node.match(/^\/\w/)) indent = indent.substring(2);
    formatted += indent + '<' + node + '>\n';
    if (node.match(/^<?\w[^>]*[^\/]$/) && !node.match(/^!/) && !node.match(/^\?/)) indent += '  ';
  });
  return formatted.substring(1, formatted.length - 2);
}

function validateXML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const err = doc.querySelector('parsererror');
  if (err) return { valid: false, error: err.textContent || 'XML syntax error' };

  const openTags = [];
  const tagRegex = /<\/?[\w:-]+[^>]*>/g;
  for (const tag of xml.match(tagRegex) || []) {
    if (tag.startsWith('<?') || tag.startsWith('<!') || tag.endsWith('/>')) continue;
    const name = tag.match(/<\/?([^\s>]+)/)[1];
    if (tag.startsWith('</')) {
      if (!openTags.length || openTags[openTags.length-1] !== name)
        return { valid: false, error: `Missing opening tag for </${name}>` };
      openTags.pop();
    } else {
      openTags.push(name);
    }
  }
  if (openTags.length) return { valid: false, error: `Missing closing tag for <${openTags[openTags.length-1]}>` };
  return { valid: true };
}

function parseXMLToObject(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  function xmlToJson(node) {
    if (node.nodeType === 3) return node.nodeValue.trim();
    let obj = {};
    if (node.attributes) {
      for (let a of node.attributes) obj['@' + a.name] = a.value;
    }
    for (let child of node.childNodes) {
      if (child.nodeType === 3) {
        const t = child.nodeValue.trim();
        if (t) return t;
      } else {
        const n = child.nodeName;
        if (obj[n] === undefined) obj[n] = xmlToJson(child);
        else { if (!Array.isArray(obj[n])) obj[n] = [obj[n]]; obj[n].push(xmlToJson(child)); }
      }
    }
    return obj;
  }
  return { [doc.documentElement.nodeName]: xmlToJson(doc.documentElement) };
}

// ── Tree render ───────────────────────────────────────────────────────────────
function renderTree(data) {
  showTreeView();
  rightTreeContent.innerHTML = '';

  function renderNode(obj, parent, key, level, path) {
    const nodeId = path + '_' + key;

    if (Array.isArray(obj)) {
      const isExp = expandedStates[nodeId] !== false;
      const line  = makeTreeLine(level);
      const toggle = span('tree-expand', isExp ? '▼' : '▶');
      toggle.onclick = () => { expandedStates[nodeId] = !isExp; renderTree(currentData); };
      line.appendChild(toggle);
      line.appendChild(span('tree-key', key));
      line.appendChild(text(' : ['));
      line.appendChild(span('tree-count', obj.length + ' items'));
      line.appendChild(text(']'));
      parent.appendChild(line);
      if (isExp) obj.forEach((item, i) => renderNode(item, parent, String(i), level+1, nodeId));

    } else if (obj !== null && typeof obj === 'object') {
      const keys = Object.keys(obj);
      const isExp = expandedStates[nodeId] !== false;
      const line  = makeTreeLine(level);
      const toggle = span('tree-expand', isExp ? '▼' : '▶');
      toggle.onclick = () => { expandedStates[nodeId] = !isExp; renderTree(currentData); };
      line.appendChild(toggle);
      line.appendChild(span('tree-key', key));
      line.appendChild(text(' : {'));
      line.appendChild(span('tree-count', keys.length + ' props'));
      line.appendChild(text('}'));
      parent.appendChild(line);
      if (isExp) keys.forEach(k => renderNode(obj[k], parent, k, level+1, nodeId));

    } else {
      const line = makeTreeLine(level);
      line.appendChild(text('  '));
      line.appendChild(span('tree-key', key));
      line.appendChild(text(' : '));
      let cls = 'tree-null', val = 'null';
      if      (typeof obj === 'string')  { cls = 'tree-string';  val = `"${obj}"`; }
      else if (typeof obj === 'number')  { cls = 'tree-number';  val = String(obj); }
      else if (typeof obj === 'boolean') { cls = 'tree-boolean'; val = String(obj); }
      line.appendChild(span(cls, val));
      parent.appendChild(line);
    }
  }

  function makeTreeLine(level) {
    const d = document.createElement('div');
    d.style.marginLeft = (level * 20) + 'px';
    return d;
  }
  function span(cls, txt) {
    const s = document.createElement('span');
    s.className = cls; s.textContent = txt; return s;
  }
  function text(t) { return document.createTextNode(t); }

  renderNode(data, rightTreeContent, 'root', 0, '');
}

// ── Format code (main entry) ──────────────────────────────────────────────────
function formatCode(isConverterReq, data, convertedType, isFromSample,autoformat) {
  let input = isConverterReq ? data : getEditorText();
  let type  = isConverterReq ? convertedType : (formatTypeEl ? formatTypeEl.value : 'json');
  const viewType = viewTypeEl ? viewTypeEl.value : 'tree';

  if (!input || !input.trim()) return;

  try {
    if (type === 'json') {
      let parsed = JSON.parse(input);
      currentData = parsed;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      const formatted = JSON.stringify(parsed, null, 2);

      // Only update the LEFT editor when formatting in-place (not a conversion result)
      if ((!isConverterReq || isFromSample) && !autoformat) {
        const rendered = renderColoredCode(formatted);
        codeEditor.innerHTML  = rendered.code;
        lineNumbers.innerHTML = rendered.numbers;
        foldStates = {};
      }

      // Conversions show as colored text view; direct format respects viewType
      if (isConverterReq && !isFromSample) {
        populateTextView(formatted);
      } else if (viewType === 'tree') {
        renderTree(parsed);
      } else {
        populateTextView(formatted);
      }

      setStatus(inputStatus, true, '✓ JSON formatted successfully!');
      setStatus(outputStatus, true, '✓ View generated');

    } else if (type === 'xml') {
      if (/^["']?[{[]/.test(input.trim())) {
        showTreeView();
        rightTreeContent.innerHTML = '<span class="error">Invalid XML — looks like JSON.</span>';
        return;
      }
      const validation = validateXML(input);
      const formatted  = formatXML(input);
      const lines      = formatted.split('\n');
      let codeHtml = '', numbersHtml = '';
      lines.forEach((line, idx) => {
        codeHtml    += `<div class="code-line">${highlightXMLLine(line)}</div>`;
        numbersHtml += `<div class="code-line">${idx + 1}</div>`;
      });

      if (isFromSample || !isConverterReq) {
        codeEditor.innerHTML  = codeHtml;
        lineNumbers.innerHTML = numbersHtml;
        foldIconsEl.innerHTML = '';
        foldHierarchy = {};
      }

      const parsed = parseXMLToObject(input);
      currentData = parsed;

      // Conversions show as colored text view; direct format respects viewType
      if (isConverterReq && !isFromSample) {
        populateTextView(formatted);
      } else if (viewType === 'tree') {
        renderTree(parsed);
      } else {
        populateTextView(formatted);
      }

      if (!validation.valid) {
        setStatus(inputStatus, false, '✗ ' + validation.error);
        showTreeView();
        rightTreeContent.innerHTML = `<div class="error">${escapeHtml(validation.error)}</div>`;
        return;
      }

      setStatus(inputStatus, true, '✓ XML formatted successfully!');
      setStatus(outputStatus, true, '✓ Tree view generated');

    } else {
      // Plain output (YAML, TOML, CSV, SQL)
      showTreeView();
      rightTreeContent.style.padding = '15px';
      rightTreeContent.innerHTML = `<pre style="color:#e3dfd8;margin:0;white-space:pre-wrap;word-break:break-all;">${escapeHtml(input)}</pre>`;
    }

  } catch (e) {
    handleParseError(e, input);
  }
}

function handleParseError(e, input) {
  let errorMsg = e.message;
  const posMatch = errorMsg.match(/at position (\d+)/);

  if (posMatch && input) {
    const pos     = parseInt(posMatch[1]);
    const before  = input.substring(0, pos);
    const linesB  = before.split('\n');
    const lineNum = linesB.length;
    const col     = linesB[linesB.length - 1].length + 1;

    let suggestion = '';
    if (errorMsg.includes("Expected ','"))            suggestion = ' → Missing comma after previous property';
    else if (errorMsg.includes("Expected '}'"))       suggestion = ' → Missing closing brace }';
    else if (errorMsg.includes("Expected ']'"))       suggestion = ' → Missing closing bracket ]';
    else if (errorMsg.includes("Expected ':'"))       suggestion = ' → Missing colon after property name';
    else if (errorMsg.includes("Expected double"))    suggestion = ' → Property name must be in double quotes';
    else if (errorMsg.includes("Unexpected token"))   suggestion = ' → Unexpected character found';

    errorMsg = errorMsg.replace(/\(line \d+ column \d+\)/, `(line ${lineNum} column ${col})`);
    const allLines   = input.split('\n');
    const lineContent = allLines[lineNum - 1] || '';
    const prevLine    = lineNum > 1 ? allLines[lineNum - 2] : '';
    const pointer     = ' '.repeat(col - 1) + '↑';

    let html = `<div class="error"><strong>Parse Error on Line ${lineNum}:</strong><br><br>
      ${escapeHtml(errorMsg)}${escapeHtml(suggestion)}<br><br>
      <strong>Problem area:</strong><br>
      <code style="display:block;background:#2a2a2a;padding:10px;margin:10px 0;font-family:monospace;">`;
    if (prevLine) html += `Line ${lineNum-1}: ${escapeHtml(prevLine)}<br>`;
    html += `Line ${lineNum}: ${escapeHtml(lineContent)}<br>`;
    html += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${pointer.replace(/ /g,'&nbsp;')} <span style="color:#ff6b6b">Error here</span>`;
    html += `</code>`;
    if (suggestion) html += `<br><strong>Fix:</strong> ${escapeHtml(suggestion.substring(3))}`;
    html += `</div>`;

    showTreeView();
    rightTreeContent.innerHTML = html;
    setStatus(inputStatus, false, '✗ ' + errorMsg);
    return;
  }

  setStatus(inputStatus, false, '✗ ' + e.message);
  showTreeView();
  if (rightTreeContent) rightTreeContent.innerHTML = `<div class="error">Parse Error: ${escapeHtml(e.message)}</div>`;
}

// ── Minify ────────────────────────────────────────────────────────────────────
function minifyCode() {
  const input = getEditorText();
  const type  = formatTypeEl ? formatTypeEl.value : 'json';
  if (!input) { setStatus(inputStatus, null, '⚠ Please enter some code first!'); return; }

  try {
    if (type === 'json') {
      const parsed = JSON.parse(input);
      codeEditor.textContent = JSON.stringify(parsed);
      foldHierarchy = {};
      foldIconsEl.innerHTML = '';
      updateLineNumbers();
      currentData = parsed;
      renderTree(parsed);
      setStatus(inputStatus, true, '✓ JSON minified successfully!');
      setStatus(outputStatus, true, '✓ Tree view updated');
    } else {
      codeEditor.textContent = input.replace(/>\s+</g, '><').trim();
      foldHierarchy = {};
      foldIconsEl.innerHTML = '';
      updateLineNumbers();
      setStatus(inputStatus, true, '✓ XML minified successfully!');
    }
  } catch (e) {
    setStatus(inputStatus, false, '✗ ' + e.message);
  }
}

// ── Clear all ─────────────────────────────────────────────────────────────────
function clearAll() {
  codeEditor.textContent = '';
  foldIconsEl.innerHTML  = '';
  rightFoldIcons.innerHTML   = '';
  rightLineNumbers.innerHTML = '';
  rightCodeEditor.innerHTML  = '';
  showTreeView();
  rightTreeContent.innerHTML = '<div style="padding:20px;color:#858585;">Tree view will appear here after formatting</div>';
  updateLineNumbers();
  currentData = null;
  expandedStates = {};
  foldStates = {};
  foldHierarchy = {};
  rightPanelFoldStates = {};
  rightPanelFoldHierarchy = {};
  if (inputStatus)  inputStatus.textContent  = 'Cleared';
  if (outputStatus) outputStatus.textContent = 'Cleared';
}

// ── Load sample ───────────────────────────────────────────────────────────────
const SAMPLE_JSON = `{
  "customer": {
    "id": "55000",
    "name": "Charter Group",
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

function loadSample() {
  const type = formatTypeEl ? formatTypeEl.value : 'json';
  if (type === 'json') {
    formatCode(true, SAMPLE_JSON, 'json', true);
  } else {
    formatCode(true, SAMPLE_XML, 'xml', true);
  }
}

// ── Change view type (Tree ↔ Text) ────────────────────────────────────────────
function changeViewType() {
  const viewType = viewTypeEl ? viewTypeEl.value : 'tree';
  const input    = getEditorText();
  const type     = formatTypeEl ? formatTypeEl.value : 'json';
  if (!input.trim()) return;
  foldStates = {};
  rightPanelFoldStates = {};

  if (type === 'json') {
    try {
      let parsed = JSON.parse(input);
      currentData = parsed;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      const formatted = JSON.stringify(parsed, null, 2);
      if (viewType === 'tree') renderTree(parsed);
      else populateTextView(formatted);
    } catch(e) { /* ignore */ }
  }
}

// ── Format data (API call) ────────────────────────────────────────────────────
function formatData(type, filters) {
  const selectedType = formatTypeEl ? formatTypeEl.value : 'json';
  const input        = getEditorText();
  if (!input.trim()) return;

  let apiType = type;
  if (type === 'REPAIR') {
    apiType = selectedType === 'xml' ? 'XML_FORMAT' : 'JSON_FORMAT';
  }
  if (type === 'JSON_SORT' || type === 'XML_SORT') {
    apiType = type;
  }
  if (['TOML','YAML','CSV','SQL'].includes(type)) {
    apiType = selectedType.toUpperCase() + '_TO_' + type;
  }

  fetch('/data/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: apiType, data: input, filters: filters || null })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      let fmt = 'json';
      if (['XML_FORMAT','JSON_TO_XML','XML_SORT','CSV_TO_XML'].includes(apiType)) fmt = 'xml';
      else if (['JSON_TO_YAML','XML_TO_YAML','PROPERTY_TO_YAML'].includes(apiType)) fmt = 'yaml';
      else if (['JSON_TO_TOML','XML_TO_TOML'].includes(apiType))                    fmt = 'toml';
      else if (['JSON_TO_CSV','XML_TO_CSV'].includes(apiType))                      fmt = 'csv';
      else if (['JSON_TO_SQL','XML_TO_SQL','CSV_TO_SQL'].includes(apiType))                      fmt = 'sql';
      else if (apiType === 'YAML_TO_PROPERTY')                                      fmt = 'property';

      formatCode(true, res.parsedData.replace(/\r\n/g, '\n'), fmt, false);
    } else {
      showTreeView();
      rightTreeContent.innerHTML = `<div class="error">Failed: ${escapeHtml(res.message || 'Unknown error')}</div>`;
    }
  })
  .catch(() => {
    showTreeView();
    rightTreeContent.innerHTML = '<div class="error">Network error while processing</div>';
  });
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

  if (expandedPanel === side) {
    // collapse
    container.classList.remove('expanded-left', 'expanded-right');
    document.body.classList.remove('panel-expanded');
    if (leftPanel)      leftPanel.classList.remove('hidden');
    if (middleControls) middleControls.classList.remove('hidden');
    if (rightPanel)     rightPanel.classList.remove('hidden');
    if (leftHeader)     leftHeader.classList.remove('expanded-header');
    if (rightHeader)    rightHeader.classList.remove('expanded-header');
    if (leftIcon)       leftIcon.textContent  = '⛶';
    if (rightIcon)      rightIcon.textContent = '⛶';
    expandedPanel = null;
  } else {
    container.classList.remove('expanded-left', 'expanded-right');
    document.body.classList.add('panel-expanded');
    if (side === 'left') {
      container.classList.add('expanded-left');
      if (middleControls) middleControls.classList.add('hidden');
      if (rightPanel)     rightPanel.classList.add('hidden');
      if (leftHeader)     leftHeader.classList.add('expanded-header');
      if (rightHeader)    rightHeader.classList.remove('expanded-header');
      if (leftIcon)       leftIcon.textContent  = '✕';
      if (rightIcon)      rightIcon.textContent = '⛶';
    } else {
      container.classList.add('expanded-right');
      if (leftPanel)      leftPanel.classList.add('hidden');
      if (middleControls) middleControls.classList.add('hidden');
      if (leftHeader)     leftHeader.classList.remove('expanded-header');
      if (rightHeader)    rightHeader.classList.add('expanded-header');
      if (leftIcon)       leftIcon.textContent  = '⛶';
      if (rightIcon)      rightIcon.textContent = '✕';
    }
    expandedPanel = side;
  }
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
  const text = (
    (rightCodeEditor && rightCodeEditor.textContent) ||
    (rightTreeContent && rightTreeContent.textContent) || ''
  ).trim();

  if (!text) { alert('No content to export.'); return; }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) { alert('Content does not look like CSV.'); return; }
  if (!lines[0].includes(',') && !lines[0].includes(';') && !lines[0].includes('\t')) {
    alert('Content does not look like CSV.'); return;
  }

  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'data.csv' });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function setStatus(el, success, msg) {
  if (!el) return;
  if (success === true)  el.innerHTML = `<span class="success">${msg}</span>`;
  else if (success === false) el.innerHTML = `<span class="error">${msg}</span>`;
  else el.innerHTML = `<span class="warning">${msg}</span>`;
}

// Sync the two formatType selects (middle panel sync)
document.addEventListener('DOMContentLoaded', () => {
  const ft2 = document.getElementById('formatType2');
  const ft1 = document.getElementById('formatType');
  if (ft2 && ft1) {
    ft2.addEventListener('change', () => ft1.value = ft2.value);
  }
});

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
    if (!sqlTableNameInput.value) sqlTableNameInput.value = 'users';
    sqlIncludeNullsCheck.checked = true;
    sqlDbTypeSelect.value = 'POSTGRES';
    sqlModalOverlay.style.display = 'flex';
    sqlTableNameInput.focus();
  }

  function closeSqlModal() {
    sqlModalOverlay.style.display = 'none';
  }

  convertToSqlBtn.addEventListener('click', openSqlModal);
  sqlModalCloseBtn.addEventListener('click', closeSqlModal);
  sqlModalCancelBtn.addEventListener('click', closeSqlModal);

  sqlModalOverlay.addEventListener('click', e => {
    if (e.target === sqlModalOverlay) closeSqlModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sqlModalOverlay.style.display !== 'none') closeSqlModal();
  });

  sqlGenerateBtn.addEventListener('click', () => {
    const options = {
      tableName:    (sqlTableNameInput.value || 'users').trim(),
      dialect:      sqlDbTypeSelect.value,
      includeNulls: sqlIncludeNullsCheck.checked
    };
    formatData('SQL', options);
    closeSqlModal();
  });
});

 const SD_EP = window.location.origin + '/data/share/text';

  let _sdSource = 'input';

 function openShareModal(source) {
    _sdSource = source || 'input';
    // Reset to form state
    document.getElementById('sdForm').style.display    = 'block';
    document.getElementById('sdLoader').classList.remove('show');
    document.getElementById('sdSuccess').style.display = 'none';
    document.getElementById('sdError').style.display   = 'none';
    document.getElementById('sdError').textContent     = '';
    document.getElementById('sdOneTime').checked       = false;
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
    if (_sdSource === 'input') {
      // Get text from the left editor (codeEditor)
      const el = document.getElementById('codeEditor');
      return el ? el.innerText.trim() : '';
    } else {
      // Get text from right panel — try text view first, then tree text
      const rightEditor = document.getElementById('rightCodeEditor');
      if (rightEditor && rightEditor.innerText.trim()) {
        return rightEditor.innerText.trim();
      }
      // Fallback: get visible text from tree content
      const tree = document.getElementById('rightTreeContent');
      return tree ? tree.innerText.trim() : '';
    }
  }

async function doShare() {
    const text = getSdContent();

    if (!text) {
      const err = document.getElementById('sdError');
      err.textContent = '⚠ Nothing to share — the selected panel is empty.';
      err.style.display = 'block';
      return;
    }

    const oneTime = document.getElementById('sdOneTime').checked;

    // Show loader
    document.getElementById('sdForm').style.display    = 'none';
    document.getElementById('sdLoader').classList.add('show');
    document.getElementById('sdError').style.display   = 'none';

    try {
      const res = await fetch(SD_EP, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, oneTimeDownload: oneTime })
      });

      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.message || 'Server error ' + res.status);

      // Show success
      document.getElementById('sdLoader').classList.remove('show');
      document.getElementById('sdSuccess').style.display = 'block';
      document.getElementById('sdUrlText').textContent   = json.url;
      document.getElementById('sdSuccessSub').textContent =
        `${text.length.toLocaleString()} chars · ${_sdSource} panel` + (oneTime ? ' · one-time' : '');

    } catch (err) {
      document.getElementById('sdLoader').classList.remove('show');
      document.getElementById('sdForm').style.display  = 'block';
      const errEl = document.getElementById('sdError');
      errEl.textContent    = '⚠ ' + err.message;
      errEl.style.display  = 'block';
    }
  }

  function sdCopyUrl() {
    const url = document.getElementById('sdUrlText').textContent;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('sdCopyBtn');
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '⎘ Copy'; btn.classList.remove('copied'); }, 2200);
    });
  }

  // Close on backdrop click
  document.getElementById('sdOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('sdOverlay')) closeSdModal();
  });