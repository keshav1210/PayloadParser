
'use strict';

const CodeFmtTool = (() => {
  function minifyCss(css) {
    const saved = [];
    const keep = s => `\u0000${saved.push(s) - 1}\u0000`;
    let s = css.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g, keep)
      .replace(/url\(\s*([^)'"]*?)\s*\)/gi, m => keep(m.replace(/\s+/g, '')));
    s = s.replace(/\/\*(?!!)[\s\S]*?\*\//g, '');
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/\b(calc|min|max|clamp)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, (m, fn, body) => keep(`${fn}(${body.trim().replace(/\s*([*/,])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')})`));
    s = s.replace(/\s*([{};:,>~+])\s*/g, '$1');
    s = s.replace(/;}/g, '}').replace(/\s*!important/g, '!important');
    s = s.replace(/(^|[^\w.-])0(?:px|em|rem|%|pt|vh|vw)(?=[;}\s!,)])/g, '$10');
    s = s.replace(/(:|\s|,)0+\.(\d)/g, '$1.$2');
    s = s.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, '#$1$2$3');
    s = s.replace(/[^{}]+\{\}/g, '');
    for (let i = 0; i < 3 && s.includes('\u0000'); i++) s = s.replace(/\u0000(\d+)\u0000/g, (m, n) => saved[n]);
    return s.trim();
  }

  const BLOCK = new Set(('html head body title meta link style script base div p ul ol li dl dt dd table thead tbody tfoot tr td th caption colgroup col ' +
    'section article aside header footer nav main h1 h2 h3 h4 h5 h6 form fieldset legend hr br pre blockquote figure figcaption address details summary ' +
    'option optgroup select iframe noscript template svg canvas video audio source track picture').split(' '));

  function minifyHtml(html) {
    const saved = [];
    const keep = s => `\u0000${saved.push(s) - 1}\u0000`;
    let s = html
      .replace(/<(pre|textarea)\b[\s\S]*?<\/\1>/gi, keep)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, keep)
      .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, body, b) => keep(a.replace(/\s+/g, ' ') + minifyCss(body) + b))
      .replace(/<!--(?!\[if|<!|\s*ko\b)[\s\S]*?-->/g, '');
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/\s*(<\/?([a-zA-Z][\w-]*)\b[^>]*>)\s*/g, (m, tag, name) => (BLOCK.has(name.toLowerCase()) ? tag : m.replace(/^\s+/, ' ').replace(/\s+$/, ' ')));
    s = s.replace(/\s*(<!DOCTYPE[^>]*>)\s*/i, '$1');
    s = s.replace(/<([a-zA-Z][^>]*?)\s+(\/?)>/g, '<$1$2>');
    s = s.replace(/ {2,}/g, ' ');
    for (let i = 0; i < 3 && s.includes('\u0000'); i++) s = s.replace(/\u0000(\d+)\u0000/g, (m, n) => saved[n]);
    return s.trim();
  }

  let terserLoading = null;
  function loadTerser() {
    if (window.Terser) return Promise.resolve();
    if (!terserLoading) {
      terserLoading = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = '/js/vendor/terser.min.js?v=5.37.0';
        sc.onload = resolve;
        sc.onerror = () => { terserLoading = null; reject(new Error('Could not load the JavaScript minifier. Check your connection and try again.')); };
        document.head.append(sc);
      });
    }
    return terserLoading;
  }

  async function minifyJs(code, mangle) {
    await loadTerser();
    const r = await Terser.minify(code, { compress: { passes: 2 }, mangle, format: { comments: /^!|@license|@preserve/ } });
    return r.code;
  }

  function detect(code) {
    const t = code.trim();
    if (/^</.test(t)) return 'html';
    if (/^(@(media|import|charset|font-face|keyframes|supports|layer)|[.#:\w\[*][^{;=()]*\{[^}]*:[^}]*\})/i.test(t) && !/\b(function|=>|const|let|var|return)\b/.test(t)) return 'css';
    return 'js';
  }

  const $ = id => document.getElementById(id);
  const STORE = 'jxe.codefmt';
  let els, lang = 'html', output = '';

  const SAMPLES = {
    html: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Sample page</title><style>body{margin:0;font-family:system-ui}.card{padding:16px;border:1px solid #dddddd}</style></head><body><!-- main content --><main><div class="card"><h1>Hello</h1><p>This is <b>bold</b> and <i>italic</i> text.</p><ul><li>One</li><li>Two</li></ul></div></main><script>document.querySelector("h1").addEventListener("click",function(){alert("hi")})</script></body></html>',
    css: '/* layout */\n.container{max-width:1200px;margin:0 auto;padding:0px 16px}\n.btn,.btn:hover{color:#ffffff;background:#2f6fed;padding:8px 14px;border-radius:6px;transition:background .2s ease}\n@media (max-width:600px){.container{padding:0 8px}.btn{width:calc(100% - 16px)}}',
    js: 'const greet=function(name){if(!name){return "Hello, stranger"}const parts=["Hello",name];return parts.join(", ")+"!"};\nasync function load(url){const res=await fetch(url);if(!res.ok)throw new Error("HTTP "+res.status);return res.json()}\nexport {greet,load};',
  };

  function opts() {
    const ind = els.indent.value;
    return {
      indent_size: ind === 'tab' ? 1 : +ind, indent_char: ind === 'tab' ? '\t' : ' ', indent_with_tabs: ind === 'tab',
      wrap_line_length: +els.wrap.value, brace_style: els.brace.value, preserve_newlines: true, max_preserve_newlines: 2,
      end_with_newline: true, indent_inner_html: true, wrap_attributes: els.attrs.value, extra_liners: [],
      space_after_anon_function: false, e4x: true,
    };
  }

  function setLang(l) {
    lang = l;
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.lang === l)));
    els.attrsWrap.hidden = l !== 'html';
    els.braceWrap.hidden = l === 'html';
    els.mangleWrap.hidden = l !== 'js';
    save();
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ lang, code: els.input.value.length < 500000 ? els.input.value : '', indent: els.indent.value, wrap: els.wrap.value })); } catch (_) {  }
  }

  const kb = n => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

  function showResult(text, action) {
    output = text;
    els.output.value = text;
    const before = new Blob([els.input.value]).size, after = new Blob([text]).size;
    const diff = before ? Math.round((1 - after / before) * 100) : 0;
    els.stats.textContent = action === 'minify'
      ? `${kb(before)} → ${kb(after)} (${diff >= 0 ? diff + '% smaller' : Math.abs(diff) + '% larger'})`
      : `${text.split('\n').length} lines · ${kb(after)}`;
  }

  async function run(action) {
    const code = els.input.value;
    els.error.hidden = true;
    if (!code.trim()) { showResult('', action); return; }
    save();
    try {
      let out;
      if (action === 'beautify') {
        const o = opts();
        out = lang === 'html' ? html_beautify(code, o) : lang === 'css' ? css_beautify(code, o) : js_beautify(code, o);
      } else if (lang === 'css') out = minifyCss(code);
      else if (lang === 'html') out = minifyHtml(code);
      else {
        els.stats.textContent = 'Minifying…';
        out = await minifyJs(code, els.mangle.checked);
      }
      showResult(out, action);
    } catch (e) {
      const msg = e.line ? `Syntax error on line ${e.line}, column ${e.col + 1}: ${e.message}` : e.message;
      els.error.textContent = msg;
      els.error.hidden = false;
      output = '';
      els.output.value = '';
      els.stats.textContent = '';
    }
  }

  function flash(btn, text) {
    const t = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = t; }, 1300);
  }

  function init() {
    els = {
      input: $('cfInput'), output: $('cfOutput'), stats: $('cfStats'), error: $('cfError'), indent: $('cfIndent'), wrap: $('cfWrap'),
      brace: $('cfBrace'), attrs: $('cfAttrs'), mangle: $('cfMangle'), attrsWrap: $('cfAttrsWrap'), braceWrap: $('cfBraceWrap'), mangleWrap: $('cfMangleWrap'),
    };
    if (!els.input) return;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (_) {  }
    const hashLang = location.hash.slice(1);
    if (s) { els.indent.value = s.indent || '2'; els.wrap.value = s.wrap || '0'; }
    const startLang = ['html', 'css', 'js'].includes(hashLang) ? hashLang : (s && s.lang) || 'html';
    els.input.value = s && s.code && (!hashLang || hashLang === s.lang) ? s.code : SAMPLES[startLang];
    setLang(startLang);

    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
      const wasSample = Object.values(SAMPLES).includes(els.input.value) || !els.input.value.trim();
      setLang(b.dataset.lang);
      if (wasSample) { els.input.value = SAMPLES[lang]; run('beautify'); }
      else { output = ''; els.output.value = ''; els.stats.textContent = ''; els.error.hidden = true; }
    }));
    els.input.addEventListener('paste', () => setTimeout(() => {
      const d = detect(els.input.value);
      if (d !== lang) { setLang(d); els.detectNote.hidden = false; setTimeout(() => { els.detectNote.hidden = true; }, 3000); }
    }, 0));
    els.detectNote = $('cfDetected');
    $('cfBeautify').addEventListener('click', () => run('beautify'));
    $('cfMinify').addEventListener('click', () => run('minify'));
    $('cfCopy').addEventListener('click', e => { if (output) navigator.clipboard.writeText(output).then(() => flash(e.target, 'Copied')); });
    $('cfUse').addEventListener('click', () => { if (output) { els.input.value = output; save(); } });
    $('cfDownload').addEventListener('click', () => {
      if (!output) return;
      const ext = { html: 'html', css: 'css', js: 'js' }[lang];
      const url = URL.createObjectURL(new Blob([output], { type: 'text/plain' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `code.${ext}` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('cfFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const l = { htm: 'html', html: 'html', css: 'css', js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js' }[ext];
      f.text().then(t => { els.input.value = t; setLang(l || detect(t)); run('beautify'); });
      e.target.value = '';
    });
    [els.indent, els.wrap, els.brace, els.attrs].forEach(e => e.addEventListener('change', () => run('beautify')));
    els.input.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(e.shiftKey ? 'minify' : 'beautify'); }
    });
    run('beautify');
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { minifyCss, minifyHtml, detect };
})();
