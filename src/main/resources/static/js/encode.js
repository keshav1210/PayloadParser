
'use strict';

const Codec = (() => {
  const $ = id => document.getElementById(id);
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });

  function bytesToBase64(bytes) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  }

  function base64ToBytes(s) {
    let b = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (b.startsWith('data:')) b = b.slice(b.indexOf(',') + 1);
    if (/[^A-Za-z0-9+/=]/.test(b)) throw new Error('This is not valid Base64: it contains characters other than A–Z, a–z, 0–9, +, / and =.');
    if (b.replace(/=+$/, '').length % 4 === 1) throw new Error('This Base64 is incomplete: its length is not valid.');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToDisplay(bytes) {
    if (!fileInfo(bytes)) try {
      const text = dec.decode(bytes);
      const binary = /[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 4000));
      if (!binary) return { text };
    } catch (_) {  }
    const sig = sniff(bytes);
    const hex = Array.from(bytes.subarray(0, 512), b => b.toString(16).padStart(2, '0')).join(' ');
    return {
      text: hex + (bytes.length > 512 ? ' …' : ''),
      note: `Binary data (${bytes.length.toLocaleString()} bytes${sig ? ', looks like ' + sig : ''}), shown as hex.`,
      bytes,
      type: sig,
    };
  }

  const SIGNATURES = [
    ['89504e47', 'a PNG image', 'png', 'image/png'],
    ['ffd8ff', 'a JPEG image', 'jpg', 'image/jpeg'],
    ['47494638', 'a GIF image', 'gif', 'image/gif'],
    ['52494646', 'a WebP image', 'webp', 'image/webp'],
    ['25504446', 'a PDF document', 'pdf', 'application/pdf'],
    ['504b0304', 'a ZIP archive (or .docx/.xlsx/.jar)', 'zip', 'application/zip'],
    ['1f8b', 'gzip-compressed data', 'gz', 'application/gzip'],
  ];

  function fileInfo(b) {
    const h = Array.from(b.subarray(0, 12), x => x.toString(16).padStart(2, '0')).join('');
    const hit = SIGNATURES.find(([sig, , ext]) => h.startsWith(sig) && (ext !== 'webp' || h.slice(16, 24) === '57454250'));
    return hit ? { label: hit[1], ext: hit[2], mime: hit[3] } : null;
  }

  function sniff(b) {
    const info = fileInfo(b);
    return info ? info.label : '';
  }

  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function decodeHtml(s) {
    const doc = new DOMParser().parseFromString('<!doctype html><body><textarea>' + s.replace(/</g, '&lt;') + '</textarea>', 'text/html');
    return doc.querySelector('textarea').value;
  }

  function relative(ms) {
    const diff = (ms - Date.now()) / 1000, abs = Math.abs(diff);
    const units = [['year', 31536000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    for (const [u, s] of units) {
      if (abs >= s || u === 'second') {
        const n = Math.round(abs / s);
        const t = `${n} ${u}${n === 1 ? '' : 's'}`;
        return diff >= 0 ? `in ${t}` : `${t} ago`;
      }
    }
    return '';
  }

  function timestamp(input, direction) {
    const s = input.trim();
    if (!s) return { text: '' };
    let ms;
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      const digits = s.replace(/^-/, '').split('.')[0].length;
      let unit;
      if (digits >= 17) { ms = n / 1e6; unit = 'nanoseconds'; }
      else if (digits >= 14) { ms = n / 1e3; unit = 'microseconds'; }
      else if (digits >= 12) { ms = n; unit = 'milliseconds'; }
      else { ms = n * 1000; unit = 'seconds'; }
      const d = new Date(ms);
      if (isNaN(d)) throw new Error('That number is outside the range of valid dates.');
      return {
        text: [
          `UTC        ${d.toISOString()}`,
          `Local      ${d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}`,
          `Relative   ${relative(ms)}`,
          '',
          `Seconds       ${Math.floor(ms / 1000)}`,
          `Milliseconds  ${Math.floor(ms)}`,
        ].join('\n'),
        note: `Read as ${unit} since 1 January 1970 (UTC).`,
      };
    }
    const d = new Date(s);
    if (isNaN(d)) throw new Error('Enter a Unix timestamp (e.g. 1700000000) or a date such as 2026-09-26T10:15:00Z.');
    ms = d.getTime();
    return {
      text: [
        `Seconds       ${Math.floor(ms / 1000)}`,
        `Milliseconds  ${ms}`,
        '',
        `UTC        ${d.toISOString()}`,
        `Local      ${d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}`,
        `Relative   ${relative(ms)}`,
      ].join('\n'),
      note: /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'No time zone given, so the date was read in your local time zone.',
    };
  }

  const MODES = {
    base64: {
      label: 'Base64',
      encode: s => ({ text: bytesToBase64(enc.encode(s)) }),
      decode: s => bytesToDisplay(base64ToBytes(s)),
    },
    base64url: {
      label: 'Base64URL',
      encode: s => ({ text: bytesToBase64(enc.encode(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }),
      decode: s => bytesToDisplay(base64ToBytes(s)),
    },
    url: {
      label: 'URL',
      encode: s => ({ text: encodeURIComponent(s) }),
      decode: s => {
        try { return { text: decodeURIComponent(s.replace(/\+/g, '%20')) }; }
        catch (_) { throw new Error('This contains a % that is not followed by two hex digits, so it cannot be URL-decoded.'); }
      },
    },
    html: {
      label: 'HTML entities',
      encode: s => ({ text: s.replace(/[&<>"']/g, c => HTML_ESC[c]) }),
      decode: s => ({ text: decodeHtml(s) }),
    },
    json: {
      label: 'JSON string',
      encode: s => ({ text: JSON.stringify(s), note: 'Ready to paste as a JSON string value, quotes included.' }),
      decode: s => {
        let t = s.trim();
        if (!/^".*"$/s.test(t)) t = '"' + t.replace(/(^|[^\\])"/g, '$1\\"') + '"';
        try {
          const value = JSON.parse(t);
          const out = { text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) };
          try { const inner = JSON.parse(out.text); out.text = JSON.stringify(inner, null, 2); out.note = 'The unescaped text is itself JSON, so it has been formatted.'; } catch (_) {  }
          return out;
        } catch (_) {
          throw new Error('This is not a valid JSON string. Check for a backslash that isn\'t followed by a valid escape such as \\n, \\" or \\u00e9.');
        }
      },
    },
    hex: {
      label: 'Hex',
      encode: s => ({ text: Array.from(enc.encode(s), b => b.toString(16).padStart(2, '0')).join('') }),
      decode: s => {
        const h = s.replace(/0x/gi, '').replace(/[\s:,-]/g, '');
        if (/[^0-9a-fA-F]/.test(h)) throw new Error('Hex may only contain 0–9 and a–f.');
        if (h.length % 2) throw new Error('Hex needs an even number of digits (two per byte).');
        const bytes = new Uint8Array(h.length / 2);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(h.substr(i * 2, 2), 16);
        return bytesToDisplay(bytes);
      },
    },
    time: {
      label: 'Unix timestamp',
      encode: s => timestamp(s),
      decode: s => timestamp(s),
    },
  };

  let els, mode = 'base64', direction = 'encode', lastBinary = null;

  function run() {
    const m = MODES[mode];
    const input = els.input.value;
    els.error.hidden = true;
    els.note.textContent = '';
    lastBinary = null;
    els.download.hidden = true;
    if (!input) { els.output.value = ''; els.stats.textContent = ''; showPreview(null); return; }
    try {
      const r = (direction === 'encode' ? m.encode : m.decode)(input);
      els.output.value = r.text;
      els.note.textContent = r.note || '';
      if (r.bytes) { lastBinary = r.bytes; els.download.hidden = false; }
      showPreview(r.bytes);
      els.stats.textContent = `${input.length.toLocaleString()} → ${r.text.length.toLocaleString()} characters`;
    } catch (e) {
      els.output.value = '';
      els.stats.textContent = '';
      showPreview(null);
      els.error.hidden = false;
      els.error.textContent = e.message;
    }
  }

  let previewUrl = null;

  function showPreview(bytes) {
    if (!els.preview) return;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const info = bytes && fileInfo(bytes);
    if (!info || !/^image\/|pdf$/.test(info.mime)) { els.preview.hidden = true; els.preview.replaceChildren(); return; }
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: info.mime }));
    const view = info.mime.startsWith('image/')
      ? Object.assign(document.createElement('img'), { src: previewUrl, alt: 'Decoded image' })
      : Object.assign(document.createElement('iframe'), { src: previewUrl, title: 'Decoded PDF' });
    els.preview.replaceChildren(view);
    els.preview.hidden = false;
  }

  function setMode(m) {
    mode = m;
    els.modeBtns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    const isTime = m === 'time';
    els.dirWrap.hidden = isTime;
    els.now.hidden = !isTime;
    els.file.hidden = !(m === 'base64' || m === 'base64url');
    els.input.placeholder = isTime ? 'A Unix timestamp such as 1700000000 (seconds or milliseconds), or a date like 2026-09-26T10:15:00Z'
      : direction === 'encode' ? 'Text to encode' : 'Text to decode';
    run();
  }

  function setDirection(d) {
    direction = d;
    els.dirBtns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.dir === d)));
    setMode(mode);
  }

  function init() {
    els = {
      input: $('encInput'), output: $('encOutput'), error: $('encError'), note: $('encNote'), stats: $('encStats'),
      modeBtns: [...document.querySelectorAll('[data-mode]')], dirBtns: [...document.querySelectorAll('[data-dir]')],
      dirWrap: $('encDir'), now: $('encNow'), file: $('encFile'), download: $('encDownload'), preview: $('encPreview'),
    };
    if (!els.input) return;
    els.modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    els.dirBtns.forEach(b => b.addEventListener('click', () => setDirection(b.dataset.dir)));
    els.input.addEventListener('input', run);
    $('encSwap').addEventListener('click', () => {
      els.input.value = els.output.value;
      setDirection(direction === 'encode' ? 'decode' : 'encode');
    });
    $('encCopy').addEventListener('click', e => {
      const t = els.output.value;
      if (!t) return;
      const btn = e.target, label = btn.textContent;
      const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = label; }, 1200); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done);
      else { els.output.select(); document.execCommand('copy'); done(); }
    });
    $('encClear').addEventListener('click', () => { els.input.value = ''; run(); els.input.focus(); });
    els.now.addEventListener('click', () => { els.input.value = String(Math.floor(Date.now() / 1000)); run(); });

    const fileInput = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
    els.file.after(fileInput);
    els.file.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { els.error.hidden = false; els.error.textContent = 'Files up to 10 MB can be encoded here.'; return; }
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        let b64 = bytesToBase64(bytes);
        if (mode === 'base64url') b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        els.input.value = `(file: ${f.name}, ${bytes.length.toLocaleString()} bytes)`;
        els.output.value = b64;
        els.error.hidden = true;
        els.note.textContent = `Data URL prefix if you need one: data:${f.type || 'application/octet-stream'};base64,`;
        els.stats.textContent = `${bytes.length.toLocaleString()} bytes → ${b64.length.toLocaleString()} characters`;
      };
      reader.readAsArrayBuffer(f);
    });
    els.download.addEventListener('click', () => {
      if (!lastBinary) return;
      const info = fileInfo(lastBinary);
      const url = URL.createObjectURL(new Blob([lastBinary], { type: info ? info.mime : 'application/octet-stream' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'decoded.' + (info ? info.ext : 'bin') });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const preset = document.body.dataset;
    if (preset.presetDir === 'decode') direction = 'decode';
    els.dirBtns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.dir === direction)));
    const fromHash = location.hash.slice(1);
    if (MODES[fromHash]) setMode(fromHash); else setMode(MODES[preset.presetMode] ? preset.presetMode : 'base64');
  }

  document.addEventListener('DOMContentLoaded', init);
  return { MODES, run };
})();
