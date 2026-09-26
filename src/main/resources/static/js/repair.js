/* ============================================================
   repair.js - tolerant repair for broken JSON and XML
   Runs entirely in the browser. Each repairer returns
   { text, fixes } where fixes is a list of what was changed.
   ============================================================ */

'use strict';

function makeFixLog() {
  const counts = new Map();
  return {
    add(msg) { counts.set(msg, (counts.get(msg) || 0) + 1); },
    list() { return [...counts].map(([m, c]) => (c > 1 ? `${m} (×${c})` : m)); },
  };
}

function stripCodeFence(text, log) {
  const m = text.match(/^\s*```[\w-]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/);
  if (m) { log.add('Removed Markdown code fence'); return m[1]; }
  return text;
}

/* ─────────────────────────────── JSON ─────────────────────────────── */
const JsonRepair = (() => {
  // opening quote → closing quote
  const QUOTES = {
    '"': '"', "'": "'", '`': '`',
    '\u201c': '\u201d', '\u201d': '\u201d',   // curly double quotes
    '\u2018': '\u2019', '\u2019': '\u2019',   // curly single quotes
  };
  const isQuote = c => c !== undefined && Object.prototype.hasOwnProperty.call(QUOTES, c);
  const isWs = c => /[\s\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/.test(c);
  const LITERALS = {
    true: 'true', false: 'false', null: 'null',
    True: 'true', TRUE: 'true', False: 'false', FALSE: 'false',
    None: 'null', NULL: 'null', Null: 'null', nil: 'null',
    undefined: 'null', NaN: 'null', Infinity: 'null', '-Infinity': 'null',
  };

  function repair(input) {
    const log = makeFixLog();
    let text = String(input).replace(/^\ufeff/, '');
    text = stripCodeFence(text, log);

    // JSONP: callback({...});
    const jsonp = text.match(/^\s*[A-Za-z_$][\w$.]*\s*\(([\s\S]*)\)\s*;?\s*$/);
    if (jsonp && /^\s*[{[]/.test(jsonp[1])) { text = jsonp[1]; log.add('Removed JSONP wrapper'); }

    // Text in front of the JSON, e.g. "Response: {...}" from a log line
    const first = text.search(/\S/);
    if (first >= 0 && !/[{["'`\u201c\u2018\d\-+./#]/.test(text[first]) && !/^\s*(true|false|null)\b/.test(text)) {
      const brace = text.search(/[{[]/);
      const prefix = brace > 0 ? text.slice(0, brace) : '';
      const looksLikeKey = /^\s*[A-Za-z_$][\w$-]*\s*:/.test(text);
      if (brace > 0 && !looksLikeKey && !/["'{}\[\]]/.test(prefix)) {
        text = text.slice(brace);
        log.add('Removed text before the JSON');
      }
    }

    const n = text.length;
    let i = 0;

    // ── helpers ──
    function skip() {
      for (;;) {
        while (i < n && isWs(text[i])) i++;
        if (text.startsWith('//', i)) {
          const e = text.indexOf('\n', i);
          i = e < 0 ? n : e + 1;
          log.add('Removed comments');
        } else if (text.startsWith('/*', i)) {
          const e = text.indexOf('*/', i + 2);
          i = e < 0 ? n : e + 2;
          log.add('Removed comments');
        } else if (text[i] === '#') {
          const e = text.indexOf('\n', i);
          i = e < 0 ? n : e + 1;
          log.add('Removed comments');
        } else {
          return;
        }
      }
    }

    // Is there a `key:` at the current position?
    function keyAhead() {
      const save = i;
      let ok = false;
      if (isQuote(text[i])) {
        const close = QUOTES[text[i]];
        let j = i + 1;
        while (j < n && text[j] !== close && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
        if (text[j] === close) {
          j++;
          while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
          ok = text[j] === ':';
        }
      } else {
        const m = /^[A-Za-z_$][\w$-]*[ \t]*:(?!\/\/)/.exec(text.slice(i, i + 256));
        ok = !!m && !(m[0].replace(/[\s:]/g, '') in LITERALS);
      }
      i = save;
      return ok;
    }

    function parseValue() {
      skip();
      if (i >= n) { log.add('Added missing values (null)'); return 'null'; }
      const c = text[i];
      if (c === '{') return parseObject(false);
      if (c === '[') return parseArray();
      if ((isQuote(c) || /[A-Za-z_$]/.test(c)) && keyAhead()) {
        // A "key": value where a value was expected → the opening brace is missing
        log.add('Added missing {');
        return parseObject(true);
      }
      if (isQuote(c)) return parseStringValue();
      if (/[-+.\d]/.test(c)) return parseNumber();
      return parseWord();
    }

    function parseObject(implicit) {
      if (!implicit) i++;
      const members = [];
      for (;;) {
        skip();
        if (i >= n) { log.add('Added missing }'); break; }
        const c = text[i];
        if (c === '}') { i++; break; }
        if (c === ']') { log.add('Added missing }'); break; }
        if (c === ',') { i++; log.add('Removed extra commas'); continue; }

        let key;
        if (isQuote(c)) {
          key = parseString(true);
        } else if (/[^\s:,{}\[\]]/.test(c)) {
          const m = /^[^\s:,{}\[\]"'`]+/.exec(text.slice(i, i + 512));
          if (!m) { i++; continue; }
          key = m[0];
          i += key.length;
          log.add('Added quotes around keys');
        } else {
          i++;
          log.add('Removed invalid characters');
          continue;
        }

        skip();
        if (text[i] === ':') i++;
        else if (text[i] === '=') { i++; log.add('Replaced = with :'); }
        else log.add('Added missing colons');
        skip();

        let value;
        const v = text[i];
        if (i >= n || v === ',' || v === '}' || v === ']') {
          value = 'null';
          log.add('Added missing values (null)');
        } else {
          value = parseValue();
        }
        members.push(JSON.stringify(key) + ':' + value);

        skip();
        if (text[i] === ',') {
          i++;
          skip();
          if (i >= n || text[i] === '}' || text[i] === ']') log.add('Removed trailing commas');
          continue;
        }
        if (i >= n || text[i] === '}' || text[i] === ']') continue;
        log.add('Added missing commas');
      }
      return '{' + members.join(',') + '}';
    }

    function parseArray() {
      i++;
      const items = [];
      for (;;) {
        skip();
        if (i >= n) { log.add('Added missing ]'); break; }
        const c = text[i];
        if (c === ']') { i++; break; }
        if (c === '}') { log.add('Added missing ]'); break; }
        if (c === ',') { i++; log.add('Removed extra commas'); continue; }
        items.push(parseValue());
        skip();
        if (text[i] === ',') {
          i++;
          skip();
          if (i >= n || text[i] === ']' || text[i] === '}') log.add('Removed trailing commas');
          continue;
        }
        if (i >= n || text[i] === ']' || text[i] === '}') continue;
        log.add('Added missing commas');
      }
      return '[' + items.join(',') + ']';
    }

    // Returns the decoded string content
    function parseString(isKey) {
      const open = text[i];
      const close = QUOTES[open];
      if (open === "'") log.add('Replaced single quotes with double quotes');
      else if (open === '`') log.add('Replaced backticks with double quotes');
      else if (open !== '"') log.add('Replaced curly quotes with straight quotes');
      i++;
      let s = '';
      for (;;) {
        if (i >= n) { log.add('Closed unterminated strings'); break; }
        const c = text[i];

        if (c === '\\') {
          const e = text[i + 1];
          if (e === undefined) { i++; continue; }
          if ('"\\/bfnrt'.includes(e)) { s += JSON.parse('"\\' + e + '"'); i += 2; continue; }
          if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.substr(i + 2, 4))) {
            s += String.fromCharCode(parseInt(text.substr(i + 2, 4), 16));
            i += 6;
            continue;
          }
          if (e === "'" || e === '`') { s += e; i += 2; continue; }
          if (e === '\n') { i += 2; continue; }
          s += '\\';
          i++;
          log.add('Fixed invalid escape sequences');
          continue;
        }

        // Curly-quoted strings are sometimes closed with a straight quote
        if (c === close || (!'"\'`'.includes(open) && c === '"')) {
          // Is this really the end of the string? Look at what follows.
          let j = i + 1;
          while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
          const next = text[j];
          // Keys always end at their closing quote; values end when a delimiter follows
          if (isKey || j >= n || /[,:}\])\r\n+]/.test(next) || text.startsWith('//', j) || text.startsWith('/*', j)) {
            i++;
            break;
          }
          // `"a": "hello, "b": 2` → the string before "b" was never closed
          i++;
          const save = i;
          i -= 1;
          const nextIsKey = keyAhead();
          i = save;
          if (nextIsKey && !isKey) {
            i -= 1;
            s = s.replace(/[\s,]+$/, '');
            log.add('Closed unterminated strings');
            break;
          }
          s += c;
          log.add('Escaped quotes inside strings');
          continue;
        }

        if (c === '\n' || c === '\r') {
          let j = i;
          while (j < n && isWs(text[j])) j++;
          const rest = text.slice(j, j + 256);
          if (j >= n || /^[}\]]/.test(rest) || /^["'][^"'\n]*["'][ \t]*:/.test(rest) || /^[A-Za-z_$][\w$-]*[ \t]*:/.test(rest)) {
            s = s.replace(/[\s,]+$/, '');
            log.add('Closed unterminated strings');
            break;
          }
          s += c;
          i++;
          log.add('Escaped line breaks inside strings');
          continue;
        }

        s += c;
        i++;
      }
      return s;
    }

    function parseStringValue() {
      let s = parseString(false);
      for (;;) {
        const save = i;
        while (i < n && isWs(text[i])) i++;
        if (text[i] === '+') {
          i++;
          while (i < n && isWs(text[i])) i++;
          if (isQuote(text[i])) {
            s += parseString(false);
            log.add('Joined concatenated strings');
            continue;
          }
        }
        i = save;
        break;
      }
      return JSON.stringify(s);
    }

    function parseNumber() {
      const chunk = text.slice(i, i + 512);
      const m = /^[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(chunk);
      if (!m) return parseWord();
      const after = chunk[m[0].length];
      if (after !== undefined && /[A-Za-z_$\d]/.test(after)) return parseWord();   // 12px, 1st …
      const raw = m[0];
      i += raw.length;

      let out = raw;
      if (out[0] === '+') out = out.slice(1);
      const neg = out[0] === '-';
      const body = neg ? out.slice(1) : out;

      if (/^0[xX]/.test(body)) {
        out = (neg ? '-' : '') + BigInt(body).toString();
      } else if (/^0\d/.test(body)) {
        log.add('Quoted numbers with leading zeros');
        return JSON.stringify(raw);
      } else {
        out = (neg ? '-' : '') + body
          .replace(/^\./, '0.')
          .replace(/\.(?=[eE]|$)/, '');
      }
      if (out !== raw) log.add('Fixed invalid numbers');
      return out;
    }

    function parseWord() {
      const chunk = text.slice(i, i + 256);

      // ObjectId("…"), ISODate("…"), new Date(…), NumberLong(…)
      const call = /^(?:new\s+)?[A-Za-z_$][\w$.]*\s*\(/.exec(chunk);
      if (call) {
        i += call[0].length;
        skip();
        const value = text[i] === ')' ? 'null' : parseValue();
        let depth = 0;
        while (i < n && !(text[i] === ')' && depth === 0)) {
          if ('([{'.includes(text[i])) depth++;
          else if (')]}'.includes(text[i])) depth--;
          i++;
        }
        if (text[i] === ')') i++;
        log.add('Unwrapped function calls such as ObjectId(…)');
        return value;
      }

      const start = i;
      // "//" only starts a comment after whitespace, so unquoted URLs like https://… survive
      const commentAt = k => (text.startsWith('//', k) || text.startsWith('/*', k)) && (k === start || isWs(text[k - 1]));
      while (i < n && !/[,}\]\r\n]/.test(text[i]) && !commentAt(i)) i++;
      const word = text.slice(start, i).trim();
      if (!word) { i = Math.max(i, start + 1); log.add('Removed invalid characters'); return 'null'; }
      if (word in LITERALS) {
        if (LITERALS[word] !== word) log.add('Converted Python/JavaScript values (True, None, undefined …)');
        return LITERALS[word];
      }
      log.add('Added quotes around text values');
      return JSON.stringify(word);
    }

    // ── top level ──
    skip();
    if (i >= n) throw new Error('There is nothing to repair');
    const values = [];
    try {
      while (i < n) {
        skip();
        if (i >= n) break;
        const c = text[i];
        if (c === '}' || c === ']' || c === ')') { i++; log.add('Removed extra closing brackets'); continue; }
        if (c === ',' || c === ';') { i++; continue; }
        if (values.length && !/[{["'`\u201c\u2018\d\-]/.test(c) && !keyAhead()) {
          log.add('Removed text after the JSON');
          break;
        }
        values.push(parseValue());
      }
    } catch (e) {
      if (e instanceof RangeError) throw new Error('The data is nested too deeply to repair');
      throw e;
    }

    // Plain text with no JSON structure at all: don't pretend it was JSON
    if (values.length === 1 && /^"/.test(values[0]) && !/^\s*["'`“‘]/.test(text)) {
      throw new Error('This doesn\'t look like JSON: no objects, arrays or quoted values were found');
    }

    let result = values[0];
    if (values.length > 1) {
      result = '[' + values.join(',') + ']';
      log.add('Wrapped multiple JSON values in an array');
    }
    JSON.parse(result);   // sanity check \u2013 throws if the repair produced something invalid
    return { text: result, fixes: log.list() };
  }

  return { repair };
})();

/* ─────────────────────────────── XML ─────────────────────────────── */
const XmlRepair = (() => {
  const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr', 'param']);
  const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
  const HTML_ENTITIES = {
    nbsp: 160, copy: 169, reg: 174, trade: 8482, hellip: 8230, mdash: 8212, ndash: 8211,
    lsquo: 8216, rsquo: 8217, ldquo: 8220, rdquo: 8221, euro: 8364, pound: 163, yen: 165,
    cent: 162, deg: 176, times: 215, divide: 247, middot: 183, bull: 8226, laquo: 171, raquo: 187,
    sect: 167, para: 182, plusmn: 177, frac12: 189, frac14: 188, frac34: 190,
  };

  function repair(input) {
    const log = makeFixLog();
    let text = String(input).replace(/^\ufeff/, '');
    text = stripCodeFence(text, log).trim();
    if (!text) throw new Error('There is nothing to repair');

    const n = text.length;
    let i = 0;
    let declaration = '';
    let doctype = '';
    const top = [];        // top-level nodes: { xml, element, text }
    const stack = [];      // open elements: { name, attrs, parts }

    function escapeText(raw, where) {
      let changed = false;
      let out = raw.replace(/&(#\d+;|#x[0-9a-fA-F]+;|([A-Za-z][\w.-]*);)?/g, (m, ref, name) => {
        if (ref && (!name || XML_ENTITIES.has(name))) return m;
        if (name && HTML_ENTITIES[name]) { changed = true; return `&#${HTML_ENTITIES[name]};`; }
        changed = true;
        return '&amp;' + (ref || '');
      });
      out = out.replace(/</g, () => { changed = true; return '&lt;'; });
      if (where === 'attr') out = out.replace(/"/g, '&quot;');
      if (changed) log.add(where === 'attr' ? 'Escaped special characters in attribute values' : 'Escaped & and < in text');
      return out;
    }

    function add(xml, isElement) {
      if (stack.length) stack[stack.length - 1].parts.push(xml);
      else top.push({ xml, element: isElement, text: !isElement && !/^<[!?]/.test(xml) && xml.trim() !== '' });
    }

    function closeTop() {
      const el = stack.pop();
      add(`<${el.name}${el.attrs}>${el.parts.join('')}</${el.name}>`, true);
    }

    function readUntil(end, openLen) {
      const e = text.indexOf(end, i + openLen);
      if (e < 0) {
        const body = text.slice(i + openLen);
        i = n;
        return { body, closed: false };
      }
      const body = text.slice(i + openLen, e);
      i = e + end.length;
      return { body, closed: true };
    }

    while (i < n) {
      const lt = text.indexOf('<', i);
      if (lt < 0) { add(escapeText(text.slice(i)), false); break; }
      if (lt > i) add(escapeText(text.slice(i, lt)), false);
      i = lt;

      if (text.startsWith('<!--', i)) {
        const { body, closed } = readUntil('-->', 4);
        if (!closed) log.add('Closed unterminated comments');
        const clean = body.replace(/--/g, '- -').replace(/-$/, '- ');
        if (clean !== body) log.add('Fixed "--" inside comments');
        add(`<!--${clean}-->`, false);
        continue;
      }
      if (text.startsWith('<![CDATA[', i)) {
        const { body, closed } = readUntil(']]>', 9);
        if (!closed) log.add('Closed unterminated CDATA sections');
        add(`<![CDATA[${body}]]>`, false);
        continue;
      }
      if (text.startsWith('<?', i)) {
        const { body, closed } = readUntil('?>', 2);
        if (!closed) log.add('Closed unterminated processing instructions');
        if (/^xml(\s|$)/i.test(body)) {
          const isFirst = !declaration && !doctype && !stack.length && !top.some(t => t.element || t.text);
          if (isFirst) declaration = `<?${body.trim()}?>`;
          else log.add('Removed misplaced XML declaration');
        } else {
          add(`<?${body}?>`, false);
        }
        continue;
      }
      if (/^<!DOCTYPE/i.test(text.slice(i, i + 9))) {
        let depth = 0, j = i;
        for (; j < n; j++) {
          if (text[j] === '[') depth++;
          else if (text[j] === ']') depth--;
          else if (text[j] === '>' && depth <= 0) break;
        }
        const dt = text.slice(i, Math.min(j + 1, n));
        i = Math.min(j + 1, n);
        if (!doctype && !stack.length && !top.some(t => t.element)) doctype = dt.endsWith('>') ? dt : dt + '>';
        else log.add('Removed misplaced DOCTYPE');
        continue;
      }

      // End tag
      if (text[i + 1] === '/') {
        const m = /^<\/\s*([^\s>/<]*)\s*(>)?/.exec(text.slice(i, i + 512));
        const name = m[1];
        i += m[0].length;
        if (!m[2]) log.add('Added missing >');
        if (!name) { log.add('Removed empty closing tags'); continue; }

        let j = stack.length - 1;
        while (j >= 0 && stack[j].name !== name) j--;
        if (j < 0) {
          j = stack.length - 1;
          while (j >= 0 && stack[j].name.toLowerCase() !== name.toLowerCase()) j--;
          if (j >= 0) log.add('Fixed tag name case mismatches');
        }
        if (j < 0) { log.add('Removed closing tags without an opening tag'); continue; }
        while (stack.length - 1 > j) { log.add('Closed unclosed elements'); closeTop(); }
        closeTop();
        continue;
      }

      // Start tag
      if (/[A-Za-z_:]/.test(text[i + 1] || '')) {
        const nm = /^<([A-Za-z_:][\w:.\-]*)/.exec(text.slice(i, i + 256));
        const name = nm[1];
        i += nm[0].length;
        let attrs = '';
        const seen = new Set();
        let selfClose = false;

        for (;;) {
          while (i < n && /\s/.test(text[i])) i++;
          if (i >= n) { log.add('Added missing >'); break; }
          if (text[i] === '>') { i++; break; }
          if (text.startsWith('/>', i)) { selfClose = true; i += 2; break; }
          if (text[i] === '<') { log.add('Added missing >'); break; }
          if (text[i] === '/' || text[i] === '"' || text[i] === "'" || text[i] === '=') { i++; continue; }

          const an = /^[^\s=>\/<"']+/.exec(text.slice(i, i + 256))[0];
          i += an.length;
          while (i < n && /[ \t]/.test(text[i])) i++;

          let value;
          if (text[i] === '=') {
            i++;
            while (i < n && /[ \t]/.test(text[i])) i++;
            const q = text[i];
            if (q === '"' || q === "'") {
              const e = text.indexOf(q, i + 1);
              const nextTag = text.indexOf('<', i + 1);
              if (e < 0 || (nextTag >= 0 && nextTag < e)) {
                // The quote is never closed inside this tag: the value runs to the end of the tag
                const gt = text.indexOf('>', i + 1);
                const stop = gt >= 0 && (nextTag < 0 || gt < nextTag) ? gt : (nextTag >= 0 ? nextTag : n);
                value = text.slice(i + 1, stop).replace(/\/$/, '');
                i = stop;
                log.add('Closed unterminated attribute values');
              } else {
                value = text.slice(i + 1, e);
                i = e + 1;
              }
            } else {
              const uv = /^[^\s>]*/.exec(text.slice(i, i + 1024))[0];
              value = uv.endsWith('/') && text[i + uv.length] === '>' ? uv.slice(0, -1) : uv;
              i += value.length;
              log.add('Added quotes around attribute values');
            }
          } else {
            value = an;
            log.add('Gave attributes without a value a value');
          }

          if (!/^[A-Za-z_:][\w:.\-]*$/.test(an)) { log.add('Removed invalid attribute names'); continue; }
          if (seen.has(an)) { log.add('Removed duplicate attributes'); continue; }
          seen.add(an);
          attrs += ` ${an}="${escapeText(value, 'attr')}"`;
        }

        if (!selfClose && VOID.has(name.toLowerCase())) {
          // <br>, <img …> written HTML-style \u2013 close them unless a matching end tag follows
          const endTag = new RegExp('^\\s*</' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*>', 'i');
          if (!endTag.test(text.slice(i, i + 256))) { selfClose = true; log.add('Closed HTML-style empty tags like <br>'); }
        }

        if (selfClose) add(`<${name}${attrs}/>`, true);
        else stack.push({ name, attrs, parts: [] });
        continue;
      }

      // A "<" that doesn't start a tag
      add(escapeText('<'), false);
      i++;
    }

    while (stack.length) { log.add('Closed unclosed elements'); closeTop(); }

    const elements = top.filter(t => t.element).length;
    const strayText = top.some(t => t.text);
    let body;
    if (elements !== 1 || strayText) {
      body = '<root>' + top.map(t => t.xml).join('') + '</root>';
      log.add(elements === 0 ? 'Wrapped the content in a <root> element' : 'Wrapped multiple root elements in <root>');
    } else {
      body = top.map(t => t.xml).join('');
    }

    const result = [declaration, doctype, body].filter(Boolean).join('\n');
    return { text: result, fixes: log.list() };
  }

  return { repair };
})();
