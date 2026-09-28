
'use strict';

const TextDiffTool = (() => {
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.textdiff';
  const CONTEXT = 3;
  let els, timer = null, lastPatch = '';

  const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const splitLines = s => { const l = s.split('\n'); if (l.length && l[l.length - 1] === '') l.pop(); return l; };

  function options() {
    return { ignoreWhitespace: els.ignoreWs.checked, ignoreCase: els.ignoreCase.checked, stripTrailingCr: true, timeout: 5000 };
  }

  function inline(a, b) {
    const parts = Diff.diffWordsWithSpace(a, b, { ignoreCase: els.ignoreCase.checked });
    let left = '', right = '';
    for (const p of parts) {
      const t = escapeHtml(p.value);
      if (p.added) right += `<ins>${t}</ins>`;
      else if (p.removed) left += `<del>${t}</del>`;
      else { left += t; right += t; }
    }
    return [left, right];
  }

  function buildRows(changes) {
    const rows = [];
    let ln = 1, rn = 1;
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const lines = splitLines(c.value);
      if (!c.added && !c.removed) {
        for (const l of lines) rows.push({ type: 'eq', l, r: l, ln: ln++, rn: rn++ });
      } else if (c.removed && changes[i + 1] && changes[i + 1].added) {
        const adds = splitLines(changes[i + 1].value);
        const n = Math.max(lines.length, adds.length);
        for (let k = 0; k < n; k++) {
          const a = lines[k], b = adds[k];
          if (a !== undefined && b !== undefined) {
            const [lh, rh] = inline(a, b);
            rows.push({ type: 'mod', l: a, r: b, lh, rh, ln: ln++, rn: rn++ });
          } else if (a !== undefined) rows.push({ type: 'del', l: a, ln: ln++ });
          else rows.push({ type: 'add', r: b, rn: rn++ });
        }
        i++;
      } else if (c.removed) {
        for (const l of lines) rows.push({ type: 'del', l, ln: ln++ });
      } else {
        for (const r of lines) rows.push({ type: 'add', r, rn: rn++ });
      }
    }
    return rows;
  }

  function collapse(rows) {
    if (!els.onlyChanges.checked) return rows;
    const keep = rows.map(r => r.type !== 'eq');
    rows.forEach((r, i) => {
      if (r.type === 'eq') return;
      for (let k = Math.max(0, i - CONTEXT); k <= Math.min(rows.length - 1, i + CONTEXT); k++) keep[k] = true;
    });
    const out = [];
    for (let i = 0; i < rows.length;) {
      if (keep[i]) { out.push(rows[i]); i++; continue; }
      let j = i;
      while (j < rows.length && !keep[j]) j++;
      out.push({ type: 'fold', count: j - i, from: i, to: j });
      i = j;
    }
    return out;
  }

  const num = n => (n === undefined ? '' : n);

  function renderSplit(rows) {
    return rows.map(r => {
      if (r.type === 'fold') return `<tr class="td-fold"><td colspan="4">⋯ ${r.count} unchanged line${r.count === 1 ? '' : 's'}</td></tr>`;
      const left = r.type === 'add' ? '' : (r.lh ?? escapeHtml(r.l));
      const right = r.type === 'del' ? '' : (r.rh ?? escapeHtml(r.r));
      const lc = r.type === 'del' || r.type === 'mod' ? 'td-del' : r.type === 'add' ? 'td-empty' : '';
      const rc = r.type === 'add' || r.type === 'mod' ? 'td-add' : r.type === 'del' ? 'td-empty' : '';
      return `<tr><td class="td-n">${num(r.ln)}</td><td class="td-c ${lc}">${left}</td><td class="td-n">${num(r.rn)}</td><td class="td-c ${rc}">${right}</td></tr>`;
    }).join('');
  }

  function renderUnified(rows) {
    const out = [];
    for (const r of rows) {
      if (r.type === 'fold') { out.push(`<tr class="td-fold"><td colspan="4">⋯ ${r.count} unchanged line${r.count === 1 ? '' : 's'}</td></tr>`); continue; }
      if (r.type === 'eq') out.push(`<tr><td class="td-n">${r.ln}</td><td class="td-n">${r.rn}</td><td class="td-sign"> </td><td class="td-c">${escapeHtml(r.l)}</td></tr>`);
      if (r.type === 'del' || r.type === 'mod') out.push(`<tr><td class="td-n">${r.ln}</td><td class="td-n"></td><td class="td-sign">−</td><td class="td-c td-del">${r.lh ?? escapeHtml(r.l)}</td></tr>`);
      if (r.type === 'add' || r.type === 'mod') out.push(`<tr><td class="td-n"></td><td class="td-n">${r.rn}</td><td class="td-sign">+</td><td class="td-c td-add">${r.rh ?? escapeHtml(r.r)}</td></tr>`);
    }
    return out.join('');
  }

  function renderInline(parts) {
    return parts.map(p => {
      const t = escapeHtml(p.value);
      return p.added ? `<ins>${t}</ins>` : p.removed ? `<del>${t}</del>` : t;
    }).join('');
  }

  function run() {
    const a = els.left.value, b = els.right.value;
    try { localStorage.setItem(STORE, JSON.stringify({ a: a.length < 500000 ? a : '', b: b.length < 500000 ? b : '', mode: els.mode.value, view: els.view.value })); } catch (_) {  }
    els.error.hidden = true;
    if (!a && !b) { els.out.innerHTML = ''; els.summary.textContent = 'Paste two texts to compare.'; els.summary.className = 'summary'; return; }

    const mode = els.mode.value;
    const opts = options();
    let changes;
    if (mode === 'lines') changes = Diff.diffLines(a, b, opts);
    else if (mode === 'words') changes = Diff.diffWordsWithSpace(a, b, opts);
    else changes = Diff.diffChars(a, b, opts);
    if (!changes) {
      els.error.textContent = 'These texts are too different to compare within 5 seconds. Try comparing by lines, or compare smaller sections.';
      els.error.hidden = false;
      return;
    }

    let added = 0, removed = 0;
    if (mode === 'lines') {
      changes.forEach(c => { if (c.added) added += c.count; else if (c.removed) removed += c.count; });
    } else {
      changes.forEach(c => { if (c.added) added += c.value.length; else if (c.removed) removed += c.value.length; });
    }
    const unit = mode === 'lines' ? 'line' : 'character';
    if (!added && !removed) {
      els.summary.textContent = 'The two texts are identical' + (opts.ignoreWhitespace || opts.ignoreCase ? ' (with the chosen ignore options).' : '.');
      els.summary.className = 'summary ok';
    } else {
      els.summary.innerHTML = `<span class="pill add">+${added.toLocaleString()} ${unit}${added === 1 ? '' : 's'}</span><span class="pill del">−${removed.toLocaleString()} ${unit}${removed === 1 ? '' : 's'}</span>`;
      els.summary.className = 'summary';
    }

    if (mode === 'lines') {
      const rows = collapse(buildRows(changes));
      els.out.className = 'td-view ' + (els.view.value === 'split' ? 'td-split' : 'td-unified');
      els.out.innerHTML = `<table class="td-table">${els.view.value === 'split' ? renderSplit(rows) : renderUnified(rows)}</table>`;
      lastPatch = Diff.createTwoFilesPatch(els.leftName.value || 'original', els.rightName.value || 'changed', a, b, '', '', { context: CONTEXT });
    } else {
      els.out.className = 'td-view td-inline';
      els.out.innerHTML = `<pre>${renderInline(changes)}</pre>`;
      lastPatch = '';
    }
    els.patchBtn.disabled = !lastPatch;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  function readFile(file, target, nameEl) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { els.error.textContent = 'Files up to 20 MB can be compared in the browser.'; els.error.hidden = false; return; }
    file.text().then(t => { target.value = t; nameEl.value = file.name; run(); });
  }

  function init() {
    els = {
      left: $('tdLeft'), right: $('tdRight'), leftName: $('tdLeftName'), rightName: $('tdRightName'), out: $('tdOut'), summary: $('tdSummary'),
      error: $('tdError'), mode: $('tdMode'), view: $('tdView'), ignoreWs: $('tdIgnoreWs'), ignoreCase: $('tdIgnoreCase'), onlyChanges: $('tdOnlyChanges'),
      patchBtn: $('tdPatch'),
    };
    if (!els.left) return;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (_) {  }
    if (s) { els.left.value = s.a || ''; els.right.value = s.b || ''; els.mode.value = s.mode || 'lines'; els.view.value = s.view || 'split'; }
    else {
      els.left.value = 'server:\n  port: 8080\n  host: localhost\nlogging:\n  level: info\nfeatures:\n  - search\n  - export\n';
      els.right.value = 'server:\n  port: 8443\n  host: localhost\n  tls: true\nlogging:\n  level: debug\nfeatures:\n  - search\n';
    }
    [els.left, els.right].forEach(e => e.addEventListener('input', schedule));
    [els.mode, els.view, els.ignoreWs, els.ignoreCase, els.onlyChanges].forEach(e => e.addEventListener('change', () => {
      els.view.disabled = els.mode.value !== 'lines';
      els.onlyChanges.disabled = els.mode.value !== 'lines';
      run();
    }));
    $('tdSwap').addEventListener('click', () => {
      [els.left.value, els.right.value] = [els.right.value, els.left.value];
      [els.leftName.value, els.rightName.value] = [els.rightName.value, els.leftName.value];
      run();
    });
    $('tdClear').addEventListener('click', () => { els.left.value = ''; els.right.value = ''; run(); els.left.focus(); });
    $('tdLeftFile').addEventListener('change', e => { readFile(e.target.files[0], els.left, els.leftName); e.target.value = ''; });
    $('tdRightFile').addEventListener('change', e => { readFile(e.target.files[0], els.right, els.rightName); e.target.value = ''; });
    [[els.left, els.leftName], [els.right, els.rightName]].forEach(([ta, name]) => {
      ta.addEventListener('dragover', e => e.preventDefault());
      ta.addEventListener('drop', e => { if (e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0], ta, name); } });
    });
    els.patchBtn.addEventListener('click', () => {
      if (!lastPatch) return;
      const url = URL.createObjectURL(new Blob([lastPatch], { type: 'text/x-diff' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'changes.patch' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    els.view.disabled = els.mode.value !== 'lines';
    run();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { buildRows };
})();
