'use strict';

const ExcelConv = (() => {
  const $ = id => document.getElementById(id);
  let els, grid, data = null, output = '';

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function show(d) {
    data = d;
    els.empty.hidden = true;
    els.workspace.hidden = false;
    els.name.textContent = d.name;
    els.meta.textContent = `${d.rows.length.toLocaleString('en-US')} rows × ${d.columns.length} columns`;
    const multi = d.sheets && d.sheets.length > 1;
    els.sheetWrap.hidden = !multi;
    els.allSheetsWrap.hidden = !multi;
    if (d.sheets) els.sheet.innerHTML = d.sheets.map(s => `<option${s === d.sheet ? ' selected' : ''}>${esc(s)}</option>`).join('');
    grid.setData(d.columns, d.rows);
    convert();
  }

  function sheetsData() {
    if (!data) return [];
    if (data.workbook && els.allSheets.checked) {
      return data.workbook.SheetNames.map(s => DataLoad.fromSheet(data.workbook, s, data.name)).filter(d => d.columns.length).map(d => ({ name: d.sheet, columns: d.columns, rows: d.rows }));
    }
    return [{ name: data.sheet || DataLoad.baseName(data.name), columns: data.columns, rows: data.rows }];
  }

  function markdown(columns, rows) {
    const cell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
    const nums = columns.map((_, i) => rows.length > 0 && rows.every(r => r[i] === '' || /^-?\d+(\.\d+)?$/.test(r[i])));
    return [
      `| ${columns.map(cell).join(' | ')} |`,
      `| ${columns.map((_, i) => (nums[i] ? '---:' : '---')).join(' | ')} |`,
      ...rows.map(r => `| ${columns.map((_, i) => cell(r[i])).join(' | ')} |`),
    ].join('\n');
  }

  function html(columns, rows) {
    return `<table>\n  <thead>\n    <tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>\n  </thead>\n  <tbody>\n${rows.map(r => `    <tr>${columns.map((_, i) => `<td>${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('\n')}\n  </tbody>\n</table>`;
  }

  function convert() {
    if (!data) return;
    const f = els.format.value;
    els.csvOpts.hidden = f !== 'csv';
    els.jsonOpts.hidden = f !== 'json';
    els.textOut.hidden = f === 'xlsx';
    els.xlsxNote.hidden = f !== 'xlsx';
    els.copy.hidden = f === 'xlsx';
    const sheets = sheetsData();
    const typedVals = els.typed.checked;
    if (f === 'csv') {
      const d = { tab: '\t', semicolon: ';', pipe: '|', comma: ',' }[els.delim.value];
      output = sheets.length > 1
        ? sheets.map(s => `# ${s.name}\n${DataLoad.toCsv(s.columns, s.rows, d)}`).join('\n\n')
        : DataLoad.toCsv(sheets[0].columns, sheets[0].rows, d);
    } else if (f === 'json') {
      const shape = els.shape.value;
      const one = s => (shape === 'arrays' ? [s.columns, ...(typedVals ? DataLoad.typedRows(s.columns, s.rows) : s.rows)] : DataLoad.toObjects(s.columns, s.rows, typedVals));
      if (shape === 'ndjson') output = sheets.flatMap(s => DataLoad.toObjects(s.columns, s.rows, typedVals)).map(o => JSON.stringify(o)).join('\n');
      else if (sheets.length > 1) output = JSON.stringify(Object.fromEntries(sheets.map(s => [s.name, one(s)])), null, 2);
      else output = JSON.stringify(one(sheets[0]), null, 2);
    } else if (f === 'markdown') {
      output = sheets.map(s => (sheets.length > 1 ? `## ${s.name}\n\n` : '') + markdown(s.columns, s.rows)).join('\n\n');
    } else if (f === 'html') {
      output = sheets.map(s => (sheets.length > 1 ? `<h2>${esc(s.name)}</h2>\n` : '') + html(s.columns, s.rows)).join('\n\n');
    } else {
      output = '';
      els.xlsxNote.textContent = `Click Download to save ${sheets.length > 1 ? `all ${sheets.length} sheets` : 'the data'} as an Excel workbook (.xlsx). Numbers and true/false become real Excel values.`;
    }
    const big = output.length > 2000000;
    els.textOut.value = big ? output.slice(0, 2000000) + '\n…(preview truncated; Download gives the full file)' : output;
    els.outMeta.textContent = f === 'xlsx' ? '' : `${(new Blob([output]).size / 1024).toFixed(1)} KB`;
  }

  function download() {
    if (!data) return;
    const f = els.format.value;
    const base = DataLoad.baseName(data.name);
    if (f === 'xlsx') { DataLoad.toXlsxBlob(sheetsData()).then(b => DataLoad.download(`${base}.xlsx`, b)).catch(e => showError(e.message)); return; }
    const ext = { csv: els.delim.value === 'tab' ? 'tsv' : 'csv', json: els.shape.value === 'ndjson' ? 'ndjson' : 'json', markdown: 'md', html: 'html' }[f];
    const type = { csv: 'text/csv;charset=utf-8', json: 'application/json', markdown: 'text/markdown', html: 'text/html' }[f];
    DataLoad.download(`${base}.${ext}`, (f === 'csv' ? '﻿' : '') + output, type);
  }

  async function openFiles(files) {
    const f = files[0];
    if (!f) return;
    showError('');
    els.loading.hidden = false;
    try {
      const d = await DataLoad.readFile(f);
      if (DataLoad.EXCEL_EXT.test(f.name)) { if (els.format.value === 'xlsx') els.format.value = 'csv'; }
      else els.format.value = 'xlsx';
      show(d);
    } catch (e) { showError(e.message); }
    finally { els.loading.hidden = true; }
  }

  function init() {
    els = {
      drop: $('xcDrop'), file: $('xcFile'), paste: $('xcPaste'), pasteBtn: $('xcPasteBtn'), error: $('xcError'), loading: $('xcLoading'),
      empty: $('xcEmpty'), workspace: $('xcWorkspace'), name: $('xcName'), meta: $('xcMeta'), sheet: $('xcSheet'), sheetWrap: $('xcSheetWrap'),
      allSheets: $('xcAllSheets'), allSheetsWrap: $('xcAllSheetsWrap'), format: $('xcFormat'), delim: $('xcDelim'), shape: $('xcShape'),
      typed: $('xcTyped'), csvOpts: $('xcCsvOpts'), jsonOpts: $('xcJsonOpts'), textOut: $('xcOutput'), xlsxNote: $('xcXlsxNote'),
      outMeta: $('xcOutMeta'), copy: $('xcCopy'),
    };
    if (!els.drop) return;
    grid = new DataGrid($('xcGrid'));
    els.file.addEventListener('change', e => { openFiles([...e.target.files]); e.target.value = ''; });
    DataLoad.wireDrop(document.body, openFiles);
    els.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.file.click(); } });
    els.pasteBtn.addEventListener('click', async () => {
      showError('');
      try { els.format.value = 'xlsx'; show(await DataLoad.readText(els.paste.value)); }
      catch (e) { showError(e.message); }
    });
    els.sheet.addEventListener('change', () => {
      const d = DataLoad.fromSheet(data.workbook, els.sheet.value, data.name);
      d.workbook = data.workbook;
      show(d);
    });
    [els.format, els.delim, els.shape, els.typed, els.allSheets].forEach(e => e.addEventListener('change', convert));
    $('xcDownload').addEventListener('click', download);
    els.copy.addEventListener('click', e => navigator.clipboard.writeText(output).then(() => { const t = e.target.textContent; e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = t; }, 1200); }));
    $('xcClose').addEventListener('click', () => { data = null; els.workspace.hidden = true; els.empty.hidden = false; showError(''); });
    const want = location.hash.slice(1);
    if (['csv', 'json', 'xlsx', 'markdown', 'html'].includes(want)) els.format.value = want;
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
