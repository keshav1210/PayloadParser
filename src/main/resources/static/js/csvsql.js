'use strict';

const CsvSql = (() => {
  const $ = id => document.getElementById(id);
  const DUCKDB_URL = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm';
  const STORE = 'jxe.csvsql.query';
  let els, grid, engineP = null, tables = [], result = null, fileSeq = 0;

  function status(msg, kind = '') {
    els.status.textContent = msg;
    els.status.className = 'sq-status ' + kind;
  }

  function engine() {
    if (engineP) return engineP;
    engineP = (async () => {
      els.engine.hidden = false;
      els.engine.textContent = 'Loading the SQL engine (DuckDB, about 7 MB, kept by your browser after the first time)…';
      const duckdb = await import(DUCKDB_URL);
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
      const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
      const worker = new Worker(workerUrl);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      const conn = await db.connect();
      els.engine.hidden = true;
      return { duckdb, db, conn };
    })();
    engineP.catch(e => {
      engineP = null;
      els.engine.textContent = 'The SQL engine could not be loaded: ' + e.message + '. Check your connection and try again.';
    });
    return engineP;
  }

  const ident = name => '"' + String(name).replace(/"/g, '""') + '"';
  const literal = s => "'" + String(s).replace(/'/g, "''") + "'";

  function tableName(raw) {
    let base = String(raw).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'data';
    if (/^\d/.test(base)) base = 't_' + base;
    let name = base, n = 2;
    while (tables.some(t => t.name === name)) name = `${base}_${n++}`;
    return name;
  }

  async function addTableFromSql(name, source, select) {
    const { conn } = await engine();
    await conn.query(`CREATE OR REPLACE TABLE ${ident(name)} AS ${select}`);
    const desc = await conn.query(`DESCRIBE ${ident(name)}`);
    const cols = desc.toArray().map(r => ({ name: String(r.column_name), type: String(r.column_type) }));
    const cnt = await conn.query(`SELECT count(*) AS n FROM ${ident(name)}`);
    const rows = Number(cnt.toArray()[0].n);
    tables = tables.filter(t => t.name !== name).concat({ name, source, cols, rows });
    renderTables();
    return name;
  }

  async function addFile(file) {
    const { db, duckdb } = await engine();
    const ext = DataLoad.extOf(file.name);
    if (DataLoad.EXCEL_EXT.test(file.name)) {
      const wb = await DataLoad.readWorkbook(await file.arrayBuffer());
      const added = [];
      for (const sheet of wb.SheetNames) {
        const d = DataLoad.fromSheet(wb, sheet, file.name);
        if (!d.columns.length) continue;
        const name = tableName(wb.SheetNames.length > 1 ? `${file.name.replace(/\.[^.]+$/, '')}_${sheet}` : file.name);
        added.push(await addCsvText(name, `${file.name} › ${sheet}`, DataLoad.toCsv(d.columns, d.rows)));
      }
      return added;
    }
    const fname = `f${++fileSeq}_${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
    await db.registerFileHandle(fname, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    let select;
    if (ext === 'parquet') select = `SELECT * FROM read_parquet(${literal(fname)})`;
    else if (ext === 'json' || ext === 'ndjson' || ext === 'jsonl') select = `SELECT * FROM read_json_auto(${literal(fname)})`;
    else select = `SELECT * FROM read_csv_auto(${literal(fname)}, header = true, sample_size = ${file.size < 50 * 1024 * 1024 ? -1 : 100000})`;
    return [await addTableFromSql(tableName(file.name), file.name, select)];
  }

  async function addCsvText(name, source, csv) {
    const { db } = await engine();
    const fname = `f${++fileSeq}_${name}.csv`;
    await db.registerFileText(fname, csv);
    return addTableFromSql(name, source, `SELECT * FROM read_csv_auto(${literal(fname)}, header = true, sample_size = -1)`);
  }

  async function addJsonText(name, source, json) {
    const { db } = await engine();
    const fname = `f${++fileSeq}_${name}.json`;
    await db.registerFileText(fname, json);
    return addTableFromSql(name, source, `SELECT * FROM read_json_auto(${literal(fname)})`);
  }

  async function addFiles(files) {
    els.error.hidden = true;
    for (const f of files) {
      status(`Loading ${f.name}…`);
      try {
        const names = await addFile(f);
        status(`Added ${names.map(n => `“${n}”`).join(', ')} from ${f.name}.`, 'ok');
        if (!els.editor.value.trim() && names[0]) {
          els.editor.value = `SELECT *\nFROM ${names[0]}\nLIMIT 100;`;
          run();
        }
      } catch (e) {
        showError(`Could not load ${f.name}: ${cleanError(e)}`);
        status('');
      }
    }
  }

  function cleanError(e) {
    const msg = String(e && e.message || e).replace(/^Error:\s*/, '').trimEnd();
    const lines = msg.split('\n');
    const seen = new Set();
    return lines.filter(l => !l.trim() || (!seen.has(l.trimEnd()) && seen.add(l.trimEnd()))).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function renderTables() {
    els.tables.innerHTML = tables.length
      ? tables.map(t => `<li class="sq-table">
          <button type="button" class="sq-tname" data-insert="${DataGrid.esc(t.name)}" title="Insert table name">${DataGrid.esc(t.name)}</button>
          <span class="muted">${t.rows.toLocaleString('en-US')} rows</span>
          <button type="button" class="mini-btn sq-drop" data-drop="${DataGrid.esc(t.name)}" title="Remove table" aria-label="Remove ${DataGrid.esc(t.name)}">×</button>
          <ul>${t.cols.map(c => `<li><button type="button" class="sq-col" data-insert="${DataGrid.esc(/^[a-z_][a-z0-9_]*$/.test(c.name) ? c.name : ident(c.name))}">${DataGrid.esc(c.name)}</button><span class="sq-type">${DataGrid.esc(c.type.toLowerCase())}</span></li>`).join('')}</ul>
        </li>`).join('')
      : '<li class="muted sq-none">No tables yet. Add a file to create one.</li>';
    els.chips.hidden = !tables.length;
  }

  function insert(text) {
    const ta = els.editor;
    const { selectionStart: s, selectionEnd: e } = ta;
    ta.setRangeText(text, s, e, 'end');
    ta.focus();
  }

  function splitStatements(sql) {
    const out = [];
    let cur = '', q = null;
    for (let i = 0; i < sql.length; i++) {
      const c = sql[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '-' && sql[i + 1] === '-') { const nl = sql.indexOf('\n', i); const end = nl < 0 ? sql.length : nl; cur += sql.slice(i, end); i = end - 1; continue; }
      if (c === ';') { if (cur.trim()) out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.replace(/--[^\n]*/g, '').trim()) out.push(cur);
    return out;
  }

  function formatValue(v, type) {
    if (v === null || v === undefined) return '';
    const t = String(type);
    if (/^Decimal/.test(t)) {
      const scale = type.scale || 0;
      let s = typeof v === 'object' && v.toString ? v.toString() : String(v);
      if (scale > 0) {
        const neg = s.startsWith('-');
        s = (neg ? s.slice(1) : s).padStart(scale + 1, '0');
        s = (neg ? '-' : '') + s.slice(0, -scale) + '.' + s.slice(-scale);
      }
      return s;
    }
    if (/^(Timestamp|Date)/.test(t)) {
      let n = typeof v === 'bigint' ? Number(v) : v instanceof Date ? v.getTime() : Number(v);
      if (/MICROSECOND/.test(t) && Math.abs(n) > 1e14) n /= 1000;
      if (/NANOSECOND/.test(t) && Math.abs(n) > 1e17) n /= 1e6;
      const iso = new Date(n).toISOString();
      return /^Date/.test(t) ? iso.slice(0, 10) : iso.replace('.000Z', '').replace('T', ' ').replace('Z', '');
    }
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'object') {
      const plain = typeof v.toJSON === 'function' ? v.toJSON() : typeof v.toArray === 'function' ? [...v.toArray()] : v;
      return JSON.stringify(plain, (k, x) => (typeof x === 'bigint' ? x.toString() : x));
    }
    return String(v);
  }

  async function run() {
    const ta = els.editor;
    const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    const sql = (selected.trim() ? selected : ta.value).trim();
    try { localStorage.setItem(STORE, ta.value); } catch (_) { }
    showError('');
    if (!sql) return;
    els.run.disabled = true;
    status('Running…');
    const t0 = performance.now();
    try {
      const { conn } = await engine();
      const stmts = splitStatements(sql);
      let table = null;
      for (const s of stmts) table = await conn.query(s);
      const ms = Math.round(performance.now() - t0);
      if (stmts.some(s => /^\s*(create|drop|alter|insert|update|delete)\b/i.test(s.replace(/^(\s*--[^\n]*\n)+/, '')))) await refreshTables();
      showResult(table, ms);
    } catch (e) {
      showError(cleanError(e));
      status('Query failed.', 'bad');
    } finally {
      els.run.disabled = false;
    }
  }

  async function refreshTables() {
    const { conn } = await engine();
    const list = (await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name")).toArray().map(r => String(r.table_name));
    const fresh = [];
    for (const name of list) {
      const desc = await conn.query(`DESCRIBE ${ident(name)}`);
      const cols = desc.toArray().map(r => ({ name: String(r.column_name), type: String(r.column_type) }));
      const n = Number((await conn.query(`SELECT count(*) AS n FROM ${ident(name)}`)).toArray()[0].n);
      const old = tables.find(t => t.name === name);
      fresh.push({ name, source: old ? old.source : 'created by query', cols, rows: n });
    }
    tables = fresh;
    renderTables();
  }

  const MAX_SHOW = 200000;

  function showResult(table, ms) {
    if (!table || !table.schema) { status(`Done in ${ms} ms.`, 'ok'); return; }
    const fields = table.schema.fields;
    const n = Math.min(table.numRows, MAX_SHOW);
    const columns = fields.map(f => f.name);
    const vectors = fields.map((_, i) => table.getChildAt(i));
    const rows = new Array(n);
    for (let r = 0; r < n; r++) {
      const row = new Array(fields.length);
      for (let c = 0; c < fields.length; c++) row[c] = formatValue(vectors[c].get(r), fields[c].type);
      rows[r] = row;
    }
    result = { columns, rows, total: table.numRows };
    els.resultWrap.hidden = false;
    grid.setData(columns, rows);
    const more = table.numRows > MAX_SHOW ? ` (showing the first ${MAX_SHOW.toLocaleString('en-US')})` : '';
    status(`${table.numRows.toLocaleString('en-US')} row${table.numRows === 1 ? '' : 's'} in ${ms} ms${more}`, 'ok');
  }

  function exportAs(kind) {
    if (!result) return;
    const rows = grid.visibleRows();
    if (kind === 'csv') DataLoad.download('query-result.csv', '﻿' + DataLoad.toCsv(result.columns, rows), 'text/csv;charset=utf-8');
    else if (kind === 'json') DataLoad.download('query-result.json', JSON.stringify(DataLoad.toObjects(result.columns, rows), null, 2), 'application/json');
    else DataLoad.toXlsxBlob([{ name: 'Result', columns: result.columns, rows }]).then(b => DataLoad.download('query-result.xlsx', b)).catch(e => showError(e.message));
  }

  function sampleData() {
    const regions = ['North', 'South', 'East', 'West'];
    const products = [['Laptop', 899], ['Monitor', 229], ['Keyboard', 59], ['Mouse', 25], ['Headset', 79], ['Dock', 189]];
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const orders = ['order_id,order_date,region,product,quantity,unit_price,status'];
    for (let i = 1; i <= 2000; i++) {
      const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(rnd() * 600) * 86400000).toISOString().slice(0, 10);
      const [p, price] = products[Math.floor(rnd() * products.length)];
      orders.push(`${10000 + i},${d},${regions[Math.floor(rnd() * 4)]},${p},${1 + Math.floor(rnd() * 8)},${price},${rnd() < 0.08 ? 'returned' : 'shipped'}`);
    }
    const managers = 'region,manager,target\nNorth,Asha Rao,350000\nSouth,Ben Carter,300000\nEast,Chen Wei,320000\nWest,Diego Lopez,280000';
    return { orders: orders.join('\n'), managers };
  }

  const EXAMPLES = {
    totals: t => `SELECT region,\n       count(*) AS orders,\n       sum(quantity * unit_price) AS revenue\nFROM ${t}\nGROUP BY region\nORDER BY revenue DESC;`,
    top: t => `SELECT product,\n       sum(quantity) AS units,\n       round(sum(quantity * unit_price), 2) AS revenue\nFROM ${t}\nGROUP BY product\nORDER BY revenue DESC\nLIMIT 10;`,
    monthly: t => `SELECT date_trunc('month', order_date) AS month,\n       sum(quantity * unit_price) AS revenue\nFROM ${t}\nGROUP BY month\nORDER BY month;`,
    nulls: t => `SUMMARIZE ${t};`,
    join: () => `SELECT o.region, m.manager, m.target,\n       sum(o.quantity * o.unit_price) AS revenue,\n       round(100 * sum(o.quantity * o.unit_price) / m.target, 1) AS pct_of_target\nFROM orders o\nJOIN managers m USING (region)\nGROUP BY o.region, m.manager, m.target\nORDER BY pct_of_target DESC;`,
  };

  async function loadSample() {
    showError('');
    status('Loading sample tables…');
    try {
      const s = sampleData();
      await addCsvText('orders', 'sample orders.csv', s.orders);
      await addCsvText('managers', 'sample managers.csv', s.managers);
      els.editor.value = EXAMPLES.join();
      await run();
    } catch (e) { showError(cleanError(e)); status(''); }
  }

  async function addPasted() {
    const text = els.paste.value.trim();
    if (!text) { showError('Paste CSV or JSON first.'); return; }
    showError('');
    try {
      const name = tableName(els.pasteName.value.trim() || 'pasted');
      if (/^[[{]/.test(text)) await addJsonText(name, 'pasted JSON', text);
      else await addCsvText(name, 'pasted CSV', text);
      els.paste.value = '';
      els.pasteBox.open = false;
      status(`Added “${name}”.`, 'ok');
      if (!els.editor.value.trim()) { els.editor.value = `SELECT * FROM ${name} LIMIT 100;`; run(); }
    } catch (e) { showError(cleanError(e)); }
  }

  async function init() {
    els = {
      drop: $('sqDrop'), file: $('sqFile'), tables: $('sqTables'), editor: $('sqEditor'), run: $('sqRun'), status: $('sqStatus'),
      engine: $('sqEngine'), error: $('sqError'), resultWrap: $('sqResultWrap'), chips: $('sqChips'), paste: $('sqPaste'),
      pasteName: $('sqPasteName'), pasteBox: $('sqPasteBox'),
    };
    if (!els.editor) return;
    grid = new DataGrid($('sqGrid'));
    try { els.editor.value = localStorage.getItem(STORE) || ''; } catch (_) { }
    renderTables();
    els.file.addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
    DataLoad.wireDrop(document.body, addFiles);
    els.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.file.click(); } });
    els.run.addEventListener('click', run);
    els.editor.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insert('  '); }
    });
    els.tables.addEventListener('click', async e => {
      const ins = e.target.closest('[data-insert]');
      if (ins) { insert(ins.dataset.insert); return; }
      const drop = e.target.closest('[data-drop]');
      if (drop) {
        const { conn } = await engine();
        await conn.query(`DROP TABLE IF EXISTS ${ident(drop.dataset.drop)}`);
        tables = tables.filter(t => t.name !== drop.dataset.drop);
        renderTables();
      }
    });
    document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => {
      const t = tables[0] ? tables[0].name : 'orders';
      els.editor.value = EXAMPLES[b.dataset.example](t);
      run();
    }));
    document.querySelectorAll('[data-sq-export]').forEach(b => b.addEventListener('click', () => exportAs(b.dataset.sqExport)));
    $('sqSample').addEventListener('click', loadSample);
    $('sqPasteAdd').addEventListener('click', addPasted);
    let handoff = null;
    try { handoff = JSON.parse(sessionStorage.getItem('jxe.handoff')); sessionStorage.removeItem('jxe.handoff'); } catch (_) { }
    if (handoff && handoff.csv) {
      try {
        const name = await addCsvText(tableName(handoff.name), handoff.name, handoff.csv);
        els.editor.value = `SELECT *\nFROM ${name}\nLIMIT 100;`;
        run();
      } catch (e) { showError(cleanError(e)); }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
