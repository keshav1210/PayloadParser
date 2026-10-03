'use strict';

const DataLoad = (() => {
  const loaded = {};
  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { delete loaded[src]; reject(new Error('Could not load a required library. Check your connection and try again.')); };
        document.head.append(s);
      });
    }
    return loaded[src];
  }

  const ensurePapa = () => loadScript('/js/vendor/papaparse.min.js?v=5.5.3', 'Papa');
  const ensureXlsx = () => loadScript('/js/vendor/xlsx.full.min.js?v=0.20.3', 'XLSX');

  const EXCEL_EXT = /\.(xlsx|xlsm|xlsb|xls|ods|numbers)$/i;
  const extOf = name => (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';

  function uniqueHeaders(raw) {
    const used = new Set();
    return raw.map((h, i) => {
      const base = String(h ?? '').trim() || `column_${i + 1}`;
      let name = base, n = 2;
      while (used.has(name)) name = `${base}_${n++}`;
      used.add(name);
      return name;
    });
  }

  function cellText(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) {
      if (isNaN(v)) return '';
      const p = n => String(n).padStart(2, '0');
      const date = `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
      const h = v.getHours(), m = v.getMinutes(), s = v.getSeconds();
      return h || m || s ? `${date} ${p(h)}:${p(m)}:${p(s)}` : date;
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function fromMatrix(matrix, name, hasHeader = true) {
    const rows = matrix.filter(r => r && r.some(c => cellText(c) !== ''));
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    let header;
    if (hasHeader && rows.length) header = uniqueHeaders(Array.from({ length: width }, (_, i) => cellText(rows[0][i])));
    else header = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    const body = (hasHeader ? rows.slice(1) : rows).map(r => Array.from({ length: width }, (_, i) => cellText(r[i])));
    return { name, columns: header, rows: body };
  }

  function flatten(obj, prefix, out) {
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
      const keys = Object.keys(obj);
      if (!keys.length && prefix) out[prefix] = '{}';
      for (const k of keys) flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
    } else if (Array.isArray(obj)) {
      if (obj.every(x => x === null || typeof x !== 'object')) out[prefix || 'value'] = obj.map(cellText).join(', ');
      else out[prefix || 'value'] = JSON.stringify(obj);
    } else {
      out[prefix || 'value'] = cellText(obj);
    }
    return out;
  }

  function fromJson(text, name) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      try { data = lines.map(l => JSON.parse(l)); }
      catch (_) { throw new Error('This JSON is not valid: ' + e.message); }
    }
    if (!Array.isArray(data)) {
      const arrKey = data && typeof data === 'object' && Object.keys(data).find(k => Array.isArray(data[k]) && data[k].length && typeof data[k][0] === 'object');
      data = arrKey ? data[arrKey] : [data];
    }
    if (data.length && Array.isArray(data[0])) return fromMatrix(data, name, true);
    const flat = data.map(item => flatten(item, '', {}));
    const columns = [];
    const seen = new Set();
    for (const r of flat) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
    return { name, columns, rows: flat.map(r => columns.map(c => r[c] ?? '')) };
  }

  async function fromCsvText(text, name) {
    await ensurePapa();
    const res = Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy', delimitersToGuess: [',', '\t', ';', '|'] });
    if (!res.data.length) throw new Error('No rows found.');
    const d = fromMatrix(res.data, name, true);
    d.delimiter = res.meta.delimiter;
    return d;
  }

  function fromCsvFile(file) {
    return ensurePapa().then(() => new Promise((resolve, reject) => {
      Papa.parse(file, {
        skipEmptyLines: 'greedy',
        delimitersToGuess: [',', '\t', ';', '|'],
        worker: file.size > 5 * 1024 * 1024,
        complete: res => {
          if (!res.data.length) { reject(new Error('No rows found in the file.')); return; }
          const d = fromMatrix(res.data, file.name, true);
          d.delimiter = res.meta.delimiter;
          resolve(d);
        },
        error: err => reject(new Error('Could not read the CSV: ' + err.message)),
      });
    }));
  }

  async function readWorkbook(buffer) {
    await ensureXlsx();
    return XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
  }

  function fromSheet(wb, sheetName, name) {
    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
    const d = fromMatrix(matrix, name, true);
    d.sheet = sheetName;
    d.sheets = wb.SheetNames;
    return d;
  }

  async function readFile(file) {
    const ext = extOf(file.name);
    if (EXCEL_EXT.test(file.name)) {
      const wb = await readWorkbook(await file.arrayBuffer());
      const d = fromSheet(wb, wb.SheetNames[0], file.name);
      d.workbook = wb;
      return d;
    }
    if (ext === 'json' || ext === 'ndjson' || ext === 'jsonl') return fromJson(await file.text(), file.name);
    if (ext === 'parquet') throw new Error('Parquet files can be opened in the SQL tool (Query CSV with SQL).');
    return fromCsvFile(file);
  }

  async function readText(text, name = 'pasted data') {
    const t = text.trim();
    if (!t) throw new Error('Paste some CSV or JSON first.');
    if (/^[[{]/.test(t)) return fromJson(t, name);
    return fromCsvText(text, name);
  }

  function toCsv(columns, rows, delimiter = ',') {
    const q = v => (v === null || v === undefined ? '' : /["\r\n]/.test(String(v)) || String(v).includes(delimiter) || /^\s|\s$/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    return [columns.map(q).join(delimiter), ...rows.map(r => r.map(q).join(delimiter))].join('\r\n');
  }

  function typed(v) {
    if (v === '') return null;
    if (v === 'true' || v === 'false') return v === 'true';
    if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }

  function columnKinds(columns, rows) {
    return columns.map((_, i) => {
      let num = true, bool = true, any = false;
      for (const r of rows) {
        const v = r[i] ?? '';
        if (v === '') continue;
        any = true;
        if (num && !/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(v)) num = false;
        if (bool && v !== 'true' && v !== 'false') bool = false;
        if (!num && !bool) break;
      }
      return !any ? 'text' : num ? 'num' : bool ? 'bool' : 'text';
    });
  }

  function typedRows(columns, rows) {
    const kinds = columnKinds(columns, rows);
    return rows.map(r => columns.map((_, i) => {
      const v = r[i] ?? '';
      if (v === '') return null;
      return kinds[i] === 'num' ? Number(v) : kinds[i] === 'bool' ? v === 'true' : v;
    }));
  }

  function toObjects(columns, rows, typedValues = true) {
    const vals = typedValues ? typedRows(columns, rows) : rows.map(r => columns.map((_, i) => r[i] ?? ''));
    return vals.map(r => {
      const o = {};
      columns.forEach((c, i) => { o[c] = r[i]; });
      return o;
    });
  }

  async function toXlsxBlob(sheets) {
    await ensureXlsx();
    const wb = XLSX.utils.book_new();
    for (const { name, columns, rows } of sheets) {
      const data = [columns, ...typedRows(columns, rows).map(r => r.map(v => (v === null ? '' : v)))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = columns.map((c, i) => ({ wch: Math.min(50, Math.max(String(c).length, ...rows.slice(0, 200).map(r => String(r[i] ?? '').length)) + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, String(name || 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const baseName = name => String(name || 'data').replace(/\.[^.]+$/, '') || 'data';

  function wireDrop(zone, onFile) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('over');
      if (e.dataTransfer.files.length) onFile([...e.dataTransfer.files]);
    });
  }

  return { loadScript, ensurePapa, ensureXlsx, readFile, readText, fromJson, fromMatrix, readWorkbook, fromSheet, toCsv, toObjects, toXlsxBlob, typed, typedRows, download, baseName, wireDrop, cellText, extOf, EXCEL_EXT };
})();
