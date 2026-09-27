/* ============================================================
   password.js - Password and passphrase generator with an
   entropy-based strength estimate. Uses crypto.getRandomValues
   with rejection sampling, so every character is equally likely.
   Passphrases use the EFF large wordlist (js/vendor/eff-wordlist.js).
   ============================================================ */

'use strict';

const PasswordTool = (() => {
  const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!#$%&*+-=?@^_~()[]{}<>.,:;/|',
  };
  const AMBIGUOUS = 'Il1O0o|`\'"';

  // Uniform random integer in [0, n)
  function randInt(n) {
    if (n <= 0) throw new Error('empty range');
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pools(o) {
    const strip = s => [...s].filter(c => !(o.noAmbiguous && AMBIGUOUS.includes(c)) && !o.exclude.includes(c)).join('');
    return ['upper', 'lower', 'digits', 'symbols'].filter(k => o[k]).map(k => strip(SETS[k])).filter(Boolean);
  }

  function password(o) {
    const sets = pools(o);
    if (!sets.length) throw new Error('Choose at least one kind of character.');
    const all = [...new Set(sets.join(''))].join('');
    if (o.length < sets.length) throw new Error(`Use a length of at least ${sets.length} to include every chosen kind.`);
    // one from each chosen set, the rest from everything, then shuffle
    const chars = sets.map(s => s[randInt(s.length)]);
    while (chars.length < o.length) chars.push(all[randInt(all.length)]);
    return { value: shuffle(chars).join(''), bits: o.length * Math.log2(all.length), pool: all.length };
  }

  function passphrase(o) {
    const words = window.EFF_WORDS;
    if (!words) throw new Error('The word list is still loading.');
    const picked = Array.from({ length: o.words }, () => words[randInt(words.length)]);
    let list = o.capitalize ? picked.map(w => w[0].toUpperCase() + w.slice(1)) : picked;
    let bits = o.words * Math.log2(words.length);
    if (o.addNumber) {
      const i = randInt(list.length);
      list = list.map((w, j) => (j === i ? w + randInt(10) : w));
      bits += Math.log2(10 * list.length);
    }
    return { value: list.join(o.separator), bits, pool: words.length };
  }

  // Rough time to crack for an attacker who knows exactly how the password was made
  function strength(bits) {
    const guessesPerSec = 1e11;                // a large GPU cluster against a fast hash
    const seconds = 2 ** (bits - 1) / guessesPerSec;
    const units = [['second', 60], ['minute', 60], ['hour', 24], ['day', 365], ['year', 1000], ['thousand years', 1000], ['million years', 1000], ['billion years', Infinity]];
    let v = seconds, label = 'second';
    for (const [name, size] of units) {
      label = name;
      if (v < size) break;
      v /= size;
    }
    const time = seconds < 1 ? 'instantly' : v >= 1000 && label === 'billion years' ? 'longer than the age of the universe' : `about ${Math.round(v).toLocaleString()} ${label}${Math.round(v) === 1 || label.includes('years') ? '' : 's'}`;
    const level = bits < 40 ? ['Very weak', 0] : bits < 60 ? ['Weak', 1] : bits < 80 ? ['Good', 2] : bits < 100 ? ['Strong', 3] : ['Very strong', 4];
    return { label: level[0], level: level[1], time };
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.password';
  let els, mode = 'password', wordsLoading = null;

  function opts() {
    return {
      length: +els.length.value, upper: els.upper.checked, lower: els.lower.checked, digits: els.digits.checked, symbols: els.symbols.checked,
      noAmbiguous: els.noAmbiguous.checked, exclude: els.exclude.value,
      words: +els.words.value, separator: els.separator.value === 'space' ? ' ' : els.separator.value, capitalize: els.capitalize.checked, addNumber: els.addNumber.checked,
      count: Math.max(1, Math.min(50, +els.count.value || 1)),
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        mode, length: els.length.value, upper: els.upper.checked, lower: els.lower.checked, digits: els.digits.checked, symbols: els.symbols.checked,
        noAmbiguous: els.noAmbiguous.checked, exclude: els.exclude.value, words: els.words.value, separator: els.separator.value,
        capitalize: els.capitalize.checked, addNumber: els.addNumber.checked, count: els.count.value,
      }));
    } catch (_) { /* ignore */ }
  }

  function loadWords() {
    if (window.EFF_WORDS) return Promise.resolve();
    if (!wordsLoading) {
      wordsLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/js/vendor/eff-wordlist.js?v=1';
        s.onload = resolve;
        s.onerror = () => { wordsLoading = null; reject(new Error('Could not load the word list. Check your connection and try again.')); };
        document.head.append(s);
      });
    }
    return wordsLoading;
  }

  const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function colorize(pw) {
    return [...pw].map(c => {
      const cls = /[0-9]/.test(c) ? 'pw-d' : /[A-Za-z]/.test(c) ? '' : c === ' ' ? 'pw-sp' : 'pw-s';
      return cls ? `<span class="${cls}">${escapeHtml(c)}</span>` : escapeHtml(c);
    }).join('');
  }

  async function generate() {
    const o = opts();
    save();
    els.lengthOut.textContent = o.length;
    els.wordsOut.textContent = o.words;
    els.error.hidden = true;
    if (mode === 'passphrase') {
      try { await loadWords(); }
      catch (e) { showError(e.message); return; }
    }
    let list;
    try {
      list = Array.from({ length: o.count }, () => (mode === 'password' ? password(o) : passphrase(o)));
    } catch (e) { showError(e.message); return; }

    const first = list[0];
    els.main.innerHTML = colorize(first.value);
    els.main.dataset.value = first.value;
    const s = strength(first.bits);
    els.meter.dataset.level = s.level;
    els.strength.textContent = s.label;
    els.entropy.textContent = `${Math.round(first.bits)} bits of entropy · ${mode === 'password' ? `${first.pool} possible characters` : `${first.pool.toLocaleString()} possible words`}`;
    els.crack.textContent = `Guessing it would take ${s.time} at 100 billion guesses per second.`;
    els.more.hidden = o.count < 2;
    els.list.innerHTML = list.slice(1).map(p => `<li><code>${colorize(p.value)}</code><button type="button" class="mini-btn" data-pw="${escapeHtml(p.value)}">Copy</button></li>`).join('');
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = false;
    els.main.textContent = '';
    delete els.main.dataset.value;
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('[data-pw-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pwMode === m)));
    els.pwOpts.hidden = m !== 'password';
    els.ppOpts.hidden = m !== 'passphrase';
    generate();
  }

  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const t = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = t; }, 1200);
    });
  }

  function init() {
    els = {
      main: $('pwMain'), meter: $('pwMeter'), strength: $('pwStrength'), entropy: $('pwEntropy'), crack: $('pwCrack'), error: $('pwError'),
      length: $('pwLength'), lengthOut: $('pwLengthOut'), upper: $('pwUpper'), lower: $('pwLower'), digits: $('pwDigits'), symbols: $('pwSymbols'),
      noAmbiguous: $('pwNoAmbiguous'), exclude: $('pwExclude'), words: $('ppWords'), wordsOut: $('ppWordsOut'), separator: $('ppSeparator'),
      capitalize: $('ppCapitalize'), addNumber: $('ppNumber'), count: $('pwCount'), list: $('pwList'), more: $('pwMore'),
      pwOpts: $('pwOptions'), ppOpts: $('ppOptions'),
    };
    if (!els.main) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (_) { /* ignore */ }
    if (saved) {
      ['length', 'exclude', 'words', 'separator', 'count'].forEach(k => { if (saved[k] !== undefined) els[k].value = saved[k]; });
      ['upper', 'lower', 'digits', 'symbols', 'noAmbiguous', 'capitalize'].forEach(k => { if (saved[k] !== undefined) els[k].checked = saved[k]; });
      if (saved.addNumber !== undefined) els.addNumber.checked = saved.addNumber;
    }

    document.querySelectorAll('.pw-controls input, .pw-controls select').forEach(i => i.addEventListener('input', generate));
    document.querySelectorAll('[data-pw-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.pwMode)));
    $('pwRegenerate').addEventListener('click', generate);
    $('pwCopy').addEventListener('click', e => { if (els.main.dataset.value) copy(els.main.dataset.value, e.target); });
    els.list.addEventListener('click', e => { const b = e.target.closest('[data-pw]'); if (b) copy(b.dataset.pw, b); });
    const start = location.hash === '#passphrase' ? 'passphrase' : (saved && saved.mode) || 'password';
    setMode(start);
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { password, strength, randInt };
})();
