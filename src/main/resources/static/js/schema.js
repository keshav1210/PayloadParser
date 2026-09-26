/* ============================================================
   schema.js - generate a JSON Schema from a sample, and validate
   JSON against a schema. Runs in the browser. Uses parseJsonAst,
   lineColFromPos and jsonPath from jsonxmlformatter.js.
   ============================================================ */

'use strict';

const Schema = (() => {
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'jxe.schema';

  // ── Parsing with good error messages ────────────────────────────────────────
  function parseJson(text, label) {
    try {
      parseJsonAst(text);                 // precise line/column errors
    } catch (e) {
      if (e && e.isParseError) {
        const { line, col } = lineColFromPos(text, e.pos);
        throw new Error(`${label} is not valid JSON (line ${line}, column ${col}): ${e.message}`);
      }
      throw e;
    }
    return JSON.parse(text);
  }

  // ── Generator ──────────────────────────────────────────────────────────────
  const FORMATS = [
    ['date-time', /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/],
    ['date', /^\d{4}-\d{2}-\d{2}$/],
    ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    ['uri', /^https?:\/\/[^\s]+$/i],
    ['uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i],
  ];

  function infer(value, opts) {
    if (value === null) return { type: 'null' };
    if (Array.isArray(value)) {
      const schema = { type: 'array' };
      if (value.length) schema.items = value.map(v => infer(v, opts)).reduce((a, b) => merge(a, b, opts));
      return schema;
    }
    switch (typeof value) {
      case 'boolean': return { type: 'boolean' };
      case 'number': return { type: Number.isInteger(value) ? 'integer' : 'number' };
      case 'string': {
        const s = { type: 'string' };
        if (opts.formats) {
          const f = FORMATS.find(([, re]) => re.test(value));
          if (f) s.format = f[0];
        }
        return s;
      }
      default: {
        const props = {};
        Object.keys(value).forEach(k => { props[k] = infer(value[k], opts); });
        const s = { type: 'object', properties: props };
        if (opts.required && Object.keys(props).length) s.required = Object.keys(props);
        if (!opts.additional) s.additionalProperties = false;
        return s;
      }
    }
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const typesOf = s => (Array.isArray(s.type) ? s.type : [s.type]);

  // Combine the schemas of two values seen in the same place (e.g. array items)
  function merge(a, b, opts) {
    if (same(a, b)) return a;
    if (a.anyOf || b.anyOf) {
      const list = [...(a.anyOf || [a])];
      (b.anyOf || [b]).forEach(s => { if (!list.some(x => same(x, s))) list.push(s); });
      return { anyOf: list };
    }
    if (a.type === 'object' && b.type === 'object') {
      const props = { ...a.properties };
      Object.keys(b.properties).forEach(k => { props[k] = k in props ? merge(props[k], b.properties[k], opts) : b.properties[k]; });
      const s = { type: 'object', properties: props };
      if (opts.required) {
        const req = (a.required || []).filter(k => (b.required || []).includes(k));
        if (req.length) s.required = req;
      }
      if (!opts.additional) s.additionalProperties = false;
      return s;
    }
    if (a.type === 'array' && b.type === 'array') {
      const s = { type: 'array' };
      if (a.items && b.items) s.items = merge(a.items, b.items, opts);
      else if (a.items || b.items) s.items = a.items || b.items;
      return s;
    }
    const ta = typesOf(a), tb = typesOf(b);
    const simple = s => !s.properties && !s.items && !s.anyOf;
    if (simple(a) && simple(b)) {
      let types = [...new Set([...ta, ...tb])];
      if (types.includes('number') && types.includes('integer')) types = types.filter(t => t !== 'integer');
      const s = { type: types.length === 1 ? types[0] : types };
      if (a.format && a.format === b.format) s.format = a.format;
      return s;
    }
    // e.g. an object in one item and null in another
    if (ta.length === 1 && tb.length === 1 && (ta[0] === 'null' || tb[0] === 'null')) {
      const real = ta[0] === 'null' ? b : a;
      return { anyOf: [real, { type: 'null' }] };
    }
    return { anyOf: [a, b] };
  }

  function generate(sampleText, opts) {
    const value = parseJson(sampleText, 'The sample');
    const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Generated schema', ...infer(value, opts) };
    return JSON.stringify(schema, null, 2);
  }

  // ── Validator ──────────────────────────────────────────────────────────────
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }

  const FORMAT_CHECK = {
    'date-time': s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.test(s) && !isNaN(Date.parse(s)),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')),
    time: s => /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i.test(s),
    email: s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
    uri: s => /^[a-z][a-z0-9+.-]*:[^\s]*$/i.test(s),
    uuid: s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
    ipv4: s => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s),
    ipv6: s => /^[0-9a-f:]+$/i.test(s) && s.includes(':'),
    hostname: s => /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(s),
  };

  function resolveRef(root, ref) {
    if (!ref.startsWith('#')) throw new Error(`Only references inside the same schema are supported (got "${ref}")`);
    const parts = ref.slice(1).split('/').filter(Boolean).map(p => decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~'));
    let node = root;
    for (const p of parts) {
      if (node == null || !(p in node)) throw new Error(`Can't resolve "${ref}"`);
      node = node[p];
    }
    return node;
  }

  const show = v => { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function validate(schema, value, path, errors, ctx, depth) {
    if (depth > 200) { errors.push({ path, message: 'The schema is nested too deeply (circular $ref?)', keyword: '$ref' }); return; }
    if (schema === true || schema === undefined) return;
    if (schema === false) { errors.push({ path, message: 'No value is allowed here', keyword: 'false' }); return; }
    if (typeof schema !== 'object' || schema === null) return;
    const add = (keyword, message) => errors.push({ path, keyword, message });

    const ref = schema.$ref;
    if (typeof ref === 'string') {
      try { validate(resolveRef(ctx.root, ref), value, path, errors, ctx, depth + 1); }
      catch (e) { add('$ref', e.message); }
    }

    const t = typeOf(value);

    if (schema.type !== undefined) {
      const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
      const ok = allowed.some(a => a === t || (a === 'number' && t === 'integer'));
      if (!ok) { add('type', `Expected ${allowed.join(' or ')}, got ${t === 'integer' ? 'number' : t} ${show(value)}`); return; }
    }
    if (schema.enum && !schema.enum.some(e => deepEqual(e, value))) add('enum', `${show(value)} is not one of ${show(schema.enum)}`);
    if ('const' in schema && !deepEqual(schema.const, value)) add('const', `Must be exactly ${show(schema.const)}`);

    if (t === 'number' || t === 'integer') {
      const exMin = schema.exclusiveMinimum, exMax = schema.exclusiveMaximum;
      if (typeof schema.minimum === 'number') {
        if (exMin === true ? value <= schema.minimum : value < schema.minimum) add('minimum', `${value} is less than the minimum ${schema.minimum}${exMin === true ? ' (exclusive)' : ''}`);
      }
      if (typeof schema.maximum === 'number') {
        if (exMax === true ? value >= schema.maximum : value > schema.maximum) add('maximum', `${value} is greater than the maximum ${schema.maximum}${exMax === true ? ' (exclusive)' : ''}`);
      }
      if (typeof exMin === 'number' && value <= exMin) add('exclusiveMinimum', `${value} must be greater than ${exMin}`);
      if (typeof exMax === 'number' && value >= exMax) add('exclusiveMaximum', `${value} must be less than ${exMax}`);
      if (typeof schema.multipleOf === 'number') {
        const q = value / schema.multipleOf;
        if (Math.abs(q - Math.round(q)) > 1e-9) add('multipleOf', `${value} is not a multiple of ${schema.multipleOf}`);
      }
    }

    if (t === 'string') {
      const len = [...value].length;
      if (typeof schema.minLength === 'number' && len < schema.minLength) add('minLength', `Too short: ${plural(len, 'character')}, minimum ${schema.minLength}`);
      if (typeof schema.maxLength === 'number' && len > schema.maxLength) add('maxLength', `Too long: ${plural(len, 'character')}, maximum ${schema.maxLength}`);
      if (typeof schema.pattern === 'string') {
        try { if (!new RegExp(schema.pattern, 'u').test(value)) add('pattern', `${show(value)} doesn't match the pattern ${schema.pattern}`); }
        catch (_) { add('pattern', `The schema's pattern ${schema.pattern} is not a valid regular expression`); }
      }
      if (typeof schema.format === 'string' && FORMAT_CHECK[schema.format] && !FORMAT_CHECK[schema.format](value)) {
        add('format', `${show(value)} is not a valid ${schema.format}`);
      }
    }

    if (t === 'array') {
      if (typeof schema.minItems === 'number' && value.length < schema.minItems) add('minItems', `Has ${plural(value.length, 'item')}, needs at least ${schema.minItems}`);
      if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) add('maxItems', `Has ${plural(value.length, 'item')}, allows at most ${schema.maxItems}`);
      if (schema.uniqueItems === true) {
        for (let i = 0; i < value.length; i++) {
          const j = value.findIndex((x, k) => k > i && deepEqual(x, value[i]));
          if (j > 0) { add('uniqueItems', `Items ${i} and ${j} are the same, but items must be unique`); break; }
        }
      }
      let start = 0;
      if (Array.isArray(schema.prefixItems)) {
        schema.prefixItems.forEach((s, i) => { if (i < value.length) validate(s, value[i], path.concat(i), errors, ctx, depth + 1); });
        start = schema.prefixItems.length;
      }
      if (Array.isArray(schema.items)) {                      // draft 4–7 tuple form
        schema.items.forEach((s, i) => { if (i < value.length) validate(s, value[i], path.concat(i), errors, ctx, depth + 1); });
        if (schema.additionalItems !== undefined) {
          for (let i = schema.items.length; i < value.length; i++) validate(schema.additionalItems, value[i], path.concat(i), errors, ctx, depth + 1);
        }
      } else if (schema.items !== undefined) {
        for (let i = start; i < value.length; i++) validate(schema.items, value[i], path.concat(i), errors, ctx, depth + 1);
      }
      if (schema.contains !== undefined) {
        const matches = value.filter(v => { const e = []; validate(schema.contains, v, path, e, ctx, depth + 1); return !e.length; }).length;
        const min = typeof schema.minContains === 'number' ? schema.minContains : 1;
        if (matches < min) add('contains', `Needs at least ${plural(min, 'item')} matching "contains", found ${matches}`);
        if (typeof schema.maxContains === 'number' && matches > schema.maxContains) add('maxContains', `At most ${schema.maxContains} items may match "contains", found ${matches}`);
      }
    }

    if (t === 'object') {
      const keys = Object.keys(value);
      if (Array.isArray(schema.required)) {
        schema.required.forEach(k => { if (!(k in value)) errors.push({ path, keyword: 'required', message: `Missing required property "${k}"` }); });
      }
      if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties) add('minProperties', `Has ${plural(keys.length, 'property')}, needs at least ${schema.minProperties}`);
      if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) add('maxProperties', `Has ${plural(keys.length, 'property')}, allows at most ${schema.maxProperties}`);
      const props = schema.properties || {};
      const patterns = Object.keys(schema.patternProperties || {}).map(p => { try { return [new RegExp(p, 'u'), schema.patternProperties[p]]; } catch (_) { return null; } }).filter(Boolean);
      keys.forEach(k => {
        let matched = false;
        if (k in props) { matched = true; validate(props[k], value[k], path.concat(k), errors, ctx, depth + 1); }
        patterns.forEach(([re, s]) => { if (re.test(k)) { matched = true; validate(s, value[k], path.concat(k), errors, ctx, depth + 1); } });
        if (!matched && schema.additionalProperties !== undefined) {
          if (schema.additionalProperties === false) errors.push({ path: path.concat(k), keyword: 'additionalProperties', message: `Property "${k}" is not allowed` });
          else validate(schema.additionalProperties, value[k], path.concat(k), errors, ctx, depth + 1);
        }
        if (schema.propertyNames !== undefined) {
          const e = [];
          validate(schema.propertyNames, k, path, e, ctx, depth + 1);
          if (e.length) errors.push({ path: path.concat(k), keyword: 'propertyNames', message: `The property name "${k}" is not allowed: ${e[0].message}` });
        }
      });
      const depReq = schema.dependentRequired || (schema.dependencies && Object.fromEntries(Object.entries(schema.dependencies).filter(([, v]) => Array.isArray(v))));
      if (depReq) {
        Object.entries(depReq).forEach(([k, needs]) => {
          if (k in value) needs.forEach(n => { if (!(n in value)) add('dependentRequired', `"${k}" is present, so "${n}" is required too`); });
        });
      }
    }

    // Combinators
    const branch = s => { const e = []; validate(s, value, path, e, ctx, depth + 1); return e; };
    if (Array.isArray(schema.allOf)) schema.allOf.forEach(s => validate(s, value, path, errors, ctx, depth + 1));
    if (Array.isArray(schema.anyOf)) {
      const results = schema.anyOf.map(branch);
      if (!results.some(r => !r.length)) {
        const best = results.reduce((a, b) => (b.length < a.length ? b : a));
        add('anyOf', `Doesn't match any of the ${schema.anyOf.length} allowed shapes. Closest: ${best[0] ? best[0].message : ''}`);
      }
    }
    if (Array.isArray(schema.oneOf)) {
      const passing = schema.oneOf.map(branch).filter(r => !r.length).length;
      if (passing === 0) add('oneOf', `Doesn't match any of the ${schema.oneOf.length} options`);
      else if (passing > 1) add('oneOf', `Matches ${passing} of the options, but must match exactly one`);
    }
    if (schema.not !== undefined && !branch(schema.not).length) add('not', 'Matches a schema it must not match');
    if (schema.if !== undefined) {
      const cond = !branch(schema.if).length;
      if (cond && schema.then !== undefined) validate(schema.then, value, path, errors, ctx, depth + 1);
      if (!cond && schema.else !== undefined) validate(schema.else, value, path, errors, ctx, depth + 1);
    }
  }

  function runValidation(schemaText, dataText) {
    const schema = parseJson(schemaText, 'The schema');
    const data = parseJson(dataText, 'The JSON data');
    const errors = [];
    validate(schema, data, [], errors, { root: schema }, 0);
    return errors;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  let els, timer = null;

  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function opts() {
    return { required: els.optRequired.checked, formats: els.optFormats.checked, additional: els.optAdditional.checked };
  }

  function runGenerate() {
    save();
    els.genError.hidden = true;
    if (!els.sample.value.trim()) { els.genOut.value = ''; return; }
    try { els.genOut.value = generate(els.sample.value, opts()); }
    catch (e) { els.genOut.value = ''; els.genError.hidden = false; els.genError.textContent = e.message; }
  }

  function runValidate() {
    save();
    const body = els.errBody;
    body.textContent = '';
    els.valResult.hidden = true;
    if (!els.schema.value.trim() || !els.data.value.trim()) return;
    els.valResult.hidden = false;
    let errors;
    try {
      errors = runValidation(els.schema.value, els.data.value);
    } catch (e) {
      els.valSummary.className = 'summary bad';
      els.valSummary.textContent = e.message;
      els.errTable.hidden = true;
      return;
    }
    if (!errors.length) {
      els.valSummary.className = 'summary ok';
      els.valSummary.textContent = '✓ Valid: the JSON matches the schema.';
      els.errTable.hidden = true;
      return;
    }
    els.valSummary.className = 'summary bad';
    els.valSummary.textContent = `✗ ${plural(errors.length, 'problem')} found`;
    els.errTable.hidden = false;
    errors.slice(0, 500).forEach(e => {
      const tr = document.createElement('tr');
      tr.append(node('td', 'path', jsonPath(e.path)), node('td', null, e.message), node('td', 'val', e.keyword));
      body.append(tr);
    });
  }

  function selectTab(name) {
    els.tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    els.genPanel.hidden = name !== 'generate';
    els.valPanel.hidden = name !== 'validate';
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        sample: els.sample.value.slice(0, 500000), schema: els.schema.value.slice(0, 500000), data: els.data.value.slice(0, 500000),
      }));
    } catch (_) { /* ignore */ }
  }

  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s) { els.sample.value = s.sample || ''; els.schema.value = s.schema || ''; els.data.value = s.data || ''; }
    } catch (_) { /* ignore */ }
  }

  const SAMPLE_DATA = `{
  "id": 1042,
  "email": "ada@example.com",
  "createdAt": "2026-09-26T10:15:00Z",
  "tags": ["admin", "beta"],
  "address": { "city": "London", "zip": "EC1A 1BB" },
  "orders": [
    { "sku": "A-100", "qty": 2, "price": 9.5 },
    { "sku": "B-220", "qty": 1, "price": 24, "gift": true }
  ]
}`;

  const SAMPLE_BAD = `{
  "id": "1042",
  "email": "ada-at-example.com",
  "createdAt": "2026-09-26T10:15:00Z",
  "tags": ["admin", "beta"],
  "address": { "city": "London" },
  "orders": [
    { "sku": "A-100", "qty": 0, "price": 9.5 }
  ],
  "nickname": "Ada"
}`;

  function init() {
    els = {
      tabs: [...document.querySelectorAll('#schemaTabs .tab-btn')],
      genPanel: $('genPanel'), valPanel: $('valPanel'),
      sample: $('genSample'), genOut: $('genOut'), genError: $('genError'),
      optRequired: $('optRequired'), optFormats: $('optFormats'), optAdditional: $('optAdditional'),
      schema: $('valSchema'), data: $('valData'), valResult: $('valResult'), valSummary: $('valSummary'),
      errTable: $('valErrors'), errBody: $('valErrorBody'),
    };
    if (!els.sample) return;
    els.tabs.forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));
    els.sample.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runGenerate, 300); });
    [els.optRequired, els.optFormats, els.optAdditional].forEach(o => o.addEventListener('change', runGenerate));
    [els.schema, els.data].forEach(t => t.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runValidate, 300); }));

    $('genSampleBtn').addEventListener('click', () => { els.sample.value = SAMPLE_DATA; runGenerate(); });
    $('genCopy').addEventListener('click', e => {
      if (!els.genOut.value) return;
      const btn = e.target, label = btn.textContent;
      const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = label; }, 1200); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(els.genOut.value).then(done);
      else { els.genOut.select(); document.execCommand('copy'); done(); }
    });
    $('genUse').addEventListener('click', () => {
      if (!els.genOut.value) return;
      els.schema.value = els.genOut.value;
      els.data.value = els.sample.value;
      selectTab('validate');
      runValidate();
    });
    $('valSampleBtn').addEventListener('click', () => {
      els.sample.value = SAMPLE_DATA;
      els.schema.value = generate(SAMPLE_DATA, { required: true, formats: true, additional: false });
      els.data.value = SAMPLE_BAD;
      runValidate();
    });

    restore();
    runGenerate();
    runValidate();
    selectTab(location.hash === '#validate' ? 'validate' : 'generate');
  }

  document.addEventListener('DOMContentLoaded', init);
  return { generate, runValidation, validate, infer };
})();
