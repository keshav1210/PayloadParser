/* ============================================================
   markdown.js - Markdown editor with live preview (GitHub-style
   tables, task lists, fenced code), toolbar, word count and
   export to HTML or .md. Rendering: marked (MIT); the HTML is
   cleaned with DOMPurify so pasted content can't run scripts.
   ============================================================ */

'use strict';

const MarkdownTool = (() => {
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.markdown';
  let els, timer = null;

  const SAMPLE = `# Project name

A short description of what this project does and **why** someone would use it.

## Features

- Fast: formats a 10 MB file in under a second
- Works offline, no account needed
- [x] JSON and XML
- [ ] YAML (coming soon)

## Installation

\`\`\`bash
npm install my-project
\`\`\`

## Usage

\`\`\`js
import { format } from 'my-project';
console.log(format('{"a":1}'));
\`\`\`

| Option   | Default | Description              |
|----------|:-------:|--------------------------|
| \`indent\` | \`2\`     | Spaces per level         |
| \`sort\`   | \`false\` | Sort object keys A to Z |

> **Note:** Settings can also be read from \`.myprojectrc\`.

See the [documentation](https://example.com/docs) for more.
`;

  function render() {
    const md = els.input.value;
    try { localStorage.setItem(STORE, md); } catch (_) { /* ignore */ }
    const raw = marked.parse(md, { gfm: true, breaks: els.breaks.checked });
    els.preview.innerHTML = DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
    els.preview.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    const text = els.preview.textContent.trim();
    const words = text ? text.split(/\s+/).length : 0;
    els.stats.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'} · ${md.length.toLocaleString()} characters · ${Math.max(1, Math.round(words / 230))} min read`;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────
  function wrap(before, after = before, placeholder = 'text') {
    const ta = els.input;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, 'end');
    ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    ta.focus();
    render();
  }

  function linePrefix(prefix) {
    const ta = els.input;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e);
    const lines = block.split('\n');
    const allHave = lines.every(l => l.startsWith(prefix));
    const out = lines.map((l, i) => {
      if (allHave) return l.slice(prefix.length);
      return (prefix === '1. ' ? `${i + 1}. ` : prefix) + l;
    }).join('\n');
    ta.setRangeText(out, lineStart, e, 'select');
    ta.focus();
    render();
  }

  const ACTIONS = {
    bold: () => wrap('**'),
    italic: () => wrap('_'),
    strike: () => wrap('~~'),
    code: () => wrap('`', '`', 'code'),
    h1: () => linePrefix('# '),
    h2: () => linePrefix('## '),
    h3: () => linePrefix('### '),
    ul: () => linePrefix('- '),
    ol: () => linePrefix('1. '),
    task: () => linePrefix('- [ ] '),
    quote: () => linePrefix('> '),
    link: () => wrap('[', '](https://)', 'link text'),
    image: () => wrap('![', '](https://)', 'alt text'),
    codeblock: () => wrap('\n```\n', '\n```\n', 'code'),
    table: () => wrap('\n| Column 1 | Column 2 |\n|----------|----------|\n| ', ' |          |\n', 'Cell'),
    hr: () => wrap('\n\n---\n\n', '', ''),
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const EXPORT_CSS = `body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;color:#1f2328}
h1,h2{border-bottom:1px solid #d0d7de;padding-bottom:.3em}code{background:#f6f8fa;padding:.2em .4em;border-radius:6px;font:85% Consolas,monospace}
pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto}pre code{background:none;padding:0}blockquote{margin:0;padding:0 1em;color:#59636e;border-left:.25em solid #d0d7de}
table{border-collapse:collapse}th,td{border:1px solid #d0d7de;padding:6px 13px}img{max-width:100%}a{color:#0969da}`;

  // Print layout for PDF: page size, margins, page numbers, no code blocks or rows split across pages
  const PRINT_CSS = size => `@page{size:${size};margin:18mm 16mm 20mm;@bottom-right{content:counter(page) " / " counter(pages);font:9pt -apple-system,"Segoe UI",Arial,sans-serif;color:#8c959f}}
html,body{background:#fff}body{max-width:none;margin:0;padding:0;font-size:11pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font-size:22pt}h2{font-size:16pt}h3{font-size:13pt}h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}
pre{white-space:pre-wrap;word-break:break-word;overflow:visible;font-size:9pt}code{font-size:9.5pt}pre code{font-size:9pt}pre,blockquote,img,tr,li{break-inside:avoid;page-break-inside:avoid}
table{width:auto;max-width:100%}thead{display:table-header-group}p,li{orphans:3;widows:3}a{text-decoration:none}
input[type=checkbox]{margin-right:6px}li:has(>input[type=checkbox]){list-style:none;margin-left:-1.2em}`;

  // Wait for images in the print frame (max 4 s) so they appear in the PDF
  function imagesLoaded(doc) {
    const imgs = [...doc.images].filter(i => !i.complete);
    return Promise.race([
      Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))),
      new Promise(r => setTimeout(r, 4000)),
    ]);
  }

  async function exportPdf(btn) {
    if (!els.input.value.trim()) { flash(btn, 'Nothing to export'); return; }
    const title = docTitle().replace(/[<>&"]/g, '');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><base href="${location.origin}/">` +
      `<style>${EXPORT_CSS}\n${PRINT_CSS(els.paper.value)}</style></head><body>${els.preview.innerHTML}</body></html>`);
    doc.close();
    await imagesLoaded(doc);

    // Browsers name the saved PDF after the page title
    const oldTitle = document.title;
    document.title = title;
    const cleanup = () => {
      document.title = oldTitle;
      setTimeout(() => frame.remove(), 500);
    };
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    els.pdfHint.hidden = false;
    setTimeout(() => { els.pdfHint.hidden = true; }, 12000);
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // Some browsers don't fire afterprint for iframes; restore anyway
    setTimeout(() => { if (document.title === title) document.title = oldTitle; }, 3000);
    setTimeout(() => frame.isConnected && frame.remove(), 60000);
  }

  function docTitle() {
    const h = els.preview.querySelector('h1, h2');
    return (h ? h.textContent : 'Document').trim().slice(0, 80);
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function flash(btn, text) {
    const t = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = t; }, 1300);
  }

  function setView(v) {
    els.layout.dataset.view = v;
    document.querySelectorAll('[data-md-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mdView === v)));
  }

  function init() {
    els = { input: $('mdInput'), preview: $('mdPreview'), stats: $('mdStats'), breaks: $('mdBreaks'), layout: $('mdLayout'), paper: $('mdPaper'), pdfHint: $('mdPdfHint') };
    if (!els.input) return;
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch (_) { /* ignore */ }
    els.input.value = saved !== null && saved !== '' ? saved : SAMPLE;

    els.input.addEventListener('input', schedule);
    els.breaks.addEventListener('change', render);
    document.querySelectorAll('[data-md]').forEach(b => b.addEventListener('click', () => ACTIONS[b.dataset.md]()));
    document.querySelectorAll('[data-md-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.mdView)));
    els.input.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) {
        if (e.key === 'Tab') { e.preventDefault(); els.input.setRangeText('  ', els.input.selectionStart, els.input.selectionEnd, 'end'); schedule(); }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); ACTIONS.bold(); }
      else if (k === 'i') { e.preventDefault(); ACTIONS.italic(); }
      else if (k === 'k' && e.shiftKey) { e.preventDefault(); ACTIONS.link(); }
    });
    // keep the preview roughly in step with the editor
    els.input.addEventListener('scroll', () => {
      const ta = els.input, pv = els.preview;
      const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
      pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight);
    });

    $('mdCopyHtml').addEventListener('click', e => navigator.clipboard.writeText(els.preview.innerHTML).then(() => flash(e.target, 'Copied')));
    $('mdCopyMd').addEventListener('click', e => navigator.clipboard.writeText(els.input.value).then(() => flash(e.target, 'Copied')));
    $('mdDownloadMd').addEventListener('click', () => download('README.md', els.input.value, 'text/markdown'));
    $('mdDownloadHtml').addEventListener('click', () => {
      const title = docTitle().replace(/[<>&]/g, '');
      download('document.html', `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${els.preview.innerHTML}\n</body>\n</html>\n`, 'text/html');
    });
    $('mdDownloadPdf').addEventListener('click', e => exportPdf(e.currentTarget));
    try { const p = localStorage.getItem(STORE + '.paper'); if (p) els.paper.value = p; } catch (_) { /* ignore */ }
    els.paper.addEventListener('change', () => { try { localStorage.setItem(STORE + '.paper', els.paper.value); } catch (_) { /* ignore */ } });
    $('mdOpen').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) f.text().then(t => { els.input.value = t; render(); });
      e.target.value = '';
    });
    $('mdSample').addEventListener('click', () => { els.input.value = SAMPLE; render(); });
    $('mdClear').addEventListener('click', () => { els.input.value = ''; render(); els.input.focus(); });
    setView(window.innerWidth < 860 ? 'edit' : 'split');
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
