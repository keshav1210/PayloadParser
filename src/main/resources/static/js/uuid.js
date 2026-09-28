
'use strict';

const UuidTool = (() => {
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const fmtUuid = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

  function uuidV4() {
    const b = rand(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return fmtUuid(hex(b));
  }

  let v7Ms = -1, v7Seq = 0;
  function uuidV7(now = Date.now()) {
    if (now <= v7Ms) {
      v7Seq++;
      if (v7Seq > 0xfff) { v7Ms++; v7Seq = rand(2)[0] & 0x3ff; }
      now = v7Ms;
    } else {
      v7Ms = now;
      v7Seq = ((rand(2)[0] << 8) | rand(1)[0]) & 0x3ff;
    }
    const b = rand(16);
    const ms = BigInt(now);
    for (let i = 0; i < 6; i++) b[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
    b[6] = 0x70 | ((v7Seq >> 8) & 0x0f);
    b[7] = v7Seq & 0xff;
    b[8] = (b[8] & 0x3f) | 0x80;
    return fmtUuid(hex(b));
  }

  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let ulidMs = -1, ulidRand = null;
  function ulid(now = Date.now()) {
    if (now <= ulidMs && ulidRand) {
      let i = 15;
      while (i >= 0 && ulidRand[i] === 31) { ulidRand[i] = 0; i--; }
      if (i < 0) { ulidMs++; ulidRand = Array.from(rand(16), x => x & 31); }
      else ulidRand[i]++;
      now = ulidMs;
    } else {
      ulidMs = now;
      ulidRand = Array.from(rand(16), x => x & 31);
      ulidRand[0] &= 15;
    }
    let t = '', ms = now;
    for (let i = 0; i < 10; i++) { t = CROCKFORD[ms % 32] + t; ms = Math.floor(ms / 32); }
    return t + ulidRand.map(x => CROCKFORD[x]).join('');
  }

  function nanoid(size = 21, alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict') {
    const mask = (2 << Math.log2(alphabet.length - 1)) - 1;
    const step = Math.ceil((1.6 * mask * size) / alphabet.length);
    let id = '';
    while (id.length < size) {
      for (const byte of rand(step)) {
        const i = byte & mask;
        if (i < alphabet.length) { id += alphabet[i]; if (id.length === size) break; }
      }
    }
    return id;
  }

  function inspect(input) {
    const s = input.trim().replace(/^[{("']|[})"']$/g, '').replace(/^urn:uuid:/i, '');
    if (!s) return null;
    const compact = s.replace(/-/g, '');
    if (/^[0-9a-f]{32}$/i.test(compact)) {
      const h = compact.toLowerCase();
      if (/^0+$/.test(h)) return { type: 'Nil UUID', rows: [['Meaning', 'All zeros; used as “no value”']] };
      if (/^f+$/.test(h)) return { type: 'Max UUID', rows: [['Meaning', 'All ones (RFC 9562)']] };
      const version = parseInt(h[12], 16);
      const variantBits = parseInt(h[16], 16);
      const variant = variantBits >= 0xe ? 'Reserved (future)' : variantBits >= 0xc ? 'Microsoft (legacy GUID)' : variantBits >= 8 ? 'RFC 9562 / RFC 4122' : 'NCS (legacy)';
      const names = { 1: 'time-based (MAC address)', 2: 'DCE security', 3: 'name-based (MD5)', 4: 'random', 5: 'name-based (SHA-1)', 6: 'time-ordered (reordered v1)', 7: 'time-ordered (Unix time)', 8: 'custom' };
      const rows = [['Canonical form', fmtUuid(h)], ['Version', `${version}${names[version] ? ' · ' + names[version] : ''}`], ['Variant', variant]];
      let ms = null;
      if (version === 7) ms = parseInt(h.slice(0, 12), 16);
      if (version === 1 || version === 6) {
        const ts = version === 1
          ? BigInt('0x' + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8))
          : BigInt('0x' + h.slice(0, 12) + h.slice(13, 16));
        ms = Number((ts - 122192928000000000n) / 10000n);
        rows.push(['Node (MAC)', h.slice(20).match(/../g).join(':')]);
      }
      if (ms !== null) rows.splice(2, 0, ['Created', `${new Date(ms).toISOString()} (${new Date(ms).toLocaleString()})`]);
      if (version === 4) rows.push(['Randomness', '122 random bits']);
      return { type: 'UUID', rows };
    }
    if (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(s)) {
      const up = s.toUpperCase();
      let ms = 0;
      for (const c of up.slice(0, 10)) ms = ms * 32 + CROCKFORD.indexOf(c);
      return { type: 'ULID', rows: [['Created', `${new Date(ms).toISOString()} (${new Date(ms).toLocaleString()})`], ['Timestamp', `${ms} ms`], ['Randomness', up.slice(10)]] };
    }
    return { type: null, rows: [['Not recognised', 'This is not a UUID (32 hex digits) or a ULID (26 Crockford Base32 characters).']] };
  }

  const $ = id => document.getElementById(id);
  const STORE = 'jxe.uuid';
  let els, ids = [];

  function readOpts() {
    return {
      kind: els.kind.value, count: Math.max(1, Math.min(1000, parseInt(els.count.value, 10) || 1)),
      upper: els.upper.checked, hyphens: els.hyphens.checked, braces: els.braces.checked, format: els.format.value,
      nanoSize: Math.max(4, Math.min(128, parseInt(els.nanoSize.value, 10) || 21)), nanoAlpha: els.nanoAlpha.value,
    };
  }

  const ALPHABETS = {
    default: 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict',
    alnum: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    lower: '0123456789abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    nolookalikes: '346789ABCDEFGHJKLMNPQRTUVWXYabcdefghijkmnpqrtwxyz',
  };

  function generate() {
    const o = readOpts();
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (_) {  }
    els.uuidOpts.hidden = !o.kind.startsWith('v');
    els.nanoOpts.hidden = o.kind !== 'nanoid';
    ids = [];
    for (let i = 0; i < o.count; i++) {
      let id;
      if (o.kind === 'v4') id = uuidV4();
      else if (o.kind === 'v7') id = uuidV7();
      else if (o.kind === 'ulid') id = ulid();
      else id = nanoid(o.nanoSize, ALPHABETS[o.nanoAlpha]);
      if (o.kind.startsWith('v')) {
        if (!o.hyphens) id = id.replace(/-/g, '');
        if (o.upper) id = id.toUpperCase();
        if (o.braces) id = `{${id}}`;
      }
      ids.push(id);
    }
    els.output.value = formatList(ids, o.format);
    els.meta.textContent = `${ids.length} ${{ v4: 'UUID v4', v7: 'UUID v7', ulid: 'ULID', nanoid: 'Nano ID' }[o.kind]}${ids.length === 1 ? '' : 's'}`;
    if (ids.length) { els.inspect.value = ids[0].replace(/[{}]/g, ''); runInspect(); }
  }

  function formatList(list, format) {
    if (format === 'json') return JSON.stringify(list, null, 2);
    if (format === 'sql') return '(' + list.map(i => `'${i}'`).join(', ') + ')';
    if (format === 'csv') return list.join(',');
    if (format === 'java') return list.map(i => `UUID.fromString("${i}")`).join(',\n');
    return list.join('\n');
  }

  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function runInspect() {
    const r = inspect(els.inspect.value);
    if (!r) { els.inspectOut.innerHTML = '<dt>Paste an ID</dt><dd class="muted">to see its version and creation time</dd>'; return; }
    els.inspectOut.innerHTML = (r.type ? `<dt>Type</dt><dd>${escapeHtml(r.type)}</dd>` : '') + r.rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  }

  function flash(btn, text) {
    const t = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = t; }, 1300);
  }

  function init() {
    els = {
      kind: $('uuidKind'), count: $('uuidCount'), upper: $('uuidUpper'), hyphens: $('uuidHyphens'), braces: $('uuidBraces'),
      format: $('uuidFormat'), output: $('uuidOutput'), meta: $('uuidMeta'), inspect: $('uuidInspect'), inspectOut: $('uuidInspectOut'),
      uuidOpts: $('uuidOpts'), nanoOpts: $('nanoOpts'), nanoSize: $('nanoSize'), nanoAlpha: $('nanoAlpha'),
    };
    if (!els.kind) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (_) {  }
    const hashKind = location.hash.slice(1);
    if (saved) {
      els.kind.value = saved.kind || 'v4'; els.count.value = saved.count || 5; els.upper.checked = !!saved.upper;
      els.hyphens.checked = saved.hyphens !== false; els.braces.checked = !!saved.braces; els.format.value = saved.format || 'lines';
      els.nanoSize.value = saved.nanoSize || 21; els.nanoAlpha.value = saved.nanoAlpha || 'default';
    }
    if (['v4', 'v7', 'ulid', 'nanoid'].includes(hashKind)) els.kind.value = hashKind;

    [els.kind, els.upper, els.hyphens, els.braces, els.nanoAlpha].forEach(e => e.addEventListener('change', generate));
    [els.count, els.nanoSize].forEach(e => e.addEventListener('change', generate));
    els.format.addEventListener('change', () => { els.output.value = formatList(ids, els.format.value); generate(); });
    $('uuidGenerate').addEventListener('click', generate);
    $('uuidCopy').addEventListener('click', e => navigator.clipboard.writeText(els.output.value).then(() => flash(e.target, 'Copied')));
    $('uuidDownload').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([els.output.value + '\n'], { type: 'text/plain' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'ids.txt' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    els.inspect.addEventListener('input', runInspect);
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    });
    generate();
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { uuidV4, uuidV7, ulid, nanoid, inspect };
})();
