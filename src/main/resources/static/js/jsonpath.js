/* ============================================================
   jsonpath.js - JSONPath queries over the editor's AST
   (see parseJsonAst in jsonxmlformatter.js). Working on the AST keeps
   big numbers exact. Supports:
     $  .key  ['key']  [0]  [-1]  [*]  .*  ..key  ..*  [0,2]  ['a','b']
     [start:end:step]  [?(@.price < 10 && @.tags)]  [?@.isbn]
   Filters: == != < <= > >= =~ /regex/i  && || !  ( )  .length
   ============================================================ */

'use strict';

const JsonPath = (() => {
  // ── AST helpers ────────────────────────────────────────────────────────────
  const isContainer = n => n && (n.type === 'object' || n.type === 'array');

  function children(n) {
    if (!n) return [];
    if (n.type === 'object') return n.entries.map(e => ({ key: unquote(e.key.raw), node: e.value }));
    if (n.type === 'array') return n.items.map((node, i) => ({ key: i, node }));
    return [];
  }

  function child(n, key) {
    if (!n) return undefined;
    if (n.type === 'object') {
      let found;
      n.entries.forEach(e => { if (unquote(e.key.raw) === key) found = e.value; });   // last duplicate wins, like JSON.parse
      return found;
    }
    if (n.type === 'array' && typeof key === 'number') {
      const i = key < 0 ? n.items.length + key : key;
      return n.items[i];
    }
    return undefined;
  }

  // AST node → comparable JS value (containers stay as nodes)
  function value(n) {
    if (n === undefined) return undefined;
    switch (n.type) {
      case 'string': return unquote(n.raw);
      case 'number': return Number(n.raw);
      case 'boolean': return n.raw === 'true';
      case 'null': return null;
      default: return n;
    }
  }

  // ── Path parser ────────────────────────────────────────────────────────────
  function parse(expr) {
    const src = expr.trim();
    let i = 0;
    const segs = [];
    const err = msg => { throw new Error(`${msg} at position ${i + 1}`); };
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };

    if (src[i] === '$') i++;
    else if (src[i] !== '.' && src[i] !== '[') segs.push({ desc: false, sel: [{ k: 'name', v: readName() }] });

    function readName() {
      const m = /^[A-Za-z_$@À-￿][\w$\-À-￿]*/.exec(src.slice(i));
      if (!m) err('Expected a property name');
      i += m[0].length;
      return m[0];
    }

    function readString() {
      const q = src[i++];
      let s = '';
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++];
      }
      if (src[i] !== q) err('Unterminated string');
      i++;
      return s;
    }

    function readBracket() {
      i++; // [
      ws();
      if (src[i] === '?') {
        i++;
        ws();
        let depth = 0, start = i, inStr = null;
        // read up to the matching ]
        for (; i < src.length; i++) {
          const c = src[i];
          if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
          if (c === '"' || c === "'") inStr = c;
          else if (c === '(' || c === '[') depth++;
          else if (c === ')' || c === ']') { if (depth === 0 && c === ']') break; depth--; }
        }
        if (src[i] !== ']') err('Missing ] after the filter');
        let body = src.slice(start, i).trim();
        i++;
        if (body.startsWith('(') && matchingParen(body) === body.length - 1) body = body.slice(1, -1);
        return [{ k: 'filter', v: parseFilter(body) }];
      }
      const sels = [];
      for (;;) {
        ws();
        const c = src[i];
        if (c === '*') { i++; sels.push({ k: 'wild' }); }
        else if (c === '"' || c === "'") sels.push({ k: 'name', v: readString() });
        else {
          const m = /^(-?\d*)\s*(?::\s*(-?\d*)\s*(?::\s*(-?\d*))?)?/.exec(src.slice(i));
          if (!m || !m[0].trim()) err('Expected an index, a quoted name, * or a filter');
          i += m[0].length;
          if (m[0].includes(':')) sels.push({ k: 'slice', start: m[1] === '' ? null : +m[1], end: m[2] === undefined || m[2] === '' ? null : +m[2], step: m[3] === undefined || m[3] === '' ? 1 : +m[3] });
          else sels.push({ k: 'index', v: +m[1] });
        }
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; break; }
        err('Expected , or ]');
      }
      return sels;
    }

    while (i < src.length) {
      ws();
      if (i >= src.length) break;
      if (src.startsWith('..', i)) {
        i += 2;
        if (src[i] === '[') segs.push({ desc: true, sel: readBracket() });
        else if (src[i] === '*') { i++; segs.push({ desc: true, sel: [{ k: 'wild' }] }); }
        else segs.push({ desc: true, sel: [{ k: 'name', v: readName() }] });
      } else if (src[i] === '.') {
        i++;
        if (src[i] === '*') { i++; segs.push({ desc: false, sel: [{ k: 'wild' }] }); }
        else {
          const name = readName();
          segs.push({ desc: false, sel: [name === 'length' ? { k: 'length' } : { k: 'name', v: name }] });
        }
      } else if (src[i] === '[') {
        segs.push({ desc: false, sel: readBracket() });
      } else {
        err(`Unexpected "${src[i]}"`);
      }
    }
    return segs;
  }

  function matchingParen(s) {
    let depth = 0, inStr = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") inStr = c;
      else if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  // ── Filter expressions ─────────────────────────────────────────────────────
  function parseFilter(src) {
    let i = 0;
    const err = msg => { throw new Error(`Filter: ${msg} near "${src.slice(i, i + 12)}"`); };
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const peek = s => { ws(); return src.startsWith(s, i); };

    function or() { let l = and(); while (peek('||')) { i += 2; const r = and(); const a = l; l = ctx => truthy(a(ctx)) || truthy(r(ctx)); } return l; }
    function and() { let l = not(); while (peek('&&')) { i += 2; const r = not(); const a = l; l = ctx => truthy(a(ctx)) && truthy(r(ctx)); } return l; }
    function not() { if (peek('!') && !peek('!=')) { i++; const e = not(); return ctx => !truthy(e(ctx)); } return cmp(); }
    function cmp() {
      const l = operand();
      ws();
      const m = /^(==|!=|<=|>=|<|>|=~)/.exec(src.slice(i));
      if (!m) return l;
      i += m[1].length;
      const r = operand();
      const op = m[1];
      return ctx => compare(op, l(ctx), r(ctx));
    }
    function operand() {
      ws();
      const c = src[i];
      if (c === '(') { i++; const e = or(); ws(); if (src[i] !== ')') err('missing )'); i++; return e; }
      if (c === '"' || c === "'") {
        const q = src[i++]; let s = '';
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++]; }
        if (src[i] !== q) err('unterminated string'); i++;
        return () => s;
      }
      if (c === '/') {
        const m = /^\/((?:\\.|[^/\\])*)\/([gimsuy]*)/.exec(src.slice(i));
        if (!m) err('bad regular expression');
        i += m[0].length;
        let re;
        try { re = new RegExp(m[1], m[2].replace('g', '')); } catch (e) { err('bad regular expression'); }
        return () => re;
      }
      const num = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      if (num) { i += num[0].length; const v = Number(num[0]); return () => v; }
      for (const [word, v] of [['true', true], ['false', false], ['null', null]]) {
        if (src.startsWith(word, i) && !/[\w$]/.test(src[i + word.length] || '')) { i += word.length; return () => v; }
      }
      if (c === '@' || c === '$') {
        const start = i;
        i++;
        // relative path: stop at an operator, ) or whitespace outside brackets
        let depth = 0, inStr = null;
        for (; i < src.length; i++) {
          const ch = src[i];
          if (inStr) { if (ch === '\\') i++; else if (ch === inStr) inStr = null; continue; }
          if (ch === '"' || ch === "'") inStr = ch;
          else if (ch === '[') depth++;
          else if (ch === ']') depth--;
          else if (depth === 0 && /[\s=!<>&|)~]/.test(ch)) break;
        }
        const segs = parse(src.slice(start + 1).slice(0, i - start - 1) ? '$' + src.slice(start + 1, i) : '$');
        const root = c === '$';
        return ctx => {
          const res = evaluate(segs, root ? ctx.root : ctx.node);
          if (!res.length) return undefined;
          return res[0].node === LENGTH ? res[0].value : value(res[0].node);
        };
      }
      err('expected a value');
    }

    const e = or();
    ws();
    if (i < src.length) err('unexpected text');
    return e;
  }

  const truthy = v => v !== undefined && v !== false && v !== null ? true : v === null ? true : false;

  function compare(op, a, b) {
    if (op === '=~') return b instanceof RegExp && typeof a === 'string' && b.test(a);
    if (a === undefined || b === undefined) return op === '!=' ? a !== b : false;
    const prim = v => (v !== null && typeof v === 'object') ? astToText(v, '') : v;
    const x = prim(a), y = prim(b);
    switch (op) {
      case '==': return x === y;
      case '!=': return x !== y;
      default:
        if (typeof x !== typeof y || (typeof x !== 'number' && typeof x !== 'string')) return false;
        return op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y;
    }
  }

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const LENGTH = { type: 'length' };

  function select(item, sel, root) {
    const { node, path } = item;
    const out = [];
    switch (sel.k) {
      case 'name': { const c = child(node, sel.v); if (c !== undefined) out.push({ node: c, path: path.concat(sel.v) }); break; }
      case 'index': {
        if (node && node.type === 'array') {
          const i = sel.v < 0 ? node.items.length + sel.v : sel.v;
          if (i >= 0 && i < node.items.length) out.push({ node: node.items[i], path: path.concat(i) });
        }
        break;
      }
      case 'wild': children(node).forEach(c => out.push({ node: c.node, path: path.concat(c.key) })); break;
      case 'slice': {
        if (!node || node.type !== 'array') break;
        const len = node.items.length, step = sel.step || 1;
        const norm = (v, d) => v === null ? d : v < 0 ? Math.max(0, len + v) : Math.min(v, len);
        if (step > 0) {
          for (let i = norm(sel.start, 0); i < norm(sel.end, len); i += step) out.push({ node: node.items[i], path: path.concat(i) });
        } else {
          const s = sel.start === null ? len - 1 : sel.start < 0 ? len + sel.start : Math.min(sel.start, len - 1);
          const e = sel.end === null ? -1 : sel.end < 0 ? len + sel.end : sel.end;
          for (let i = s; i > e; i += step) out.push({ node: node.items[i], path: path.concat(i) });
        }
        break;
      }
      case 'filter':
        children(node).forEach(c => {
          let ok = false;
          try { ok = truthy(sel.v({ node: c.node, root })); } catch (_) { ok = false; }
          if (ok) out.push({ node: c.node, path: path.concat(c.key) });
        });
        break;
      case 'length':
        if (node && node.type === 'array') out.push({ node: LENGTH, value: node.items.length, path: path.concat('length') });
        else if (node && node.type === 'string') out.push({ node: LENGTH, value: [...unquote(node.raw)].length, path: path.concat('length') });
        else { const c = child(node, 'length'); if (c !== undefined) out.push({ node: c, path: path.concat('length') }); }
        break;
    }
    return out;
  }

  function descendants(item, acc) {
    acc.push(item);
    children(item.node).forEach(c => descendants({ node: c.node, path: item.path.concat(c.key) }, acc));
    return acc;
  }

  function evaluate(segs, rootNode) {
    let items = [{ node: rootNode, path: [] }];
    for (const seg of segs) {
      const next = [];
      const sources = seg.desc ? items.flatMap(it => descendants(it, [])) : items;
      sources.forEach(it => seg.sel.forEach(sel => next.push(...select(it, sel, rootNode))));
      items = next;
      if (items.length > 100000) throw new Error('The query matches too many values (over 100,000)');
    }
    return items;
  }

  function query(ast, expr) {
    if (!expr || !expr.trim()) return [];
    const segs = parse(expr);
    return evaluate(segs, ast).map(r => ({
      path: r.path,
      node: r.node === LENGTH ? { type: 'number', raw: String(r.value) } : r.node,
    }));
  }

  return { query, parse };
})();
