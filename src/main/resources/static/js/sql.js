/* ============================================================
   sql.js - SQL formatter / minifier. Formatting is done by the
   sql-formatter library (MIT, js/vendor/sql-formatter.min.js).
   ============================================================ */

'use strict';

const SqlTool = (() => {
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.sql';

  const SAMPLE = `-- Monthly revenue per customer, last 12 months
with recent_orders as (select o.customer_id, date_trunc('month', o.created_at) as month, sum(oi.quantity * oi.unit_price) as revenue from orders o join order_items oi on oi.order_id = o.id where o.status in ('paid', 'shipped') and o.created_at >= now() - interval '12 months' group by 1, 2)
select c.id, c.name, r.month, r.revenue, case when r.revenue > 1000 then 'gold' when r.revenue > 250 then 'silver' else 'standard' end as tier from customers c left join recent_orders r on r.customer_id = c.id where c.deleted_at is null and (c.country = 'IN' or c.country = 'US') order by r.month desc, r.revenue desc limit 100;
update customers set tier = 'gold', updated_at = now() where id in (select customer_id from recent_orders where revenue > 1000);`;

  // ── Minify (keeps strings and quoted names intact, drops comments) ─────────
  function minify(sql) {
    let out = '', i = 0, pendingSpace = false;
    const n = sql.length;
    const word = c => /[\w$@#]/.test(c || '');
    const emit = s => {
      if (pendingSpace && out && (word(out[out.length - 1]) || /['"`\]]/.test(out[out.length - 1]) || out.endsWith('*/')) && (word(s[0]) || /['"`[]/.test(s[0]))) out += ' ';
      else if (pendingSpace && out && /[-+*/<>=!|&%^~]$/.test(out) && /^[-+*/<>=!|&%^~]/.test(s)) out += ' ';
      pendingSpace = false;
      out += s;
    };
    while (i < n) {
      const c = sql[i], d = sql[i + 1];
      if (/\s/.test(c)) { pendingSpace = true; i++; continue; }
      if (c === '-' && d === '-') { while (i < n && sql[i] !== '\n') i++; pendingSpace = true; continue; }
      if (c === '#' && /^#\s/.test(sql.slice(i, i + 2)) && !word(out[out.length - 1])) { while (i < n && sql[i] !== '\n') i++; pendingSpace = true; continue; }
      if (c === '/' && d === '*') {
        const end = sql.indexOf('*/', i + 2);
        const body = sql.slice(i, end < 0 ? n : end + 2);
        if (body.startsWith('/*!') || body.startsWith('/*+')) out += (out ? ' ' : '') + body;   // MySQL / optimizer hints
        i = end < 0 ? n : end + 2;
        pendingSpace = true;
        continue;
      }
      if (c === "'" || c === '"' || c === '`' || c === '[') {
        const close = c === '[' ? ']' : c;
        let j = i + 1;
        while (j < n) {
          if (sql[j] === '\\' && c === "'") { j += 2; continue; }
          if (sql[j] === close) { if (sql[j + 1] === close && close !== ']') { j += 2; continue; } break; }
          j++;
        }
        emit(sql.slice(i, j + 1));
        i = j + 1;
        continue;
      }
      if (c === '$') {
        const tag = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
        if (tag) {
          const end = sql.indexOf(tag[0], i + tag[0].length);
          const stop = end < 0 ? n : end + tag[0].length;
          emit(sql.slice(i, stop));
          i = stop;
          continue;
        }
      }
      let j = i + 1;
      if (word(c)) while (j < n && word(sql[j])) j++;
      emit(sql.slice(i, j));
      i = j;
    }
    return out.trim();
  }

  // ── Highlighting ───────────────────────────────────────────────────────────
  const KEYWORDS = new Set(('select from where and or not in is null like ilike between exists as on join inner left right full outer cross natural using ' +
    'group by order having limit offset fetch first next rows only union all intersect except distinct insert into values update set delete ' +
    'create table view index unique primary key foreign references alter add drop column constraint default check if replace truncate ' +
    'with recursive case when then else end asc desc nulls last returning over partition window lateral cascade restrict begin commit ' +
    'rollback transaction grant revoke to procedure function returns language declare cursor for loop while do return trigger before after ' +
    'each row execute merge matched top interval true false current_date current_timestamp temporary temp materialized conflict nothing ' +
    'auto_increment identity serial database schema use show describe explain analyze vacuum').split(' '));

  const escapeHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function highlight(sql) {
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.|'')*'|"(?:[^"]|"")*"|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w$]*)(?=\s*\()|([A-Za-z_][\w$]*)|([\s\S])/g;
    let html = '', m;
    while ((m = re.exec(sql))) {
      if (m[1]) html += `<span class="c">${escapeHtml(m[1])}</span>`;
      else if (m[2]) html += `<span class="${m[2][0] === "'" ? 's' : 'q'}">${escapeHtml(m[2])}</span>`;
      else if (m[3]) html += `<span class="n">${m[3]}</span>`;
      else if (m[4]) html += KEYWORDS.has(m[4].toLowerCase()) ? `<span class="k">${m[4]}</span>` : `<span class="f">${m[4]}</span>`;
      else if (m[5]) html += KEYWORDS.has(m[5].toLowerCase()) ? `<span class="k">${m[5]}</span>` : m[5];
      else html += escapeHtml(m[6]);
    }
    return html;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  let els, mode = 'format', timer = null, output = '';

  function options() {
    const indent = els.indent.value;
    return {
      language: els.dialect.value,
      tabWidth: indent === 'tab' ? 4 : +indent,
      useTabs: indent === 'tab',
      keywordCase: els.kwCase.value,
      dataTypeCase: els.kwCase.value,
      functionCase: els.kwCase.value === 'preserve' ? 'preserve' : els.kwCase.value,
      indentStyle: els.style.value,
      logicalOperatorNewline: els.logical.value,
      linesBetweenQueries: 1,
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        sql: els.input.value, dialect: els.dialect.value, indent: els.indent.value, kwCase: els.kwCase.value,
        style: els.style.value, logical: els.logical.value,
      }));
    } catch (_) { /* ignore */ }
  }

  function restore() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (_) { /* ignore */ }
    if (!s) { els.input.value = SAMPLE; return; }
    els.input.value = s.sql || '';
    ['dialect', 'indent', 'kwCase', 'style', 'logical'].forEach(k => { if (s[k]) els[k].value = s[k]; });
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function run() {
    save();
    const sql = els.input.value;
    showError('');
    if (!sql.trim()) { output = ''; els.output.innerHTML = ''; els.stats.textContent = ''; return; }
    try {
      output = mode === 'minify' ? minify(sql) : sqlFormatter.format(sql, options());
    } catch (e) {
      const msg = String(e.message || e).split('\n').filter(Boolean)[0].replace(/^Parse error:\s*/, '').replace(/«EOF»/g, 'the end of the query');
      showError(`Couldn't format this as ${els.dialect.selectedOptions[0].textContent}:\n${msg}\n\nCheck the dialect, or look for a missing quote or bracket near that spot.`);
      return;
    }
    els.output.innerHTML = highlight(output) + '\n';
    const lines = output.split('\n').length;
    els.stats.textContent = `${lines} line${lines === 1 ? '' : 's'} · ${output.length.toLocaleString()} characters`;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 200);
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('[data-sql-mode]').forEach(b => b.classList.toggle('btn-primary', b.dataset.sqlMode === m));
    els.formatOpts.classList.toggle('dim', m === 'minify');
    run();
  }

  function flash(btn, text) {
    const t = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = t; }, 1300);
  }

  function init() {
    els = {
      input: $('sqlInput'), output: $('sqlOutput'), error: $('sqlError'), stats: $('sqlStats'),
      dialect: $('sqlDialect'), indent: $('sqlIndent'), kwCase: $('sqlCase'), style: $('sqlStyle'), logical: $('sqlLogical'),
      formatOpts: $('sqlOptions'),
    };
    if (!els.input) return;
    restore();

    els.input.addEventListener('input', schedule);
    ['dialect', 'indent', 'kwCase', 'style', 'logical'].forEach(k => els[k].addEventListener('change', run));
    document.querySelectorAll('[data-sql-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.sqlMode)));
    $('sqlSample').addEventListener('click', () => { els.input.value = SAMPLE; run(); });
    $('sqlClear').addEventListener('click', () => { els.input.value = ''; run(); els.input.focus(); });
    $('sqlCopy').addEventListener('click', e => { if (output) navigator.clipboard.writeText(output).then(() => flash(e.target, 'Copied')); });
    $('sqlUse').addEventListener('click', () => { if (output) { els.input.value = output; run(); } });
    $('sqlDownload').addEventListener('click', () => {
      if (!output) return;
      const url = URL.createObjectURL(new Blob([output + '\n'], { type: 'application/sql' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'query.sql' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('sqlFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then(t => { els.input.value = t; run(); });
      e.target.value = '';
    });
    els.input.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    setMode('format');
  }

  document.addEventListener('DOMContentLoaded', init);
  return { minify, highlight };
})();
