
'use strict';

const TimeTool = (() => {
  const pad = (n, w = 2) => String(n).padStart(w, '0');

  function zoneOffset(ms, zone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const get = t => +parts.find(p => p.type === t).value;
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  }

  function wallToInstant(y, mo, d, h, mi, s, zone) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    const o1 = zoneOffset(guess, zone);
    let t = guess - o1 * 60000;
    const o2 = zoneOffset(t, zone);
    if (o2 !== o1) t = guess - o2 * 60000;
    return t;
  }

  function fmtOffset(min) {
    const sign = min < 0 ? '-' : '+';
    const a = Math.abs(min);
    return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  }

  function isoInZone(ms, zone) {
    const off = zoneOffset(ms, zone);
    const d = new Date(ms + off * 60000);
    const frac = ms % 1000 ? '.' + pad(((ms % 1000) + 1000) % 1000, 3) : '';
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${frac}${off === 0 ? 'Z' : fmtOffset(off)}`;
  }

  function relative(ms, now = Date.now()) {
    const diff = ms - now;
    const abs = Math.abs(diff);
    const units = [['year', 31557600000], ['month', 2629800000], ['week', 604800000], ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]];
    for (const [u, size] of units) {
      if (abs >= size || u === 'second') {
        const n = Math.round(abs / size);
        if (u === 'second' && n < 5) return 'just now';
        return diff < 0 ? `${n} ${u}${n === 1 ? '' : 's'} ago` : `in ${n} ${u}${n === 1 ? '' : 's'}`;
      }
    }
    return '';
  }

  function isoWeek(ms) {
    const d = new Date(ms);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return { year: d.getUTCFullYear(), week: 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7) };
  }

  function parseInput(raw) {
    const s = raw.trim();
    if (!s) return null;
    if (/^now$/i.test(s)) return { ms: Date.now(), unit: 'now' };
    const num = s.replace(/[_,\s]/g, '');
    if (/^-?\d+(\.\d+)?$/.test(num)) {
      const intDigits = num.replace('-', '').split('.')[0].length;
      let unit, ms;
      if (intDigits <= 11) { unit = 'seconds'; ms = Number(num) * 1000; }
      else if (intDigits <= 14) { unit = 'milliseconds'; ms = Number(num); }
      else if (intDigits <= 17) { unit = 'microseconds'; ms = Math.floor(Number(num) / 1000); }
      else { unit = 'nanoseconds'; ms = Number(BigInt(num.split('.')[0]) / 1000000n); }
      if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) throw new Error('That timestamp is outside the range a date can represent.');
      return { ms: Math.round(ms), unit };
    }
    const excel = s.match(/^excel\s+(\d+(?:\.\d+)?)$|^(\d+(?:\.\d+)?)\s+excel$/i);
    if (excel) {
      const v = Number(excel[1] || excel[2]);
      return { ms: Math.round((v - 25569) * 86400000), unit: 'Excel serial date (UTC)' };
    }
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) throw new Error('Not recognised. Enter a Unix timestamp (seconds, ms, µs or ns), an ISO 8601 date such as 2026-09-27T10:30:00Z, or "now".');
    const hasZone = /(Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i.test(s) || /^\w{3}, \d/.test(s);
    return { ms, unit: 'date', note: hasZone || /^\d{4}-\d{2}-\d{2}$/.test(s) ? '' : 'No time zone in the input, so it was read as your local time.' };
  }

  const $ = id => document.getElementById(id);
  const STORE = 'jxe.time';
  const DEFAULT_ZONES = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
  const LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let els, zones = [];

  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function allZones() {
    try { return Intl.supportedValuesOf('timeZone'); } catch (_) { return DEFAULT_ZONES.concat([LOCAL]); }
  }

  function tickNow() {
    const now = Date.now();
    els.nowS.textContent = Math.floor(now / 1000);
    els.nowMs.textContent = now;
    els.nowIso.textContent = new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function row(label, value, copy = true) {
    return `<tr><th>${label}</th><td class="val"><code>${escapeHtml(value)}</code></td><td>${copy ? `<button type="button" class="mini-btn" data-copy="${escapeHtml(value)}">Copy</button>` : ''}</td></tr>`;
  }

  function convert() {
    let r;
    try { r = parseInput(els.input.value); }
    catch (e) {
      els.inputErr.textContent = e.message; els.inputErr.hidden = false; els.result.innerHTML = ''; els.detected.textContent = '';
      return;
    }
    els.inputErr.hidden = true;
    if (!r) { els.result.innerHTML = ''; els.detected.textContent = ''; return; }
    const ms = r.ms;
    const d = new Date(ms);
    const zone = els.zone.value;
    const w = isoWeek(ms);
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    const dayOfYear = Math.floor((ms - start) / 86400000) + 1;
    els.detected.textContent = r.unit === 'date' ? 'Read as a date' + (r.note ? '. ' + r.note : '') : r.unit === 'now' ? 'Current time' : `Read as ${r.unit}`;
    const human = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long', timeZone: zone }).format(d);
    els.result.innerHTML = [
      row('In ' + (zone === LOCAL ? 'your time zone' : zone), human, false),
      row('Relative', relative(ms), false),
      row('Unix seconds', String(Math.floor(ms / 1000))),
      row('Unix milliseconds', String(ms)),
      row('ISO 8601 (UTC)', d.toISOString()),
      row(`ISO 8601 (${zone})`, isoInZone(ms, zone)),
      row('RFC 2822 / HTTP date', d.toUTCString()),
      row('SQL (UTC)', d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')),
      row('Excel serial date (UTC)', String(+(ms / 86400000 + 25569).toFixed(6))),
      row('ISO week', `${w.year}-W${pad(w.week)}`, false),
      row('Day of year', String(dayOfYear), false),
    ].join('');
    save();
  }

  function convertZones() {
    const val = els.tzDate.value;
    if (!val) return;
    const [date, time = '00:00'] = val.split('T');
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi, s = 0] = time.split(':').map(Number);
    const from = els.tzFrom.value;
    const ms = wallToInstant(y, mo, d, h, mi, s, from);
    const fromDay = Date.UTC(y, mo - 1, d);
    const fmt = z => new Intl.DateTimeFormat(undefined, { timeZone: z, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    els.tzRows.innerHTML = zones.map(z => {
      const off = zoneOffset(ms, z);
      const local = new Date(ms + off * 60000);
      const dayDiff = Math.round((Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - fromDay) / 86400000);
      const hour = local.getUTCHours();
      const night = hour < 7 || hour >= 22;
      return `<tr class="${z === from ? 'tz-source' : ''}">
        <th>${escapeHtml(z.replace(/_/g, ' '))}${z === LOCAL ? ' <span class="badge ok">you</span>' : ''}</th>
        <td class="val"><code>${escapeHtml(fmt(z).format(ms))}</code>${dayDiff ? ` <span class="badge warn">${dayDiff > 0 ? '+' : ''}${dayDiff} day</span>` : ''}${night ? ' <span class="muted" title="Outside 07:00–22:00">night</span>' : ''}</td>
        <td class="muted">UTC${fmtOffset(off)}</td>
        <td><button type="button" class="mini-btn" data-remove="${escapeHtml(z)}" aria-label="Remove ${escapeHtml(z)}">×</button></td></tr>`;
    }).join('');
    save();
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ zones, zone: els.zone.value, from: els.tzFrom.value })); } catch (_) {  }
  }

  function setNowInConverter() {
    const now = new Date();
    const off = zoneOffset(now.getTime(), els.tzFrom.value);
    const w = new Date(now.getTime() + off * 60000);
    els.tzDate.value = `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
  }

  function init() {
    els = {
      nowS: $('tsNowS'), nowMs: $('tsNowMs'), nowIso: $('tsNowIso'), input: $('tsInput'), inputErr: $('tsError'), detected: $('tsDetected'),
      result: $('tsResult'), zone: $('tsZone'), tzDate: $('tzDate'), tzFrom: $('tzFrom'), tzRows: $('tzRows'), tzAdd: $('tzAdd'),
    };
    if (!els.input) return;
    const list = allZones();
    const opts = [LOCAL, 'UTC', ...list.filter(z => z !== LOCAL && z !== 'UTC')].map(z => `<option value="${z}">${z.replace(/_/g, ' ')}${z === LOCAL ? ' (your time zone)' : ''}</option>`).join('');
    els.zone.innerHTML = opts;
    els.tzFrom.innerHTML = opts;
    els.tzAdd.innerHTML = '<option value="">+ Add a time zone…</option>' + opts;

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (_) {  }
    zones = saved && Array.isArray(saved.zones) && saved.zones.length ? saved.zones.filter(z => list.includes(z) || z === 'UTC') : [LOCAL, ...DEFAULT_ZONES.filter(z => z !== LOCAL)];
    els.zone.value = (saved && saved.zone) || LOCAL;
    els.tzFrom.value = (saved && saved.from) || LOCAL;

    tickNow();
    setInterval(tickNow, 1000);
    const fromHash = decodeURIComponent(location.hash.slice(1));
    els.input.value = fromHash || String(Math.floor(Date.now() / 1000));
    convert();
    setNowInConverter();
    convertZones();

    els.input.addEventListener('input', convert);
    els.zone.addEventListener('change', convert);
    els.tzDate.addEventListener('input', convertZones);
    els.tzFrom.addEventListener('change', convertZones);
    els.tzAdd.addEventListener('change', () => {
      const z = els.tzAdd.value;
      if (z && !zones.includes(z)) zones.push(z);
      els.tzAdd.value = '';
      convertZones();
    });
    $('tzNow').addEventListener('click', () => { setNowInConverter(); convertZones(); });
    $('tsNowBtn').addEventListener('click', () => { els.input.value = String(Math.floor(Date.now() / 1000)); convert(); });
    document.addEventListener('click', e => {
      const c = e.target.closest('[data-copy]');
      if (c) {
        navigator.clipboard.writeText(c.dataset.copy).then(() => { const t = c.textContent; c.textContent = 'Copied'; setTimeout(() => { c.textContent = t; }, 1200); });
        return;
      }
      const r = e.target.closest('[data-remove]');
      if (r) { zones = zones.filter(z => z !== r.dataset.remove); convertZones(); }
      const n = e.target.closest('[data-copy-now]');
      if (n) navigator.clipboard.writeText($(n.dataset.copyNow).textContent).then(() => { const t = n.textContent; n.textContent = 'Copied'; setTimeout(() => { n.textContent = t; }, 1200); });
    });
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { parseInput, zoneOffset, wallToInstant, isoInZone, isoWeek };
})();
