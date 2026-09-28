import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import JavaScriptObfuscator from 'javascript-obfuscator';
import CleanCSS from 'clean-css';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';

const [, , srcArg = '../src/main/resources/static', outArg = './dist'] = process.argv;
const SRC = path.resolve(srcArg);
const OUT = path.resolve(outArg);

const COPY_AS_IS = [/^js\/vendor\//, /^google[0-9a-f]+\.html$/];

const OBFUSCATE = {
  compact: true,
  target: 'browser',
  renameGlobals: false,
  identifierNamesGenerator: 'mangled',
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: [],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 0,
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  numbersToExpressions: false,
  simplify: true,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
};

const HTML = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  minifyCSS: { level: 1 },
  minifyJS: { compress: true, mangle: true, format: { comments: false } },
  keepClosingSlash: true,
  decodeEntities: false,
};

const css = new CleanCSS({ level: 1, returnPromise: false });

const usedIds = new Map();
function shortId(rel) {
  let h = 2166136261;
  for (const ch of rel) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let id = '_' + h.toString(36).slice(0, 4);
  while (usedIds.has(id) && usedIds.get(id) !== rel) id += 'x';
  usedIds.set(id, rel);
  return id;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

function checkJs(code, rel) {
  try { new vm.Script(code, { filename: rel }); }
  catch (e) {
    if (!/Cannot use import statement|await is only valid|export/.test(e.message)) throw new Error(`${rel}: output is not valid JavaScript: ${e.message}`);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
let before = 0, after = 0, count = 0;

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const ext = path.extname(file).toLowerCase();

  if (COPY_AS_IS.some(re => re.test(rel)) || !['.js', '.css', '.html'].includes(ext)) {
    fs.copyFileSync(file, dest);
    continue;
  }

  const input = fs.readFileSync(file, 'utf8');
  let output;
  if (ext === '.js') {
    const small = (await minifyJs(input, { compress: { passes: 2 }, mangle: true, format: { comments: false } })).code;
    const prefix = shortId(rel);
    output = JavaScriptObfuscator.obfuscate(small, { ...OBFUSCATE, identifiersPrefix: prefix }).getObfuscatedCode();
    checkJs(output, rel);
  } else if (ext === '.css') {
    const r = css.minify(input);
    if (r.errors.length) throw new Error(`${rel}: ${r.errors.join('; ')}`);
    output = r.styles;
  } else {
    output = await minifyHtml(input, HTML);
  }
  fs.writeFileSync(dest, output);
  before += Buffer.byteLength(input);
  after += Buffer.byteLength(output);
  count++;
}

console.log(`Processed ${count} files: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (vendor and other files copied unchanged)`);
