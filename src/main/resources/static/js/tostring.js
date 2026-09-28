
'use strict';

const ToStringParser = (() => {
  class ParseError extends Error {
    constructor(msg, pos, src) {
      const before = src.slice(0, pos);
      const line = before.split('\n').length, col = pos - before.lastIndexOf('\n');
      super(`${msg} (line ${line}, column ${col})`);
      this.pos = pos;
    }
  }

  class RawNumber { constructor(text) { this.text = text; } }

  const IDENT = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/y;
  const FIELD_AHEAD = /\s*[A-Za-z_$][\w$]*\s*=/y;
  const MAP_KEY_AHEAD = /\s*[A-Za-z0-9_$@][\w .$@:-]*=/y;
  const NOT_JSON = Symbol('not json');
  const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
  const CLOSE = { '(': ')', '[': ']', '{': '}' };

  function parse(src, opts = {}) {
    let i = 0;
    const err = msg => new ParseError(msg, i, src);
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const at = (re, pos = i) => { re.lastIndex = pos; return re.exec(src); };

    function looksLikeObjectBody(openPos) {
      const close = CLOSE[src[openPos]];
      let j = openPos + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      return src[j] === close || !!at(FIELD_AHEAD, openPos + 1);
    }

    function value(ctx) {
      ws();
      if (i >= src.length) throw err('Unexpected end of input');
      const c = src[i];

      const id = at(IDENT);
      if (id && id.index === i) {
        const name = id[0], after = i + name.length;
        const next = src[after];
        if ((next === '(' || next === '[') && /^[A-Za-z_$]/.test(name)) {
          if (/^Optional(Int|Long|Double)?$/.test(name.split('.').pop()) && next === '[') {
            i = after + 1;
            const v = value(']');
            ws();
            if (src[i] !== ']') throw err('Expected “]” to close Optional');
            i++;
            return v;
          }
          if (looksLikeObjectBody(after)) {
            i = after;
            return object(name);
          }
        }
        if (/^Optional(Int|Long|Double)?\.empty$/.test(name.split('.').slice(-2).join('.'))) {
          i = after;
          return null;
        }
      }
      if (c === '[' || c === '{') {
        const embedded = embeddedJson(ctx);
        if (embedded !== NOT_JSON) return embedded;
      }
      if (c === '[') return list();
      if (c === '{') return map();
      return scalar(ctx);
    }

    function closeCharOf(ctx) {
      return ctx.startsWith('obj:') ? ctx.slice(4) : ctx === 'list' || ctx === ']' ? ']' : ctx === 'map' ? '}' : null;
    }

    function skipWs(pos) {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      return pos;
    }

    function endsValue(pos, ctx) {
      if (pos >= src.length) return true;
      const ch = src[pos];
      return ch === ',' || ch === closeCharOf(ctx) || (ctx === 'top' && src[pos - 1] === '\n');
    }

    function looksLikeJson(pos) {
      const c = src[pos], d = src[skipWs(pos + 1)];
      if (c === '{') return d === '"' || d === '}';
      return c === '[' && d !== undefined && /[{["\]\-0-9tfn]/.test(d);
    }

    function embeddedJson(ctx) {
      if (!looksLikeJson(i)) return NOT_JSON;
      const first = readJson(i);
      if (!first || !endsValue(skipWs(first.end), ctx)) return NOT_JSON;
      i = first.end;
      if (!ctx.startsWith('obj:') && ctx !== 'map') return first.value;
      const all = [first.value];
      for (;;) {
        const comma = skipWs(i);
        if (src[comma] !== ',') break;
        const next = skipWs(comma + 1);
        if (!looksLikeJson(next)) break;
        const more = readJson(next);
        if (!more || !endsValue(skipWs(more.end), ctx)) break;
        all.push(more.value);
        i = more.end;
      }
      return all.length === 1 ? all[0] : all;
    }

    function readJson(start) {
      let j = start;
      const fail = () => { throw NOT_JSON; };
      const sp = () => { while (j < src.length && /\s/.test(src[j])) j++; };
      function str() {
        let out = '';
        j++;
        while (j < src.length) {
          const ch = src[j];
          if (ch === '"') { j++; return out; }
          if (ch === '\\') {
            const e = src[j + 1];
            const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
            if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(src.substr(j + 2, 4))) { out += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 6; continue; }
            if (!(e in map)) fail();
            out += map[e];
            j += 2;
            continue;
          }
          if (ch < ' ') fail();
          out += ch;
          j++;
        }
        return fail();
      }
      function val() {
        sp();
        const ch = src[j];
        if (ch === '{') {
          j++;
          const obj = new Map();
          sp();
          if (src[j] === '}') { j++; return obj; }
          for (;;) {
            sp();
            if (src[j] !== '"') fail();
            const k = str();
            sp();
            if (src[j] !== ':') fail();
            j++;
            obj.set(k, val());
            sp();
            if (src[j] === ',') { j++; continue; }
            if (src[j] === '}') { j++; return obj; }
            fail();
          }
        }
        if (ch === '[') {
          j++;
          const arr = [];
          sp();
          if (src[j] === ']') { j++; return arr; }
          for (;;) {
            arr.push(val());
            sp();
            if (src[j] === ',') { j++; continue; }
            if (src[j] === ']') { j++; return arr; }
            fail();
          }
        }
        if (ch === '"') return str();
        const m = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
        m.lastIndex = j;
        const hit = m.exec(src);
        if (!hit) fail();
        j += hit[0].length;
        return hit[0] === 'true' ? true : hit[0] === 'false' ? false : hit[0] === 'null' ? null : new RawNumber(hit[0]);
      }
      try {
        const value = val();
        return { value, end: j };
      } catch (e) {
        if (e === NOT_JSON) return null;
        throw e;
      }
    }

    function object(className) {
      const open = src[i], close = CLOSE[open];
      i++;
      const out = new Map();
      if (opts.typeKey) out.set(opts.typeKey, className.split('.').pop());
      ws();
      if (src[i] === close) { i++; return out; }
      for (;;) {
        ws();
        const f = at(/([A-Za-z_$][\w$]*)\s*=/y);
        if (!f) throw err(`Expected a field name followed by “=” inside ${className}`);
        i += f[0].length;
        out.set(f[1], value('obj:' + close));
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === close) { i++; return out; }
        if (i >= src.length) throw err(`The “${open}” after ${className} is never closed. The text may be cut off; paste the complete output`);
        throw err(`Expected “,” or “${close}” in ${className}`);
      }
    }

    function list() {
      i++;
      const out = [];
      ws();
      if (src[i] === ']') { i++; return out; }
      for (;;) {
        out.push(value('list'));
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return out; }
        throw err('Expected “,” or “]” in a list');
      }
    }

    function map() {
      i++;
      const out = new Map();
      ws();
      if (src[i] === '}') { i++; return out; }
      for (;;) {
        ws();
        let j = i, depth = 0;
        while (j < src.length && !(depth === 0 && src[j] === '=')) {
          if ('([{'.includes(src[j])) depth++;
          else if (')]}'.includes(src[j])) depth--;
          if (depth < 0) break;
          j++;
        }
        if (src[j] !== '=') throw err('Expected “key=value” in a map');
        const key = src.slice(i, j).trim();
        i = j + 1;
        out.set(key, value('map'));
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return out; }
        throw err('Expected “,” or “}” in a map');
      }
    }

    function scalar(ctx) {
      const start = i;
      const closeChar = closeCharOf(ctx);
      let depth = 0;
      while (i < src.length) {
        const ch = src[i];
        if (depth === 0) {
          if (ch === closeChar) break;
          if (ch === ',') {
            if (ctx === 'list' || ctx === ']') break;
            if (ctx.startsWith('obj:') && at(FIELD_AHEAD, i + 1)) break;
            if (ctx === 'map' && at(MAP_KEY_AHEAD, i + 1)) break;
          }
          if (ctx === 'top' && ch === '\n') break;
        }
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth--;
        i++;
      }
      const text = src.slice(start, i).replace(/\s+$/, '');
      return convertScalar(text);
    }

    function convertScalar(text) {
      if (text === 'null') return null;
      if (text === 'true' || text === 'false') return text === 'true';
      if (NUMBER.test(text)) return new RawNumber(text);
      return text;
    }

    function findStart() {
      const re = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*[([]\s*(?:[A-Za-z_$][\w$]*\s*=|[)\]])/g;
      re.lastIndex = i;
      const m = re.exec(src);
      if (m) return m.index;
      const list = src.indexOf('[', i);
      return list >= 0 ? list : -1;
    }

    const results = [];
    ws();
    while (i < src.length) {
      const s = findStart();
      if (s < 0) break;
      i = s;
      results.push(value('top'));
      ws();
    }
    if (!results.length) {
      throw new ParseError('No object found. Paste output such as UserDTO(id=1, name=Amit) or a Java record like User[id=1, name=Amit]', 0, src);
    }
    return results.length === 1 ? results[0] : results;
  }

  const snake = k => k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();

  function toJson(v, indent = 2, keyCase = 'as-is', level = 0) {
    const pad = typeof indent === 'number' ? ' '.repeat(indent) : indent;
    const nl = pad ? '\n' : '';
    const inner = pad.repeat(level + 1), outer = pad.repeat(level);
    const sep = pad ? ': ' : ':';
    if (v === null) return 'null';
    if (v instanceof RawNumber) return v.text;
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return `[${nl}${v.map(x => inner + toJson(x, indent, keyCase, level + 1)).join(',' + nl)}${nl}${outer}]`;
    }
    const entries = v instanceof Map ? [...v.entries()] : Object.entries(v);
    if (!entries.length) return '{}';
    return `{${nl}${entries.map(([k, x]) => `${inner}${JSON.stringify(keyCase === 'snake' && !k.startsWith('@') ? snake(k) : k)}${sep}${toJson(x, indent, keyCase, level + 1)}`).join(',' + nl)}${nl}${outer}}`;
  }

  function convert(src, { indent = 2, keyCase = 'as-is', typeKey = null } = {}) {
    return toJson(parse(src, { typeKey }), indent, keyCase);
  }

  function rootName(src) {
    const m = src.match(/([A-Za-z_$][\w$]*)[([]\s*[A-Za-z_$][\w$]*\s*=/);
    return m ? m[1] : null;
  }

  return { parse, convert, toJson, rootName, ParseError };
})();
