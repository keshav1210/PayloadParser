/* ============================================================
   qr.js - QR code generator (runs in the browser).
   Encoding by qrcode-generator (MIT, js/vendor/qrcode.js).
   ============================================================ */

'use strict';

const QrTool = (() => {
  const $ = id => document.getElementById(id);
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];   // non-Latin text and emoji

  let els, logoImg = null, current = null, timer = null;

  // ── Payload builders ───────────────────────────────────────────────────────
  const val = id => ($(id) ? $(id).value.trim() : '');
  const phoneDigits = s => s.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

  function checkPhone(raw, label) {
    const p = phoneDigits(raw);
    const digits = p.replace('+', '');
    if (!digits) throw new Error(`Enter ${label}.`);
    if (digits.length < 5 || digits.length > 15) throw new Error(`${label[0].toUpperCase() + label.slice(1)} should have 5 to 15 digits.`);
    return p;
  }

  // vCard / Wi-Fi escaping
  const escVcard = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const escWifi = s => s.replace(/([\\;,:"])/g, '\\$1');

  const BUILD = {
    url() {
      let u = val('qrUrl');
      if (!u) throw new Error('Enter a web address.');
      if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      return u;
    },
    text() {
      const t = $('qrText').value;
      if (!t.trim()) throw new Error('Enter some text.');
      return t;
    },
    phone() {
      return 'tel:' + checkPhone(val('qrPhone'), 'a phone number');
    },
    sms() {
      const n = checkPhone(val('qrSmsNumber'), 'a phone number');
      const msg = $('qrSmsBody').value;
      return `SMSTO:${n}:${msg}`;
    },
    whatsapp() {
      const n = checkPhone(val('qrWaNumber'), 'a phone number with country code').replace('+', '');
      const msg = $('qrWaBody').value;
      return `https://wa.me/${n}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
    },
    email() {
      const to = val('qrEmailTo');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Enter a valid email address.');
      const q = [];
      if (val('qrEmailSubject')) q.push('subject=' + encodeURIComponent(val('qrEmailSubject')));
      if ($('qrEmailBody').value.trim()) q.push('body=' + encodeURIComponent($('qrEmailBody').value));
      return `mailto:${to}${q.length ? '?' + q.join('&') : ''}`;
    },
    wifi() {
      const ssid = $('qrWifiSsid').value;
      if (!ssid) throw new Error('Enter the network name (SSID).');
      const sec = $('qrWifiSec').value;
      const pass = $('qrWifiPass').value;
      if (sec !== 'nopass' && !pass) throw new Error('Enter the Wi-Fi password, or choose "No password".');
      return `WIFI:T:${sec};S:${escWifi(ssid)};${sec !== 'nopass' ? 'P:' + escWifi(pass) + ';' : ''}${$('qrWifiHidden').checked ? 'H:true;' : ''};`;
    },
    vcard() {
      const first = val('qrVcFirst'), last = val('qrVcLast');
      if (!first && !last) throw new Error('Enter at least a first or last name.');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escVcard(last)};${escVcard(first)};;;`, `FN:${escVcard([first, last].filter(Boolean).join(' '))}`];
      if (val('qrVcOrg')) lines.push('ORG:' + escVcard(val('qrVcOrg')));
      if (val('qrVcTitle')) lines.push('TITLE:' + escVcard(val('qrVcTitle')));
      if (val('qrVcPhone')) lines.push('TEL;TYPE=CELL:' + checkPhone(val('qrVcPhone'), 'the phone number'));
      if (val('qrVcEmail')) lines.push('EMAIL:' + escVcard(val('qrVcEmail')));
      if (val('qrVcUrl')) lines.push('URL:' + escVcard(val('qrVcUrl')));
      if (val('qrVcAddress')) lines.push('ADR;TYPE=WORK:;;' + escVcard(val('qrVcAddress')) + ';;;;');
      lines.push('END:VCARD');
      return lines.join('\n');
    },
  };

  const HINTS = {
    url: 'Scanning opens this page in the browser.',
    text: 'Scanning shows this text.',
    phone: 'Scanning opens the phone app with the number filled in, ready to call. The number is visible to whoever scans the code.',
    sms: 'Scanning opens a new text message with the number and message filled in.',
    whatsapp: 'Scanning opens a WhatsApp chat with this number, with your message ready to send.',
    email: 'Scanning opens a new email with the address, subject and message filled in.',
    wifi: 'Scanning offers to join this Wi-Fi network: no typing the password.',
    vcard: 'Scanning offers to save this contact to the phone.',
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function encode(payload, level) {
    const qr = qrcode(0, level);
    qr.addData(payload, 'Byte');
    try { qr.make(); }
    catch (_) { throw new Error('Too much content for one QR code. Shorten it, or choose a lower error correction level.'); }
    return qr;
  }

  function draw(qr, canvas, px, margin, fg, bg) {
    const n = qr.getModuleCount();
    const total = n + margin * 2;
    const scale = Math.max(1, Math.floor(px / total));
    const size = total * scale;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = fg;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
    if (logoImg) {
      // Logo covers at most ~20% of the width; error correction H restores the hidden modules
      const box = Math.round(n * 0.2) * scale;
      const x = Math.round((size - box) / 2), y = x;
      const pad = Math.max(2, Math.round(scale * 0.8));
      ctx.fillStyle = bg;
      ctx.fillRect(x - pad, y - pad, box + pad * 2, box + pad * 2);
      const ratio = Math.min(box / logoImg.width, box / logoImg.height);
      const w = logoImg.width * ratio, h = logoImg.height * ratio;
      ctx.drawImage(logoImg, x + (box - w) / 2, y + (box - h) / 2, w, h);
    }
    return size;
  }

  function toSvg(qr, margin, fg, bg) {
    const n = qr.getModuleCount();
    const total = n + margin * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) { c++; continue; }
        const start = c;
        while (c < n && qr.isDark(r, c)) c++;
        d += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
      }
    }
    let logo = '';
    if (logoImg && current && current.logoData) {
      const box = Math.round(n * 0.2);
      const x = (total - box) / 2;
      logo = `<rect x="${x - 0.8}" y="${x - 0.8}" width="${box + 1.6}" height="${box + 1.6}" fill="${bg}"/>` +
             `<image href="${current.logoData}" x="${x}" y="${x}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
           `<rect width="100%" height="100%" fill="${bg}"/><path fill="${fg}" d="${d}"/>${logo}</svg>`;
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function render() {
    const type = els.type.value;
    showError('');
    let payload;
    try { payload = BUILD[type](); }
    catch (e) {
      current = null;
      els.preview.classList.add('empty');
      els.payload.textContent = '';
      els.stats.textContent = '';
      if (els.touched) showError(e.message);
      return;
    }
    els.touched = true;
    const level = logoImg ? 'H' : els.level.value;
    let qr;
    try { qr = encode(payload, level); }
    catch (e) { current = null; els.preview.classList.add('empty'); showError(e.message); return; }

    const fg = els.fg.value, bg = els.bg.value;
    const margin = +els.margin.value;
    const px = +els.size.value;
    const size = draw(qr, els.canvas, px, margin, fg, bg);
    els.preview.classList.remove('empty');
    current = { qr, payload, margin, fg, bg, logoData: current && current.logoData, size, type };
    if (logoImg && logoImg.dataset.src) current.logoData = logoImg.dataset.src;

    els.payload.textContent = payload;
    const n = qr.getModuleCount();
    els.stats.textContent = `Version ${(n - 17) / 4} · ${n}×${n} modules · ${size}×${size} px · error correction ${level}`;
    els.hint.textContent = HINTS[type];

    // Scannability warnings
    const lf = luminance(fg), lb = luminance(bg);
    const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    const warns = [];
    if (lf > lb) warns.push('The code is lighter than its background. Many scanners can\'t read inverted codes; use a dark colour on a light background.');
    if (ratio < 4) warns.push('The two colours are too similar for reliable scanning. Increase the contrast.');
    if (margin < 2) warns.push('A margin under 2 modules can stop some phones from finding the code.');
    els.warn.hidden = !warns.length;
    els.warn.textContent = warns.join(' ');
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  function setType(type) {
    els.type.value = type;
    document.querySelectorAll('[data-qr-type]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.qrType === type)));
    document.querySelectorAll('.qr-fields').forEach(f => { f.hidden = f.dataset.fields !== type; });
    els.touched = false;
    render();
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function fileBase() {
    return 'qr-' + (current ? current.type : 'code');
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function flash(btn, text) {
    const t = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = t; }, 1300);
  }

  function init() {
    els = {
      type: $('qrType'), canvas: $('qrCanvas'), preview: $('qrPreview'), payload: $('qrPayload'), stats: $('qrStats'),
      error: $('qrError'), warn: $('qrWarn'), hint: $('qrHint'), fg: $('qrFg'), bg: $('qrBg'), size: $('qrSize'),
      margin: $('qrMargin'), level: $('qrLevel'), touched: false,
    };
    if (!els.canvas) return;

    document.querySelectorAll('[data-qr-type]').forEach(b => b.addEventListener('click', () => setType(b.dataset.qrType)));
    document.querySelectorAll('.qr-form input, .qr-form textarea, .qr-form select').forEach(i => {
      i.addEventListener('input', () => { els.touched = true; schedule(); });
      i.addEventListener('change', schedule);
    });
    $('qrWifiSec').addEventListener('change', () => { $('qrWifiPassWrap').hidden = $('qrWifiSec').value === 'nopass'; });
    $('qrSizeOut').textContent = els.size.value + ' px';
    els.size.addEventListener('input', () => { $('qrSizeOut').textContent = els.size.value + ' px'; });

    $('qrLogo').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { showError('Choose an image file for the logo.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          logoImg = img;
          img.dataset.src = reader.result;
          els.level.value = 'H';
          els.level.disabled = true;
          $('qrLogoClear').hidden = false;
          render();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    });
    $('qrLogoClear').addEventListener('click', () => {
      logoImg = null;
      if (current) current.logoData = null;
      $('qrLogo').value = '';
      els.level.disabled = false;
      $('qrLogoClear').hidden = true;
      render();
    });

    $('qrPng').addEventListener('click', () => { if (current) els.canvas.toBlob(b => download(b, fileBase() + '.png'), 'image/png'); });
    $('qrSvg').addEventListener('click', () => {
      if (!current) return;
      download(new Blob([toSvg(current.qr, current.margin, current.fg, current.bg)], { type: 'image/svg+xml' }), fileBase() + '.svg');
    });
    $('qrCopy').addEventListener('click', e => {
      if (!current) return;
      const btn = e.target;
      if (!navigator.clipboard || !window.ClipboardItem) { flash(btn, 'Not supported here'); return; }
      els.canvas.toBlob(b => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
          .then(() => flash(btn, 'Copied'), () => flash(btn, 'Copy failed'));
      }, 'image/png');
    });
    $('qrReset').addEventListener('click', () => {
      els.fg.value = '#000000'; els.bg.value = '#ffffff'; els.margin.value = '4'; els.size.value = '512';
      $('qrSizeOut').textContent = '512 px';
      if (!logoImg) els.level.value = 'M';
      render();
    });

    const fromHash = location.hash.slice(1);
    setType(BUILD[fromHash] ? fromHash : 'url');
  }

  document.addEventListener('DOMContentLoaded', init);
  return { BUILD, encode, toSvg };
})();
