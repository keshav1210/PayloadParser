'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = DataSource.esc;
  const fmt = n => n.toLocaleString('en-US');
  const SEP = '\u0001';
  const MAX_COLS = 80, MAX_ROWS = 3000;
  let data = null, table = null;

  const AGG = { count: 'Count', sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max', distinct: 'Count distinct' };
  const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY = ['1 Mon', '2 Tue', '3 Wed', '4 Thu', '5 Fri', '6 Sat', '7 Sun'];

  function group(v, how) {
    if (how === 'none' || !v) return v;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (!m) return v;
    const y = m[1], mo = +m[2];
    if (how === 'year') return y;
    if (how === 'quarter') return `${y}-Q${Math.ceil(mo / 3)}`;
    if (how === 'month') return `${y}-${m[2]}`;
    if (how === 'monthname') return `${m[2]} ${MONTH[mo - 1]}`;
    if (how === 'weekday') return DAY[(new Date(Date.UTC(+y, mo - 1, +m[3])).getUTCDay() + 6) % 7];
    return v;
  }

  const num = v => { const t = (v ?? '').trim(); return t !== '' && isFinite(+t) ? +t : null; };
  const acc = () => ({ rows: 0, n: 0, nums: 0, sum: 0, min: Infinity, max: -Infinity, set: null });

  function add(a, v, agg) {
    a.rows++;
    if (v === undefined) return;
    if ((v ?? '').trim() === '') return;
    a.n++;
    if (agg === 'distinct') { (a.set || (a.set = new Set())).add(v); return; }
    const x = num(v);
    if (x === null) return;
    a.nums++;
    a.sum += x;
    if (x < a.min) a.min = x;
    if (x > a.max) a.max = x;
  }

  function value(a, agg, hasVal) {
    if (!a) return null;
    switch (agg) {
      case 'count': return hasVal ? a.n : a.rows;
      case 'sum': return a.nums ? a.sum : null;
      case 'avg': return a.nums ? a.sum / a.nums : null;
      case 'min': return a.nums ? a.min : null;
      case 'max': return a.nums ? a.max : null;
      case 'distinct': return a.set ? a.set.size : 0;
    }
    return null;
  }

  function fieldOptions(sel, blank) {
    return DataSource.columnOptions(data.columns, sel, blank === undefined ? {} : { blank });
  }

  function setup(d) {
    data = d;
    const cols = d.columns;
    const prof = Profiler.profile(cols, d.rows.length > 5000 ? d.rows.filter((_, i) => i % Math.ceil(d.rows.length / 5000) === 0) : d.rows);
    const isNum = i => prof[i].type === 'integer' || prof[i].type === 'decimal';
    const cat = prof.map((p, i) => [p, i]).filter(([p]) => p.type === 'text' && p.distinct && p.distinct <= 50);
    const rowGuess = cat.length ? cat[0][1] : 0;
    const colGuess = cat.length > 1 ? cat[1][1] : '';
    const numGuess = prof.map((p, i) => i).filter(isNum).filter(i => !/(^|_)(id|year|zip|code)$/i.test(cols[i])).pop();
    $('pvRows').innerHTML = fieldOptions(rowGuess);
    $('pvRows2').innerHTML = fieldOptions('', '(none)');
    $('pvCols').innerHTML = fieldOptions(colGuess, '(none)');
    $('pvVal').innerHTML = fieldOptions(numGuess ?? '', '(rows)');
    $('pvAgg').value = numGuess !== undefined ? 'sum' : 'count';
    const hasDate = prof.some(p => p.type === 'date');
    $('pvDateWrap').hidden = !hasDate;
    $('pvWork').hidden = false;
    build();
  }

  function build() {
    $('pvError').hidden = true;
    const r1 = +$('pvRows').value, r2 = $('pvRows2').value === '' ? -1 : +$('pvRows2').value;
    const cf = $('pvCols').value === '' ? -1 : +$('pvCols').value;
    const vf = $('pvVal').value === '' ? -1 : +$('pvVal').value;
    const agg = $('pvAgg').value, showAs = $('pvShow').value, how = $('pvDate').value, sort = $('pvSort').value;
    if (vf < 0 && agg !== 'count') $('pvAgg').value = 'count';
    const aggUsed = vf < 0 ? 'count' : agg;

    const cells = new Map(), rowTot = new Map(), colTot = new Map(), grand = acc();
    const colKeys = new Set();
    for (const r of data.rows) {
      const rk = group(r[r1] ?? '', how) + (r2 >= 0 ? SEP + group(r[r2] ?? '', how) : '');
      const ck = cf >= 0 ? group(r[cf] ?? '', how) : '';
      const v = vf >= 0 ? r[vf] ?? '' : undefined;
      colKeys.add(ck);
      if (colKeys.size > MAX_COLS) {
        $('pvError').textContent = `“${data.columns[cf]}” has more than ${MAX_COLS} different values, which is too many for columns. Put it in Rows instead, or group dates.`;
        $('pvError').hidden = false;
        return;
      }
      let row = cells.get(rk);
      if (!row) cells.set(rk, (row = new Map()));
      let a = row.get(ck);
      if (!a) row.set(ck, (a = acc()));
      add(a, v, aggUsed);
      let t = rowTot.get(rk); if (!t) rowTot.set(rk, (t = acc())); add(t, v, aggUsed);
      let ct = colTot.get(ck); if (!ct) colTot.set(ck, (ct = acc())); add(ct, v, aggUsed);
      add(grand, v, aggUsed);
    }
    const hasVal = vf >= 0;
    const val = a => value(a, aggUsed, hasVal);
    const cmp = (a, b) => DataGrid.compare(a, b);
    const cks = [...colKeys].sort(cmp);
    let rks = [...cells.keys()];
    if (sort === 'desc') rks.sort((a, b) => (val(rowTot.get(b)) ?? -Infinity) - (val(rowTot.get(a)) ?? -Infinity) || cmp(a, b));
    else if (sort === 'asc') rks.sort((a, b) => (val(rowTot.get(a)) ?? Infinity) - (val(rowTot.get(b)) ?? Infinity) || cmp(a, b));
    else rks.sort((a, b) => { const [a1, a2 = ''] = a.split(SEP), [b1, b2 = ''] = b.split(SEP); return cmp(a1, b1) || cmp(a2, b2); });

    const additive = aggUsed === 'sum' || aggUsed === 'count';
    const show = (x, rk, ck) => {
      if (x === null || x === undefined) return null;
      if (showAs === 'value' || !additive) return x;
      const base = showAs === 'total' ? val(grand) : showAs === 'row' ? val(rowTot.get(rk)) : val(colTot.get(ck));
      return base ? (x / base) * 100 : null;
    };
    const pct = showAs !== 'value' && additive;
    const label = `${AGG[aggUsed]}${hasVal ? ' of ' + data.columns[vf] : ''}${pct ? ' (%)' : ''}`;

    const rowHead = [data.columns[r1], ...(r2 >= 0 ? [data.columns[r2]] : [])];
    const colHead = cf >= 0 ? cks.map(c => c === '' ? '(blank)' : c) : [label];
    const out = rks.map(rk => {
      const parts = rk.split(SEP).map(p => p === '' ? '(blank)' : p);
      const row = cells.get(rk);
      const vals = cf >= 0 ? cks.map(ck => show(val(row.get(ck)), rk, ck)) : [show(val(rowTot.get(rk)), rk, '')];
      const tot = cf >= 0 ? show(val(rowTot.get(rk)), rk, null) : null;
      return { parts, vals, tot };
    });
    const totals = { vals: cf >= 0 ? cks.map(ck => show(val(colTot.get(ck)), null, ck)) : [show(val(grand), null, null)], tot: cf >= 0 ? show(val(grand), null, null) : null };
    if (showAs === 'row' && cf >= 0) totals.vals = cks.map(ck => { const g = val(grand); return g ? (val(colTot.get(ck)) / g) * 100 : null; });
    if (pct && cf >= 0) totals.tot = 100;
    if (showAs === 'col' && cf >= 0) out.forEach(o => { const g = val(grand); o.tot = g ? (val(rowTot.get(o.parts.join(SEP))) / g) * 100 : null; });

    table = { rowHead, colHead, out, totals, pct, label, hasColTotals: cf >= 0, colName: cf >= 0 ? data.columns[cf] : '' };
    renderTable();
    $('pvNote').textContent = !additive && showAs !== 'value' ? 'Percentages are only available for Sum and Count.' : '';
  }

  function cellFmt(x, pct) {
    if (x === null || x === undefined || Number.isNaN(x)) return '';
    if (pct) return x.toFixed(1) + '%';
    if (Number.isInteger(x)) return fmt(x);
    return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function renderTable() {
    const t = table;
    const shown = t.out.slice(0, MAX_ROWS);
    const heat = $('pvHeat').checked;
    let max = 0;
    if (heat) for (const o of shown) for (const v of o.vals) if (v > max) max = v;
    const style = v => (heat && max > 0 && v > 0 ? ` style="background:rgba(47,111,237,${(0.08 + 0.5 * (v / max)).toFixed(3)})"` : '');
    const head = `<tr>${t.rowHead.map(h => `<th class="pv-rh">${esc(h)}</th>`).join('')}${t.colHead.map(h => `<th>${esc(h)}</th>`).join('')}${t.hasColTotals ? '<th class="pv-tot">Total</th>' : ''}</tr>`;
    const top = t.hasColTotals ? `<tr class="pv-cap"><th colspan="${t.rowHead.length}"></th><th colspan="${t.colHead.length + 1}">${esc(t.colName)} · ${esc(t.label)}</th></tr>` : '';
    const body = shown.map(o => `<tr>${o.parts.map(p => `<th class="pv-rh">${esc(p)}</th>`).join('')}${o.vals.map(v => `<td${style(v)}>${cellFmt(v, t.pct)}</td>`).join('')}${t.hasColTotals ? `<td class="pv-tot">${cellFmt(o.tot, t.pct)}</td>` : ''}</tr>`).join('');
    const foot = `<tr class="pv-total"><th class="pv-rh" colspan="${t.rowHead.length}">Grand total</th>${t.totals.vals.map(v => `<td>${cellFmt(v, t.pct)}</td>`).join('')}${t.hasColTotals ? `<td class="pv-tot">${cellFmt(t.totals.tot, t.pct)}</td>` : ''}</tr>`;
    $('pvTable').innerHTML = `<table class="pv-table"><thead>${top}${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`;
    $('pvInfo').textContent = `${fmt(t.out.length)} row${t.out.length === 1 ? '' : 's'}${t.out.length > MAX_ROWS ? ` (first ${fmt(MAX_ROWS)} shown, export for all)` : ''}`;
  }

  function matrix(withTotals) {
    const t = table;
    const columns = [...t.rowHead, ...t.colHead, ...(t.hasColTotals && withTotals ? ['Total'] : [])];
    const f = v => (v === null || v === undefined || Number.isNaN(v) ? '' : String(Math.round(v * 1e6) / 1e6));
    const rows = t.out.map(o => [...o.parts, ...o.vals.map(f), ...(t.hasColTotals && withTotals ? [f(o.tot)] : [])]);
    if (withTotals) rows.push(['Grand total', ...t.rowHead.slice(1).map(() => ''), ...t.totals.vals.map(f), ...(t.hasColTotals ? [f(t.totals.tot)] : [])]);
    return { columns, rows };
  }

  function init() {
    DataSource.mount($('pvSource'), { title: 'Your data', sample: () => DataSource.sampleSales(800), onLoad: setup });
    ['pvRows', 'pvRows2', 'pvCols', 'pvVal', 'pvAgg', 'pvShow', 'pvDate', 'pvSort'].forEach(id => $(id).addEventListener('change', build));
    $('pvHeat').addEventListener('change', () => table && renderTable());
    $('pvSwap').addEventListener('click', () => {
      if ($('pvCols').value === '') return;
      const r = $('pvRows').value;
      $('pvRows').value = $('pvCols').value;
      $('pvCols').value = r;
      build();
    });
    document.querySelectorAll('[data-pv-export]').forEach(b => b.addEventListener('click', async () => {
      if (!table) return;
      const { columns, rows } = matrix(true);
      const base = DataLoad.baseName(data.name) + '-pivot';
      if (b.dataset.pvExport === 'csv') DataLoad.download(base + '.csv', '﻿' + DataLoad.toCsv(columns, rows), 'text/csv;charset=utf-8');
      else DataLoad.download(base + '.xlsx', await DataLoad.toXlsxBlob([{ name: 'Pivot', columns, rows }]));
    }));
    $('pvChart').addEventListener('click', () => {
      if (!table) return;
      const { columns, rows } = matrix(false);
      try { sessionStorage.setItem('jxe.chart', JSON.stringify({ name: DataLoad.baseName(data.name) + '-pivot.csv', csv: DataLoad.toCsv(columns, rows) })); } catch (_) { }
      location.href = '/chart-maker';
    });
  }

  init();
})();
