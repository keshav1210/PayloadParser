'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const MAX_PDF_PAGES = 15;

  let worker = null, workerLang = '', busy = false, onProgress = null, pdfjs = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the text recognition engine. Check your connection and try again.'));
      document.head.append(s);
    });
  }

  async function getWorker() {
    const lang = $('ocLang').value;
    if (worker && workerLang === lang) return worker;
    if (!window.Tesseract) await loadScript(TESSERACT);
    if (worker) { await worker.terminate(); worker = null; }
    worker = await Tesseract.createWorker(lang, 1, {
      logger: m => { if (onProgress) onProgress(m); },
    });
    workerLang = lang;
    return worker;
  }

  async function getPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import(PDFJS);
    const blob = new Blob([`import "${PDFJS_WORKER}";`], { type: 'text/javascript' });
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(blob), { type: 'module' });
    return pdfjs;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`“${file.name || 'image'}” could not be opened. Use JPG, PNG, WebP, GIF, BMP or PDF (iPhone HEIC photos need converting first).`)); };
      img.src = url;
    });
  }

  function prepare(source, w, h) {
    const enhance = $('ocEnhance').checked;
    const longest = Math.max(w, h);
    const scale = longest < 1600 ? Math.min(3, 2000 / longest) : longest > 4200 ? 4200 / longest : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, c.width, c.height);
    if (enhance) {
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      const hist = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) {
        const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0;
        px[i] = g;
        hist[g]++;
      }
      const total = px.length / 4;
      let lo = 0, hi = 255, acc = 0;
      while (lo < 255 && (acc += hist[lo]) < total * 0.01) lo++;
      acc = 0;
      while (hi > 0 && (acc += hist[hi]) < total * 0.01) hi--;
      const range = Math.max(1, hi - lo);
      for (let i = 0; i < px.length; i += 4) {
        const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / range));
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
    }
    return c;
  }

  async function recognize(canvas, label, progress) {
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: $('ocLayout').value, preserve_interword_spaces: '1' });
    onProgress = m => {
      if (m.status === 'recognizing text') progress(`Reading ${label}…`, m.progress);
      else if (/loading|initializ/i.test(m.status)) progress('Loading the text recognition engine (first time only)…', m.progress);
    };
    const { data } = await w.recognize(canvas);
    onProgress = null;
    return { text: tidy(data.text), confidence: data.confidence };
  }

  function tidy(t) {
    return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function pdfPages(file, progress) {
    progress('Opening PDF…', 0);
    const lib = await getPdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const count = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages = [];
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const text = tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('');
      if (text.replace(/\s/g, '').length > 40) { pages.push({ text: tidy(text), direct: true }); continue; }
      const vp = page.getViewport({ scale: 2.2 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pages.push({ canvas: c });
    }
    return { pages, total: doc.numPages, count };
  }

  async function extractFile(file, progress, preview) {
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      const { pages, total, count } = await pdfPages(file, progress);
      const out = [];
      let direct = 0, conf = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (preview && i === 0 && p.canvas) preview(p.canvas.toDataURL('image/jpeg', 0.8));
        if (p.direct) { out.push(p.text); direct++; continue; }
        const r = await recognize(prepare(p.canvas, p.canvas.width, p.canvas.height), `page ${i + 1} of ${count}`, progress);
        out.push(r.text);
        conf.push(r.confidence);
      }
      const notes = [];
      if (direct) notes.push(direct === pages.length ? 'Text was read directly from the PDF, so it is exact.' : `${direct} page${direct === 1 ? '' : 's'} had real text and ${pages.length - direct} were scanned images.`);
      if (total > count) notes.push(`Only the first ${count} of ${total} pages were read.`);
      return { text: out.map((t, i) => (pages.length > 1 ? `--- Page ${i + 1} ---\n` : '') + t).join('\n\n'), confidence: conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : null, notes };
    }
    const { img, url } = await loadImage(file);
    if (preview) preview(url);
    const r = await recognize(prepare(img, img.naturalWidth, img.naturalHeight), file.name || 'image', progress);
    return { text: r.text, confidence: r.confidence, notes: [] };
  }

  function progressUi(box) {
    return (label, p) => {
      box.hidden = false;
      box.querySelector('span').textContent = label;
      box.querySelector('i').style.width = `${Math.round((p || 0) * 100)}%`;
    };
  }

  function confNote(c) {
    if (c === null || c === undefined) return '';
    const v = Math.round(c);
    const cls = v >= 85 ? 'ok' : v >= 65 ? 'warn' : 'bad';
    return `<span class="badge ${cls}">${v}% confidence</span>${v < 65 ? ' <span class="muted">Low: try a sharper, straighter photo with more light, or tick “Enhance photo”.</span>' : ''}`;
  }

  function wireDrop(zone, input, onFiles) {
    zone.addEventListener('click', e => { if (e.target === zone || zone.contains(e.target)) input.click(); });
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
    input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
  }

  async function guard(fn, errBox) {
    if (busy) return;
    busy = true;
    errBox.hidden = true;
    document.body.classList.add('oc-busy');
    try { await fn(); }
    catch (e) { errBox.textContent = e.message || String(e); errBox.hidden = false; }
    finally { busy = false; document.body.classList.remove('oc-busy'); }
  }

  async function runExtract(files) {
    const prog = $('exProgress');
    await guard(async () => {
      const parts = [], notes = [], confs = [];
      $('exPreview').innerHTML = '';
      for (const f of files) {
        const r = await extractFile(f, progressUi(prog), src => {
          $('exPreview').insertAdjacentHTML('beforeend', `<figure><img src="${src}" alt=""><figcaption>${esc(f.name || 'pasted image')}</figcaption></figure>`);
        });
        parts.push(files.length > 1 ? `=== ${f.name} ===\n${r.text}` : r.text);
        notes.push(...r.notes);
        if (r.confidence !== null) confs.push(r.confidence);
      }
      prog.hidden = true;
      const text = parts.join('\n\n');
      $('exText').value = text;
      $('exResult').hidden = false;
      const words = text.split(/\s+/).filter(Boolean).length;
      $('exMeta').innerHTML = `${words.toLocaleString('en-US')} words · ${text.split('\n').length.toLocaleString('en-US')} lines ${confs.length ? confNote(confs.reduce((a, b) => a + b, 0) / confs.length) : ''}${notes.length ? `<br><span class="muted">${notes.map(esc).join(' ')}</span>` : ''}`;
      if (!text) $('exMeta').innerHTML = '<span class="badge warn">No text found</span> <span class="muted">Make sure the text is in focus and not too small, and check the language.</span>';
    }, $('exError'));
    prog.hidden = true;
  }

  async function runSide(key, file) {
    const prog = $(`cp${key.toUpperCase()}Progress`);
    await guard(async () => {
      const r = await extractFile(file, progressUi(prog), src => {
        $(`cp${key.toUpperCase()}Preview`).innerHTML = `<img src="${src}" alt="">`;
      });
      $(`cp${key.toUpperCase()}Text`).value = r.text;
      $(`cp${key.toUpperCase()}Name`).textContent = file.name || 'pasted image';
      $(`cp${key.toUpperCase()}Meta`).innerHTML = confNote(r.confidence) + (r.notes.length ? ` <span class="muted">${r.notes.map(esc).join(' ')}</span>` : '');
    }, $('cpError'));
    prog.hidden = true;
    if ($('cpAText').value.trim() && $('cpBText').value.trim()) compare();
  }

  function normalizer() {
    const ic = $('cpCase').checked, ip = $('cpPunct').checked;
    return l => {
      let s = l.trim().replace(/\s+/g, ' ');
      if (ic) s = s.toLowerCase();
      if (ip) s = s.replace(/[^\p{L}\p{N}\s.,-]/gu, '').replace(/\s+/g, ' ').trim();
      return s;
    };
  }

  const NUM = /[-+]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:[.,]\d+)?/g;
  const nums = s => (s.match(NUM) || []).map(x => x.trim());

  let lastReport = null;

  function compare() {
    const norm = normalizer();
    const A = $('cpAText').value.split('\n').filter(l => l.trim()), B = $('cpBText').value.split('\n').filter(l => l.trim());
    if (!A.length || !B.length) { $('cpResult').hidden = true; return; }
    const parts = Diff.diffArrays(A.map(norm), B.map(norm));
    const rows = [];
    let ia = 0, ib = 0;
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (!p.added && !p.removed) {
        for (let j = 0; j < p.count; j++) rows.push({ t: 'same', a: A[ia++], b: B[ib++] });
        continue;
      }
      if (p.removed && parts[k + 1] && parts[k + 1].added) {
        const q = parts[k + 1];
        const n = Math.max(p.count, q.count);
        for (let j = 0; j < n; j++) {
          if (j < p.count && j < q.count) rows.push({ t: 'chg', a: A[ia++], b: B[ib++] });
          else if (j < p.count) rows.push({ t: 'del', a: A[ia++] });
          else rows.push({ t: 'add', b: B[ib++] });
        }
        k++;
        continue;
      }
      for (let j = 0; j < p.count; j++) rows.push(p.removed ? { t: 'del', a: A[ia++] } : { t: 'add', b: B[ib++] });
    }

    const cnt = { same: 0, chg: 0, del: 0, add: 0 };
    rows.forEach(r => cnt[r.t]++);
    const amounts = [];
    for (const r of rows) {
      if (r.t !== 'chg') continue;
      const na = nums(r.a), nb = nums(r.b);
      if (na.join('|') !== nb.join('|') && (na.length || nb.length)) {
        const label = r.b.replace(NUM, ' ').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim() || r.a.replace(NUM, ' ').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim() || '(line)';
        amounts.push({ label, a: na.join('  '), b: nb.join('  ') });
      }
    }
    const ic = $('cpCase').checked;
    const wordDiff = (a, b) => {
      const d = Diff.diffWordsWithSpace(a, b, { ignoreCase: ic });
      return [
        d.filter(x => !x.added).map(x => (x.removed ? `<del>${esc(x.value)}</del>` : esc(x.value))).join(''),
        d.filter(x => !x.removed).map(x => (x.added ? `<ins>${esc(x.value)}</ins>` : esc(x.value))).join(''),
      ];
    };
    const only = $('cpOnly').checked;
    const html = rows.map(r => {
      if (r.t === 'same') return only ? '' : `<tr class="oc-same"><td>${esc(r.a)}</td><td>${esc(r.b)}</td></tr>`;
      if (r.t === 'del') return `<tr class="oc-del"><td><del>${esc(r.a)}</del></td><td></td></tr>`;
      if (r.t === 'add') return `<tr class="oc-add"><td></td><td><ins>${esc(r.b)}</ins></td></tr>`;
      const [x, y] = wordDiff(r.a, r.b);
      return `<tr class="oc-chg"><td>${x}</td><td>${y}</td></tr>`;
    }).join('');
    const nameA = $('cpAName').textContent || 'Image 1', nameB = $('cpBName').textContent || 'Image 2';
    const diffs = cnt.chg + cnt.del + cnt.add;
    $('cpSummary').className = 'summary ' + (diffs ? 'warn' : 'ok');
    $('cpSummary').innerHTML = diffs
      ? `<strong>${diffs} line${diffs === 1 ? '' : 's'} differ</strong><span class="badge warn">${cnt.chg} changed</span><span class="badge bad">${cnt.del} only in ${esc(nameA)}</span><span class="badge ok">${cnt.add} only in ${esc(nameB)}</span><span class="muted">${cnt.same} identical</span>`
      : `<strong>The text in both images is the same.</strong><span class="muted">${cnt.same} lines compared</span>`;
    $('cpAmounts').innerHTML = amounts.length
      ? `<h3>Numbers and amounts that changed</h3><table class="change-table oc-amounts"><thead><tr><th>Line</th><th>${esc(nameA)}</th><th>${esc(nameB)}</th></tr></thead><tbody>${amounts.map(m => `<tr><td>${esc(m.label)}</td><td><del>${esc(m.a || '–')}</del></td><td><ins>${esc(m.b || '–')}</ins></td></tr>`).join('')}</tbody></table>`
      : '';
    $('cpTable').innerHTML = `<table class="oc-diff"><thead><tr><th>${esc(nameA)}</th><th>${esc(nameB)}</th></tr></thead><tbody>${html || '<tr><td colspan="2" class="muted">No differences.</td></tr>'}</tbody></table>`;
    $('cpResult').hidden = false;
    lastReport = { nameA, nameB, summary: $('cpSummary').innerText, amounts: $('cpAmounts').innerHTML, table: $('cpTable').innerHTML };
  }

  const PRINT_CSS = `@page{size:A4;margin:16mm 14mm}body{font:11pt/1.5 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1f2328;margin:0}
h1{font-size:18pt;margin:0 0 4px}h2{font-size:13pt;margin:18px 0 6px}h3{font-size:12pt;margin:16px 0 6px}.meta{color:#57606a;font-size:9.5pt;margin:0 0 14px}
pre{white-space:pre-wrap;word-break:break-word;font:10pt/1.5 Consolas,"Courier New",monospace;margin:0}
table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #d0d7de;padding:4px 7px;vertical-align:top;text-align:left;word-break:break-word}th{background:#f6f8fa}
tr{break-inside:avoid}del{background:#ffd7d5;text-decoration:line-through}ins{background:#ccffd8;text-decoration:none}.oc-same td{color:#57606a}
.oc-chg td{background:#fff8c5}.oc-del td:first-child{background:#ffebe9}.oc-add td:last-child{background:#dafbe1}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;

  function printDoc(title, body) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`);
    doc.close();
    const old = document.title;
    document.title = title;
    const done = () => { document.title = old; setTimeout(() => frame.remove(), 500); };
    frame.contentWindow.addEventListener('afterprint', done, { once: true });
    document.querySelectorAll('.oc-pdf-hint').forEach(h => { h.hidden = false; setTimeout(() => { h.hidden = true; }, 12000); });
    setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); }, 150);
    setTimeout(() => { if (document.title === title) document.title = old; }, 4000);
  }

  const today = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const baseName = n => String(n || 'extracted-text').replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim() || 'extracted-text';

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function copy(btn, text) {
    try { await navigator.clipboard.writeText(text); } catch (_) { return; }
    const t = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = t; }, 1400);
  }

  function setMode(m) {
    document.querySelectorAll('[data-oc-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ocMode === m)));
    $('ocExtract').hidden = m !== 'extract';
    $('ocCompare').hidden = m !== 'compare';
  }

  function pastedFile(e) {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (!item) return null;
    const f = item.getAsFile();
    return new File([f], `pasted-image.${(f.type.split('/')[1] || 'png')}`, { type: f.type });
  }

  function init() {
    document.querySelectorAll('[data-oc-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.ocMode)));
    if (/compare/.test(location.hash)) setMode('compare');
    wireDrop($('exDrop'), $('exFile'), files => runExtract(files));
    wireDrop($('cpADrop'), $('cpAFile'), files => runSide('a', files[0]));
    wireDrop($('cpBDrop'), $('cpBFile'), files => runSide('b', files[0]));

    document.addEventListener('paste', e => {
      if (e.target.closest && e.target.closest('textarea, input')) return;
      const f = pastedFile(e);
      if (!f) return;
      e.preventDefault();
      if (!$('ocCompare').hidden) runSide($('cpAText').value.trim() ? 'b' : 'a', f);
      else runExtract([f]);
    });

    $('exCopy').addEventListener('click', e => copy(e.currentTarget, $('exText').value));
    $('exTxt').addEventListener('click', () => download(baseName($('exPreview').querySelector('figcaption')?.textContent) + '.txt', $('exText').value));
    $('exPdf').addEventListener('click', () => {
      const text = $('exText').value.trim();
      if (!text) return;
      const name = $('exPreview').querySelector('figcaption')?.textContent || 'Extracted text';
      printDoc(baseName(name), `<h1>${esc(name)}</h1><p class="meta">Text extracted on ${esc(today())} · jsonxmleditor.com</p><pre>${esc(text)}</pre>`);
    });

    ['cpCase', 'cpPunct', 'cpOnly'].forEach(id => $(id).addEventListener('change', compare));
    $('cpRun').addEventListener('click', compare);
    let t;
    ['cpAText', 'cpBText'].forEach(id => $(id).addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if (!$('cpResult').hidden) compare(); }, 300); }));
    $('cpSwap').addEventListener('click', () => {
      [$('cpAText').value, $('cpBText').value] = [$('cpBText').value, $('cpAText').value];
      [$('cpAName').textContent, $('cpBName').textContent] = [$('cpBName').textContent, $('cpAName').textContent];
      [$('cpAPreview').innerHTML, $('cpBPreview').innerHTML] = [$('cpBPreview').innerHTML, $('cpAPreview').innerHTML];
      [$('cpAMeta').innerHTML, $('cpBMeta').innerHTML] = [$('cpBMeta').innerHTML, $('cpAMeta').innerHTML];
      compare();
    });
    $('cpPdf').addEventListener('click', () => {
      if (!lastReport) compare();
      if (!lastReport) return;
      const r = lastReport;
      printDoc(`Comparison ${baseName(r.nameA)} vs ${baseName(r.nameB)}`,
        `<h1>Text comparison</h1><p class="meta">${esc(r.nameA)} vs ${esc(r.nameB)} · ${esc(today())} · jsonxmleditor.com</p><p><strong>${esc(r.summary.replace(/\n+/g, ' · '))}</strong></p>${r.amounts}<h2>Line by line</h2>${r.table}
         <h2>Full text: ${esc(r.nameA)}</h2><pre>${esc($('cpAText').value)}</pre><h2>Full text: ${esc(r.nameB)}</h2><pre>${esc($('cpBText').value)}</pre>`);
    });
    $('cpTxt').addEventListener('click', () => {
      if (!lastReport) return;
      const lines = [...$('cpTable').querySelectorAll('tbody tr')].map(tr => {
        const [a, b] = [...tr.children].map(td => td.textContent);
        const c = tr.className;
        return c === 'oc-same' ? `  ${a}` : c === 'oc-del' ? `- ${a}` : c === 'oc-add' ? `+ ${b}` : `- ${a}\n+ ${b}`;
      });
      download('comparison.txt', `${lastReport.nameA} vs ${lastReport.nameB}\n${lastReport.summary.replace(/\n+/g, ' · ')}\n\n${lines.join('\n')}\n`);
    });
  }

  init();
})();
