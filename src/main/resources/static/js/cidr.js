/* ============================================================
   cidr.js - IPv4 / IPv6 subnet (CIDR) calculator: network,
   broadcast, host range, masks, address type, subnet split and
   "is this IP in the range" check. Runs in the browser.
   ============================================================ */

'use strict';

const CidrTool = (() => {
  // ── IPv4 ───────────────────────────────────────────────────────────────────
  function parseV4(s) {
    const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const parts = m.slice(1).map(Number);
    if (parts.some(p => p > 255)) throw new Error('Each part of an IPv4 address must be between 0 and 255.');
    if (m.slice(1).some(p => p.length > 1 && p.startsWith('0'))) throw new Error('Leading zeros are ambiguous in IPv4 addresses (some tools read them as octal). Remove them.');
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  const v4str = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const maskOf = p => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  const bin32 = n => n.toString(2).padStart(32, '0').match(/.{8}/g).join('.');

  function prefixFromMask(mask) {
    const inv = (~mask) >>> 0;
    if ((inv & (inv + 1)) !== 0) throw new Error('That subnet mask is not valid: the 1 bits must all come first (e.g. 255.255.255.0).');
    return 32 - Math.log2(inv + 1);
  }

  const V4_TYPES = [
    ['0.0.0.0/8', 'This network (“any address”)'], ['10.0.0.0/8', 'Private (RFC 1918)'], ['100.64.0.0/10', 'Carrier-grade NAT (RFC 6598)'],
    ['127.0.0.0/8', 'Loopback'], ['169.254.0.0/16', 'Link-local (APIPA)'], ['172.16.0.0/12', 'Private (RFC 1918)'],
    ['192.0.0.0/24', 'IETF protocol assignments'], ['192.0.2.0/24', 'Documentation (TEST-NET-1)'], ['192.88.99.0/24', '6to4 relay (deprecated)'],
    ['192.168.0.0/16', 'Private (RFC 1918)'], ['198.18.0.0/15', 'Benchmarking'], ['198.51.100.0/24', 'Documentation (TEST-NET-2)'],
    ['203.0.113.0/24', 'Documentation (TEST-NET-3)'], ['224.0.0.0/4', 'Multicast'], ['255.255.255.255/32', 'Limited broadcast'], ['240.0.0.0/4', 'Reserved'],
  ].map(([c, label]) => { const [a, p] = c.split('/'); return { net: parseV4(a), prefix: +p, label }; });

  function v4Type(ip) {
    for (const t of V4_TYPES) if (((ip & maskOf(t.prefix)) >>> 0) === t.net) return t.label;
    return 'Public';
  }

  function v4Class(ip) {
    const a = ip >>> 24;
    if (a < 128) return 'A'; if (a < 192) return 'B'; if (a < 224) return 'C'; if (a < 240) return 'D (multicast)'; return 'E (reserved)';
  }

  function calcV4(ip, prefix) {
    const mask = maskOf(prefix);
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    let first, last, usable;
    if (prefix === 32) { first = last = network; usable = 1; }
    else if (prefix === 31) { first = network; last = broadcast; usable = 2; }
    else { first = network + 1; last = broadcast - 1; usable = total - 2; }
    return { version: 4, ip, prefix, mask, wildcard: (~mask) >>> 0, network, broadcast, first, last, total, usable };
  }

  // ── IPv6 (BigInt) ──────────────────────────────────────────────────────────
  function parseV6(s) {
    let str = s.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
    if (!str.includes(':')) return null;
    // embedded IPv4 in the last 32 bits
    const v4m = str.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (v4m) {
      const n = parseV4(v4m[1]);
      str = str.slice(0, -v4m[1].length) + ((n >>> 16).toString(16)) + ':' + ((n & 0xffff).toString(16));
    }
    const halves = str.split('::');
    if (halves.length > 2) throw new Error('An IPv6 address can contain “::” only once.');
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - head.length - tail.length;
    if (halves.length === 1 && missing !== 0) throw new Error('An IPv6 address needs 8 groups, or “::” to stand for missing zero groups.');
    if (halves.length === 2 && missing < 1) throw new Error('Too many groups for an address with “::”.');
    const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
    if (groups.some(g => !/^[0-9a-fA-F]{1,4}$/.test(g))) throw new Error('IPv6 groups are 1 to 4 hexadecimal digits (0-9, a-f).');
    return groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
  }

  const groupsOf = n => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(16 * (7 - i))) & 0xffffn));
  const v6expanded = n => groupsOf(n).map(g => g.toString(16).padStart(4, '0')).join(':');

  // RFC 5952 compressed form
  function v6compressed(n) {
    if (n >> 32n === 0xffffn) return '::ffff:' + v4str(Number(n & 0xffffffffn));   // IPv4-mapped keeps dotted form
    const g = groupsOf(n);
    let bestStart = -1, bestLen = 0;
    for (let i = 0; i < 8;) {
      if (g[i] !== 0) { i++; continue; }
      let j = i;
      while (j < 8 && g[j] === 0) j++;
      if (j - i > bestLen && j - i >= 2) { bestStart = i; bestLen = j - i; }
      i = j;
    }
    const hex = g.map(x => x.toString(16));
    if (bestStart < 0) return hex.join(':');
    return hex.slice(0, bestStart).join(':') + '::' + hex.slice(bestStart + bestLen).join(':');
  }

  const MAX128 = (1n << 128n) - 1n;
  const mask6 = p => (p === 0 ? 0n : (MAX128 << BigInt(128 - p)) & MAX128);

  const V6_TYPES = [
    ['::1/128', 'Loopback'], ['::/128', 'Unspecified'], ['::ffff:0:0/96', 'IPv4-mapped'], ['64:ff9b::/96', 'IPv4/IPv6 translation (NAT64)'],
    ['2001:db8::/32', 'Documentation'], ['2002::/16', '6to4'], ['2001::/32', 'Teredo'], ['fc00::/7', 'Unique local (private, ULA)'],
    ['fe80::/10', 'Link-local'], ['ff00::/8', 'Multicast'], ['2000::/3', 'Global unicast (public)'],
  ].map(([c, label]) => { const [a, p] = c.split('/'); return { net: parseV6(a), prefix: +p, label }; });

  function v6Type(ip) {
    for (const t of V6_TYPES) if ((ip & mask6(t.prefix)) === t.net) return t.label;
    return 'Reserved / unassigned';
  }

  function calcV6(ip, prefix) {
    const mask = mask6(prefix);
    const network = ip & mask;
    const last = network | (~mask & MAX128);
    return { version: 6, ip, prefix, network, last, total: 1n << BigInt(128 - prefix) };
  }

  // ── Input parsing ──────────────────────────────────────────────────────────
  function parse(input) {
    const s = input.trim();
    if (!s) return null;
    let [addr, rest] = s.split(/\s*\/\s*|\s+/);
    if (rest === undefined && s.includes(' ')) rest = s.split(/\s+/)[1];
    const v4 = parseV4(addr);
    if (v4 !== null) {
      let prefix = 32;
      if (rest !== undefined && rest !== '') {
        if (/^\d{1,2}$/.test(rest)) { prefix = +rest; if (prefix > 32) throw new Error('An IPv4 prefix is between /0 and /32.'); }
        else {
          const m = parseV4(rest);
          if (m === null) throw new Error('After the address, give a prefix like /24 or a mask like 255.255.255.0.');
          prefix = prefixFromMask(m);
        }
      }
      return calcV4(v4, prefix);
    }
    const v6 = parseV6(addr);
    if (v6 !== null) {
      let prefix = 128;
      if (rest !== undefined && rest !== '') {
        if (!/^\d{1,3}$/.test(rest) || +rest > 128) throw new Error('An IPv6 prefix is between /0 and /128.');
        prefix = +rest;
      }
      return calcV6(v6, prefix);
    }
    throw new Error('Enter an IPv4 or IPv6 address, optionally with a prefix, e.g. 192.168.1.10/24 or 2001:db8::/48.');
  }

  function contains(r, ipText) {
    const s = ipText.trim();
    if (!s) return null;
    if (r.version === 4) {
      const ip = parseV4(s);
      if (ip === null) throw new Error('Enter an IPv4 address to check.');
      return ((ip & r.mask) >>> 0) === r.network;
    }
    const ip = parseV6(s);
    if (ip === null) throw new Error('Enter an IPv6 address to check.');
    return (ip & mask6(r.prefix)) === r.network;
  }

  function split(r, newPrefix, limit = 256) {
    if (newPrefix <= r.prefix) return { error: `Choose a prefix longer than /${r.prefix}.` };
    const count = r.version === 4 ? 2 ** (newPrefix - r.prefix) : 1n << BigInt(newPrefix - r.prefix);
    const list = [];
    if (r.version === 4) {
      const size = 2 ** (32 - newPrefix);
      for (let i = 0; i < Math.min(count, limit); i++) {
        const net = r.network + i * size;
        const c = calcV4(net, newPrefix);
        list.push({ cidr: `${v4str(net)}/${newPrefix}`, range: `${v4str(c.first)} – ${v4str(c.last)}`, hosts: c.usable.toLocaleString() });
      }
    } else {
      const size = 1n << BigInt(128 - newPrefix);
      const n = count < BigInt(limit) ? Number(count) : limit;
      for (let i = 0; i < n; i++) {
        const net = r.network + BigInt(i) * size;
        list.push({ cidr: `${v6compressed(net)}/${newPrefix}`, range: `${v6compressed(net)} – ${v6compressed(net + size - 1n)}`, hosts: '' });
      }
    }
    return { count, list };
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  let els, current = null;
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const big = n => (typeof n === 'bigint' ? (n > 10n ** 15n ? `2^${n.toString(2).length - 1}` + (n.toString(2).length - 1 <= 128 ? ` (${n.toLocaleString()})` : '') : n.toLocaleString()) : n.toLocaleString());

  function rows(pairs) {
    return pairs.map(([k, v, copy]) => `<tr><th>${k}</th><td class="val"><code>${escapeHtml(v)}</code></td><td>${copy === false ? '' : `<button type="button" class="mini-btn" data-copy="${escapeHtml(v)}">Copy</button>`}</td></tr>`).join('');
  }

  function render() {
    els.error.hidden = true;
    try { current = parse(els.input.value); }
    catch (e) { current = null; els.error.textContent = e.message; els.error.hidden = false; }
    if (!current) { els.table.innerHTML = ''; els.splitWrap.hidden = true; els.checkResult.textContent = ''; return; }
    const r = current;
    if (r.version === 4) {
      els.table.innerHTML = rows([
        ['CIDR notation', `${v4str(r.network)}/${r.prefix}`],
        ['Address', v4str(r.ip)],
        ['Subnet mask', v4str(r.mask)],
        ['Wildcard mask', v4str(r.wildcard)],
        ['Network address', v4str(r.network)],
        ['Broadcast address', r.prefix >= 31 ? 'None (/' + r.prefix + ')' : v4str(r.broadcast), r.prefix < 31],
        ['Usable host range', `${v4str(r.first)} – ${v4str(r.last)}`],
        ['Usable hosts', r.usable.toLocaleString() + (r.prefix === 31 ? ' (point-to-point link, RFC 3021)' : ''), false],
        ['Total addresses', r.total.toLocaleString(), false],
        ['Address type', v4Type(r.ip), false],
        ['Class (historical)', v4Class(r.ip), false],
        ['Address in binary', bin32(r.ip)],
        ['Mask in binary', bin32(r.mask)],
        ['Address as integer', String(r.ip)],
        ['Address in hex', '0x' + r.ip.toString(16).padStart(8, '0').toUpperCase()],
        ['Reverse DNS zone', `${v4str(r.ip).split('.').reverse().slice(4 - Math.max(1, Math.floor(r.prefix / 8))).join('.')}.in-addr.arpa`],
      ]);
    } else {
      els.table.innerHTML = rows([
        ['CIDR notation', `${v6compressed(r.network)}/${r.prefix}`],
        ['Address (compressed)', v6compressed(r.ip)],
        ['Address (expanded)', v6expanded(r.ip)],
        ['Network', v6compressed(r.network)],
        ['First address', v6compressed(r.network)],
        ['Last address', v6compressed(r.last)],
        ['Addresses in range', big(r.total), false],
        ['/64 subnets in range', r.prefix <= 64 ? big(1n << BigInt(64 - r.prefix)) : 'Less than one /64', false],
        ['Address type', v6Type(r.ip), false],
      ]);
    }
    const max = r.version === 4 ? 32 : 128;
    els.splitWrap.hidden = r.prefix >= max;
    if (r.prefix < max) {
      const opts = [];
      for (let p = r.prefix + 1; p <= Math.min(max, r.prefix + (r.version === 4 ? 16 : 32)); p++) opts.push(p);
      const keep = +els.splitPrefix.value;
      els.splitPrefix.innerHTML = opts.map(p => `<option value="${p}">/${p}</option>`).join('');
      els.splitPrefix.value = opts.includes(keep) ? keep : Math.min(max, r.version === 4 ? Math.min(r.prefix + 2, 32) : (r.prefix < 64 ? 64 : r.prefix + 4));
      renderSplit();
    }
    renderCheck();
  }

  function renderSplit() {
    if (!current) return;
    const s = split(current, +els.splitPrefix.value);
    if (s.error) { els.splitBody.innerHTML = `<tr><td colspan="3">${s.error}</td></tr>`; return; }
    els.splitCount.textContent = `${big(s.count)} subnet${s.count == 1 ? '' : 's'}${(typeof s.count === 'bigint' ? s.count > 256n : s.count > 256) ? ', showing the first 256' : ''}`;
    els.splitBody.innerHTML = s.list.map(x => `<tr><td class="val"><code>${x.cidr}</code></td><td class="val"><code>${x.range}</code></td><td>${x.hosts}</td></tr>`).join('');
  }

  function renderCheck() {
    if (!current || !els.check.value.trim()) { els.checkResult.textContent = ''; els.checkResult.className = 'badge'; return; }
    try {
      const inside = contains(current, els.check.value);
      els.checkResult.textContent = inside ? 'Inside this range' : 'Outside this range';
      els.checkResult.className = 'badge ' + (inside ? 'ok' : 'bad');
    } catch (e) { els.checkResult.textContent = e.message; els.checkResult.className = 'badge warn'; }
  }

  function init() {
    els = {
      input: $('cidrInput'), error: $('cidrError'), table: $('cidrTable'), splitWrap: $('cidrSplit'), splitPrefix: $('cidrSplitPrefix'),
      splitBody: $('cidrSplitBody'), splitCount: $('cidrSplitCount'), check: $('cidrCheck'), checkResult: $('cidrCheckResult'),
    };
    if (!els.input) return;
    const fromHash = decodeURIComponent(location.hash.slice(1));
    let saved = null;
    try { saved = localStorage.getItem('jxe.cidr'); } catch (_) { /* ignore */ }
    els.input.value = fromHash || saved || '192.168.1.10/24';
    els.input.addEventListener('input', () => { try { localStorage.setItem('jxe.cidr', els.input.value); } catch (_) { /* ignore */ } render(); });
    els.splitPrefix.addEventListener('change', renderSplit);
    els.check.addEventListener('input', renderCheck);
    document.querySelectorAll('[data-cidr]').forEach(b => b.addEventListener('click', () => { els.input.value = b.dataset.cidr; render(); }));
    document.addEventListener('click', e => {
      const c = e.target.closest('[data-copy]');
      if (c) navigator.clipboard.writeText(c.dataset.copy).then(() => { const t = c.textContent; c.textContent = 'Copied'; setTimeout(() => { c.textContent = t; }, 1200); });
    });
    render();
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { parse, parseV6, v6compressed, v6expanded, v4str, split, contains, v4Type, v6Type };
})();
