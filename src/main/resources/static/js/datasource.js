'use strict';

const DataSource = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function mount(host, { title = 'Data', sample = null, sampleLabel = 'Try sample data', onLoad, compact = false } = {}) {
    host.classList.add('ds');
    host.innerHTML = `
      <div class="ds-empty">
        <label class="data-drop${compact ? ' ds-compact' : ''}" tabindex="0">
          <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.ods,.json,.ndjson,.jsonl" hidden>
          <span class="data-drop-icon" aria-hidden="true">⬆</span>
          <strong>${esc(title)}: drop a file or click to open</strong>
          <small>CSV, Excel or JSON · read in your browser, never uploaded</small>
        </label>
        <details class="ds-paste">
          <summary>…or paste CSV / JSON${sample ? ` · <button type="button" class="linkish ds-sample">${esc(sampleLabel)}</button>` : ''}</summary>
          <textarea class="code-input" spellcheck="false" aria-label="Paste CSV or JSON for ${esc(title)}"></textarea>
          <button type="button" class="btn ds-paste-btn">Load pasted data</button>
        </details>
      </div>
      <div class="ds-loaded" hidden>
        <div><strong class="ds-name"></strong><span class="ds-meta muted"></span></div>
        <label class="field-inline ds-sheet-wrap" hidden>Sheet <select class="ds-sheet"></select></label>
        <button type="button" class="mini-btn ds-change">Change</button>
      </div>
      <p class="ds-status muted" hidden></p>
      <div class="error-box ds-error" hidden></div>`;
    const q = s => host.querySelector(s);
    const state = { data: null };

    const err = msg => { q('.ds-error').textContent = msg; q('.ds-error').hidden = !msg; };
    const busy = msg => { q('.ds-status').textContent = msg || ''; q('.ds-status').hidden = !msg; };

    function set(d) {
      state.data = d;
      q('.ds-empty').hidden = true;
      q('.ds-loaded').hidden = false;
      q('.ds-name').textContent = d.name;
      q('.ds-meta').textContent = ` · ${d.rows.length.toLocaleString('en-US')} rows × ${d.columns.length} columns`;
      const multi = d.sheets && d.sheets.length > 1;
      q('.ds-sheet-wrap').hidden = !multi;
      if (multi) q('.ds-sheet').innerHTML = d.sheets.map(s => `<option${s === d.sheet ? ' selected' : ''}>${esc(s)}</option>`).join('');
      err('');
      if (onLoad) onLoad(d);
    }

    async function fromFiles(files) {
      const f = files && files[0];
      if (!f) return;
      err('');
      busy(`Reading ${f.name}…`);
      try { set(await DataLoad.readFile(f)); }
      catch (e) { err(e.message); }
      finally { busy(''); }
    }

    const drop = q('.data-drop');
    q('input[type=file]').addEventListener('change', e => { fromFiles([...e.target.files]); e.target.value = ''; });
    DataLoad.wireDrop(drop, fromFiles);
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('input[type=file]').click(); } });
    q('.ds-paste-btn').addEventListener('click', async () => {
      err('');
      try { set(await DataLoad.readText(q('.ds-paste textarea').value, 'pasted data')); }
      catch (e) { err(e.message); }
    });
    if (sample) {
      q('.ds-sample').addEventListener('click', async e => {
        e.preventDefault();
        err('');
        const s = typeof sample === 'function' ? sample() : sample;
        try { set(await DataLoad.readText(s.text, s.name)); } catch (ex) { err(ex.message); }
      });
    }
    q('.ds-change').addEventListener('click', () => {
      q('.ds-empty').hidden = false;
      q('.ds-loaded').hidden = true;
    });
    q('.ds-sheet').addEventListener('change', () => {
      const d = state.data;
      if (!d || !d.workbook) return;
      const n = DataLoad.fromSheet(d.workbook, q('.ds-sheet').value, d.name);
      n.workbook = d.workbook;
      set(n);
    });

    return {
      get data() { return state.data; },
      set,
      error: err,
    };
  }

  function columnOptions(columns, selected, { blank = null } = {}) {
    return (blank !== null ? `<option value="">${esc(blank)}</option>` : '') +
      columns.map((c, i) => `<option value="${i}"${String(i) === String(selected) ? ' selected' : ''}>${esc(c)}</option>`).join('');
  }

  function sampleSales(n = 600, seedStart = 7) {
    const regions = ['North', 'South', 'East', 'West'];
    const products = [['Laptop', 899], ['Monitor', 229], ['Keyboard', 59], ['Mouse', 25], ['Headset', 79], ['Dock', 189]];
    const reps = ['Asha Rao', 'Ben Carter', 'Chen Wei', 'Diego Lopez', 'Fatima Khan', 'Grace Kim'];
    let seed = seedStart;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows = ['order_id,order_date,region,sales_rep,product,quantity,unit_price,amount,status'];
    for (let i = 1; i <= n; i++) {
      const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(rnd() * 540) * 86400000).toISOString().slice(0, 10);
      const [p, price] = products[Math.floor(rnd() * products.length)];
      const q = 1 + Math.floor(rnd() * 8);
      rows.push(`${10000 + i},${d},${regions[Math.floor(rnd() * 4)]},${reps[Math.floor(rnd() * reps.length)]},${p},${q},${price},${q * price},${rnd() < 0.08 ? 'returned' : 'shipped'}`);
    }
    return { name: 'sample-sales.csv', text: rows.join('\n') };
  }

  return { mount, columnOptions, sampleSales, esc };
})();
