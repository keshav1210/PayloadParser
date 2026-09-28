
'use strict';

const HashTool = (() => {
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

  function md5(bytes) {
    const len = bytes.length;
    const padded = new Uint8Array((((len + 8) >>> 6) + 1) << 6);
    padded.set(bytes);
    padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, (len * 8) >>> 0, true);
    dv.setUint32(padded.length - 4, Math.floor(len / 0x20000000), true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    const ov = new DataView(out.buffer);
    [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v, true));
    return out;
  }

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, (c ^ 0xffffffff) >>> 0);
    return out;
  }

  function hmacMd5(key, msg) {
    if (key.length > 64) key = md5(key);
    const k = new Uint8Array(64);
    k.set(key);
    const ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(64 + 16);
    for (let i = 0; i < 64; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
    ipad.set(msg, 64);
    opad.set(md5(ipad), 64);
    return md5(opad);
  }

  const ALGOS = [
    { id: 'MD5', subtle: null, note: 'Not secure: use only for checksums' },
    { id: 'SHA-1', subtle: 'SHA-1', note: 'Not secure for signatures' },
    { id: 'SHA-256', subtle: 'SHA-256' },
    { id: 'SHA-384', subtle: 'SHA-384' },
    { id: 'SHA-512', subtle: 'SHA-512' },
    { id: 'CRC32', subtle: null, note: 'Checksum, not a cryptographic hash', noHmac: true },
  ];

  async function digest(algo, bytes, key) {
    if (key) {
      if (algo.id === 'MD5') return hmacMd5(key, bytes);
      if (algo.noHmac) return null;
      const k = await crypto.subtle.importKey('raw', key.length ? key : new Uint8Array(1), { name: 'HMAC', hash: algo.subtle }, false, ['sign']);
      return new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes));
    }
    if (algo.id === 'MD5') return md5(bytes);
    if (algo.id === 'CRC32') return crc32(bytes);
    return new Uint8Array(await crypto.subtle.digest(algo.subtle, bytes));
  }

  const toHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const toB64 = b => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

  function parseKey(text, format) {
    if (format === 'hex') {
      const clean = text.replace(/\s+/g, '');
      if (!/^([0-9a-fA-F]{2})*$/.test(clean)) throw new Error('The key is not valid hex (use pairs of 0-9 and a-f).');
      return Uint8Array.from(clean.match(/../g) || [], h => parseInt(h, 16));
    }
    if (format === 'base64') {
      try { return Uint8Array.from(atob(text.trim().replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
      catch (_) { throw new Error('The key is not valid Base64.'); }
    }
    return new TextEncoder().encode(text);
  }

  const $ = id => document.getElementById(id);
  const MAX_FILE = 1024 * 1024 * 1024;
  let els, source = 'text', fileBytes = null, fileName = '', timer = null, results = {}, runId = 0;

  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function formatOut(bytes) {
    const f = els.format.value;
    if (f === 'base64') return toB64(bytes);
    return f === 'HEX' ? toHex(bytes).toUpperCase() : toHex(bytes);
  }

  async function compute() {
    const id = ++runId;
    showError('');
    let bytes;
    if (source === 'file') {
      if (!fileBytes) { renderRows(null); return; }
      bytes = fileBytes;
    } else {
      bytes = new TextEncoder().encode(els.text.value);
    }
    let key = null;
    if (els.hmacOn.checked) {
      try { key = parseKey(els.key.value, els.keyFormat.value); }
      catch (e) { showError(e.message); renderRows(null); return; }
    }
    const out = {};
    for (const a of ALGOS) {
      try { out[a.id] = await digest(a, bytes, key); }
      catch (e) { out[a.id] = e; }
    }
    if (id !== runId) return;
    results = out;
    renderRows(out);
    els.meta.textContent = source === 'file'
      ? `${fileName} · ${bytes.length.toLocaleString()} bytes`
      : `${bytes.length.toLocaleString()} byte${bytes.length === 1 ? '' : 's'} (UTF-8)`;
  }

  function renderRows(out) {
    const expected = els.compare.value.trim().replace(/\s+/g, '');
    let matched = false;
    els.rows.innerHTML = ALGOS.map(a => {
      const r = out && out[a.id];
      let value = '', cls = '';
      if (!out) value = '<span class="muted">–</span>';
      else if (r === null) value = '<span class="muted">Not available with HMAC</span>';
      else if (r instanceof Error) value = `<span class="muted">${escapeHtml(r.message)}</span>`;
      else {
        const text = formatOut(r);
        value = `<code>${text}</code>`;
        if (expected && (text.toLowerCase() === expected.toLowerCase() || toHex(r) === expected.toLowerCase() || toB64(r) === expected)) { cls = 'hash-match'; matched = true; }
      }
      const name = (els.hmacOn.checked && !a.noHmac ? 'HMAC-' : '') + a.id;
      return `<tr class="${cls}"><td><strong>${name}</strong>${a.note ? `<small>${a.note}</small>` : ''}</td><td class="val hash-val">${value}</td>
        <td><button type="button" class="mini-btn" data-copy="${a.id}"${!out || !(r instanceof Uint8Array) ? ' disabled' : ''}>Copy</button></td></tr>`;
    }).join('');
    if (!expected || !out) { els.compareResult.textContent = ''; els.compareResult.className = 'badge'; }
    else if (matched) { els.compareResult.textContent = 'Match found (highlighted)'; els.compareResult.className = 'badge ok'; }
    else { els.compareResult.textContent = 'No algorithm matches'; els.compareResult.className = 'badge bad'; }
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(compute, 150);
  }

  function setSource(s) {
    source = s;
    document.querySelectorAll('[data-hash-src]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.hashSrc === s)));
    els.textPane.hidden = s !== 'text';
    els.filePane.hidden = s !== 'file';
    compute();
  }

  async function loadFile(f) {
    if (!f) return;
    if (f.size > MAX_FILE) { showError('Files up to 1 GB can be hashed in the browser.'); return; }
    els.drop.classList.add('busy');
    els.dropText.textContent = `Reading ${f.name}…`;
    try {
      fileBytes = new Uint8Array(await f.arrayBuffer());
      fileName = f.name;
      els.dropText.textContent = `${f.name} (${(f.size / 1048576).toFixed(f.size < 1048576 ? 3 : 1)} MB). Drop another file to replace it.`;
    } catch (e) {
      showError('Could not read the file: ' + e.message);
    } finally {
      els.drop.classList.remove('busy');
    }
    compute();
  }

  function init() {
    els = {
      text: $('hashText'), rows: $('hashRows'), meta: $('hashMeta'), format: $('hashFormat'), error: $('hashError'),
      hmacOn: $('hashHmacOn'), key: $('hashKey'), keyFormat: $('hashKeyFormat'), keyWrap: $('hashKeyWrap'),
      compare: $('hashCompare'), compareResult: $('hashCompareResult'),
      textPane: $('hashTextPane'), filePane: $('hashFilePane'), drop: $('hashDrop'), dropText: $('hashDropText'), file: $('hashFile'),
    };
    if (!els.text) return;

    els.text.addEventListener('input', schedule);
    els.key.addEventListener('input', schedule);
    els.keyFormat.addEventListener('change', compute);
    els.format.addEventListener('change', () => renderRows(results && Object.keys(results).length ? results : null));
    els.compare.addEventListener('input', () => renderRows(Object.keys(results).length ? results : null));
    els.hmacOn.addEventListener('change', () => { els.keyWrap.hidden = !els.hmacOn.checked; compute(); });
    document.querySelectorAll('[data-hash-src]').forEach(b => b.addEventListener('click', () => setSource(b.dataset.hashSrc)));

    els.rows.addEventListener('click', e => {
      const btn = e.target.closest('[data-copy]');
      if (!btn || !(results[btn.dataset.copy] instanceof Uint8Array)) return;
      navigator.clipboard.writeText(formatOut(results[btn.dataset.copy])).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
      });
    });

    els.file.addEventListener('change', e => loadFile(e.target.files[0]));
    els.drop.addEventListener('dragover', e => { e.preventDefault(); els.drop.classList.add('over'); });
    els.drop.addEventListener('dragleave', () => els.drop.classList.remove('over'));
    els.drop.addEventListener('drop', e => { e.preventDefault(); els.drop.classList.remove('over'); loadFile(e.dataTransfer.files[0]); });
    els.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.file.click(); } });

    if (!els.text.value) els.text.value = 'Hello, world!';
    setSource('text');
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { md5, crc32, hmacMd5, toHex };
})();
