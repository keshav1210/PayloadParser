/* ============================================================
   compare.js - JSON / XML / text compare.
   Uses the parsers from jsonxmlformatter.js (parseJsonAst, astToText,
   xmlFormat, xmlDocToObject, valueToAst, unquote, jsonPath).
   Everything runs in the browser.
   ============================================================ */

'use strict';

const Compare = (() => {
  const MAX_CHANGES = 2000;
  const LCS_LIMIT = 1500;          // align arrays by content up to this many items per side
  const CONTEXT = 3;               // unchanged lines shown around each change
  const STORE_KEY = 'jxe.compare';

  const $ = id => document.getElementById(id);
  let els;
  let timer = null;

  // ── Parsing / normalising ──────────────────────────────────────────────────
  function detect(a, b) {
    const m = els.mode.value;
    if (m !== 'auto') return m;
    return detectFormat(a) || detectFormat(b) || 'text';
  }

  function parseSide(text, lang, label) {
    if (lang === 'json') {
      try {
        let ast = parseJsonAst(text);
        if (ast.type === 'string') {                 // JSON stored inside a string
          try { ast = parseJsonAst(JSON.parse(ast.raw)); } catch (_) { /* keep */ }
        }
        return { ast };
      } catch (e) {
        if (!e || !e.isParseError) throw e;
        const { line, col } = lineColFromPos(text, e.pos);
        throw { side: label, line, col, message: e.message, lang };
      }
    }
    if (lang === 'xml') {
      try {
        const r = xmlFormat(text, false);
        return { ast: valueToAst(xmlDocToObject(r.doc)), xmlText: r.text };
      } catch (e) {
        if (!e || !e.isParseError) throw e;
        throw { side: label, line: e.line, col: e.col, message: e.message, lang };
      }
    }
    return {};
  }

  function sortAst(node) {
    if (node.type === 'object') {
      const entries = node.entries
        .map(e => ({ key: e.key, value: sortAst(e.value) }))
        .sort((x, y) => { const a = unquote(x.key.raw), b = unquote(y.key.raw); return a < b ? -1 : a > b ? 1 : 0; });
      return { type: 'object', entries };
    }
    if (node.type === 'array') return { type: 'array', items: node.items.map(sortAst) };
    return node;
  }

  const canonical = node => astToText(sortAst(node), '');

  // ── Structural diff (JSON and XML) ─────────────────────────────────────────
  function leafValue(node) {
    if (node.type === 'string') return unquote(node.raw);
    if (node.type === 'number') {
      const n = Number(node.raw);
      return Number.isSafeInteger(n) || (Number.isFinite(n) && !/^-?\d{16,}$/.test(node.raw)) ? n : node.raw;
    }
    return node.raw;
  }

  function sameLeaf(a, b) {
    return a.type === b.type && leafValue(a) === leafValue(b);
  }

  function preview(node) {
    if (!node) return '';
    const s = node.type === 'object' || node.type === 'array' ? astToText(node, '') : node.raw;
    return s.length > 160 ? s.slice(0, 157) + '…' : s;
  }

  function diffNodes(a, b, path, out, ignoreOrder) {
    if (out.length >= MAX_CHANGES) return;
    const container = t => t === 'object' || t === 'array';
    if (a.type !== b.type || !container(a.type)) {
      if (!sameLeaf(a, b)) out.push({ kind: 'changed', path, old: preview(a), new: preview(b), typeChange: a.type !== b.type });
      return;
    }

    if (a.type === 'object') {
      const ma = new Map(a.entries.map(e => [unquote(e.key.raw), e.value]));
      const mb = new Map(b.entries.map(e => [unquote(e.key.raw), e.value]));
      for (const [k, v] of ma) {
        if (!mb.has(k)) out.push({ kind: 'removed', path: path.concat(k), old: preview(v) });
        else diffNodes(v, mb.get(k), path.concat(k), out, ignoreOrder);
      }
      for (const [k, v] of mb) {
        if (!ma.has(k)) out.push({ kind: 'added', path: path.concat(k), new: preview(v) });
      }
      if (!ignoreOrder) {
        const orderA = [...ma.keys()].filter(k => mb.has(k));
        const orderB = [...mb.keys()].filter(k => ma.has(k));
        if (orderA.join('\u0000') !== orderB.join('\u0000')) {
          out.push({ kind: 'reordered', path, old: orderA.slice(0, 12).join(', '), new: orderB.slice(0, 12).join(', ') });
        }
      }
      return;
    }

    // Arrays: align items by content so one insertion doesn't mark everything after it as changed
    const A = a.items, B = b.items;
    if (A.length > LCS_LIMIT || B.length > LCS_LIMIT) {
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        if (i >= A.length) out.push({ kind: 'added', path: path.concat(i), new: preview(B[i]) });
        else if (i >= B.length) out.push({ kind: 'removed', path: path.concat(i), old: preview(A[i]) });
        else diffNodes(A[i], B[i], path.concat(i), out, ignoreOrder);
      }
      return;
    }

    const ka = A.map(canonical), kb = B.map(canonical);
    const pairs = lcsPairs(ka, kb);
    let i = 0, j = 0;
    const flushGap = (iEnd, jEnd) => {
      // unmatched items between two matches: pair them up as changes, the rest are added/removed
      while (i < iEnd && j < jEnd) { diffNodes(A[i], B[j], path.concat(j), out, ignoreOrder); i++; j++; }
      while (i < iEnd) { out.push({ kind: 'removed', path: path.concat(i), old: preview(A[i]) }); i++; }
      while (j < jEnd) { out.push({ kind: 'added', path: path.concat(j), new: preview(B[j]) }); j++; }
    };
    for (const [pi, pj] of pairs) {
      flushGap(pi, pj);
      i = pi + 1;
      j = pj + 1;
    }
    flushGap(A.length, B.length);
  }

  // Longest common subsequence of two string arrays → matched index pairs
  function lcsPairs(a, b) {
    const n = a.length, m = b.length;
    if (!n || !m) return [];
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const pairs = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return pairs;
  }

  // ── Line diff (Myers O(ND)) ────────────────────────────────────────────────
  function myers(a, b, maxD) {
    const n = a.length, m = b.length, max = n + m;
    const offset = max + 1;
    let v = new Int32Array(2 * max + 3);
    const trace = [];
    for (let d = 0; d <= max; d++) {
      if (d > maxD) return null;
      trace.push(v.slice());
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) ? v[offset + k + 1] : v[offset + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[offset + k] = x;
        if (x >= n && y >= m) return backtrack(trace, v, n, m, offset, d);
      }
    }
    return [];
  }

  function backtrack(trace, lastV, n, m, offset, dEnd) {
    const ops = [];
    let x = n, y = m;
    for (let d = dEnd; d > 0; d--) {
      const v = trace[d];
      const k = x - y;
      const prevK = (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) ? k + 1 : k - 1;
      const prevX = v[offset + prevK];
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) { ops.push({ t: 'eq', a: x - 1, b: y - 1 }); x--; y--; }
      if (x === prevX) ops.push({ t: 'add', b: y - 1 }); else ops.push({ t: 'del', a: x - 1 });
      x = prevX; y = prevY;
    }
    while (x > 0 && y > 0) { ops.push({ t: 'eq', a: x - 1, b: y - 1 }); x--; y--; }
    return ops.reverse();
  }

  // Pair deletions and additions of the same block into side-by-side rows
  function toRows(ops) {
    const rows = [];
    let k = 0;
    while (k < ops.length) {
      if (ops[k].t === 'eq') { rows.push({ type: 'eq', a: ops[k].a, b: ops[k].b }); k++; continue; }
      const dels = [], adds = [];
      while (k < ops.length && ops[k].t !== 'eq') {
        if (ops[k].t === 'del') dels.push(ops[k].a); else adds.push(ops[k].b);
        k++;
      }
      const n = Math.max(dels.length, adds.length);
      for (let i = 0; i < n; i++) {
        const a = i < dels.length ? dels[i] : null;
        const b = i < adds.length ? adds[i] : null;
        rows.push({ type: a !== null && b !== null ? 'mod' : a !== null ? 'del' : 'add', a, b });
      }
    }
    return rows;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Mark the changed middle part of a modified line
  function markedText(text, other) {
    let p = 0;
    while (p < text.length && p < other.length && text[p] === other[p]) p++;
    let s = 0;
    while (s < text.length - p && s < other.length - p && text[text.length - 1 - s] === other[other.length - 1 - s]) s++;
    const frag = document.createDocumentFragment();
    frag.append(text.slice(0, p));
    const mid = text.slice(p, text.length - s);
    if (mid) frag.append(node('mark', null, mid));
    frag.append(text.slice(text.length - s));
    return frag;
  }

  function lineEl(cls, num, text, other) {
    const row = node('div', 'diff-line ' + cls);
    row.append(node('span', 'ln', num === null ? '' : String(num + 1)));
    const tx = node('span', 'tx');
    if (text === null) tx.textContent = '';
    else if (other !== undefined && other !== null) tx.append(markedText(text, other));
    else tx.textContent = text;
    row.append(tx);
    return row;
  }

  function renderSideBySide(aLines, bLines, rows) {
    const view = els.diffView;
    view.textContent = '';
    const colA = node('div', 'diff-col'), colB = node('div', 'diff-col');
    view.append(colA, colB);

    // Show changed rows plus a little context; collapse long unchanged runs
    const keep = new Uint8Array(rows.length);
    rows.forEach((r, i) => {
      if (r.type !== 'eq') for (let k = Math.max(0, i - CONTEXT); k <= Math.min(rows.length - 1, i + CONTEXT); k++) keep[k] = 1;
    });
    if (!rows.some(r => r.type !== 'eq')) keep.fill(1);

    const appendRow = r => {
      if (r.type === 'eq') {
        colA.append(lineEl('', r.a, aLines[r.a]));
        colB.append(lineEl('', r.b, bLines[r.b]));
      } else if (r.type === 'mod') {
        colA.append(lineEl('del', r.a, aLines[r.a], bLines[r.b]));
        colB.append(lineEl('add', r.b, bLines[r.b], aLines[r.a]));
      } else if (r.type === 'del') {
        colA.append(lineEl('del', r.a, aLines[r.a]));
        colB.append(lineEl('gap', null, null));
      } else {
        colA.append(lineEl('gap', null, null));
        colB.append(lineEl('add', r.b, bLines[r.b]));
      }
    };

    let i = 0;
    while (i < rows.length) {
      if (keep[i]) { appendRow(rows[i]); i++; continue; }
      const start = i;
      while (i < rows.length && !keep[i]) i++;
      const hidden = rows.slice(start, i);
      const label = `⋯ ${hidden.length} unchanged line${hidden.length === 1 ? '' : 's'} (click to show)`;
      const foldA = node('div', 'diff-line fold', label);
      const foldB = node('div', 'diff-line fold', label);
      const expand = () => {
        const fragA = document.createDocumentFragment(), fragB = document.createDocumentFragment();
        hidden.forEach(r => { fragA.append(lineEl('', r.a, aLines[r.a])); fragB.append(lineEl('', r.b, bLines[r.b])); });
        foldA.replaceWith(fragA);
        foldB.replaceWith(fragB);
      };
      foldA.addEventListener('click', expand);
      foldB.addEventListener('click', expand);
      colA.append(foldA);
      colB.append(foldB);
    }
  }

  function renderChanges(changes) {
    const body = els.changeBody;
    body.textContent = '';
    const labels = { added: 'Added', removed: 'Removed', changed: 'Changed', reordered: 'Key order' };
    changes.forEach(c => {
      const tr = document.createElement('tr');
      const kind = node('td');
      kind.append(node('span', 'pill ' + ({ added: 'add', removed: 'del', changed: 'mod', reordered: 'mod' }[c.kind]), labels[c.kind]));
      tr.append(kind, node('td', 'path', jsonPath(c.path)), node('td', 'val old', c.old || ''), node('td', 'val new', c.new || ''));
      body.append(tr);
    });
    if (!changes.length) {
      const tr = document.createElement('tr');
      const td = node('td', null, 'No structural differences.');
      td.colSpan = 4;
      tr.append(td);
      body.append(tr);
    }
  }

  function setSummary(cls, parts) {
    els.summary.className = 'summary ' + cls;
    els.summary.textContent = '';
    parts.forEach(p => els.summary.append(p));
    els.result.hidden = false;
  }

  function selectTab(name) {
    els.tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    els.changesPanel.hidden = name !== 'changes';
    els.diffPanel.hidden = name !== 'diff';
  }

  function showError(err) {
    const where = err.line ? ` on line ${err.line}, column ${err.col}` : '';
    const msg = node('span', null, `${err.side} is not valid ${err.lang.toUpperCase()}${where}: ${err.message}`);
    const parts = [msg];
    if (typeof JsonRepair !== 'undefined') {
      const fix = node('button', 'mini-btn', 'Try Repair');
      fix.type = 'button';
      fix.addEventListener('click', () => repairSide(err.side === 'Original' ? els.left : els.right, err.lang));
      parts.push(fix);
    }
    setSummary('bad', parts);
    els.tabBar.hidden = true;
    els.changesPanel.hidden = true;
    els.diffPanel.hidden = true;
  }

  function repairSide(textarea, lang) {
    try {
      const r = (lang === 'xml' ? XmlRepair : JsonRepair).repair(textarea.value);
      textarea.value = r.text;
      run();
    } catch (e) {
      setSummary('bad', [node('span', null, 'Could not repair: ' + e.message)]);
    }
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  function run() {
    save();
    const a = els.left.value, b = els.right.value;
    if (!a.trim() || !b.trim()) {
      els.result.hidden = true;
      return;
    }
    const lang = detect(a, b);
    els.langLabel.textContent = lang === 'text' ? 'Plain text' : lang.toUpperCase();
    els.ignoreOrderWrap.hidden = lang === 'text';
    const ignoreOrder = els.ignoreOrder.checked;
    const ignoreWs = els.ignoreWs.checked;

    let aText = a, bText = b, changes = null;
    try {
      if (lang === 'json' || lang === 'xml') {
        const pa = parseSide(a, lang, 'Original');
        const pb = parseSide(b, lang, 'Changed');
        const astA = ignoreOrder ? sortAst(pa.ast) : pa.ast;
        const astB = ignoreOrder ? sortAst(pb.ast) : pb.ast;
        changes = [];
        diffNodes(astA, astB, [], changes, ignoreOrder);
        if (lang === 'json') {
          aText = astToText(astA, '  ');
          bText = astToText(astB, '  ');
        } else if (ignoreOrder) {
          aText = astToText(astA, '  ');
          bText = astToText(astB, '  ');
        } else {
          aText = pa.xmlText;
          bText = pb.xmlText;
        }
      }
    } catch (err) {
      if (err && err.side) { showError(err); return; }
      throw err;
    }

    const aLines = aText.replace(/\r\n?/g, '\n').split('\n');
    const bLines = bText.replace(/\r\n?/g, '\n').split('\n');
    const norm = s => ignoreWs ? s.replace(/\s+/g, ' ').trim() : s;
    const ops = myers(aLines.map(norm), bLines.map(norm), 8000);

    let rows = null;
    if (ops) rows = toRows(ops);

    // Summary
    const parts = [];
    let added = 0, removed = 0, modified = 0;
    if (changes) {
      changes.forEach(c => { if (c.kind === 'added') added++; else if (c.kind === 'removed') removed++; else modified++; });
    } else if (rows) {
      rows.forEach(r => { if (r.type === 'add') added++; else if (r.type === 'del') removed++; else if (r.type === 'mod') modified++; });
    }
    const total = added + removed + modified;
    if (!total) {
      const note = changes && ignoreOrder ? ' (key order ignored)' : '';
      parts.push(node('strong', null, lang === 'text' ? 'The texts are identical' + (ignoreWs ? ' (whitespace ignored)' : '') : `No differences: the documents are equivalent${note}`));
      setSummary('ok', parts);
    } else {
      parts.push(node('strong', null, `${total}${total >= MAX_CHANGES ? '+' : ''} difference${total === 1 ? '' : 's'}`));
      if (added) parts.push(node('span', 'pill add', `+${added} added`));
      if (removed) parts.push(node('span', 'pill del', `−${removed} removed`));
      if (modified) parts.push(node('span', 'pill mod', `~${modified} changed`));
      setSummary('warn', parts);
    }

    // Views
    els.tabBar.hidden = false;
    els.changesTab.hidden = !changes;
    els.changesTab.textContent = changes ? `Changes (${changes.length}${changes.length >= MAX_CHANGES ? '+' : ''})` : 'Changes';
    if (changes) renderChanges(changes);
    if (rows) renderSideBySide(aLines, bLines, rows);
    else els.diffView.textContent = 'These documents differ in too many places to show side by side. Use the Changes tab.';
    const current = els.tabs.find(t => t.getAttribute('aria-selected') === 'true');
    selectTab(changes ? (current && !current.hidden ? current.dataset.tab : 'changes') : 'diff');
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ left: els.left.value.slice(0, 1000000), right: els.right.value.slice(0, 1000000) }));
    } catch (_) { /* storage full or disabled */ }
  }

  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s) { els.left.value = s.left || ''; els.right.value = s.right || ''; }
    } catch (_) { /* ignore */ }
  }

  const SAMPLE_A = `{
  "id": 1042,
  "customer": { "name": "Charter Group", "tier": "gold" },
  "items": [
    { "sku": "A-100", "qty": 2, "price": 9.5 },
    { "sku": "B-220", "qty": 1, "price": 24 }
  ],
  "paid": false
}`;
  const SAMPLE_B = `{
  "customer": { "tier": "platinum", "name": "Charter Group" },
  "id": 1042,
  "items": [
    { "sku": "A-100", "qty": 3, "price": 9.5 },
    { "sku": "C-310", "qty": 1, "price": 5 },
    { "sku": "B-220", "qty": 1, "price": 24 }
  ],
  "paid": true,
  "paidAt": "2026-09-26T10:15:00Z"
}`;

  function loadFile(textarea, file) {
    const reader = new FileReader();
    reader.onload = () => { textarea.value = String(reader.result || ''); run(); };
    reader.readAsText(file);
  }

  function init() {
    els = {
      left: $('cmpLeft'), right: $('cmpRight'), mode: $('cmpMode'),
      ignoreOrder: $('cmpIgnoreOrder'), ignoreOrderWrap: $('cmpIgnoreOrderWrap'), ignoreWs: $('cmpIgnoreWs'),
      result: $('cmpResult'), summary: $('cmpSummary'), tabBar: $('cmpTabs'),
      changesTab: $('cmpTabChanges'), changesPanel: $('cmpChanges'), changeBody: $('cmpChangeBody'),
      diffPanel: $('cmpDiff'), diffView: $('cmpDiffView'), langLabel: $('cmpLang'),
    };
    if (!els.left) return;
    els.tabs = [...document.querySelectorAll('#cmpTabs .tab-btn')];
    els.tabs.forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));

    [els.left, els.right].forEach(t => t.addEventListener('input', schedule));
    [els.mode, els.ignoreOrder, els.ignoreWs].forEach(c => c.addEventListener('change', run));
    $('cmpRun').addEventListener('click', run);
    $('cmpSwap').addEventListener('click', () => { [els.left.value, els.right.value] = [els.right.value, els.left.value]; run(); });
    $('cmpClear').addEventListener('click', () => { els.left.value = ''; els.right.value = ''; els.result.hidden = true; save(); els.left.focus(); });
    $('cmpSample').addEventListener('click', () => { els.left.value = SAMPLE_A; els.right.value = SAMPLE_B; els.mode.value = 'auto'; run(); });

    document.querySelectorAll('[data-upload]').forEach(btn => {
      const target = btn.dataset.upload === 'left' ? els.left : els.right;
      const input = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
      input.addEventListener('change', () => { if (input.files[0]) loadFile(target, input.files[0]); input.value = ''; });
      btn.after(input);
      btn.addEventListener('click', () => input.click());
    });
    document.querySelectorAll('[data-format]').forEach(btn => {
      const target = btn.dataset.format === 'left' ? els.left : els.right;
      btn.addEventListener('click', () => {
        const lang = detect(target.value, '');
        try {
          if (lang === 'json') target.value = astToText(parseJsonAst(target.value), '  ');
          else if (lang === 'xml') target.value = xmlFormat(target.value, false).text;
        } catch (_) { /* leave invalid input as it is; run() reports the error */ }
        run();
      });
    });
    [els.left, els.right].forEach(t => {
      t.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          document.execCommand('insertText', false, '  ');
        }
      });
      t.addEventListener('dragover', e => e.preventDefault());
      t.addEventListener('drop', e => {
        const f = e.dataTransfer && e.dataTransfer.files[0];
        if (f) { e.preventDefault(); loadFile(t, f); }
      });
    });

    restore();
    run();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { run, myers, toRows, diffNodes, sortAst };
})();
