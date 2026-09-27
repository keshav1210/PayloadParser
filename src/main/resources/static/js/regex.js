/* ============================================================
   regex.js - Regex tester: live matches, replace, explanation
   and code snippets. Matching runs in a Web Worker with a time
   limit, so a runaway pattern can't freeze the page.
   ============================================================ */

'use strict';

const RegexTool = (() => {
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.regex';
  const TIMEOUT_MS = 1500;
  const MAX_MATCHES = 1000;

  const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── Worker ─────────────────────────────────────────────────────────────────
  const WORKER_SRC = `
    self.onmessage = e => {
      const { id, pattern, flags, text, replacement, max } = e.data;
      let re;
      try { re = new RegExp(pattern, flags); }
      catch (err) { self.postMessage({ id, error: err.message }); return; }
      const matches = [];
      let truncated = false;
      if (re.global || re.sticky) {
        for (const m of text.matchAll(re.global ? re : new RegExp(pattern, flags + 'g'))) {
          if (matches.length >= max) { truncated = true; break; }
          matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
          if (!re.global) break;
        }
      } else {
        const m = re.exec(text);
        if (m) matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
      }
      let replaced = null;
      if (replacement !== null) replaced = text.replace(re, replacement);
      self.postMessage({ id, matches, truncated, replaced });
    };`;

  let worker = null, jobId = 0, timer = null;

  function getWorker() {
    if (!worker) worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    return worker;
  }

  function run(pattern, flags, text, replacement) {
    return new Promise(resolve => {
      const id = ++jobId;
      const w = getWorker();
      clearTimeout(timer);
      timer = setTimeout(() => {
        w.terminate();
        worker = null;
        resolve({ id, timeout: true });
      }, TIMEOUT_MS);
      w.onmessage = e => {
        if (e.data.id !== jobId) return;      // an older job
        clearTimeout(timer);
        resolve(e.data);
      };
      w.postMessage({ id, pattern, flags, text, replacement, max: MAX_MATCHES });
    });
  }

  // ── Explanation ────────────────────────────────────────────────────────────
  const ESCAPES = {
    d: 'a digit (0-9)', D: 'any character that is not a digit',
    w: 'a word character (letter, digit or _)', W: 'any character that is not a word character',
    s: 'a whitespace character (space, tab, line break…)', S: 'any character that is not whitespace',
    b: 'a word boundary', B: 'a position that is not a word boundary',
    t: 'a tab', n: 'a line feed (new line)', r: 'a carriage return', f: 'a form feed', v: 'a vertical tab',
    0: 'the NUL character',
  };

  function describeClassBody(body) {
    const parts = [];
    let i = 0;
    while (i < body.length) {
      let item;
      if (body[i] === '\\') {
        const n = body[i + 1];
        item = ESCAPES[n] ? ESCAPES[n].replace(/^an? /, '') : `“${n}”`;
        i += 2;
      } else {
        item = body[i];
        i++;
      }
      if (body[i] === '-' && i + 1 < body.length && body[i + 1] !== ']') {
        const to = body[i + 1] === '\\' ? body.slice(i + 1, i + 3) : body[i + 1];
        parts.push(`${item} to ${to}`);
        i += 1 + to.length;
      } else {
        parts.push(item.length === 1 ? `“${item}”` : item);
      }
    }
    return parts.join(', ');
  }

  function quantifierText(q) {
    const lazy = q.endsWith('?') && q.length > 1;
    const core = lazy ? q.slice(0, -1) : q;
    let base;
    if (core === '*') base = 'zero or more times';
    else if (core === '+') base = 'one or more times';
    else if (core === '?') base = 'optional (zero or one time)';
    else {
      const m = core.match(/^\{(\d+)(,(\d*))?\}$/);
      if (!m[2]) base = `exactly ${m[1]} time${m[1] === '1' ? '' : 's'}`;
      else if (m[3] === '') base = `${m[1]} or more times`;
      else base = `between ${m[1]} and ${m[3]} times`;
    }
    if (core === '?' || /^\{\d+\}$/.test(core)) return lazy ? base + ' (lazy)' : base;
    return base + (lazy ? ', as few as possible (lazy)' : ', as many as possible (greedy)');
  }

  function explain(pattern, flags) {
    const rows = [];
    let depth = 0, groupNo = 0, i = 0;
    const push = (token, text) => rows.push({ depth, token, text });
    const quantAt = j => {
      const rest = pattern.slice(j);
      const m = rest.match(/^(\*|\+|\?|\{\d+(,\d*)?\})\??/);
      return m ? m[0] : null;
    };

    while (i < pattern.length) {
      const c = pattern[i];
      if (c === '\\') {
        const n = pattern[i + 1] || '';
        let tok = '\\' + n, text;
        if (ESCAPES[n]) text = ESCAPES[n].charAt(0).toUpperCase() + ESCAPES[n].slice(1);
        else if (/[1-9]/.test(n)) { tok = pattern.slice(i).match(/^\\\d+/)[0]; text = `The same text that group ${tok.slice(1)} matched`; }
        else if (n === 'k' && pattern[i + 2] === '<') { tok = pattern.slice(i).match(/^\\k<[^>]*>/)?.[0] || tok; text = `The same text that the group “${tok.slice(3, -1)}” matched`; }
        else if (n === 'u' && pattern[i + 2] === '{') { tok = pattern.slice(i).match(/^\\u\{[0-9a-fA-F]+\}/)?.[0] || tok; text = `The character U+${tok.slice(3, -1).toUpperCase()}`; }
        else if (n === 'u') { tok = pattern.slice(i, i + 6); text = `The character U+${tok.slice(2).toUpperCase()}`; }
        else if (n === 'x') { tok = pattern.slice(i, i + 4); text = `The character with code 0x${tok.slice(2).toUpperCase()}`; }
        else if ((n === 'p' || n === 'P') && pattern[i + 2] === '{') {
          tok = pattern.slice(i).match(/^\\[pP]\{[^}]*\}/)?.[0] || tok;
          text = `${n === 'P' ? 'Any character without' : 'A character with'} the Unicode property ${tok.slice(3, -1)}`;
        }
        else if (n === 'c') { tok = pattern.slice(i, i + 3); text = `Control character Ctrl+${tok[2]}`; }
        else text = `The character “${n}” (escaped)`;
        push(tok, text);
        i += tok.length;
      } else if (c === '[') {
        let j = i + 1;
        const negated = pattern[j] === '^';
        if (negated) j++;
        while (j < pattern.length && pattern[j] !== ']') j += pattern[j] === '\\' ? 2 : 1;
        const tok = pattern.slice(i, j + 1);
        const body = pattern.slice(i + (negated ? 2 : 1), j);
        push(tok, body ? `${negated ? 'Any character except' : 'One character from'}: ${describeClassBody(body)}` : (negated ? 'Any character' : 'Nothing (empty set)'));
        i = j + 1;
      } else if (c === '(') {
        const rest = pattern.slice(i);
        let tok, text;
        if (rest.startsWith('(?:')) { tok = '(?:'; text = 'Start of a group that is not captured'; }
        else if (rest.startsWith('(?=')) { tok = '(?='; text = 'Lookahead: the text that follows must match…'; }
        else if (rest.startsWith('(?!')) { tok = '(?!'; text = 'Negative lookahead: the text that follows must not match…'; }
        else if (rest.startsWith('(?<=')) { tok = '(?<='; text = 'Lookbehind: the text just before must match…'; }
        else if (rest.startsWith('(?<!')) { tok = '(?<!'; text = 'Negative lookbehind: the text just before must not match…'; }
        else if (/^\(\?<[A-Za-z_$][\w$]*>/.test(rest)) {
          tok = rest.match(/^\(\?<[^>]+>/)[0];
          groupNo++;
          text = `Start of capturing group ${groupNo}, named “${tok.slice(3, -1)}”`;
        } else { tok = '('; groupNo++; text = `Start of capturing group ${groupNo}`; }
        push(tok, text);
        depth++;
        i += tok.length;
        continue;
      } else if (c === ')') {
        depth = Math.max(0, depth - 1);
        push(')', 'End of the group');
        i++;
      } else if (c === '|') {
        push('|', 'OR: otherwise try the alternative that follows');
        i++;
      } else if (c === '^') {
        push('^', flags.includes('m') ? 'Start of a line' : 'Start of the text');
        i++;
      } else if (c === '$') {
        push('$', flags.includes('m') ? 'End of a line' : 'End of the text');
        i++;
      } else if (c === '.') {
        push('.', flags.includes('s') ? 'Any character, including line breaks' : 'Any character except a line break');
        i++;
      } else if (quantAt(i)) {
        const q = quantAt(i);
        push(q, 'The previous item, ' + quantifierText(q));
        i += q.length;
        continue;
      } else {
        // Run of literal characters; a quantifier applies only to the last one
        let j = i;
        while (j < pattern.length && !'\\[]()|^$.*+?{'.includes(pattern[j])) j++;
        if (pattern[j] === '{' && !quantAt(j)) j++;
        if (j === i) j = i + 1;
        if (j - i > 1 && quantAt(j)) j--;
        const lit = pattern.slice(i, j);
        push(lit, lit.length === 1 ? `The character “${lit}”` : `The text “${lit}”`);
        i = j;
      }
      // quantifier directly after an item
      const q = quantAt(i);
      if (q) {
        push(q, 'The previous item, ' + quantifierText(q));
        i += q.length;
      }
    }
    return rows;
  }

  // ── Code snippets ──────────────────────────────────────────────────────────
  const javaString = s => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

  function snippet(lang, pattern, flags) {
    const g = flags.includes('g');
    if (lang === 'js') {
      return `const re = /${pattern.replace(/\//g, '\\/')}/${flags};\n` + (g
        ? `for (const m of text.matchAll(re)) {\n  console.log(m[0], m.index${pattern.includes('(?<') ? ', m.groups' : ''});\n}`
        : `const m = re.exec(text);\nif (m) console.log(m[0], m.index);`);
    }
    if (lang === 'java') {
      const f = [];
      if (flags.includes('i')) f.push('Pattern.CASE_INSENSITIVE');
      if (flags.includes('m')) f.push('Pattern.MULTILINE');
      if (flags.includes('s')) f.push('Pattern.DOTALL');
      if (flags.includes('u')) f.push('Pattern.UNICODE_CASE');
      return `import java.util.regex.*;\n\nPattern pattern = Pattern.compile(${javaString(pattern)}${f.length ? ', ' + f.join(' | ') : ''});\nMatcher m = pattern.matcher(text);\n` +
        (g ? `while (m.find()) {\n    System.out.println(m.group() + " at " + m.start());\n}` : `if (m.find()) {\n    System.out.println(m.group() + " at " + m.start());\n}`);
    }
    if (lang === 'python') {
      const py = pattern.replace(/\(\?<([A-Za-z_]\w*)>/g, '(?P<$1>').replace(/\\k<([A-Za-z_]\w*)>/g, '(?P=$1)');
      const lit = py.includes("'") ? (py.includes('"') ? `'${py.replace(/'/g, "\\'")}'` : `r"${py}"`) : `r'${py}'`;
      const f = [];
      if (flags.includes('i')) f.push('re.IGNORECASE');
      if (flags.includes('m')) f.push('re.MULTILINE');
      if (flags.includes('s')) f.push('re.DOTALL');
      const fl = f.length ? ', ' + f.join(' | ') : '';
      return `import re\n\npattern = re.compile(${lit}${fl})\n` +
        (g ? `for m in pattern.finditer(text):\n    print(m.group(), m.start())` : `m = pattern.search(text)\nif m:\n    print(m.group(), m.start())`);
    }
    return '';
  }

  // ── Samples ────────────────────────────────────────────────────────────────
  const SAMPLES = {
    email:  { p: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', f: 'g', t: 'Write to support@example.com or sales.team@shop.co.uk.\nNot an email: user@localhost' },
    url:    { p: 'https?:\\/\\/[\\w.-]+(?:\\.[a-z]{2,})(?::\\d+)?(?:\\/[^\\s]*)?', f: 'gi', t: 'Docs: https://example.com/docs?page=2\nLocal: http://api.test.io:8080/v1/users\nNot a link: ftp://files.example.com' },
    ipv4:   { p: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', f: 'g', t: 'Server 192.168.1.20 talks to 10.0.0.255.\nInvalid: 256.1.1.1 and 1.2.3' },
    date:   { p: '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])', f: 'g', t: 'Released 2026-09-27, patched 2026-10-03.\nNot a date: 2026-13-45', r: '$<day>/$<month>/$<year>' },
    phone:  { p: '\\+?[1-9]\\d{0,2}[\\s-]?\\(?\\d{2,4}\\)?[\\s-]?\\d{3,4}[\\s-]?\\d{3,4}', f: 'g', t: 'Call +91 98765 43210 or +1 (555) 123-4567.\nOffice: 020 7946 0958' },
    hex:    { p: '#(?:[0-9a-fA-F]{3}){1,2}\\b', f: 'g', t: 'color: #2f6fed; background: #FFF; border: #12345z;' },
    uuid:   { p: '\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b', f: 'gi', t: 'id: 3f2504e0-4f89-41d3-9a0c-0305e82c3301\nv7:  01928c7e-5b3a-7cc2-9f1e-2a7d6c0b4e11\nbad: 3f2504e0-4f89-01d3-9a0c-0305e82c3301' },
    password: { p: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$', f: 'gm', t: 'password\nPassw0rd!\nSh0rt!\nCorrect-Horse-9' },
    html:   { p: '<([a-z][a-z0-9]*)\\b[^>]*>(.*?)<\\/\\1>', f: 'gi', t: '<p class="intro">Hello</p> <b>bold</b> <i>not closed</b>' },
    dupes:  { p: '\\b(\\w+)\\s+\\1\\b', f: 'gi', t: 'This is is a test of the the duplicate finder.', r: '$1' },
    trim:   { p: '^[ \\t]+|[ \\t]+$', f: 'gm', t: '   leading spaces\ntrailing spaces   \n\t tabs and spaces \t', r: '' },
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  let els, debounce = null, lastMatches = [];

  function flags() {
    return [...document.querySelectorAll('[data-flag]')].filter(c => c.checked).map(c => c.dataset.flag).join('');
  }

  function setFlags(f) {
    document.querySelectorAll('[data-flag]').forEach(c => { c.checked = f.includes(c.dataset.flag); });
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state())); } catch (_) { /* ignore */ }
  }

  function state() {
    return { p: els.pattern.value, f: flags(), t: els.text.value, r: els.replaceOn.checked ? els.replace.value : null };
  }

  function load(s) {
    els.pattern.value = s.p || '';
    setFlags(s.f || 'g');
    els.text.value = s.t || '';
    els.replaceOn.checked = s.r !== null && s.r !== undefined;
    els.replace.value = s.r || '';
    els.replaceWrap.hidden = !els.replaceOn.checked;
  }

  function highlight(matches) {
    const t = els.text.value;
    let html = '', pos = 0;
    matches.forEach((m, n) => {
      if (m.index < pos) return;
      html += escapeHtml(t.slice(pos, m.index));
      html += m.text ? `<mark class="${n % 2 ? 'alt' : ''}">${escapeHtml(m.text)}</mark>` : '<mark class="empty"></mark>';
      pos = m.index + m.text.length;
    });
    html += escapeHtml(t.slice(pos)) + '\n';
    els.backdrop.innerHTML = html;
    els.backdrop.scrollTop = els.text.scrollTop;
  }

  // Name of each capturing group by position (null when unnamed)
  function groupNames(pattern) {
    const names = [];
    let inClass = false;
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === '\\') { i++; continue; }
      if (inClass) { if (c === ']') inClass = false; continue; }
      if (c === '[') { inClass = true; continue; }
      if (c !== '(') continue;
      if (pattern[i + 1] !== '?') names.push(null);
      else {
        const m = pattern.slice(i).match(/^\(\?<([A-Za-z_$][\w$]*)>/);
        if (m) names.push(m[1]);
      }
    }
    return names;
  }

  function renderMatches(matches, truncated) {
    if (!matches.length) {
      els.matchBody.innerHTML = '';
      els.matchTable.hidden = true;
      return;
    }
    els.matchTable.hidden = false;
    const names = groupNames(els.pattern.value);
    els.matchBody.innerHTML = matches.slice(0, 300).map((m, n) => {
      const groups = m.groups.map((g, gi) => {
        const name = names[gi];
        return `<span class="rx-group"><b>${name ? escapeHtml(name) : gi + 1}</b> ${g === undefined ? '<i>not matched</i>' : escapeHtml(g) || '<i>empty</i>'}</span>`;
      }).join('');
      return `<tr><td>${n + 1}</td><td class="val">${m.text ? escapeHtml(m.text) : '<i>empty</i>'}</td><td>${m.index}–${m.index + m.text.length}</td><td>${groups || '<span class="muted">–</span>'}</td></tr>`;
    }).join('') + (matches.length > 300 || truncated ? `<tr><td colspan="4" class="muted">Showing the first ${Math.min(300, matches.length)} matches${truncated ? ` (matching stopped at ${MAX_MATCHES})` : ''}.</td></tr>` : '');
  }

  function renderExplain() {
    const rows = els.pattern.value ? explain(els.pattern.value, flags()) : [];
    els.explain.innerHTML = rows.length
      ? rows.map(r => `<li style="--d:${r.depth}"><code>${escapeHtml(r.token)}</code><span>${escapeHtml(r.text)}</span></li>`).join('')
      : '<li class="muted">Type a pattern to see what each part does.</li>';
  }

  function renderCode() {
    els.code.textContent = els.pattern.value ? snippet(els.codeLang.value, els.pattern.value, flags()) : '';
  }

  async function update() {
    save();
    renderExplain();
    renderCode();
    const pattern = els.pattern.value;
    const f = flags();
    els.slash.textContent = '/' + f;
    els.error.hidden = true;
    els.pattern.classList.remove('invalid');
    if (!pattern) {
      lastMatches = [];
      highlight([]);
      renderMatches([]);
      els.summary.textContent = 'Enter a pattern to start.';
      els.summary.className = 'summary';
      els.replaceOut.textContent = '';
      return;
    }
    const res = await run(pattern, f, els.text.value, els.replaceOn.checked ? els.replace.value : null);
    if (res.id !== jobId && !res.timeout) return;
    if (res.error || res.timeout) {
      els.pattern.classList.add('invalid');
      els.error.textContent = res.timeout
        ? `The pattern took longer than ${TIMEOUT_MS / 1000} seconds and was stopped. This usually means catastrophic backtracking: nested quantifiers such as (a+)+ or (.*)*. Make the repeated part more specific.`
        : res.error.replace(/^Invalid regular expression: /, '');
      els.error.hidden = false;
      els.summary.textContent = res.timeout ? 'Stopped: pattern too slow.' : 'The pattern has an error.';
      els.summary.className = 'summary bad';
      highlight([]);
      renderMatches([]);
      return;
    }
    lastMatches = res.matches;
    highlight(res.matches);
    renderMatches(res.matches, res.truncated);
    const n = res.matches.length;
    els.summary.textContent = n ? `${n}${res.truncated ? '+' : ''} match${n === 1 ? '' : 'es'}${!f.includes('g') && n ? ' (add the g flag to find all)' : ''}` : 'No matches.';
    els.summary.className = 'summary ' + (n ? 'ok' : 'warn');
    els.replaceOut.textContent = res.replaced ?? '';
  }

  function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(update, 120);
  }

  function toB64(s) { return btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromB64(s) { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); }

  function flash(btn, text) {
    const t = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = t; }, 1300);
  }

  function init() {
    els = {
      pattern: $('rxPattern'), slash: $('rxSlashFlags'), text: $('rxText'), backdrop: $('rxBackdrop'),
      replaceOn: $('rxReplaceOn'), replace: $('rxReplace'), replaceWrap: $('rxReplaceWrap'), replaceOut: $('rxReplaceOut'),
      summary: $('rxSummary'), error: $('rxError'), matchTable: $('rxMatches'), matchBody: $('rxMatchBody'),
      explain: $('rxExplain'), code: $('rxCode'), codeLang: $('rxCodeLang'),
    };
    if (!els.pattern) return;

    let initial = null;
    if (location.hash.length > 1) { try { initial = JSON.parse(fromB64(location.hash.slice(1))); } catch (_) { /* ignore */ } }
    if (!initial) { try { initial = JSON.parse(localStorage.getItem(STORE)); } catch (_) { /* ignore */ } }
    load(initial || { ...SAMPLES.date });

    [els.pattern, els.text, els.replace].forEach(e => e.addEventListener('input', schedule));
    document.querySelectorAll('[data-flag]').forEach(c => c.addEventListener('change', schedule));
    els.replaceOn.addEventListener('change', () => { els.replaceWrap.hidden = !els.replaceOn.checked; schedule(); });
    els.codeLang.addEventListener('change', renderCode);
    els.text.addEventListener('scroll', () => { els.backdrop.scrollTop = els.text.scrollTop; els.backdrop.scrollLeft = els.text.scrollLeft; });

    $('rxSamples').addEventListener('change', e => {
      const s = SAMPLES[e.target.value];
      if (s) load({ r: null, ...s });
      e.target.value = '';
      update();
    });
    $('rxClear').addEventListener('click', () => { load({ p: '', f: 'g', t: '', r: null }); update(); els.pattern.focus(); });
    $('rxShare').addEventListener('click', e => {
      const url = location.origin + location.pathname + '#' + toB64(JSON.stringify(state()));
      if (url.length > 8000) { flash(e.target, 'Too long to share'); return; }
      history.replaceState(null, '', url);
      navigator.clipboard.writeText(url).then(() => flash(e.target, 'Link copied'), () => flash(e.target, 'Copy failed'));
    });
    $('rxCopyCode').addEventListener('click', e => navigator.clipboard.writeText(els.code.textContent).then(() => flash(e.target, 'Copied')));
    $('rxCopyReplace').addEventListener('click', e => navigator.clipboard.writeText(els.replaceOut.textContent).then(() => flash(e.target, 'Copied')));
    $('rxCopyMatches').addEventListener('click', e => navigator.clipboard.writeText(lastMatches.map(m => m.text).join('\n')).then(() => flash(e.target, 'Copied')));

    update();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { explain, snippet };
})();
