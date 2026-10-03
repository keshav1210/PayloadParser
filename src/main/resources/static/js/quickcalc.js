'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const val = id => { const t = $(id).value.replace(/[,\s_]/g, ''); return t === '' ? NaN : Number(t); };
  const fmt = (n, d = 4) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '–');
  const out = (id, html) => { $(id).innerHTML = html; };
  const watch = (ids, fn) => { ids.forEach(id => $(id).addEventListener('input', fn)); fn(); };

  const DAY = 86400000;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parseD = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const nice = t => { const d = new Date(t); return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`; };

  function businessDays(a, b) {
    const sign = b >= a ? 1 : -1;
    let lo = Math.min(a, b), hi = Math.max(a, b);
    const total = Math.round((hi - lo) / DAY);
    const weeks = Math.floor(total / 7);
    let n = weeks * 5;
    let d = new Date(lo + weeks * 7 * DAY).getUTCDay();
    for (let i = 0; i < total - weeks * 7; i++) { if (d !== 0 && d !== 6) n++; d = (d + 1) % 7; }
    return sign * n;
  }

  function ymd(a, b) {
    const s = Math.min(a, b), e = Math.max(a, b);
    const sd = new Date(s), ed = new Date(e);
    let months = (ed.getUTCFullYear() - sd.getUTCFullYear()) * 12 + ed.getUTCMonth() - sd.getUTCMonth();
    if (addMonths(s, months) > e) months--;
    const d = Math.round((e - addMonths(s, months)) / DAY);
    return [Math.floor(months / 12), months % 12, d];
  }

  function addMonths(t, n) {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(day, last));
  }

  function isoWeek(t) {
    const d = new Date(t);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((d - first) / DAY - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  }

  function dates() {
    if (!$('dtA')) return;
    const today = iso(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    if (!$('dtA').value) $('dtA').value = today;
    if (!$('dtB').value) $('dtB').value = `${new Date().getFullYear()}-12-31`;
    if (!$('adBase').value) $('adBase').value = today;
    if (!$('xsDate').value) $('xsDate').value = today;
    const plural = (n, w) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
    watch(['dtA', 'dtB', 'dtInc'], () => {
      const a = parseD($('dtA').value), b = parseD($('dtB').value);
      if (isNaN(a) || isNaN(b)) { out('dtOut', ''); return; }
      const inc = $('dtInc').checked ? (b >= a ? 1 : -1) : 0;
      const days = Math.round((b - a) / DAY) + inc;
      const abs = Math.abs(days);
      const [y, m, d] = ymd(a, b + inc * DAY);
      const bd = businessDays(a, b + inc * DAY);
      out('dtOut', `
        <div class="summary ok"><strong>${plural(abs, 'day')}</strong>${days < 0 ? '<span class="muted">(the end date is before the start date)</span>' : ''}</div>
        <table class="change-table kv-table qc-table">
          <tr><th>Years, months, days</th><td>${[y && plural(y, 'year'), m && plural(m, 'month'), plural(d, 'day')].filter(Boolean).join(', ')}</td></tr>
          <tr><th>Weeks and days</th><td>${plural(Math.floor(abs / 7), 'week')}, ${plural(abs % 7, 'day')}</td></tr>
          <tr><th>Business days (Mon–Fri)</th><td>${Math.abs(bd).toLocaleString('en-US')}</td></tr>
          <tr><th>In hours / minutes</th><td>${(abs * 24).toLocaleString('en-US')} hours · ${(abs * 1440).toLocaleString('en-US')} minutes</td></tr>
          <tr><th>In months / years</th><td>${fmt(abs / 30.436875, 2)} months · ${fmt(abs / 365.2425, 3)} years</td></tr>
        </table>`);
    });
    watch(['adBase', 'adOp', 'adN', 'adUnit'], () => {
      const base = parseD($('adBase').value), n = Math.trunc(val('adN')) * ($('adOp').value === 'sub' ? -1 : 1), unit = $('adUnit').value;
      if (isNaN(base) || !Number.isFinite(n) || Math.abs(n) > 200000) { out('adOut', ''); return; }
      let t;
      if (unit === 'days') t = base + n * DAY;
      else if (unit === 'weeks') t = base + n * 7 * DAY;
      else if (unit === 'months') t = addMonths(base, n);
      else if (unit === 'years') t = addMonths(base, n * 12);
      else {
        t = base;
        let left = Math.abs(n);
        const step = n >= 0 ? DAY : -DAY;
        while (left > 0) { t += step; const wd = new Date(t).getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
      }
      out('adOut', `<strong>${nice(t)}</strong> <span class="muted">${iso(t)}</span>`);
    });
    watch(['xsDate', 'xs1904'], () => {
      const t = parseD($('xsDate').value);
      if (isNaN(t)) { out('xsDateOut', ''); return; }
      const epoch = $('xs1904').checked ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
      let serial = Math.round((t - epoch) / DAY);
      if (!$('xs1904').checked && t < Date.UTC(1900, 2, 1)) serial -= 1;
      const d = new Date(t);
      const doy = Math.round((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1;
      out('xsDateOut', `Excel serial number <strong>${serial.toLocaleString('en-US')}</strong> · ${WEEKDAYS[d.getUTCDay()]} · ISO week ${isoWeek(t)} · day ${doy} of the year · Unix time ${(t / 1000).toLocaleString('en-US')}`);
    });
    watch(['xsSerial', 'xs1904'], () => {
      const s = val('xsSerial');
      if (!Number.isFinite(s)) { out('xsSerialOut', ''); return; }
      const n1904 = $('xs1904').checked;
      let days = Math.floor(s);
      if (!n1904 && days === 60) { out('xsSerialOut', '<strong>29 February 1900</strong> <span class="muted">(a date that does not exist; Excel keeps it for compatibility with Lotus 1-2-3)</span>'); return; }
      if (!n1904 && days < 60) days += 1;
      const t = (n1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + days * DAY;
      const frac = s - Math.floor(s);
      const secs = Math.round(frac * 86400);
      const time = frac ? ` ${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}` : '';
      out('xsSerialOut', `<strong>${nice(t)}${time}</strong> <span class="muted">${iso(t)}${time}</span>`);
    });
    document.querySelectorAll('[data-dt-today]').forEach(b => b.addEventListener('click', () => { const el = $(b.dataset.dtToday); el.value = today; el.dispatchEvent(new Event('input')); }));
  }

  dates();
})();
