'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = DataSource.esc;
  let data = null, prof = null, lastSvg = '', lastTable = null;

  const PALETTES = {
    bright: ['#2f6fed', '#f28e2b', '#3fb950', '#e15759', '#a371f7', '#17becf', '#edc948', '#ff9da7', '#9c755f', '#8b949e'],
    soft: ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
    blues: ['#08306b', '#08519c', '#2171b5', '#4292c6', '#6baed6', '#9ecae1', '#c6dbef', '#3d5a80', '#98c1d9', '#293241'],
    warm: ['#d62828', '#f77f00', '#fcbf49', '#eae2b7', '#003049', '#9d0208', '#e85d04', '#ffba08', '#6a040f', '#370617'],
  };
  const THEMES = {
    light: { bg: '#ffffff', text: '#1f2328', muted: '#57606a', grid: '#e5e7eb', axis: '#8c959f' },
    dark: { bg: '#16181d', text: '#e6e9ef', muted: '#9aa3b2', grid: '#2a2f3a', axis: '#4b5263' },
  };
  const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const num = v => { const t = (v ?? '').trim(); return t !== '' && isFinite(+t) ? +t : null; };

  function compact(n) {
    if (n === null || n === undefined || !isFinite(n)) return '';
    const a = Math.abs(n);
    if (a >= 1e12) return +(n / 1e12).toFixed(1) + 'T';
    if (a >= 1e9) return +(n / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return +(n / 1e3).toFixed(1) + 'K';
    if (Number.isInteger(n)) return n.toLocaleString('en-US');
    return n.toLocaleString('en-US', { maximumFractionDigits: a >= 100 ? 1 : a >= 1 ? 2 : 4 });
  }
  const full = n => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 4 }));

  function niceTicks(min, max, count = 6) {
    if (min === max) { if (min === 0) { max = 1; } else { const p = Math.abs(min) * 0.1; min -= p; max += p; } }
    const span = max - min;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { lo, hi, ticks };
  }

  function dateGroup(v, how) {
    if (how === 'none' || !v) return v;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (!m) return v;
    if (how === 'year') return m[1];
    if (how === 'quarter') return `${m[1]}-Q${Math.ceil(+m[2] / 3)}`;
    if (how === 'month') return `${m[1]}-${m[2]}`;
    if (how === 'day') return `${m[1]}-${m[2]}-${m[3]}`;
    return v;
  }

  function prettyCat(c, how) {
    if (how === 'month') { const m = /^(\d{4})-(\d{2})$/.exec(c); if (m) return `${MONTH[+m[2] - 1]} ${m[1]}`; }
    return c === '' ? '(blank)' : c;
  }

  function setup(d) {
    data = d;
    const sample = d.rows.length > 5000 ? d.rows.filter((_, i) => i % Math.ceil(d.rows.length / 5000) === 0) : d.rows;
    prof = Profiler.profile(d.columns, sample);
    const isNum = i => prof[i].type === 'integer' || prof[i].type === 'decimal';
    const nums = prof.map((_, i) => i).filter(isNum).filter(i => !/(^|_)(id|zip)$/i.test(d.columns[i]));
    const cat = prof.findIndex(p => p.type === 'date') >= 0 ? prof.findIndex(p => p.type === 'date') : Math.max(0, prof.findIndex(p => p.type === 'text' && p.distinct && p.distinct <= 60));
    $('chX').innerHTML = DataSource.columnOptions(d.columns, cat);
    $('chSplit').innerHTML = DataSource.columnOptions(d.columns, '', { blank: '(none)' });
    $('chYnum').innerHTML = '';
    $('chY').innerHTML = d.columns.map((c, i) => `<label class="check"><input type="checkbox" class="chYc" value="${i}"${i === nums[nums.length - 1] ? ' checked' : ''}> ${esc(c)}</label>`).join('') || '<span class="muted">No columns</span>';
    $('chAgg').value = nums.length ? 'sum' : 'count';
    if (prof[cat] && prof[cat].type === 'date') { $('chType').value = 'line'; $('chDate').value = 'month'; }
    else { $('chType').value = 'bar'; $('chDate').value = 'none'; }
    $('chTitle').value = '';
    $('chWork').hidden = false;
    syncControls();
    draw();
  }

  function syncControls() {
    const t = $('chType').value;
    const xy = t === 'scatter', hist = t === 'histogram', pie = t === 'pie' || t === 'donut';
    $('chXLabel').firstChild.textContent = xy ? 'X (number) ' : hist ? 'Column ' : pie ? 'Slices ' : 'Category / X ';
    document.querySelectorAll('.ch-cat').forEach(el => { el.hidden = xy || hist; });
    document.querySelectorAll('.ch-xy').forEach(el => { el.hidden = !xy; });
    document.querySelectorAll('.ch-hist').forEach(el => { el.hidden = !hist; });
    document.querySelectorAll('.ch-stack').forEach(el => { el.hidden = !(t === 'bar' || t === 'hbar' || t === 'area'); });
    if ((xy || hist) && prof) {
      const numeric = i => prof[i] && (prof[i].type === 'integer' || prof[i].type === 'decimal');
      if (!numeric(+$('chX').value)) {
        const nums = prof.map((_, i) => i).filter(numeric);
        const pick = nums.find(i => !/(^|_)(id|zip)$/i.test(data.columns[i])) ?? nums[0];
        if (pick !== undefined) $('chX').value = String(pick);
      }
    }
    const isDate = prof && prof[+$('chX').value] && prof[+$('chX').value].type === 'date';
    $('chDateWrap').hidden = !isDate || xy || hist;
    if (xy && !$('chYnum').options.length) {
      const nums = prof.map((p, i) => (p.type === 'integer' || p.type === 'decimal' ? i : -1)).filter(i => i >= 0);
      const xNow = +$('chX').value;
      const yPick = nums.find(i => i !== xNow && !/(^|_)(id|zip)$/i.test(data.columns[i])) ?? nums.find(i => i !== xNow) ?? nums[0] ?? 0;
      $('chYnum').innerHTML = DataSource.columnOptions(data.columns, yPick);
    }
  }

  function aggregate() {
    const xi = +$('chX').value, how = $('chDateWrap').hidden ? 'none' : $('chDate').value;
    const ys = [...document.querySelectorAll('.chYc:checked')].map(x => +x.value);
    let agg = $('chAgg').value;
    const si = $('chSplit').value === '' ? -1 : +$('chSplit').value;
    if (!ys.length) agg = 'count';
    const useYs = si >= 0 ? ys.slice(0, 1) : ys;
    const seriesNames = [];
    const sIndex = new Map();
    const cats = new Map();
    const sname = (r, y) => si >= 0 ? (r[si] ?? '') || '(blank)' : agg === 'count' && !ys.length ? 'Count' : data.columns[y];
    for (const r of data.rows) {
      const c = dateGroup(r[xi] ?? '', how);
      let m = cats.get(c);
      if (!m) cats.set(c, (m = new Map()));
      const list = agg === 'count' && !ys.length ? [-1] : useYs;
      for (const y of list) {
        const s = sname(r, y);
        if (!sIndex.has(s)) { sIndex.set(s, seriesNames.length); seriesNames.push(s); }
        let a = m.get(s);
        if (!a) m.set(s, (a = { n: 0, k: 0, sum: 0, min: Infinity, max: -Infinity }));
        a.n++;
        if (y < 0) continue;
        const x = num(r[y]);
        if (agg === 'count') { if ((r[y] ?? '').trim() !== '') a.k++; continue; }
        if (x === null) continue;
        a.k++; a.sum += x;
        if (x < a.min) a.min = x;
        if (x > a.max) a.max = x;
      }
    }
    const val = a => {
      if (!a) return null;
      if (agg === 'count') return ys.length ? a.k : a.n;
      if (!a.k) return null;
      return agg === 'sum' ? a.sum : agg === 'avg' ? a.sum / a.k : agg === 'min' ? a.min : a.max;
    };
    let catList = [...cats.keys()];
    const total = c => seriesNames.reduce((s, n) => s + (val(cats.get(c).get(n)) || 0), 0);
    const pieType = $('chType').value === 'pie' || $('chType').value === 'donut';
    const sort = pieType && +$('chLimit').value && catList.length > +$('chLimit').value ? 'desc' : $('chSort').value;
    if (sort === 'desc') catList.sort((a, b) => total(b) - total(a));
    else if (sort === 'asc') catList.sort((a, b) => total(a) - total(b));
    else catList.sort(DataGrid.compare);
    let series = seriesNames.map(n => ({ name: n, values: catList.map(c => val(cats.get(c).get(n))) }));
    if (series.length > 12) {
      const keep = series.map(s => [s, s.values.reduce((a, b) => a + (b || 0), 0)]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
      series = keep;
      $('chNote').textContent = 'Only the 12 largest series are shown.';
    }
    const limit = +$('chLimit').value;
    let note = '';
    if (limit && catList.length > limit) {
      note = `Showing ${limit} of ${catList.length} categories.`;
      const t = $('chType').value;
      if ((t === 'pie' || t === 'donut') && (agg === 'sum' || agg === 'count')) {
        const rest = catList.slice(limit - 1);
        catList = [...catList.slice(0, limit - 1), 'Other'];
        series = series.map(s => {
          const other = s.values.slice(limit - 1).reduce((a, b) => a + (b || 0), 0);
          return { name: s.name, values: [...s.values.slice(0, limit - 1), other] };
        });
        note = `${rest.length} smallest categories grouped as “Other”.`;
      } else {
        catList = catList.slice(0, limit);
        series = series.map(s => ({ name: s.name, values: s.values.slice(0, limit) }));
      }
    }
    const aggLabel = { sum: 'Sum', avg: 'Average', count: 'Count', min: 'Min', max: 'Max' }[agg];
    const yLabel = ys.length && agg !== 'count' ? (useYs.length === 1 ? `${aggLabel} of ${data.columns[useYs[0]]}` : aggLabel) : ys.length ? `Count of ${data.columns[useYs[0]]}` : 'Number of rows';
    return { cats: catList.map(c => prettyCat(c, how)), series, xLabel: data.columns[xi], yLabel, note };
  }

  function text(x, y, s, { size = 12, fill, anchor = 'middle', weight = 400, rotate = 0, baseline } = {}) {
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${weight !== 400 ? ` font-weight="${weight}"` : ''}${baseline ? ` dominant-baseline="${baseline}"` : ''}${rotate ? ` transform="rotate(${rotate} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''}>${esc(s)}</text>`;
  }

  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const tw = (s, size = 12) => s.length * size * 0.58;

  function frame(W, H, th, title, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" role="img" aria-label="${esc(title || 'Chart')}">`
      + (th.bg ? `<rect width="${W}" height="${H}" fill="${th.bg}"/>` : '')
      + (title ? text(W / 2, 30, title, { size: 18, fill: th.text, weight: 600 }) : '')
      + body + '</svg>';
  }

  function legend(names, colors, W, y, th) {
    if (names.length < 2) return { svg: '', h: 0 };
    const items = names.map((n, i) => ({ n: clip(String(n), 28), c: colors[i % colors.length] }));
    const rows = [];
    let row = [], wsum = 0;
    for (const it of items) {
      const w = tw(it.n) + 34;
      if (wsum + w > W - 60 && row.length) { rows.push([row, wsum]); row = []; wsum = 0; }
      row.push([it, w]); wsum += w;
    }
    if (row.length) rows.push([row, wsum]);
    let svg = '';
    rows.forEach(([r, total], k) => {
      let x = (W - total) / 2;
      const yy = y + k * 20;
      for (const [it, w] of r) {
        svg += `<rect x="${x.toFixed(1)}" y="${yy - 9}" width="12" height="12" rx="2" fill="${it.c}"/>` + text(x + 18, yy + 1, it.n, { size: 12, fill: th.muted, anchor: 'start' });
        x += w;
      }
    });
    return { svg, h: rows.length * 20 + 6 };
  }

  function axisChart(type, d, opt) {
    const { W, H, th, colors, title, labels, stacked } = opt;
    const horizontal = type === 'hbar';
    const n = d.cats.length;
    const S = d.series;
    const leg = legend(S.map(s => s.name), colors, W, (title ? 58 : 22), th);
    const top = (title ? 50 : 18) + leg.h + 12;
    let lo = 0, hi = 0;
    const stack = stacked && S.length > 1 && type !== 'line';
    for (let i = 0; i < n; i++) {
      if (stack) {
        let p = 0, m = 0;
        for (const s of S) { const v = s.values[i] || 0; if (v >= 0) p += v; else m += v; }
        hi = Math.max(hi, p); lo = Math.min(lo, m);
      } else for (const s of S) { const v = s.values[i]; if (v !== null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }
    }
    if (type === 'line' && !opt.zero) {
      const all = S.flatMap(s => s.values).filter(v => v !== null);
      if (all.length) { lo = Math.min(...all); hi = Math.max(...all); }
    }
    const { lo: t0, hi: t1, ticks } = niceTicks(lo, hi);
    const catLabels = d.cats.map(c => clip(String(c), horizontal ? 26 : 22));
    let body = '';

    if (horizontal) {
      const left = Math.min(220, Math.max(...catLabels.map(c => tw(c))) + 20);
      const bottom = 52, right = 30;
      const pw = W - left - right, ph = H - top - bottom;
      const sx = v => left + ((v - t0) / (t1 - t0)) * pw;
      const band = ph / Math.max(1, n);
      for (const t of ticks) body += `<line x1="${sx(t).toFixed(1)}" x2="${sx(t).toFixed(1)}" y1="${top}" y2="${top + ph}" stroke="${th.grid}"/>` + text(sx(t), top + ph + 18, compact(t), { size: 11, fill: th.muted });
      body += text(left + pw / 2, H - 12, d.yLabel, { size: 12, fill: th.muted });
      catLabels.forEach((c, i) => { if (band >= 11 || i % Math.ceil(11 / band) === 0) body += text(left - 8, top + band * i + band / 2 + 4, c, { size: 11.5, fill: th.text, anchor: 'end' }); });
      const inner = band * 0.78, gap = band * 0.11;
      for (let i = 0; i < n; i++) {
        let pos = 0, neg = 0;
        S.forEach((s, k) => {
          const v = s.values[i];
          if (v === null) return;
          let x0, x1, y, h;
          if (stack) { const b = v >= 0 ? pos : neg; x0 = sx(b); x1 = sx(b + v); if (v >= 0) pos += v; else neg += v; y = top + band * i + gap; h = inner; }
          else { h = inner / S.length; y = top + band * i + gap + h * k; x0 = sx(Math.max(t0, 0)); x1 = sx(v); }
          const x = Math.min(x0, x1), w = Math.max(1, Math.abs(x1 - x0));
          body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, h - 1).toFixed(1)}" fill="${colors[k % colors.length]}" rx="2"><title>${esc(`${d.cats[i]} · ${s.name}: ${full(v)}`)}</title></rect>`;
          if (labels && !stack && h >= 10) body += text(x + w + 4, y + h / 2 + 4, compact(v), { size: 10.5, fill: th.muted, anchor: 'start' });
        });
      }
      body += `<line x1="${sx(Math.max(t0, 0))}" x2="${sx(Math.max(t0, 0))}" y1="${top}" y2="${top + ph}" stroke="${th.axis}"/>`;
      return frame(W, H, th, title, leg.svg + body);
    }

    const maxLab = Math.max(...catLabels.map(c => tw(c, 11.5)));
    const left = Math.max(48, Math.max(...ticks.map(t => tw(compact(t), 11))) + 26), right = 20;
    const pwGuess = W - left - right;
    const rotate = maxLab > (pwGuess / Math.max(1, n)) - 6;
    const bottom = (rotate ? Math.min(140, maxLab * 0.72 + 16) : 30) + 30;
    const pw = W - left - right, ph = H - top - bottom;
    const sy = v => top + ph - ((v - t0) / (t1 - t0)) * ph;
    const band = pw / Math.max(1, n);
    for (const t of ticks) body += `<line x1="${left}" x2="${left + pw}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}" stroke="${th.grid}"/>` + text(left - 8, sy(t) + 4, compact(t), { size: 11, fill: th.muted, anchor: 'end' });
    body += text(16, top + ph / 2, d.yLabel, { size: 12, fill: th.muted, rotate: -90 });
    const every = Math.max(1, Math.ceil((rotate ? 13 : maxLab + 10) / band));
    catLabels.forEach((c, i) => {
      if (i % every) return;
      const x = left + band * i + band / 2;
      body += rotate ? text(x + 3, top + ph + 12, c, { size: 11.5, fill: th.text, anchor: 'end', rotate: -40 }) : text(x, top + ph + 18, c, { size: 11.5, fill: th.text });
    });
    body += text(left + pw / 2, H - 10, d.xLabel, { size: 12, fill: th.muted });
    const zero = sy(Math.min(Math.max(0, t0), t1));

    if (type === 'bar') {
      const inner = band * 0.76, gap = band * 0.12;
      for (let i = 0; i < n; i++) {
        let pos = 0, neg = 0;
        S.forEach((s, k) => {
          const v = s.values[i];
          if (v === null) return;
          let y0, y1, x, w;
          if (stack) { const b = v >= 0 ? pos : neg; y0 = sy(b); y1 = sy(b + v); if (v >= 0) pos += v; else neg += v; x = left + band * i + gap; w = inner; }
          else { w = inner / S.length; x = left + band * i + gap + w * k; y0 = zero; y1 = sy(v); }
          const y = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
          body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, w - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${colors[k % colors.length]}" rx="2"><title>${esc(`${d.cats[i]} · ${s.name}: ${full(v)}`)}</title></rect>`;
          if (labels && !stack && w >= 18) body += text(x + w / 2, (v >= 0 ? y - 5 : y + h + 13), compact(v), { size: 10.5, fill: th.muted });
        });
      }
    } else {
      const area = type === 'area';
      const base = S.map(() => []);
      const cum = new Array(n).fill(0);
      S.forEach((s, k) => {
        const c = colors[k % colors.length];
        const pts = [];
        for (let i = 0; i < n; i++) {
          const v = s.values[i];
          if (v === null && !(area && stack)) { pts.push(null); continue; }
          const b = area && stack ? cum[i] : 0;
          const top2 = b + (v || 0);
          base[k][i] = b;
          if (area && stack) cum[i] = top2;
          pts.push([left + band * i + band / 2, sy(top2), v, sy(b)]);
        }
        const segs = [];
        let cur = [];
        for (const p of pts) { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } }
        if (cur.length) segs.push(cur);
        for (const seg of segs) {
          const line = seg.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
          if (area) {
            const back = seg.slice().reverse().map(p => `L${p[0].toFixed(1)},${(stack ? p[3] : zero).toFixed(1)}`).join('');
            body += `<path d="${line}${back}Z" fill="${c}" fill-opacity="${stack ? 0.75 : 0.25}" stroke="none"/>`;
          }
          body += `<path d="${line}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
        }
        const dots = n <= 60;
        pts.forEach((p, i) => {
          if (!p) return;
          body += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${dots ? 3.2 : 6}" fill="${dots ? c : 'transparent'}"${dots ? ` stroke="${th.bg || '#fff'}" stroke-width="1"` : ''}><title>${esc(`${d.cats[i]} · ${s.name}: ${full(p[2] ?? 0)}`)}</title></circle>`;
          if (labels && dots && S.length === 1 && i % every === 0) body += text(p[0], p[1] - 8, compact(p[2]), { size: 10.5, fill: th.muted });
        });
      });
    }
    body += `<line x1="${left}" x2="${left + pw}" y1="${zero.toFixed(1)}" y2="${zero.toFixed(1)}" stroke="${th.axis}"/>`;
    return frame(W, H, th, title, leg.svg + body);
  }

  function pieChart(d, opt) {
    const { W, H, th, colors, title, labels, donut } = opt;
    const s = d.series[0];
    const items = d.cats.map((c, i) => [c, s ? s.values[i] : 0]).filter(([, v]) => v > 0);
    if (!items.length) return frame(W, H, th, title, text(W / 2, H / 2, 'No positive values to show.', { fill: th.muted, size: 14 }));
    const total = items.reduce((a, [, v]) => a + v, 0);
    const top = title ? 50 : 16;
    const legW = Math.min(300, Math.max(...items.map(([c]) => tw(clip(String(c), 30)))) + 90);
    const r = Math.max(40, Math.min((W - legW - 60) / 2, (H - top - 24) / 2));
    const cx = 30 + r + Math.max(0, (W - legW - 60 - 2 * r) / 2), cy = top + (H - top) / 2;
    let a0 = -Math.PI / 2, body = '';
    const ri = donut ? r * 0.58 : 0;
    items.forEach(([c, v], i) => {
      const frac = v / total, a1 = a0 + frac * Math.PI * 2;
      const color = colors[i % colors.length];
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
      let path;
      if (frac >= 0.9999) path = donut ? `M${p(r, 0)}A${r},${r} 0 1,1 ${p(r, Math.PI)}A${r},${r} 0 1,1 ${p(r, 0)}M${p(ri, 0)}A${ri},${ri} 0 1,0 ${p(ri, Math.PI)}A${ri},${ri} 0 1,0 ${p(ri, 0)}Z` : `M${p(r, 0)}A${r},${r} 0 1,1 ${p(r, Math.PI)}A${r},${r} 0 1,1 ${p(r, 0)}Z`;
      else if (donut) path = `M${p(r, a0)}A${r},${r} 0 ${large},1 ${p(r, a1)}L${p(ri, a1)}A${ri},${ri} 0 ${large},0 ${p(ri, a0)}Z`;
      else path = `M${cx},${cy}L${p(r, a0)}A${r},${r} 0 ${large},1 ${p(r, a1)}Z`;
      body += `<path d="${path}" fill="${color}" stroke="${th.bg || '#fff'}" stroke-width="1.5" fill-rule="evenodd"><title>${esc(`${c}: ${full(v)} (${(frac * 100).toFixed(1)}%)`)}</title></path>`;
      if (labels && frac >= 0.04) {
        const am = (a0 + a1) / 2, lr = donut ? (r + ri) / 2 : r * 0.66;
        body += text(cx + lr * Math.cos(am), cy + lr * Math.sin(am) + 4, `${Math.round(frac * 100)}%`, { size: 12, fill: '#fff', weight: 600 });
      }
      a0 = a1;
    });
    if (donut) body += text(cx, cy - 2, compact(total), { size: 20, fill: th.text, weight: 600 }) + text(cx, cy + 18, 'total', { size: 12, fill: th.muted });
    const lx = cx + r + 40;
    const step = Math.min(24, (H - top - 20) / items.length);
    const ly = cy - (items.length * step) / 2 + step / 2;
    items.forEach(([c, v], i) => {
      if (step < 12 && i % 2) return;
      const y = ly + i * step;
      body += `<rect x="${lx}" y="${(y - 6).toFixed(1)}" width="12" height="12" rx="2" fill="${colors[i % colors.length]}"/>` + text(lx + 18, y + 4, clip(String(c), 30), { size: 12, fill: th.text, anchor: 'start' }) + text(lx + legW - 20, y + 4, `${((v / total) * 100).toFixed(1)}%`, { size: 12, fill: th.muted, anchor: 'end' });
    });
    return frame(W, H, th, title, body);
  }

  function scatterChart(opt) {
    const { W, H, th, colors, title } = opt;
    const xi = +$('chX').value, yi = +$('chYnum').value, si = $('chSplit').value === '' ? -1 : +$('chSplit').value;
    const pts = [];
    const groups = new Map();
    for (const r of data.rows) {
      const x = num(r[xi]), y = num(r[yi]);
      if (x === null || y === null) continue;
      const g = si >= 0 ? (r[si] || '(blank)') : '';
      if (!groups.has(g)) groups.set(g, groups.size);
      pts.push([x, y, groups.get(g)]);
    }
    if (!pts.length) return { svg: frame(W, H, th, title, text(W / 2, H / 2, 'Pick two numeric columns.', { fill: th.muted, size: 14 })), note: '' };
    const names = [...groups.keys()];
    const leg = legend(si >= 0 ? names : [], colors, W, (title ? 58 : 22), th);
    const top = (title ? 50 : 18) + leg.h + 12;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const [x, y] of pts) { if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    const X = niceTicks(xmin, xmax), Y = niceTicks(ymin, ymax);
    const left = Math.max(48, Math.max(...Y.ticks.map(t => tw(compact(t), 11))) + 26), right = 24, bottom = 56;
    const pw = W - left - right, ph = H - top - bottom;
    const sx = v => left + ((v - X.lo) / (X.hi - X.lo)) * pw, sy = v => top + ph - ((v - Y.lo) / (Y.hi - Y.lo)) * ph;
    let body = '';
    for (const t of Y.ticks) body += `<line x1="${left}" x2="${left + pw}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}" stroke="${th.grid}"/>` + text(left - 8, sy(t) + 4, compact(t), { size: 11, fill: th.muted, anchor: 'end' });
    for (const t of X.ticks) body += `<line x1="${sx(t).toFixed(1)}" x2="${sx(t).toFixed(1)}" y1="${top}" y2="${top + ph}" stroke="${th.grid}"/>` + text(sx(t), top + ph + 18, compact(t), { size: 11, fill: th.muted });
    body += text(left + pw / 2, H - 12, data.columns[xi], { size: 12, fill: th.muted }) + text(16, top + ph / 2, data.columns[yi], { size: 12, fill: th.muted, rotate: -90 });
    const shown = pts.length > 20000 ? pts.filter((_, i) => i % Math.ceil(pts.length / 20000) === 0) : pts;
    const rr = shown.length > 2000 ? 2 : 3.5;
    const op = shown.length > 2000 ? 0.45 : 0.75;
    for (const [x, y, g] of shown) body += `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="${rr}" fill="${colors[g % colors.length]}" fill-opacity="${op}">${shown.length <= 3000 ? `<title>${esc(`${data.columns[xi]}: ${full(x)}, ${data.columns[yi]}: ${full(y)}${si >= 0 ? ' · ' + names[g] : ''}`)}</title>` : ''}</circle>`;
    let note = '';
    if ($('chTrend').checked && pts.length > 2) {
      const n = pts.length;
      let sxx = 0, sy2 = 0, sxy = 0, sx1 = 0, sy1 = 0;
      for (const [x, y] of pts) { sx1 += x; sy1 += y; sxx += x * x; sy2 += y * y; sxy += x * y; }
      const den = n * sxx - sx1 * sx1;
      if (den) {
        const m = (n * sxy - sx1 * sy1) / den, b = (sy1 - m * sx1) / n;
        const r = (n * sxy - sx1 * sy1) / Math.sqrt(den * (n * sy2 - sy1 * sy1));
        const clampY = v => Math.min(Y.hi, Math.max(Y.lo, v));
        const xa = X.lo, xb = X.hi;
        body += `<line x1="${sx(xa)}" y1="${sy(clampY(m * xa + b))}" x2="${sx(xb)}" y2="${sy(clampY(m * xb + b))}" stroke="${th.text}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
        note = `Trend line: y = ${compact(m)}·x ${b >= 0 ? '+' : '−'} ${compact(Math.abs(b))} · correlation r = ${isFinite(r) ? r.toFixed(3) : '–'} · R² = ${isFinite(r) ? (r * r).toFixed(3) : '–'}`;
      }
    }
    if (shown.length < pts.length) note = `${note ? note + ' · ' : ''}${shown.length.toLocaleString('en-US')} of ${pts.length.toLocaleString('en-US')} points drawn.`;
    return { svg: frame(W, H, th, title, leg.svg + body), note, table: { columns: [data.columns[xi], data.columns[yi]], rows: pts.map(([x, y]) => [String(x), String(y)]) } };
  }

  function histogramData() {
    const xi = +$('chX').value;
    const vals = data.rows.map(r => num(r[xi])).filter(v => v !== null).sort((a, b) => a - b);
    if (!vals.length) return null;
    const lo = vals[0], hi = vals[vals.length - 1];
    if (!+$('chBins').value && vals.every(Number.isInteger) && hi - lo <= 40) {
      const counts = new Array(hi - lo + 1).fill(0);
      for (const v of vals) counts[v - lo]++;
      return { cats: counts.map((_, i) => String(lo + i)), series: [{ name: 'Rows', values: counts }], xLabel: data.columns[xi], yLabel: 'Number of rows', note: `${vals.length.toLocaleString('en-US')} values, one bar per whole number.` };
    }
    let bins = +$('chBins').value || Math.min(60, Math.ceil(Math.log2(vals.length) + 1));
    if (lo === hi) bins = 1;
    const { lo: a, hi: b } = niceTicks(lo, hi, bins);
    const w = (b - a) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const v of vals) counts[Math.min(bins - 1, Math.floor((v - a) / w))]++;
    const cats = counts.map((_, i) => `${compact(a + i * w)}–${compact(a + (i + 1) * w)}`);
    return { cats, series: [{ name: 'Rows', values: counts }], xLabel: data.columns[xi], yLabel: 'Number of rows', note: `${vals.length.toLocaleString('en-US')} values in ${bins} bins of width ${compact(w)}.` };
  }

  function draw() {
    if (!data) return;
    syncControls();
    const type = $('chType').value;
    const [W, H] = $('chSize').value.split('x').map(Number);
    const style = $('chStyle').value;
    const th = { ...THEMES[style === 'transparent' ? (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark') : style] };
    if (style === 'transparent') th.bg = '';
    const colors = PALETTES[$('chPalette').value];
    const title = $('chTitle').value.trim();
    const opt = { W, H, th, colors, title, labels: $('chLabels').checked, stacked: $('chStacked').checked, zero: $('chZero').checked, donut: type === 'donut' };
    let svg = '', note = '';
    $('chNote').textContent = '';
    if (type === 'scatter') {
      const r = scatterChart(opt);
      svg = r.svg; note = r.note; lastTable = r.table || null;
    } else {
      const d = type === 'histogram' ? histogramData() : aggregate();
      if (!d || !d.cats.length) svg = frame(W, H, th, title, text(W / 2, H / 2, 'Nothing to chart with these settings.', { fill: th.muted, size: 14 }));
      else {
        svg = type === 'pie' || type === 'donut' ? pieChart(d, opt) : axisChart(type === 'histogram' ? 'bar' : type, d, opt);
        note = d.note;
        lastTable = { columns: [d.xLabel, ...d.series.map(s => s.name)], rows: d.cats.map((c, i) => [String(c), ...d.series.map(s => (s.values[i] === null ? '' : String(Math.round(s.values[i] * 1e6) / 1e6)))]) };
      }
    }
    lastSvg = svg;
    $('chCanvas').innerHTML = svg;
    if (note) $('chNote').textContent = ($('chNote').textContent ? $('chNote').textContent + ' ' : '') + note;
  }

  function fileBase() {
    return ($('chTitle').value.trim() || DataLoad.baseName(data.name) + '-chart').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'chart';
  }

  function exportPng() {
    const [W, H] = $('chSize').value.split('x').map(Number);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * 2; c.height = H * 2;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      c.toBlob(b => DataLoad.download(fileBase() + '.png', b), 'image/png');
    };
    img.src = url;
  }

  function init() {
    const src = DataSource.mount($('chSource'), { title: 'Your data', sample: () => DataSource.sampleSales(800), onLoad: setup });
    ['chType', 'chAgg', 'chSort', 'chLimit', 'chDate', 'chSplit', 'chSize', 'chStyle', 'chPalette', 'chLabels', 'chStacked', 'chZero', 'chTrend', 'chBins', 'chYnum'].forEach(id => $(id).addEventListener('change', draw));
    $('chX').addEventListener('change', () => {
      const p = prof[+$('chX').value];
      if (p && p.type === 'date' && $('chDate').value === 'none') $('chDate').value = 'month';
      draw();
    });
    $('chY').addEventListener('change', draw);
    let tmr;
    $('chTitle').addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(draw, 200); });
    $('chSvg').addEventListener('click', () => lastSvg && DataLoad.download(fileBase() + '.svg', lastSvg, 'image/svg+xml'));
    $('chPng').addEventListener('click', () => lastSvg && exportPng());
    $('chCsv').addEventListener('click', () => lastTable && DataLoad.download(fileBase() + '-data.csv', '﻿' + DataLoad.toCsv(lastTable.columns, lastTable.rows), 'text/csv;charset=utf-8'));
    let hand = null;
    try { hand = JSON.parse(sessionStorage.getItem('jxe.chart') || 'null'); sessionStorage.removeItem('jxe.chart'); } catch (_) { }
    if (hand && hand.csv) DataLoad.readText(hand.csv, hand.name || 'data.csv').then(d => {
      src.set(d);
      document.querySelectorAll('.chYc').forEach(cb => { const p = prof[+cb.value]; cb.checked = p.type === 'integer' || p.type === 'decimal'; });
      $('chAgg').value = 'sum';
      draw();
    }).catch(() => { });
  }

  init();
})();
