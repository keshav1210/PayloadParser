'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = DataSource.esc;
  const fmt = n => n.toLocaleString('en-US');

  let current = null;
  let history = [];
  let grid = null;

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function sampleDirty() {
    const lines = [
      'Customer ID,Name,Email,City,Signup Date,Plan,Monthly Fee',
      '1001,  alice JOHNSON ,Alice.Johnson@Example.com,new york,03/14/2024,Pro,"$1,200.00"',
      '1002,Bob Smith,bob@example.com,Chicago,2024-02-01,basic,$49',
      '1003,carla gomez,,San Francisco,1/9/2024,PRO,$99.00',
      '1002,Bob Smith,bob@example.com,Chicago,2024-02-01,basic,$49',
      ',,,,,,',
      '1004,Dev Patel  ,dev.patel@example.com, Austin,"Feb 20, 2024",Basic,49',
      '1005,EMMA BROWN,emma@example.com,,2024/03/02,pro,(25.00)',
      '1006,Farid Haddad,farid@example.com,Boston,12-04-2024,Enterprise,"2,500"',
      '1007,grace lee,GRACE@EXAMPLE.COM,new york,7 Apr 2024,,$99',
      '1004,Dev Patel  ,dev.patel@example.com, Austin,"Feb 20, 2024",Basic,49',
      '1008,Hiro Tanaka,hiro@example.com,Seattle,2024-04-11,Pro,99',
    ];
    return { name: 'customers-messy.csv', text: lines.join('\n') };
  }

  function colChoice(id, { all = false, label = 'Column' } = {}) {
    return `<label class="field-inline">${label} <select id="${id}">${all ? '<option value="*">All columns</option>' : ''}${DataSource.columnOptions(current.columns, all ? '*' : 0)}</select></label>`;
  }

  const OPS = {
    trim: {
      label: 'Trim spaces',
      form: () => `${colChoice('opCol', { all: true })}<label class="check"><input type="checkbox" id="opInner" checked> Collapse double spaces inside text</label>`,
      run(cols, rows) {
        const sel = $('opCol').value, inner = $('opInner').checked;
        let n = 0;
        const out = mapCells(rows, cols, sel, v => {
          let t = v.trim();
          if (inner) t = t.replace(/\s{2,}/g, ' ');
          if (t !== v) n++;
          return t;
        });
        return { rows: out, note: `${fmt(n)} cell${n === 1 ? '' : 's'} trimmed` };
      },
    },
    emptyRows: {
      label: 'Remove empty rows',
      form: () => '<span class="muted">Removes rows where every cell is empty or only spaces.</span>',
      run(cols, rows) {
        const out = rows.filter(r => r.some(v => (v ?? '').trim() !== ''));
        return { rows: out, note: `${fmt(rows.length - out.length)} empty rows removed` };
      },
    },
    dedupe: {
      label: 'Remove duplicate rows',
      form: () => `<label class="field-inline">Compare <select id="opCol"><option value="*">All columns</option>${DataSource.columnOptions(current.columns, '*')}</select></label>
        <label class="check"><input type="checkbox" id="opLoose" checked> Ignore case and extra spaces</label>
        <span class="muted">The first row of each group is kept.</span>`,
      run(cols, rows) {
        const sel = $('opCol').value, loose = $('opLoose').checked;
        const norm = v => (loose ? (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase() : v ?? '');
        const seen = new Set();
        const out = rows.filter(r => {
          const key = sel === '*' ? r.map(norm).join('\u0001') : norm(r[+sel]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return { rows: out, note: `${fmt(rows.length - out.length)} duplicate rows removed` };
      },
    },
    case: {
      label: 'Change case',
      form: () => `${colChoice('opCol', { all: true })}<label class="field-inline">To <select id="opCase"><option value="title">Title Case</option><option value="upper">UPPER CASE</option><option value="lower">lower case</option><option value="sentence">Sentence case</option></select></label>`,
      run(cols, rows) {
        const sel = $('opCol').value, mode = $('opCase').value;
        const f = {
          upper: v => v.toUpperCase(),
          lower: v => v.toLowerCase(),
          title: v => v.toLowerCase().replace(/(^|[\s\-'(/])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
          sentence: v => v.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
        }[mode];
        let n = 0;
        const out = mapCells(rows, cols, sel, v => { const t = f(v); if (t !== v) n++; return t; });
        return { rows: out, note: `${fmt(n)} cells changed` };
      },
    },
    replace: {
      label: 'Find and replace',
      form: () => `${colChoice('opCol', { all: true })}
        <input id="opFind" class="text-input" placeholder="Find" spellcheck="false">
        <input id="opWith" class="text-input" placeholder="Replace with" spellcheck="false">
        <label class="check"><input type="checkbox" id="opWhole"> Whole cell only</label>
        <label class="check"><input type="checkbox" id="opCaseS"> Match case</label>
        <label class="check"><input type="checkbox" id="opRegex"> Regular expression</label>`,
      run(cols, rows) {
        const sel = $('opCol').value, find = $('opFind').value, rep = $('opWith').value;
        const whole = $('opWhole').checked, cs = $('opCaseS').checked, rx = $('opRegex').checked;
        if (!find && !whole) throw new Error('Type what to find. To fill empty cells, use “Fill empty cells”.');
        let src = rx ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (whole) src = `^(?:${src})$`;
        let re;
        try { re = new RegExp(src, cs ? 'gu' : 'giu'); } catch (e) { throw new Error('Invalid regular expression: ' + e.message); }
        let n = 0;
        const out = mapCells(rows, cols, sel, v => {
          re.lastIndex = 0;
          const t = v.replace(re, rx ? rep : () => rep);
          if (t !== v) n++;
          return t;
        });
        return { rows: out, note: `${fmt(n)} cells changed` };
      },
    },
    fill: {
      label: 'Fill empty cells',
      form: () => `${colChoice('opCol', { all: true })}<label class="field-inline">With <select id="opFill"><option value="value">a fixed value</option><option value="down">the value above</option><option value="up">the value below</option></select></label><input id="opValue" class="text-input" placeholder="Value, e.g. Unknown or 0" spellcheck="false">`,
      run(cols, rows) {
        const sel = $('opCol').value, mode = $('opFill').value, value = $('opValue').value;
        const idx = sel === '*' ? cols.map((_, i) => i) : [+sel];
        const out = rows.map(r => r.slice());
        let n = 0;
        for (const c of idx) {
          if (mode === 'value') {
            for (const r of out) if ((r[c] ?? '').trim() === '') { r[c] = value; n++; }
          } else {
            const order = mode === 'down' ? out : out.slice().reverse();
            let last = '';
            for (const r of order) {
              if ((r[c] ?? '').trim() === '') { if (last !== '') { r[c] = last; n++; } }
              else last = r[c];
            }
          }
        }
        return { rows: out, note: `${fmt(n)} empty cells filled` };
      },
    },
    filterRows: {
      label: 'Remove rows where…',
      form: () => `${colChoice('opCol')}<select id="opCond" class="mini-select" style="font-size:14px;padding:7px 10px"><option value="empty">is empty</option><option value="eq">equals</option><option value="contains">contains</option><option value="notcontains">does not contain</option><option value="gt">is greater than</option><option value="lt">is less than</option></select><input id="opValue" class="text-input" placeholder="Value" spellcheck="false">`,
      run(cols, rows) {
        const c = +$('opCol').value, cond = $('opCond').value, val = $('opValue').value;
        const lv = val.toLowerCase(), nv = Number(val);
        if ((cond === 'gt' || cond === 'lt') && (val.trim() === '' || isNaN(nv))) throw new Error('Enter a number to compare with.');
        const drop = r => {
          const v = (r[c] ?? '').trim();
          switch (cond) {
            case 'empty': return v === '';
            case 'eq': return v.toLowerCase() === lv.trim();
            case 'contains': return v.toLowerCase().includes(lv);
            case 'notcontains': return !v.toLowerCase().includes(lv);
            case 'gt': return v !== '' && !isNaN(+v) && +v > nv;
            case 'lt': return v !== '' && !isNaN(+v) && +v < nv;
          }
          return false;
        };
        const out = rows.filter(r => !drop(r));
        return { rows: out, note: `${fmt(rows.length - out.length)} rows removed` };
      },
    },
    dates: {
      label: 'Standardise dates',
      form: () => `${colChoice('opCol')}<label class="field-inline">Input order <select id="opIn"><option value="auto">Detect</option><option value="dmy">Day/Month/Year</option><option value="mdy">Month/Day/Year</option></select></label><label class="field-inline">Output <select id="opOut"><option value="iso">2026-03-14</option><option value="dmy">14/03/2026</option><option value="mdy">03/14/2026</option><option value="long">14 Mar 2026</option></select></label><label class="check"><input type="checkbox" id="opSerial"> Convert Excel serial numbers</label>`,
      run(cols, rows) {
        const c = +$('opCol').value, outFmt = $('opOut').value, serial = $('opSerial').checked;
        let order = $('opIn').value;
        let detected = '';
        if (order === 'auto') {
          order = detectOrder(rows.map(r => r[c] ?? ''));
          detected = order === 'dmy' ? ' (read as day/month/year)' : ' (read as month/day/year)';
        }
        let n = 0, bad = 0;
        const out = rows.map(r => {
          const v = (r[c] ?? '').trim();
          if (!v) return r;
          const d = parseDate(v, order, serial);
          if (!d) { bad++; return r; }
          const t = formatDate(d, outFmt);
          if (t === r[c]) return r;
          n++;
          const nr = r.slice(); nr[c] = t; return nr;
        });
        return { rows: out, note: `${fmt(n)} dates reformatted${detected}${bad ? `, ${fmt(bad)} values not recognised as dates` : ''}` };
      },
    },
    numbers: {
      label: 'Clean numbers',
      form: () => `${colChoice('opCol')}<label class="check"><input type="checkbox" id="opComma"> Decimal comma (1.234,56)</label><span class="muted">Removes currency symbols, thousands separators, spaces and %, and turns (25.00) into -25.00.</span>`,
      run(cols, rows) {
        const c = +$('opCol').value, comma = $('opComma').checked;
        let n = 0, bad = 0;
        const out = rows.map(r => {
          const v = (r[c] ?? '').trim();
          if (!v) return r;
          const t = cleanNumber(v, comma);
          if (t === null) { bad++; return r; }
          if (t === r[c]) return r;
          n++;
          const nr = r.slice(); nr[c] = t; return nr;
        });
        return { rows: out, note: `${fmt(n)} numbers cleaned${bad ? `, ${fmt(bad)} values left as they are (not numbers)` : ''}` };
      },
    },
    split: {
      label: 'Split column',
      form: () => `${colChoice('opCol')}<input id="opDelim" class="text-input" placeholder="Split on, e.g. space , - or @" value=" " spellcheck="false" style="width:170px"><label class="field-inline">Into <select id="opParts"><option value="2">2 columns</option><option value="3">3 columns</option><option value="0">as many as needed</option></select></label><label class="check"><input type="checkbox" id="opKeep"> Keep original column</label>`,
      run(cols, rows) {
        const c = +$('opCol').value, delim = $('opDelim').value, parts = +$('opParts').value, keep = $('opKeep').checked;
        if (!delim) throw new Error('Enter the text to split on.');
        const pieces = rows.map(r => {
          const v = (delim.trim() === '' ? (r[c] ?? '').trim() : r[c] ?? '');
          const all = v === '' ? [] : delim.trim() === '' ? v.split(/\s+/) : v.split(delim);
          if (parts && all.length > parts) return [...all.slice(0, parts - 1), all.slice(parts - 1).join(delim.trim() === '' ? ' ' : delim)];
          return all;
        });
        const width = parts || Math.min(50, Math.max(1, ...pieces.map(p => p.length)));
        const names = Array.from({ length: width }, (_, i) => `${cols[c]}_${i + 1}`);
        const newCols = [...cols.slice(0, keep ? c + 1 : c), ...names, ...cols.slice(c + 1)];
        const out = rows.map((r, i) => {
          const p = Array.from({ length: width }, (_, k) => (pieces[i][k] ?? '').trim());
          return [...r.slice(0, keep ? c + 1 : c), ...p, ...r.slice(c + 1)];
        });
        return { columns: uniq(newCols), rows: out, note: `“${cols[c]}” split into ${width} columns` };
      },
    },
    merge: {
      label: 'Merge columns',
      form: () => `${colChoice('opCol', { label: 'Join' })}${colChoice('opCol2', { label: 'and' })}<input id="opSep" class="text-input" placeholder="Separator" value=" " spellcheck="false" style="width:110px"><input id="opName" class="text-input" placeholder="New column name" spellcheck="false" style="width:180px"><label class="check"><input type="checkbox" id="opKeep"> Keep original columns</label>`,
      after: () => { const s = $('opCol2'); if (s.options.length > 1) s.selectedIndex = 1; },
      run(cols, rows) {
        const a = +$('opCol').value, b = +$('opCol2').value, sep = $('opSep').value, keep = $('opKeep').checked;
        if (a === b) throw new Error('Pick two different columns.');
        const name = $('opName').value.trim() || `${cols[a]}_${cols[b]}`;
        const at = Math.min(a, b);
        const joined = rows.map(r => [r[a] ?? '', r[b] ?? ''].map(s => s.trim()).filter(Boolean).join(sep));
        const keepIdx = cols.map((_, i) => i).filter(i => keep || (i !== a && i !== b));
        const pos = keep ? Math.max(a, b) + 1 : keepIdx.filter(i => i < at).length;
        const newCols = keepIdx.map(i => cols[i]);
        newCols.splice(pos, 0, name);
        const out = rows.map((r, k) => { const nr = keepIdx.map(i => r[i] ?? ''); nr.splice(pos, 0, joined[k]); return nr; });
        return { columns: uniq(newCols), rows: out, note: `“${cols[a]}” and “${cols[b]}” merged into “${name}”` };
      },
    },
    dropCols: {
      label: 'Delete column',
      form: () => `<div class="cl-cols">${current.columns.map((c, i) => `<label class="check"><input type="checkbox" value="${i}" class="opDrop"> ${esc(c)}</label>`).join('')}</div>`,
      run(cols, rows) {
        const drop = new Set([...document.querySelectorAll('.opDrop:checked')].map(x => +x.value));
        if (!drop.size) throw new Error('Tick the columns to delete.');
        if (drop.size === cols.length) throw new Error('At least one column has to stay.');
        const keep = cols.map((_, i) => i).filter(i => !drop.has(i));
        return { columns: keep.map(i => cols[i]), rows: rows.map(r => keep.map(i => r[i] ?? '')), note: `${drop.size} column${drop.size === 1 ? '' : 's'} deleted` };
      },
    },
    rename: {
      label: 'Rename column',
      form: () => `${colChoice('opCol')}<input id="opName" class="text-input" placeholder="New name" spellcheck="false"><button type="button" class="mini-btn" id="opSnake" title="Rename every column to snake_case">All headers to snake_case</button>`,
      after: () => $('opSnake').addEventListener('click', () => apply('snake')),
      run(cols, rows, variant) {
        if (variant === 'snake') {
          const nc = uniq(cols.map(c => c.trim().replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'column'));
          return { columns: nc, rows, note: 'Headers renamed to snake_case' };
        }
        const c = +$('opCol').value, name = $('opName').value.trim();
        if (!name) throw new Error('Type the new column name.');
        const nc = cols.slice(); nc[c] = name;
        return { columns: uniq(nc), rows, note: `“${cols[c]}” renamed to “${name}”` };
      },
    },
  };

  function uniq(names) {
    const used = new Set();
    return names.map(n => { let x = n, k = 2; while (used.has(x)) x = `${n}_${k++}`; used.add(x); return x; });
  }

  function mapCells(rows, cols, sel, f) {
    const idx = sel === '*' ? cols.map((_, i) => i) : [+sel];
    return rows.map(r => {
      let nr = null;
      for (const c of idx) {
        const v = r[c] ?? '';
        if (v === '') continue;
        const t = f(v);
        if (t !== v) { if (!nr) nr = r.slice(); nr[c] = t; }
      }
      return nr || r;
    });
  }

  function detectOrder(values) {
    let dmy = 0, mdy = 0;
    for (const v of values) {
      const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/.exec(v.trim());
      if (!m) continue;
      if (+m[1] > 12) dmy++;
      else if (+m[2] > 12) mdy++;
    }
    return dmy > mdy ? 'dmy' : 'mdy';
  }

  function fullYear(y) {
    y = +y;
    if (y < 100) y += y < 50 ? 2000 : 1900;
    return y;
  }

  function valid(y, m, d) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? { y, m, d } : null;
  }

  function monthOf(name) {
    const i = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
    return i < 0 ? 0 : i + 1;
  }

  function parseDate(v, order, serial) {
    let m;
    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(v))) return valid(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T ,].*)?$/.exec(v))) {
      return order === 'dmy' ? valid(fullYear(m[3]), +m[2], +m[1]) : valid(fullYear(m[3]), +m[1], +m[2]);
    }
    if ((m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?,?[\s\-]+(\d{2,4})$/.exec(v)) && monthOf(m[2])) return valid(fullYear(m[3]), monthOf(m[2]), +m[1]);
    if ((m = /^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(v)) && monthOf(m[1])) return valid(+m[3], monthOf(m[1]), +m[2]);
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)) && +m[2] <= 12) return valid(+m[1], +m[2], +m[3]);
    if (serial && /^\d{1,6}(\.\d+)?$/.test(v)) {
      const n = Math.floor(+v);
      if (n >= 1 && n < 2958466) {
        const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      }
    }
    return null;
  }

  function formatDate({ y, m, d }, f) {
    const p = n => String(n).padStart(2, '0');
    if (f === 'dmy') return `${p(d)}/${p(m)}/${y}`;
    if (f === 'mdy') return `${p(m)}/${p(d)}/${y}`;
    if (f === 'long') return `${d} ${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
    return `${y}-${p(m)}-${p(d)}`;
  }

  function cleanNumber(v, decimalComma) {
    let s = v.trim();
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[\s '’]/g, '').replace(/^[^\d\-+.,]+|[^\d.,]+$/g, '');
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    else if (s.startsWith('+')) s = s.slice(1);
    s = s.replace(/^[^\d.,]+/, '');
    if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    s = s.replace(/^0+(?=\d)/, '');
    if (s.startsWith('.')) s = '0' + s;
    if (s.endsWith('.')) s = s.slice(0, -1);
    return (neg && +s !== 0 ? '-' : '') + s;
  }

  function scan(d) {
    const issues = [];
    let padded = 0, emptyRows = 0;
    const seen = new Set();
    let dups = 0;
    for (const r of d.rows) {
      let any = false;
      for (const v of r) {
        if (v && v !== v.trim()) padded++;
        if ((v ?? '').trim() !== '') any = true;
      }
      if (!any) { emptyRows++; continue; }
      const k = r.join('\u0001');
      if (seen.has(k)) dups++; else seen.add(k);
    }
    if (padded) issues.push(['trim', `${fmt(padded)} cells have extra spaces`]);
    if (emptyRows) issues.push(['emptyRows', `${fmt(emptyRows)} empty rows`]);
    if (dups) issues.push(['dedupe', `${fmt(dups)} duplicate rows`]);
    const emptyCols = d.columns.filter((_, i) => d.rows.every(r => (r[i] ?? '').trim() === ''));
    if (emptyCols.length && d.rows.length) issues.push(['dropCols', `${emptyCols.length} empty column${emptyCols.length === 1 ? '' : 's'}`]);
    return issues;
  }

  function render() {
    $('clMeta').textContent = `${fmt(current.rows.length)} rows × ${current.columns.length} columns`;
    grid.setData(current.columns, current.rows);
    grid.setFilter($('clFilter').value);
    const issues = scan(current);
    $('clIssues').innerHTML = issues.length
      ? `<span class="muted">Found:</span> ${issues.map(([op, text]) => `<button type="button" class="chip" data-fix="${op}">${esc(text)} → fix</button>`).join('')}`
      : '<span class="badge ok">No empty rows, duplicates or stray spaces</span>';
    $('clSteps').innerHTML = history.length
      ? history.map((h, i) => `<li><span class="cl-step-n">${i + 1}</span>${esc(h.note)}</li>`).join('')
      : '<li class="muted">No changes yet. Pick a fix above or an operation below.</li>';
    $('clUndo').disabled = !history.length;
    $('clReset').disabled = !history.length;
    showForm();
  }

  function showForm() {
    const op = OPS[$('clOp').value];
    $('clForm').innerHTML = op.form();
    if (op.after) op.after();
    $('clError').hidden = true;
  }

  function apply(variant) {
    const key = $('clOp').value;
    const op = OPS[key];
    $('clError').hidden = true;
    let res;
    try { res = op.run(current.columns, current.rows, variant); }
    catch (e) { $('clError').textContent = e.message; $('clError').hidden = false; return; }
    history.push({ columns: current.columns, rows: current.rows, note: res.note });
    current = { ...current, columns: res.columns || current.columns, rows: res.rows };
    render();
    $('clOp').value = key;
    showForm();
  }

  function quickFix(op) {
    $('clOp').value = op;
    showForm();
    if (op === 'dropCols') {
      current.columns.forEach((_, i) => {
        if (current.rows.every(r => (r[i] ?? '').trim() === '')) document.querySelector(`.opDrop[value="${i}"]`).checked = true;
      });
    }
    apply();
  }

  function init() {
    grid = new DataGrid($('clGrid'), { onChange: ({ total, shown }) => { $('clInfo').textContent = shown === total ? '' : `${fmt(shown)} of ${fmt(total)} rows match`; } });
    $('clOp').innerHTML = Object.entries(OPS).map(([k, o]) => `<option value="${k}">${o.label}</option>`).join('');
    DataSource.mount($('clSource'), {
      title: 'Your data',
      sample: sampleDirty,
      sampleLabel: 'Try a messy sample',
      onLoad: d => {
        current = { name: d.name, columns: d.columns.slice(), rows: d.rows };
        history = [];
        $('clWork').hidden = false;
        render();
      },
    });
    $('clOp').addEventListener('change', showForm);
    $('clApply').addEventListener('click', () => apply());
    $('clIssues').addEventListener('click', e => { const b = e.target.closest('[data-fix]'); if (b) quickFix(b.dataset.fix); });
    $('clFilter').addEventListener('input', () => grid.setFilter($('clFilter').value));
    $('clUndo').addEventListener('click', () => {
      const h = history.pop();
      if (!h) return;
      current = { ...current, columns: h.columns, rows: h.rows };
      render();
    });
    $('clReset').addEventListener('click', () => {
      if (!history.length) return;
      const h = history[0];
      history = [];
      current = { ...current, columns: h.columns, rows: h.rows };
      render();
    });
    document.querySelectorAll('[data-cl-export]').forEach(b => b.addEventListener('click', async () => {
      const kind = b.dataset.clExport, base = DataLoad.baseName(current.name) + '-clean';
      if (kind === 'csv') DataLoad.download(base + '.csv', '﻿' + DataLoad.toCsv(current.columns, current.rows), 'text/csv;charset=utf-8');
      else if (kind === 'json') DataLoad.download(base + '.json', JSON.stringify(DataLoad.toObjects(current.columns, current.rows), null, 2), 'application/json');
      else DataLoad.download(base + '.xlsx', await DataLoad.toXlsxBlob([{ name: 'Clean data', columns: current.columns, rows: current.rows }]));
    }));
  }

  init();
})();
