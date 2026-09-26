/* ============================================================
   jwt.js - decode and verify JSON Web Tokens in the browser.
   The token never leaves the page and is never stored.
   ============================================================ */

'use strict';

const Jwt = (() => {
  const $ = id => document.getElementById(id);
  let els;
  let timer = null;

  // ── base64url ───────────────────────────────────────────────────────────────
  function b64urlToBytes(s) {
    let b = s.replace(/-/g, '+').replace(/_/g, '/');
    if (/[^A-Za-z0-9+/=]/.test(b)) throw new Error('contains characters that are not valid base64url');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64url(bytes) {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false });
  const enc = new TextEncoder();

  function decodePart(part, name) {
    let bytes;
    try { bytes = b64urlToBytes(part); }
    catch (e) { throw new Error(`The ${name} ${e.message}.`); }
    const text = utf8.decode(bytes);
    try { return { json: JSON.parse(text), text }; }
    catch (_) { throw new Error(`The ${name} is not valid JSON after decoding.`); }
  }

  // ── Dates ───────────────────────────────────────────────────────────────────
  function relative(seconds) {
    const diff = seconds - Date.now() / 1000;
    const abs = Math.abs(diff);
    const units = [['year', 31536000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    for (const [u, s] of units) {
      if (abs >= s || u === 'second') {
        const n = Math.round(abs / s);
        const label = `${n} ${u}${n === 1 ? '' : 's'}`;
        return diff >= 0 ? `in ${label}` : `${label} ago`;
      }
    }
    return '';
  }

  function fmtDate(seconds) {
    const d = new Date(seconds * 1000);
    if (isNaN(d)) return String(seconds);
    return `${d.toISOString().replace('.000Z', 'Z')}  ·  ${d.toLocaleString()}  ·  ${relative(seconds)}`;
  }

  const CLAIMS = {
    iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expires', nbf: 'Not before',
    iat: 'Issued at', jti: 'Token ID', azp: 'Authorized party', scope: 'Scope', scp: 'Scopes',
    email: 'Email', name: 'Name', roles: 'Roles', tid: 'Tenant ID', oid: 'Object ID', nonce: 'Nonce',
  };

  // ── Rendering ───────────────────────────────────────────────────────────────
  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function highlightJson(obj) {
    const text = JSON.stringify(obj, null, 2);
    const frag = document.createDocumentFragment();
    const re = /("(?:\\.|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      frag.append(text.slice(last, m.index));
      const cls = m[1] ? (m[2] ? 'key' : 'string') : m[3] ? (m[3] === 'null' ? 'null' : 'boolean') : 'number';
      frag.append(node('span', cls, m[1] || m[0]));
      if (m[2]) frag.append(m[2]);
      last = re.lastIndex;
    }
    frag.append(text.slice(last));
    return frag;
  }

  function statusBadge(payload) {
    const now = Date.now() / 1000;
    if (typeof payload.exp === 'number' && payload.exp < now) return ['bad', `Expired ${relative(payload.exp)}`];
    if (typeof payload.nbf === 'number' && payload.nbf > now) return ['warn', `Not valid yet (starts ${relative(payload.nbf)})`];
    if (typeof payload.exp === 'number') return ['ok', `Valid for ${relative(payload.exp).replace(/^in /, '')}`];
    return ['warn', 'No expiry (exp) claim'];
  }

  function warnings(header, payload) {
    const w = [];
    const alg = String(header.alg || '');
    if (!alg) w.push('The header has no "alg" (algorithm).');
    if (alg.toLowerCase() === 'none') w.push('alg is "none": this token is not signed. Servers must reject it.');
    if (typeof payload.exp !== 'number') w.push('There is no "exp" claim, so the token never expires.');
    if (typeof payload.exp === 'number' && typeof payload.iat === 'number' && payload.exp - payload.iat > 86400 * 30) {
      w.push(`It is valid for ${Math.round((payload.exp - payload.iat) / 86400)} days. Long-lived tokens are risky if they leak.`);
    }
    ['exp', 'nbf', 'iat'].forEach(c => {
      if (c in payload && typeof payload[c] !== 'number') w.push(`"${c}" should be a number of seconds, but it is ${JSON.stringify(payload[c])}.`);
      if (typeof payload[c] === 'number' && payload[c] > 1e11) w.push(`"${c}" looks like milliseconds; JWT times are in seconds.`);
    });
    return w;
  }

  function renderClaims(payload) {
    const dl = els.claims;
    dl.textContent = '';
    const keys = Object.keys(payload);
    if (!keys.length) { dl.append(node('dt', null, 'Claims'), node('dd', null, '(none)')); return; }
    keys.forEach(k => {
      const v = payload[k];
      const label = CLAIMS[k] ? `${CLAIMS[k]} (${k})` : k;
      let text;
      if (['exp', 'nbf', 'iat', 'auth_time', 'updated_at'].includes(k) && typeof v === 'number') text = fmtDate(v);
      else text = typeof v === 'string' ? v : JSON.stringify(v);
      dl.append(node('dt', null, label), node('dd', null, text));
    });
  }

  function clear() {
    els.out.hidden = true;
    els.error.hidden = true;
  }

  function showError(msg) {
    els.out.hidden = true;
    els.error.hidden = false;
    els.error.textContent = msg;
  }

  let current = null;   // { header, payload, parts }

  function decode() {
    let token = els.input.value.trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').replace(/\s+/g, '');
    if (!token) { clear(); current = null; return; }
    const parts = token.split('.');
    if (parts.length === 5) { showError('This is an encrypted token (JWE, five parts). Its contents can only be read with the decryption key, which this tool does not ask for.'); current = null; return; }
    if (parts.length !== 3) { showError(`A JWT has three parts separated by dots (header.payload.signature). This one has ${parts.length}.`); current = null; return; }

    let header, payload;
    try {
      header = decodePart(parts[0], 'header').json;
      payload = decodePart(parts[1], 'payload').json;
    } catch (e) {
      showError(e.message);
      current = null;
      return;
    }
    current = { header, payload, parts };

    els.error.hidden = true;
    els.out.hidden = false;
    els.header.textContent = '';
    els.header.append(highlightJson(header));
    els.payload.textContent = '';
    els.payload.append(highlightJson(payload));
    els.signature.textContent = parts[2] || '(empty)';
    els.alg.textContent = header.alg || '?';

    const [cls, text] = statusBadge(payload);
    els.status.className = 'badge ' + cls;
    els.status.textContent = text;
    renderClaims(payload);

    const w = warnings(header, payload);
    els.warnings.hidden = !w.length;
    els.warnings.textContent = '';
    w.forEach(x => els.warnings.append(node('li', null, x)));

    const alg = String(header.alg || '');
    els.keyLabel.textContent = /^HS/.test(alg) ? 'Secret' : 'Public key (PEM or JWK)';
    els.key.placeholder = /^HS/.test(alg) ? 'The shared secret used to sign the token'
      : '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----   or a JWK like {"kty":"RSA", …}';
    verify();
  }

  // ── Signature verification (Web Crypto) ─────────────────────────────────────
  const HASH = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };
  const CURVE = { 256: 'P-256', 384: 'P-384', 512: 'P-521' };

  function pemToDer(pem) {
    const body = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
    const bin = atob(body);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  async function importKey(alg, keyText) {
    const bits = alg.slice(2);
    const hash = HASH[bits];
    if (!hash) throw new Error(`Unsupported algorithm ${alg}`);
    const family = alg.slice(0, 2);
    let params;
    if (family === 'HS') params = { name: 'HMAC', hash };
    else if (family === 'RS') params = { name: 'RSASSA-PKCS1-v1_5', hash };
    else if (family === 'PS') params = { name: 'RSA-PSS', hash };
    else if (family === 'ES') params = { name: 'ECDSA', namedCurve: CURVE[bits] };
    else throw new Error(`Unsupported algorithm ${alg}`);

    if (family === 'HS') {
      return crypto.subtle.importKey('raw', enc.encode(keyText), params, false, ['verify']);
    }
    const trimmed = keyText.trim();
    if (trimmed.startsWith('{')) {
      let jwk = JSON.parse(trimmed);
      if (Array.isArray(jwk.keys)) {
        const kid = current && current.header.kid;
        jwk = jwk.keys.find(k => !kid || k.kid === kid) || jwk.keys[0];
      }
      return crypto.subtle.importKey('jwk', jwk, params, false, ['verify']);
    }
    if (/BEGIN CERTIFICATE/.test(trimmed)) throw new Error('Paste the public key, not the certificate. You can extract it with: openssl x509 -pubkey -noout -in cert.pem');
    if (/BEGIN RSA PUBLIC KEY/.test(trimmed)) throw new Error('This is a PKCS#1 key. Convert it to "BEGIN PUBLIC KEY" format with: openssl rsa -RSAPublicKey_in -in key.pem -pubout');
    return crypto.subtle.importKey('spki', pemToDer(trimmed), params, false, ['verify']);
  }

  async function verify() {
    const keyText = els.key.value;
    if (!current || !keyText.trim()) {
      els.verify.className = 'badge warn';
      els.verify.textContent = current ? 'Signature not checked: enter a key to verify' : '';
      return;
    }
    const alg = String(current.header.alg || '');
    if (alg.toLowerCase() === 'none') {
      els.verify.className = 'badge bad';
      els.verify.textContent = 'Unsigned token (alg "none")';
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      els.verify.className = 'badge warn';
      els.verify.textContent = 'Your browser can only verify signatures on HTTPS pages';
      return;
    }
    try {
      const key = await importKey(alg, keyText);
      const data = enc.encode(current.parts[0] + '.' + current.parts[1]);
      const sig = b64urlToBytes(current.parts[2]);
      const family = alg.slice(0, 2);
      const params = family === 'HS' ? 'HMAC'
        : family === 'RS' ? 'RSASSA-PKCS1-v1_5'
        : family === 'PS' ? { name: 'RSA-PSS', saltLength: Number(alg.slice(2)) / 8 }
        : { name: 'ECDSA', hash: HASH[alg.slice(2)] };
      const ok = await crypto.subtle.verify(params, key, sig, data);
      els.verify.className = 'badge ' + (ok ? 'ok' : 'bad');
      els.verify.textContent = ok ? 'Signature verified ✓' : 'Invalid signature ✗';
    } catch (e) {
      els.verify.className = 'badge bad';
      els.verify.textContent = 'Could not verify: ' + (e.message || 'the key could not be read');
    }
  }

  // A valid HS256 sample, signed right now so verification works
  async function sample() {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: '1234567890', name: 'Ada Lovelace', email: 'ada@example.com', roles: ['admin'], iat: now, exp: now + 3600 };
    const secret = 'my-test-secret';
    const p1 = bytesToB64url(enc.encode(JSON.stringify(header)));
    const p2 = bytesToB64url(enc.encode(JSON.stringify(payload)));
    let sig = 'signature';
    if (window.crypto && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      sig = bytesToB64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(p1 + '.' + p2))));
    }
    els.input.value = `${p1}.${p2}.${sig}`;
    els.key.value = secret;
    decode();
  }

  function copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1200); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done);
    else { const ta = Object.assign(document.createElement('textarea'), { value: text }); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  }

  function init() {
    els = {
      input: $('jwtInput'), out: $('jwtOut'), error: $('jwtError'), header: $('jwtHeader'), payload: $('jwtPayload'),
      signature: $('jwtSignature'), claims: $('jwtClaims'), status: $('jwtStatus'), alg: $('jwtAlg'),
      warnings: $('jwtWarnings'), key: $('jwtKey'), keyLabel: $('jwtKeyLabel'), verify: $('jwtVerify'),
    };
    if (!els.input) return;
    els.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(decode, 150); });
    els.key.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(verify, 250); });
    $('jwtSample').addEventListener('click', sample);
    $('jwtClear').addEventListener('click', () => { els.input.value = ''; els.key.value = ''; current = null; clear(); els.input.focus(); });
    $('jwtCopyPayload').addEventListener('click', e => current && copy(JSON.stringify(current.payload, null, 2), e.target));
    $('jwtCopyHeader').addEventListener('click', e => current && copy(JSON.stringify(current.header, null, 2), e.target));
    decode();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { decode, b64urlToBytes };
})();
