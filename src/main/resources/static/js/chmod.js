/* ============================================================
   chmod.js - Unix file permission calculator: checkboxes, octal
   (755), symbolic (rwxr-xr-x) and u=rwx,g=rx,o=rx forms, special
   bits, and a umask calculator.
   ============================================================ */

'use strict';

const ChmodTool = (() => {
  // mode is a 12-bit number: special (setuid 4, setgid 2, sticky 1) then user, group, other
  function fromOctal(s) {
    const t = s.trim().replace(/^0o?/i, '') || '0';
    if (!/^[0-7]{1,4}$/.test(t)) throw new Error('Octal permissions use 3 or 4 digits from 0 to 7, e.g. 755 or 2775.');
    return parseInt(t, 8);
  }

  function fromSymbolic(s) {
    let t = s.trim().replace(/[.+@]$/, '');                                  // SELinux / ACL markers
    if (/^[-dlcbps]/.test(t) && t.length === 10) t = t.slice(1);            // ls -l output with file type
    if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(t)) throw new Error('Symbolic permissions look like rwxr-xr-x (9 characters, optionally after the file type from ls -l).');
    let mode = 0;
    const bits = [[0, 0o400], [1, 0o200], [3, 0o040], [4, 0o020], [6, 0o004], [7, 0o002]];
    for (const [i, b] of bits) if (t[i] !== '-') mode |= b;
    const x = (ch, exec, special) => { if (ch === 'x' || ch === 's' || ch === 't') mode |= exec; if (ch === 's' || ch === 'S' || ch === 't' || ch === 'T') mode |= special; };
    x(t[2], 0o100, 0o4000); x(t[5], 0o010, 0o2000); x(t[8], 0o001, 0o1000);
    return mode;
  }

  function toSymbolic(mode) {
    const r = (b, c) => (mode & b ? c : '-');
    const ex = (xb, sb, on, off) => (mode & sb ? (mode & xb ? on : off) : (mode & xb ? 'x' : '-'));
    return r(0o400, 'r') + r(0o200, 'w') + ex(0o100, 0o4000, 's', 'S') +
           r(0o040, 'r') + r(0o020, 'w') + ex(0o010, 0o2000, 's', 'S') +
           r(0o004, 'r') + r(0o002, 'w') + ex(0o001, 0o1000, 't', 'T');
  }

  function toEquals(mode) {
    const who = [['u', 6], ['g', 3], ['o', 0]].map(([w, shift]) => {
      const v = (mode >> shift) & 7;
      let p = (v & 4 ? 'r' : '') + (v & 2 ? 'w' : '') + (v & 1 ? 'x' : '');
      if (w === 'u' && mode & 0o4000) p += 's';
      if (w === 'g' && mode & 0o2000) p += 's';
      if (w === 'o' && mode & 0o1000) p += 't';
      return `${w}=${p}`;
    });
    return who.join(',');
  }

  const toOctal = mode => (mode > 0o777 ? mode.toString(8).padStart(4, '0') : mode.toString(8).padStart(3, '0'));

  function describe(mode) {
    const perms = v => {
      const list = [v & 4 && 'read', v & 2 && 'write', v & 1 && 'execute'].filter(Boolean);
      return list.length ? list.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'nothing';
    };
    const lines = [
      `Owner can ${perms((mode >> 6) & 7)}.`,
      `Group can ${perms((mode >> 3) & 7)}.`,
      `Everyone else can ${perms(mode & 7)}.`,
    ];
    if (mode & 0o4000) lines.push('Setuid: the program runs with the owner\'s privileges.' + (mode & 0o100 ? '' : ' (Capital S: setuid is set but the owner can\'t execute, which is usually a mistake.)'));
    if (mode & 0o2000) lines.push('Setgid: runs with the group\'s privileges; on a directory, new files inherit the directory\'s group.');
    if (mode & 0o1000) lines.push('Sticky bit: in a shared directory, only a file\'s owner can delete or rename it (like /tmp).');
    return lines;
  }

  function warnings(mode) {
    const w = [];
    if (mode & 0o002) w.push('Anyone on the system can modify this. World-writable files are a common security hole; 777 is almost never the right fix.');
    if ((mode & 0o4000) && (mode & 0o002)) w.push('Setuid on a world-writable file lets any user run modified code as the owner.');
    return w;
  }

  // ── umask ──────────────────────────────────────────────────────────────────
  function umask(s) {
    const m = fromOctal(s) & 0o777;
    return { files: 0o666 & ~m, dirs: 0o777 & ~m };
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  let els, mode = 0o755, lock = false;

  function render(source) {
    lock = true;
    document.querySelectorAll('[data-bit]').forEach(c => { c.checked = !!(mode & parseInt(c.dataset.bit, 8)); });
    if (source !== 'octal') { els.octal.value = toOctal(mode); els.octal.classList.remove('invalid'); }
    if (source !== 'symbolic') { els.symbolic.value = toSymbolic(mode); els.symbolic.classList.remove('invalid'); }
    lock = false;
    const file = els.file.value.trim() || 'file';
    const q = /[\s'"$`\\]/.test(file) ? `'${file.replace(/'/g, "'\\''")}'` : file;
    els.cmdOctal.textContent = `chmod ${toOctal(mode)} ${q}`;
    els.cmdSymbolic.textContent = `chmod ${toEquals(mode)} ${q}`;
    els.cmdRecursive.textContent = `find ${q} -type d -exec chmod ${toOctal(mode | ((mode & 0o444) >> 2))} {} + && find ${q} -type f -exec chmod ${toOctal(mode)} {} +`;
    els.ls.textContent = '-' + toSymbolic(mode);
    els.desc.innerHTML = describe(mode).map(l => `<li>${l}</li>`).join('');
    const w = warnings(mode);
    els.warn.hidden = !w.length;
    els.warn.textContent = w.join(' ');
    try { localStorage.setItem('jxe.chmod', String(mode)); } catch (_) { /* ignore */ }
  }

  function renderUmask() {
    try {
      const r = umask(els.umask.value);
      els.umask.classList.remove('invalid');
      els.umaskOut.innerHTML = `New files: <code>${toOctal(r.files)}</code> (<code>-${toSymbolic(r.files)}</code>) · New directories: <code>${toOctal(r.dirs)}</code> (<code>d${toSymbolic(r.dirs)}</code>)`;
    } catch (e) { els.umask.classList.add('invalid'); els.umaskOut.textContent = e.message; }
  }

  function init() {
    els = {
      octal: $('chmodOctal'), symbolic: $('chmodSymbolic'), error: $('chmodError'), file: $('chmodFile'), cmdOctal: $('chmodCmd'), cmdSymbolic: $('chmodCmdSym'),
      cmdRecursive: $('chmodCmdRec'), ls: $('chmodLs'), desc: $('chmodDesc'), warn: $('chmodWarn'), umask: $('chmodUmask'), umaskOut: $('chmodUmaskOut'),
    };
    if (!els.octal) return;
    try { const s = localStorage.getItem('jxe.chmod'); if (s !== null && !Number.isNaN(+s)) mode = +s; } catch (_) { /* ignore */ }
    const fromHash = location.hash.slice(1);
    if (/^[0-7]{3,4}$/.test(fromHash)) mode = parseInt(fromHash, 8);

    document.querySelectorAll('[data-bit]').forEach(c => c.addEventListener('change', () => {
      const b = parseInt(c.dataset.bit, 8);
      mode = c.checked ? mode | b : mode & ~b;
      render('checkbox');
    }));
    const tryParse = (el, fn, src) => el.addEventListener('input', () => {
      if (lock) return;
      try { mode = fn(el.value); el.classList.remove('invalid'); els.error.hidden = true; render(src); }
      catch (e) { el.classList.add('invalid'); els.error.textContent = e.message; els.error.hidden = false; }
    });
    tryParse(els.octal, fromOctal, 'octal');
    tryParse(els.symbolic, fromSymbolic, 'symbolic');
    els.file.addEventListener('input', () => render('file'));
    els.umask.addEventListener('input', renderUmask);
    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { mode = parseInt(b.dataset.preset, 8); els.error.hidden = true; render(); }));
    document.querySelectorAll('[data-copy-el]').forEach(b => b.addEventListener('click', () => {
      navigator.clipboard.writeText($(b.dataset.copyEl).textContent).then(() => { const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1200); });
    }));
    render();
    renderUmask();
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { fromOctal, fromSymbolic, toSymbolic, toEquals, toOctal, umask };
})();
