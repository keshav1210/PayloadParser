'use strict';

const CsvViewer = (() => {
  const $ = id => document.getElementById(id);
  let els, grid, data = null, profiled = null, timer = null;

  function sampleCsv() {
    const regions = ['North', 'South', 'East', 'West'];
    const products = ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Webcam', 'Dock'];
    const reps = ['Asha Rao', 'Ben Carter', 'Chen Wei', 'Diego Lopez', 'Fatima Khan', 'Grace Kim'];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows = ['order_id,order_date,region,sales_rep,product,quantity,unit_price,discount,status'];
    for (let i = 1; i <= 1200; i++) {
      const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(rnd() * 600) * 86400000).toISOString().slice(0, 10);
      const p = products[Math.floor(rnd() * products.length)];
      const price = { Laptop: 899, Monitor: 229, Keyboard: 59, Mouse: 25, Headset: 79, Webcam: 49, Dock: 189 }[p];
      const qty = 1 + Math.floor(rnd() * (p === 'Mouse' || p === 'Keyboard' ? 20 : 6));
      const disc = rnd() < 0.3 ? (Math.round(rnd() * 20) / 100).toFixed(2) : '0.00';
      const status = rnd() < 0.08 ? 'returned' : rnd() < 0.15 ? 'pending' : 'shipped';
      const rep = rnd() < 0.02 ? '' : reps[Math.floor(rnd() * reps.length)];
      rows.push(`${10000 + i},${d},${regions[Math.floor(rnd() * 4)]},${rep},${p},${qty},${price}.00,${disc},${status}`);
    }
    return rows.join('\n');
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function setLoading(on, label = 'Reading file…') {
    els.loading.hidden = !on;
    els.loading.textContent = label;
  }

  function show(d) {
    data = d;
    profiled = null;
    els.empty.hidden = true;
    els.workspace.hidden = false;
    els.name.textContent = d.name;
    els.meta.textContent = `${d.rows.length.toLocaleString('en-US')} rows × ${d.columns.length} columns${d.delimiter && d.delimiter !== ',' ? ` · delimiter ${d.delimiter === '\t' ? 'tab' : `"${d.delimiter}"`}` : ''}`;
    els.sheetWrap.hidden = !(d.sheets && d.sheets.length > 1);
    if (d.sheets) els.sheet.innerHTML = d.sheets.map(s => `<option${s === d.sheet ? ' selected' : ''}>${DataGrid.esc(s)}</option>`).join('');
    els.filter.value = '';
    grid.setData(d.columns, d.rows);
    if (els.profileTab.getAttribute('aria-selected') === 'true') renderProfile();
  }

  function renderProfile() {
    if (!data) return;
    if (!profiled) {
      const t0 = performance.now();
      profiled = Profiler.profile(data.columns, data.rows);
      els.profileMeta.textContent = `${data.columns.length} columns profiled in ${Math.round(performance.now() - t0)} ms`;
    }
    els.profile.innerHTML = Profiler.render(profiled, data.rows.length);
  }

  async function openFiles(files) {
    const f = files[0];
    if (!f) return;
    showError('');
    if (f.size > 300 * 1024 * 1024) { showError('Files up to 300 MB can be opened in the browser. For bigger files, use the SQL tool, which reads them more efficiently.'); return; }
    setLoading(true, `Reading ${f.name}…`);
    try { show(await DataLoad.readFile(f)); }
    catch (e) { showError(e.message); }
    finally { setLoading(false); }
  }

  function setTab(t) {
    document.querySelectorAll('[data-cv-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.cvTab === t)));
    els.tablePane.hidden = t !== 'table';
    els.profilePane.hidden = t !== 'profile';
    if (t === 'profile') renderProfile();
  }

  function exportAs(kind) {
    if (!data) return;
    const rows = grid.visibleRows();
    const base = DataLoad.baseName(data.name) + (grid.filter ? '-filtered' : '');
    if (kind === 'csv') DataLoad.download(`${base}.csv`, '﻿' + DataLoad.toCsv(data.columns, rows), 'text/csv;charset=utf-8');
    else if (kind === 'json') DataLoad.download(`${base}.json`, JSON.stringify(DataLoad.toObjects(data.columns, rows), null, 2), 'application/json');
    else DataLoad.toXlsxBlob([{ name: data.sheet || 'Data', columns: data.columns, rows }]).then(b => DataLoad.download(`${base}.xlsx`, b)).catch(e => showError(e.message));
  }

  function openInSql() {
    if (!data) return;
    const csv = DataLoad.toCsv(data.columns, data.rows);
    if (csv.length > 4.5 * 1024 * 1024) {
      showError('This file is too large to hand over directly. Open the SQL tool and load the same file there.');
      return;
    }
    try {
      sessionStorage.setItem('jxe.handoff', JSON.stringify({ name: data.name.replace(/\.[^.]+$/, '') + '.csv', csv }));
      location.href = '/csv-sql';
    } catch (_) { showError('Your browser blocked passing the data. Open the SQL tool and load the file there.'); }
  }

  function init() {
    els = {
      drop: $('cvDrop'), file: $('cvFile'), paste: $('cvPaste'), pasteBtn: $('cvPasteBtn'), sample: $('cvSample'), error: $('cvError'),
      loading: $('cvLoading'), empty: $('cvEmpty'), workspace: $('cvWorkspace'), name: $('cvName'), meta: $('cvMeta'), info: $('cvInfo'),
      sheet: $('cvSheet'), sheetWrap: $('cvSheetWrap'), filter: $('cvFilter'), tablePane: $('cvTablePane'), profilePane: $('cvProfilePane'),
      profile: $('cvProfile'), profileMeta: $('cvProfileMeta'), profileTab: document.querySelector('[data-cv-tab="profile"]'),
    };
    if (!els.drop) return;
    grid = new DataGrid($('cvGrid'), {
      onChange: ({ total, shown }) => { els.info.textContent = shown === total ? `${total.toLocaleString('en-US')} rows` : `${shown.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} rows`; },
    });
    els.file.addEventListener('change', e => { openFiles([...e.target.files]); e.target.value = ''; });
    DataLoad.wireDrop(document.body, openFiles);
    els.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.file.click(); } });
    els.pasteBtn.addEventListener('click', async () => {
      showError('');
      try { show(await DataLoad.readText(els.paste.value)); }
      catch (e) { showError(e.message); }
    });
    els.sample.addEventListener('click', async () => { showError(''); show(await DataLoad.readText(sampleCsv(), 'sample-sales.csv')); });
    els.sheet.addEventListener('change', () => {
      if (!data || !data.workbook) return;
      const d = DataLoad.fromSheet(data.workbook, els.sheet.value, data.name);
      d.workbook = data.workbook;
      show(d);
    });
    els.filter.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => grid.setFilter(els.filter.value), 150); });
    document.querySelectorAll('[data-cv-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.cvTab)));
    document.querySelectorAll('[data-cv-export]').forEach(b => b.addEventListener('click', () => exportAs(b.dataset.cvExport)));
    $('cvToSql').addEventListener('click', openInSql);
    $('cvClose').addEventListener('click', () => { data = null; els.workspace.hidden = true; els.empty.hidden = false; showError(''); });
    els.profile.addEventListener('click', e => {
      const card = e.target.closest('.pf-card');
      if (!card) return;
      setTab('table');
      grid.sortBy(+card.dataset.col);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
