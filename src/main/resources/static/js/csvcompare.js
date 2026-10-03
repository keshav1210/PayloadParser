'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = DataSource.esc;
  const fmt = n => n.toLocaleString('en-US');
  let oldD = null, newD = null, grid = null, diff = null, view = null;

  function sampleOld() {
    return { name: 'products-january.csv', text: ['sku,name,category,price,stock', 'A100,USB-C Cable,Accessories,9.99,120', 'A101,Wireless Mouse,Accessories,24.99,55', 'B200,27" Monitor,Displays,229.00,14', 'B201,Laptop Stand,Accessories,39.00,30', 'C300,Mechanical Keyboard,Input,79.00,22', 'C301,Webcam HD,Video,49.00,0'].join('\n') };
  }

  function sampleNew() {
    return { name: 'products-february.csv', text: ['sku,name,category,price,stock', 'A100,USB-C Cable,Accessories,9.99,95', 'A101,Wireless Mouse,Accessories,22.99,55', 'B200,27" Monitor,Displays,229,14', 'C300,Mechanical Keyboard (RGB),Input,84.00,18', 'C301,Webcam HD,Video,49.00,12', 'D400,Noise-cancelling Headset,Audio,129.00,40'].join('\n') };
  }

  const nameKey = s => String(s).trim().toLowerCase();

  function setup() {
    const ready = oldD && newD;
    $('ccOptions').hidden = !ready;
    if (!ready) return;
    const newNames = new Set(newD.columns.map(nameKey));
    const common = oldD.columns.map((c, i) => [c, i]).filter(([c]) => newNames.has(nameKey(c)));
    const guess = Math.max(0, common.findIndex(([c]) => /(^|_|\s)(id|key|code|sku|email|number|no)$/i.test(c)));
    const opts = common.map(([c, i], k) => `<option value="${i}"${k === guess ? ' selected' : ''}>${esc(c)}</option>`).join('');
    $('ccKey').innerHTML = `<option value="">Row by row (no key)</option>${opts}`;
    $('ccKey2').innerHTML = `<option value="">(none)</option>${opts.replace(' selected', '')}`;
    if (!common.length) $('ccKey').value = '';
  }

  function compare() {
    const k1 = $('ccKey').value, k2 = $('ccKey2').value;
    const ic = $('ccCase').checked, iw = $('ccSpace').checked, nm = $('ccNum').checked;
    const norm = v => {
      let s = v ?? '';
      if (iw) s = s.trim().replace(/\s+/g, ' ');
      if (ic) s = s.toLowerCase();
      if (nm && /^-?(\d+\.?\d*|\.\d+)$/.test(s.trim())) s = String(Number(s));
      return s;
    };

    const newIdx = new Map(newD.columns.map((c, i) => [nameKey(c), i]));
    const oldIdx = new Map(oldD.columns.map((c, i) => [nameKey(c), i]));
    const union = [];
    oldD.columns.forEach((c, i) => union.push({ name: c, o: i, n: newIdx.has(nameKey(c)) ? newIdx.get(nameKey(c)) : -1 }));
    newD.columns.forEach((c, i) => { if (!oldIdx.has(nameKey(c))) union.push({ name: c, o: -1, n: i }); });
    const removedCols = union.filter(u => u.n < 0).map(u => u.name);
    const addedCols = union.filter(u => u.o < 0).map(u => u.name);

    const keyCols = [k1, k2].filter(k => k !== '').map(Number);
    const keyCol = keyCols.map(o => union.find(u => u.o === o));
    const keyOf = (r, side) => keyCols.length ? keyCol.map(u => norm(r[side === 'o' ? u.o : u.n])).join('\u0001') : null;

    const pairs = [];
    let dupKeys = 0;
    if (!keyCols.length) {
      const n = Math.max(oldD.rows.length, newD.rows.length);
      for (let i = 0; i < n; i++) pairs.push([oldD.rows[i] || null, newD.rows[i] || null]);
    } else {
      const buckets = new Map();
      newD.rows.forEach(r => {
        const k = keyOf(r, 'n');
        const b = buckets.get(k);
        if (b) { b.push(r); if (b.length === 2) dupKeys++; } else buckets.set(k, [r]);
      });
      const seen = new Map();
      oldD.rows.forEach(r => {
        const k = keyOf(r, 'o');
        const b = buckets.get(k);
        const pos = seen.get(k) || 0;
        seen.set(k, pos + 1);
        if (pos === 1) dupKeys++;
        pairs.push([r, b && b[pos] ? b[pos] : null]);
        if (b && b[pos]) b[pos] = undefined;
      });
      buckets.forEach(b => b.forEach(r => { if (r) pairs.push([null, r]); }));
    }

    const rows = [], status = [], changed = new Set();
    const counts = { added: 0, removed: 0, changed: 0, same: 0, cells: 0 };
    for (const [o, n] of pairs) {
      const ri = rows.length;
      if (o && n) {
        let diffCells = 0;
        const row = ['', ...union.map((u, ci) => {
          const ov = u.o >= 0 ? o[u.o] ?? '' : '', nv = u.n >= 0 ? n[u.n] ?? '' : '';
          if (u.o < 0) return nv;
          if (u.n < 0) return ov;
          if (norm(ov) === norm(nv)) return nv;
          diffCells++;
          changed.add(ri + ':' + (ci + 1));
          return `${ov} → ${nv}`;
        })];
        const st = diffCells ? 'changed' : 'same';
        row[0] = diffCells ? `changed (${diffCells})` : 'same';
        counts[st]++;
        counts.cells += diffCells;
        rows.push(row);
        status.push(st);
      } else if (n) {
        rows.push(['added', ...union.map(u => (u.n >= 0 ? n[u.n] ?? '' : ''))]);
        status.push('added');
        counts.added++;
      } else {
        rows.push(['removed', ...union.map(u => (u.o >= 0 ? o[u.o] ?? '' : ''))]);
        status.push('removed');
        counts.removed++;
      }
    }
    diff = { columns: ['_status', ...union.map(u => u.name)], rows, status, changed, counts, addedCols, removedCols, dupKeys, keyed: keyCols.length > 0 };
  }

  function render() {
    const c = diff.counts;
    const total = c.added + c.removed + c.changed;
    $('ccSummary').className = 'summary ' + (total ? 'warn' : 'ok');
    $('ccSummary').innerHTML = total
      ? `<span class="badge ok">${fmt(c.added)} added</span><span class="badge bad">${fmt(c.removed)} removed</span><span class="badge warn">${fmt(c.changed)} changed rows · ${fmt(c.cells)} cells</span><span class="muted">${fmt(c.same)} unchanged</span>`
      : `<strong>The files have the same data.</strong><span class="muted">${fmt(c.same)} rows compared</span>`;
    const notes = [];
    if (diff.addedCols.length) notes.push(`New columns: ${diff.addedCols.map(esc).join(', ')}`);
    if (diff.removedCols.length) notes.push(`Removed columns: ${diff.removedCols.map(esc).join(', ')}`);
    if (diff.dupKeys) notes.push(`${fmt(diff.dupKeys)} key value${diff.dupKeys === 1 ? ' is' : 's are'} not unique; repeated keys were matched in the order they appear. Add a second key column for an exact match.`);
    if (!diff.keyed) notes.push('Rows were compared by position. If rows were inserted or sorted differently, choose a key column such as an ID.');
    $('ccNotes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
    $('ccResult').hidden = false;
    $('ccView').value = total ? 'diff' : 'all';
    show();
  }

  function show() {
    const v = $('ccView').value;
    const keep = s => v === 'all' || (v === 'diff' ? s !== 'same' : s === v);
    const idx = diff.status.map((s, i) => (keep(s) ? i : -1)).filter(i => i >= 0);
    view = idx;
    grid.setData(diff.columns, idx.map(i => diff.rows[i]));
    $('ccFilter').value = '';
  }

  function init() {
    grid = new DataGrid($('ccGrid'), {
      rowClass: i => { const s = diff.status[view[i]]; return s === 'added' ? 'dg-row-right' : s === 'removed' ? 'dg-row-left' : ''; },
      cellClass: (i, c) => (c === 0 ? 'dg-status' : diff.changed.has(view[i] + ':' + c) ? 'dg-chg' : ''),
    });
    const a = DataSource.mount($('ccOld'), { title: 'Old file', sample: sampleOld, sampleLabel: 'Load sample', compact: true, onLoad: d => { oldD = d; setup(); } });
    const b = DataSource.mount($('ccNew'), { title: 'New file', sample: sampleNew, sampleLabel: 'Load sample', compact: true, onLoad: d => { newD = d; setup(); } });
    $('ccBoth').addEventListener('click', async () => {
      const x = sampleOld(), y = sampleNew();
      a.set(await DataLoad.readText(x.text, x.name));
      b.set(await DataLoad.readText(y.text, y.name));
      compare();
      render();
    });
    $('ccRun').addEventListener('click', () => { compare(); render(); });
    $('ccView').addEventListener('change', show);
    $('ccFilter').addEventListener('input', () => grid.setFilter($('ccFilter').value));
    document.querySelectorAll('[data-cc-export]').forEach(btn => btn.addEventListener('click', async () => {
      if (!diff) return;
      const rows = grid.visibleRows(), base = 'comparison';
      if (btn.dataset.ccExport === 'csv') DataLoad.download(base + '.csv', '﻿' + DataLoad.toCsv(diff.columns, rows), 'text/csv;charset=utf-8');
      else DataLoad.download(base + '.xlsx', await DataLoad.toXlsxBlob([{ name: 'Differences', columns: diff.columns, rows }]));
    }));
  }

  init();
})();
