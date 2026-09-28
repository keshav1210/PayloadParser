
'use strict';

const BaseTool = (() => {
  const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

  function parseIn(text, base) {
    let s = text.trim().toLowerCase().replace(/[\s_,']/g, '');
    if (!s) return null;
    let neg = false;
    if (s[0] === '-' || s[0] === '+') { neg = s[0] === '-'; s = s.slice(1); }
    const pre = { 16: '0x', 2: '0b', 8: '0o' }[base];
    if (pre && s.startsWith(pre)) s = s.slice(2);
    if (base === 16 && s.startsWith('#')) s = s.slice(1);
    if (!s) throw new Error('Enter some digits.');
    let n = 0n;
    const B = BigInt(base);
    for (const ch of s) {
      const d = DIGITS.indexOf(ch);
      if (d < 0 || d >= base) throw new Error(`“${ch}” is not a valid digit in base ${base}${base <= 10 ? ` (use 0-${base - 1})` : ` (use 0-9 and a-${DIGITS[base - 1]})`}.`);
      n = n * B + BigInt(d);
    }
    return neg ? -n : n;
  }

  function toBase(n, base) {
    if (n === 0n) return '0';
    const neg = n < 0n;
    let x = neg ? -n : n, out = '';
    const B = BigInt(base);
    while (x > 0n) { out = DIGITS[Number(x % B)] + out; x /= B; }
    return (neg ? '-' : '') + out;
  }

  const group = (s, size, sep = ' ') => {
    const neg = s.startsWith('-');
    const body = neg ? s.slice(1) : s;
    const padLen = Math.ceil(body.length / size) * size;
    const padded = body.padStart(padLen, '0');
    return (neg ? '-' : '') + padded.match(new RegExp(`.{${size}}`, 'g')).join(sep);
  };

  function twos(n, bits) {
    const W = BigInt(bits);
    const min = -(1n << (W - 1n)), maxU = (1n << W) - 1n;
    if (n < min || n > maxU) return null;
    const u = n < 0n ? (1n << W) + n : n;
    const signed = u >= (1n << (W - 1n)) ? u - (1n << W) : u;
    return { unsigned: u, signed, bin: u.toString(2).padStart(bits, '0'), hex: u.toString(16).padStart(bits / 4, '0').toUpperCase() };
  }

  const $ = id => document.getElementById(id);
  let els, value = null, lock = false;
  const FIELDS = [['bin', 2], ['oct', 8], ['dec', 10], ['hex', 16]];

  function setAll(source) {
    lock = true;
    for (const [id, base] of FIELDS) {
      if (id === source) continue;
      els[id].value = value === null ? '' : base === 16 ? toBase(value, 16).toUpperCase() : toBase(value, base);
    }
    if (source !== 'custom') els.custom.value = value === null ? '' : toBase(value, +els.customBase.value);
    lock = false;
    renderExtra();
    try { localStorage.setItem('jxe.base', value === null ? '' : value.toString()); } catch (_) {  }
  }

  function onInput(id, base) {
    if (lock) return;
    const input = els[id];
    try {
      value = parseIn(input.value, base);
      input.classList.remove('invalid');
      els.error.hidden = true;
      setAll(id);
    } catch (e) {
      input.classList.add('invalid');
      els.error.textContent = e.message;
      els.error.hidden = false;
    }
  }

  function renderExtra() {
    if (value === null) { els.extra.innerHTML = ''; els.bits.textContent = ''; return; }
    const abs = value < 0n ? -value : value;
    els.bits.textContent = `${abs.toString(2).length} bit${abs.toString(2).length === 1 ? '' : 's'}${value < 0n ? ' (magnitude)' : ''} · ${abs.toString(10).length} decimal digit${abs.toString(10).length === 1 ? '' : 's'}`;
    const rows = [];
    rows.push(['Binary, grouped', group(toBase(value, 2), 4)]);
    rows.push(['Hex, grouped', group(toBase(value, 16).toUpperCase(), 2)]);
    rows.push(['Decimal, with separators', value.toLocaleString('en-US')]);
    if (abs <= 0x10ffffn && value >= 0n && value >= 32n) {
      try { rows.push(['Unicode character', `${String.fromCodePoint(Number(value))}  (U+${toBase(value, 16).toUpperCase().padStart(4, '0')})`]); } catch (_) {  }
    }
    for (const bits of [8, 16, 32, 64]) {
      const t = twos(value, bits);
      if (!t) continue;
      rows.push([`${bits}-bit`, `unsigned ${t.unsigned.toLocaleString('en-US')} · signed ${t.signed.toLocaleString('en-US')} · 0x${t.hex} · ${group(t.bin, 4)}`]);
    }
    els.extra.innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td class="val"><code>${v.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></td></tr>`).join('');
  }

  function init() {
    els = { error: $('baseError'), extra: $('baseExtra'), bits: $('baseBits'), custom: $('baseCustom'), customBase: $('baseCustomBase') };
    for (const [id] of FIELDS) els[id] = $('base' + id[0].toUpperCase() + id.slice(1));
    if (!els.dec) return;
    els.customBase.innerHTML = Array.from({ length: 35 }, (_, i) => i + 2).map(b => `<option value="${b}"${b === 36 ? ' selected' : ''}>Base ${b}</option>`).join('');
    for (const [id, base] of FIELDS) els[id].addEventListener('input', () => onInput(id, base));
    els.custom.addEventListener('input', () => onInput('custom', +els.customBase.value));
    els.customBase.addEventListener('change', () => { setAll(null); });
    document.querySelectorAll('[data-copy-field]').forEach(b => b.addEventListener('click', () => {
      navigator.clipboard.writeText($(b.dataset.copyField).value).then(() => { const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1200); });
    }));
    let saved = '';
    try { saved = localStorage.getItem('jxe.base') || ''; } catch (_) {  }
    els.dec.value = saved || '255';
    onInput('dec', 10);
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { parseIn, toBase, twos };
})();
