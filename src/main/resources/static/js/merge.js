'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = DataSource.esc;
  const fmt = n => n.toLocaleString('en-US');
  let left = null, right = null, grid = null, result = null;

  function sampleOrders() {
    const s = DataSource.sampleSales(300, 11);
    const lines = s.text.split('\n');
    lines[0] = lines[0].replace('sales_rep', 'rep_id');
    const ids = { 'Asha Rao': 'R01', 'Ben Carter': 'R02', 'Chen Wei': 'R03', 'Diego Lopez': 'R04', 'Fatima Khan': 'R05', 'Grace Kim': 'R09' };
    for (let i = 1; i < lines.length; i++) lines[i] = lines[i].replace(/,(Asha Rao|Ben Carter|Chen Wei|Diego Lopez|Fatima Khan|Grace Kim),/, (m, n) => `,${ids[n]},`);
    return { name: 'orders.csv', text: lines.join('\n') };
  }

  function sampleReps() {
    return {
      name: 'sales-reps.csv',
      text: ['rep_id,rep_name,team,email', 'R01,Asha Rao,Enterprise,asha@example.com', 'R02,Ben Carter,SMB,ben@example.com', 'r03 ,Chen Wei,Enterprise,chen@example.com', 'R04,Diego Lopez,SMB,diego@example.com', 'R05,Fatima Khan,Mid-market,fatima@example.com', 'R06,Hannah Moss,Mid-market,hannah@example.com'].join('\n'),
    };
  }

  function guessKey(a, b) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < a.columns.length; i++) {
      const j = b.columns.findIndex(c => norm(c) === norm(a.columns[i]));
      if (j >= 0) return [i, j];
    }
    const idLike = cols => Math.max(0, cols.findIndex(c => /(^|_|\s)(id|key|code|email|sku)$/i.test(c)));
    return [idLike(a.columns), idLike(b.columns)];
  }

  function setup() {
    const ready = left && right;
    $('mgOptions').hidden = !ready;
    if (!ready) return;
    const [ka, kb] = guessKey(left, right);
    $('mgKeyA').innerHTML = DataSource.columnOptions(left.columns, ka);
    $('mgKeyB').innerHTML = DataSource.columnOptions(right.columns, kb);
    renderBring();
  }

  function renderBring() {
    const kb = +$('mgKeyB').value;
    $('mgBring').innerHTML = right.columns.map((c, i) => i === kb ? '' : `<label class="check"><input type="checkbox" class="mgCol" value="${i}" checked> ${esc(c)}</label>`).join('');
  }

  function run() {
    $('mgError').hidden = true;
    const ka = +$('mgKeyA').value, kb = +$('mgKeyB').value;
    const how = $('mgHow').value, loose = $('mgLoose').checked, first = $('mgFirst').checked, flag = $('mgFlag').checked;
    const bring = [...document.querySelectorAll('.mgCol:checked')].map(x => +x.value);
    const norm = v => (loose ? (v ?? '').trim().toLowerCase() : v ?? '');

    const index = new Map();
    let dupKeys = 0;
    right.rows.forEach((r, i) => {
      const k = norm(r[kb]);
      if (k === '') return;
      const list = index.get(k);
      if (list) { if (list.length === 1) dupKeys++; list.push(i); }
      else index.set(k, [i]);
    });

    const leftNames = new Set(left.columns);
    const bringNames = bring.map(i => (leftNames.has(right.columns[i]) ? `${right.columns[i]}_2` : right.columns[i]));
    const columns = [...left.columns, ...bringNames, ...(flag ? ['_match'] : [])];
    const rows = [];
    const status = [];
    const usedRight = new Set();
    let matched = 0, unmatched = 0;
    const emptyRight = bring.map(() => '');
    const emptyLeft = left.columns.map(() => '');

    for (const r of left.rows) {
      const k = norm(r[ka]);
      let hits = k === '' ? null : index.get(k);
      if (hits && first) hits = hits.slice(0, 1);
      if (hits) {
        matched++;
        for (const h of hits) {
          usedRight.add(h);
          rows.push([...r, ...bring.map(i => right.rows[h][i] ?? ''), ...(flag ? ['both'] : [])]);
          status.push('both');
        }
      } else {
        unmatched++;
        if (how === 'inner') continue;
        rows.push([...r, ...emptyRight, ...(flag ? ['left only'] : [])]);
        status.push('left');
      }
    }
    let rightOnly = 0;
    if (first) index.forEach(list => { if (usedRight.has(list[0])) list.slice(1).forEach(h => usedRight.add(h)); });
    right.rows.forEach((r, i) => {
      if (usedRight.has(i)) return;
      rightOnly++;
      if (how !== 'full') return;
      const nl = emptyLeft.slice();
      nl[ka] = r[kb] ?? '';
      rows.push([...nl, ...bring.map(c => r[c] ?? ''), ...(flag ? ['right only'] : [])]);
      status.push('right');
    });

    result = { columns, rows, status };
    const nameA = esc(left.name), nameB = esc(right.name);
    const parts = [
      `<strong>${fmt(rows.length)}</strong> rows`,
      `<span class="badge ok">${fmt(matched)} matched</span>`,
      unmatched ? `<span class="badge warn">${fmt(unmatched)} rows in ${nameA} with no match</span>` : '',
      rightOnly ? `<span class="badge">${fmt(rightOnly)} rows in ${nameB} not used</span>` : '',
    ].filter(Boolean);
    let note = '';
    if (dupKeys && !first) note = `<p class="muted mg-note">${fmt(dupKeys)} key${dupKeys === 1 ? ' appears' : 's appear'} more than once in ${nameB}, so matching rows were repeated. Tick “First match only” to behave like VLOOKUP.</p>`;
    else if (dupKeys) note = `<p class="muted mg-note">${fmt(dupKeys)} key${dupKeys === 1 ? ' appears' : 's appear'} more than once in ${nameB}; only the first was used.</p>`;
    $('mgSummary').innerHTML = parts.join(' ');
    $('mgNote').innerHTML = note;
    $('mgResult').hidden = false;
    grid.setData(columns, rows);
    $('mgFilter').value = '';
  }

  function init() {
    grid = new DataGrid($('mgGrid'), { rowClass: i => (result && result.status[i] !== 'both' ? 'dg-row-' + result.status[i] : '') });
    const srcA = DataSource.mount($('mgLeft'), { title: 'Main table', sample: sampleOrders, sampleLabel: 'Load sample orders', compact: true, onLoad: d => { left = d; setup(); } });
    const srcB = DataSource.mount($('mgRight'), { title: 'Lookup table', sample: sampleReps, sampleLabel: 'Load sample reps', compact: true, onLoad: d => { right = d; setup(); } });
    $('mgBoth').addEventListener('click', async () => {
      const a = sampleOrders(), b = sampleReps();
      srcA.set(await DataLoad.readText(a.text, a.name));
      srcB.set(await DataLoad.readText(b.text, b.name));
      run();
    });
    $('mgKeyB').addEventListener('change', renderBring);
    $('mgRun').addEventListener('click', run);
    $('mgFilter').addEventListener('input', () => grid.setFilter($('mgFilter').value));
    document.querySelectorAll('[data-mg-export]').forEach(b => b.addEventListener('click', async () => {
      if (!result) return;
      const rows = grid.visibleRows(), base = DataLoad.baseName(left.name) + '-merged';
      const kind = b.dataset.mgExport;
      if (kind === 'csv') DataLoad.download(base + '.csv', '﻿' + DataLoad.toCsv(result.columns, rows), 'text/csv;charset=utf-8');
      else DataLoad.download(base + '.xlsx', await DataLoad.toXlsxBlob([{ name: 'Merged', columns: result.columns, rows }]));
    }));
  }

  init();
})();
