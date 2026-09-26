/* ============================================================
   classgen.js - generate Go, Kotlin, Rust, Pydantic and Zod types
   from a JSON sample, in the browser. Used by the Object Mapper.
   ============================================================ */

'use strict';

const ClassGen = (() => {
  const LANGS = {
    go: 'Go structs',
    kotlin: 'Kotlin data classes',
    rust: 'Rust (serde) structs',
    pydantic: 'Python Pydantic models',
    zod: 'TypeScript Zod schemas',
  };

  // ── Naming ──────────────────────────────────────────────────────────────────
  function words(key) {
    return String(key)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean);
  }
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  function pascal(key) {
    const w = words(key);
    let s = w.length ? w.map(cap).join('') : 'Field';
    if (/^\d/.test(s)) s = 'N' + s;
    return s;
  }
  function camel(key) { const p = pascal(key); return p.charAt(0).toLowerCase() + p.slice(1); }
  function snake(key) {
    const w = words(key);
    let s = w.length ? w.map(x => x.toLowerCase()).join('_') : 'field';
    if (/^\d/.test(s)) s = 'n_' + s;
    return s;
  }
  function singular(name) {
    if (/ies$/.test(name)) return name.slice(0, -3) + 'y';
    if (/(ss|us)$/.test(name)) return name;
    if (/(xes|ches|shes|sses)$/.test(name)) return name.slice(0, -2);
    if (/s$/.test(name) && name.length > 1) return name.slice(0, -1);
    return name + 'Item';
  }

  // ── Type model ──────────────────────────────────────────────────────────────
  // type: {k:'string'|'int'|'float'|'bool'|'null'|'any'} | {k:'array', of} | {k:'object', cls}
  // cls:  {name, fields: Map(key → {type, optional, nullable})}
  function build(sample) {
    const classes = [];
    const used = new Set();
    const uniqueName = base => {
      let n = base || 'Item', i = 2;
      while (used.has(n)) n = base + i++;
      used.add(n);
      return n;
    };

    function typeOf(value, nameHint) {
      if (value === null) return { k: 'null' };
      if (Array.isArray(value)) {
        if (!value.length) return { k: 'array', of: { k: 'any' } };
        const itemHint = singular(nameHint);
        const objs = value.filter(v => v && typeof v === 'object' && !Array.isArray(v));
        if (objs.length === value.length) return { k: 'array', of: { k: 'object', cls: objectClass(objs, itemHint) } };
        const types = value.map(v => typeOf(v, itemHint));
        return { k: 'array', of: types.reduce(mergeTypes) };
      }
      switch (typeof value) {
        case 'string': return { k: 'string' };
        case 'boolean': return { k: 'bool' };
        case 'number': return { k: Number.isInteger(value) ? 'int' : 'float' };
        default: return { k: 'object', cls: objectClass([value], nameHint) };
      }
    }

    // One class from one or more example objects (fields missing in some → optional)
    function objectClass(examples, nameHint) {
      const cls = { name: uniqueName(pascal(nameHint)), fields: new Map() };
      const keys = [];
      examples.forEach(o => Object.keys(o).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
      keys.forEach(k => {
        const present = examples.filter(o => k in o);
        const nonNull = present.map(o => o[k]).filter(v => v !== null);
        let type;
        if (!nonNull.length) type = { k: 'any' };
        else if (nonNull.every(v => v && typeof v === 'object' && !Array.isArray(v))) type = { k: 'object', cls: objectClass(nonNull, k) };
        else if (nonNull.every(Array.isArray)) {
          const flat = nonNull.flat();
          type = typeOf(flat, k);
        } else type = nonNull.map(v => typeOf(v, k)).reduce(mergeTypes);
        cls.fields.set(k, { type, optional: present.length < examples.length, nullable: nonNull.length < present.length });
      });
      classes.push(cls);
      return cls;
    }

    function mergeTypes(a, b) {
      if (a.k === b.k && a.k !== 'object' && a.k !== 'array') return a;
      if ((a.k === 'int' && b.k === 'float') || (a.k === 'float' && b.k === 'int')) return { k: 'float' };
      if (a.k === 'null') return b;
      if (b.k === 'null') return a;
      if (a.k === 'array' && b.k === 'array') return { k: 'array', of: mergeTypes(a.of, b.of) };
      if (a.k === 'object' && b.k === 'object') return a;
      return { k: 'any' };
    }

    let root;
    if (Array.isArray(sample)) root = typeOf(sample, 'Roots');
    else if (sample && typeof sample === 'object') root = { k: 'object', cls: objectClass([sample], 'Root') };
    else root = typeOf(sample, 'Root');
    return { classes, root };   // classes are listed children-first
  }

  // ── Emitters ────────────────────────────────────────────────────────────────
  const identRe = /^[A-Za-z_$][\w$]*$/;

  function goType(t) {
    switch (t.k) {
      case 'string': return 'string';
      case 'int': return 'int64';
      case 'float': return 'float64';
      case 'bool': return 'bool';
      case 'array': return '[]' + goType(t.of);
      case 'object': return t.cls.name;
      default: return 'any';
    }
  }
  function emitGo({ classes, root }) {
    const out = ['// Generated by jsonxmleditor.com/mapper', 'package model', ''];
    classes.slice().reverse().forEach(cls => {
      out.push(`type ${cls.name} struct {`);
      const rows = [...cls.fields].map(([key, f]) => {
        let type = goType(f.type);
        if ((f.optional || f.nullable) && !type.startsWith('[]') && type !== 'any') type = '*' + type;
        return [pascal(key), type, `\`json:"${key}${f.optional ? ',omitempty' : ''}"\``];
      });
      const w1 = Math.max(0, ...rows.map(r => r[0].length)), w2 = Math.max(0, ...rows.map(r => r[1].length));
      rows.forEach(r => out.push(`\t${r[0].padEnd(w1)} ${r[1].padEnd(w2)} ${r[2]}`));
      out.push('}', '');
    });
    if (root.k === 'array') out.push(`type Root ${goType(root)}`, '');
    return out.join('\n').trimEnd() + '\n';
  }

  function ktType(t) {
    switch (t.k) {
      case 'string': return 'String';
      case 'int': return 'Long';
      case 'float': return 'Double';
      case 'bool': return 'Boolean';
      case 'array': return `List<${ktType(t.of)}>`;
      case 'object': return t.cls.name;
      default: return 'JsonElement';
    }
  }
  function emitKotlin({ classes, root }) {
    const usesAny = classes.some(c => [...c.fields.values()].some(f => JSON.stringify(f.type).includes('"any"')));
    const out = ['// Generated by jsonxmleditor.com/mapper', 'import kotlinx.serialization.SerialName', 'import kotlinx.serialization.Serializable'];
    if (usesAny) out.push('import kotlinx.serialization.json.JsonElement');
    out.push('');
    classes.slice().reverse().forEach(cls => {
      out.push('@Serializable', `data class ${cls.name}(`);
      const fields = [...cls.fields];
      fields.forEach(([key, f], i) => {
        const name = camel(key);
        const nullable = f.optional || f.nullable || f.type.k === 'any';
        const ann = name !== key ? `@SerialName("${key}") ` : '';
        out.push(`    ${ann}val ${name}: ${ktType(f.type)}${nullable ? '? = null' : ''}${i < fields.length - 1 ? ',' : ''}`);
      });
      out.push(')', '');
    });
    if (root.k === 'array') out.push(`typealias Root = ${ktType(root)}`, '');
    return out.join('\n').trimEnd() + '\n';
  }

  const RUST_KEYWORDS = new Set(['type', 'match', 'ref', 'self', 'struct', 'enum', 'fn', 'impl', 'use', 'mod', 'move', 'loop', 'where', 'box', 'crate', 'dyn', 'in', 'let', 'mut', 'pub', 'static', 'super', 'trait', 'as', 'async', 'await', 'const', 'else', 'extern', 'false', 'true', 'for', 'if', 'return', 'unsafe', 'while', 'break', 'continue']);
  function rsType(t) {
    switch (t.k) {
      case 'string': return 'String';
      case 'int': return 'i64';
      case 'float': return 'f64';
      case 'bool': return 'bool';
      case 'array': return `Vec<${rsType(t.of)}>`;
      case 'object': return t.cls.name;
      default: return 'serde_json::Value';
    }
  }
  function emitRust({ classes, root }) {
    const out = ['// Generated by jsonxmleditor.com/mapper', 'use serde::{Deserialize, Serialize};', ''];
    classes.slice().reverse().forEach(cls => {
      out.push('#[derive(Debug, Clone, Serialize, Deserialize)]', `pub struct ${cls.name} {`);
      [...cls.fields].forEach(([key, f]) => {
        let name = snake(key);
        const raw = RUST_KEYWORDS.has(name);
        if (name !== key) out.push(`    #[serde(rename = "${key}")]`);
        let type = rsType(f.type);
        if (f.optional || f.nullable) {
          type = `Option<${type}>`;
          if (f.optional) out.push('    #[serde(default, skip_serializing_if = "Option::is_none")]');
        }
        out.push(`    pub ${raw ? 'r#' + name : name}: ${type},`);
      });
      out.push('}', '');
    });
    if (root.k === 'array') out.push(`pub type Root = ${rsType(root)};`, '');
    return out.join('\n').trimEnd() + '\n';
  }

  const PY_KEYWORDS = new Set(['class', 'def', 'from', 'import', 'global', 'lambda', 'return', 'yield', 'pass', 'raise', 'with', 'as', 'assert', 'async', 'await', 'break', 'continue', 'del', 'elif', 'else', 'except', 'finally', 'for', 'if', 'in', 'is', 'nonlocal', 'not', 'or', 'and', 'try', 'while', 'None', 'True', 'False']);
  function pyType(t) {
    switch (t.k) {
      case 'string': return 'str';
      case 'int': return 'int';
      case 'float': return 'float';
      case 'bool': return 'bool';
      case 'array': return `list[${pyType(t.of)}]`;
      case 'object': return t.cls.name;
      default: return 'Any';
    }
  }
  function emitPydantic({ classes, root }) {
    const body = [];
    let needsField = false, needsAny = false;
    classes.forEach(cls => {
      body.push(`class ${cls.name}(BaseModel):`);
      let aliased = false;
      const lines = [];
      [...cls.fields].forEach(([key, f]) => {
        let name = snake(key);
        if (PY_KEYWORDS.has(name)) name += '_';
        let type = pyType(f.type);
        if (type.includes('Any')) needsAny = true;
        const nullable = f.optional || f.nullable;
        if (nullable && type !== 'Any') type = `${type} | None`;
        let def = '';
        if (name !== key) {
          aliased = true;
          needsField = true;
          def = nullable ? ` = Field(default=None, alias="${key}")` : ` = Field(alias="${key}")`;
        } else if (nullable) def = ' = None';
        lines.push(`    ${name}: ${type}${def}`);
      });
      if (aliased) body.push('    model_config = ConfigDict(populate_by_name=True)', '');
      body.push(...(lines.length ? lines : ['    pass']), '', '');
    });
    if (root.k === 'array') body.push(`Root = RootModel[${pyType(root)}]`, '');
    const imports = ['# Generated by jsonxmleditor.com/mapper', 'from __future__ import annotations', ''];
    if (needsAny) imports.push('from typing import Any', '');
    const pd = ['BaseModel'];
    if (needsField) pd.push('ConfigDict', 'Field');
    if (root.k === 'array') pd.push('RootModel');
    imports.push(`from pydantic import ${pd.join(', ')}`, '', '');
    return (imports.join('\n') + body.join('\n')).trimEnd() + '\n';
  }

  function zodType(t) {
    switch (t.k) {
      case 'string': return 'z.string()';
      case 'int': return 'z.number().int()';
      case 'float': return 'z.number()';
      case 'bool': return 'z.boolean()';
      case 'array': return `z.array(${zodType(t.of)})`;
      case 'object': return `${t.cls.name}Schema`;
      default: return 'z.unknown()';
    }
  }
  function emitZod({ classes, root }) {
    const out = ['// Generated by jsonxmleditor.com/mapper', "import { z } from 'zod';", ''];
    classes.forEach(cls => {
      out.push(`export const ${cls.name}Schema = z.object({`);
      [...cls.fields].forEach(([key, f]) => {
        let t = zodType(f.type);
        if (f.nullable) t += '.nullable()';
        if (f.optional) t += '.optional()';
        out.push(`  ${identRe.test(key) ? key : JSON.stringify(key)}: ${t},`);
      });
      out.push('});', `export type ${cls.name} = z.infer<typeof ${cls.name}Schema>;`, '');
    });
    if (root.k === 'array') out.push(`export const RootSchema = ${zodType(root)};`, 'export type Root = z.infer<typeof RootSchema>;', '');
    return out.join('\n').trimEnd() + '\n';
  }

  const EMIT = { go: emitGo, kotlin: emitKotlin, rust: emitRust, pydantic: emitPydantic, zod: emitZod };

  function generate(jsonText, lang) {
    let sample;
    try { sample = JSON.parse(jsonText); }
    catch (e) { throw new Error('The input is not valid JSON. ' + e.message); }
    if (sample === null || typeof sample !== 'object') throw new Error('Paste a JSON object or an array of objects.');
    return EMIT[lang](build(sample));
  }

  return { LANGS, handles: lang => lang in EMIT, generate, build };
})();
