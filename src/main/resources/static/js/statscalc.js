'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const { tInv, quantile, fmt } = StatMath;
  let last = null;

  function parse(text, decimalComma) {
    let t = text;
    if (decimalComma) t = t.replace(/(\d)\.(?=\d{3}\b)/g, '$1').replace(/(\d),(\d)/g, '$1.$2');
    const parts = t.split(decimalComma ? /[\s;\t|]+/ : /[\s,;\t|]+/).map(s => s.trim()).filter(Boolean);
    const nums = [], skipped = [];
    for (const p of parts) {
      const c = p.replace(/^[$€£¥₹]/, '').replace(/%$/, '');
      if (c !== '' && isFinite(+c)) nums.push(+c); else skipped.push(p);
    }
    return { nums, skipped };
  }

  function compute(nums, population) {
    const n = nums.length;
    const s = nums.slice().sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const x of nums) { const d = x - mean; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    const df = population ? n : n - 1;
    const variance = df > 0 ? m2 / df : NaN;
    const sd = Math.sqrt(variance);
    const popSd = Math.sqrt(m2 / n);
    const skew = n > 2 && popSd ? (population ? (m3 / n) / popSd ** 3 : (n / ((n - 1) * (n - 2))) * (m3 / Math.pow(Math.sqrt(m2 / (n - 1)), 3))) : NaN;
    const kurt = n > 3 && popSd ? (population ? (m4 / n) / popSd ** 4 - 3 : ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * (m4 / Math.pow(m2 / (n - 1), 2)) - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))) : NaN;
    const counts = new Map();
    for (const x of nums) counts.set(x, (counts.get(x) || 0) + 1);
    const maxC = Math.max(...counts.values());
    const modes = maxC > 1 ? [...counts.entries()].filter(([, c]) => c === maxC).map(([v]) => v).sort((a, b) => a - b) : [];
    const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
    const lowF = q1 - 1.5 * iqr, highF = q3 + 1.5 * iqr;
    const outliers = s.filter(x => x < lowF || x > highF);
    const se = Math.sqrt(m2 / Math.max(1, n - 1)) / Math.sqrt(n);
    const tc = n > 1 ? tInv(0.975, n - 1) : NaN;
    const allPos = s[0] > 0;
    return {
      n, s, sum, mean, variance, sd, skew, kurt, modes, maxC, q1, q3, iqr, outliers, lowF, highF, se,
      ci: [mean - tc * se, mean + tc * se],
      median: quantile(s, 0.5),
      min: s[0], max: s[n - 1],
      geo: allPos ? Math.exp(nums.reduce((a, b) => a + Math.log(b), 0) / n) : NaN,
      harm: allPos ? n / nums.reduce((a, b) => a + 1 / b, 0) : NaN,
      cv: mean ? sd / Math.abs(mean) : NaN,
      p: [0.01, 0.05, 0.1, 0.9, 0.95, 0.99].map(q => [q, quantile(s, q)]),
    };
  }

  function chart(r) {
    const W = 640, H = 220, L = 10, R = 10, T = 12, B = 60;
    const pw = W - L - R, ph = H - T - B;
    const bins = Math.max(1, Math.min(30, Math.ceil(Math.log2(r.n) + 1)));
    if (r.min === r.max) return '';
    const w = (r.max - r.min) / bins;
    const c = new Array(bins).fill(0);
    for (const x of r.s) c[Math.min(bins - 1, Math.floor((x - r.min) / w))]++;
    const mx = Math.max(...c);
    const sx = v => L + ((v - r.min) / (r.max - r.min)) * pw;
    let svg = '';
    c.forEach((k, i) => {
      const h = (k / mx) * ph;
      svg += `<rect x="${(L + (i * pw) / bins + 1).toFixed(1)}" y="${(T + ph - h).toFixed(1)}" width="${(pw / bins - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="sc-bar"><title>${fmt(r.min + i * w)} – ${fmt(r.min + (i + 1) * w)}: ${k}</title></rect>`;
    });
    const by = T + ph + 30;
    const wl = Math.max(r.min, r.lowF), wh = Math.min(r.max, r.highF);
    svg += `<line x1="${sx(wl)}" x2="${sx(wh)}" y1="${by}" y2="${by}" class="sc-axis"/>`
      + `<rect x="${sx(r.q1)}" y="${by - 10}" width="${Math.max(1, sx(r.q3) - sx(r.q1))}" height="20" class="sc-box"/>`
      + `<line x1="${sx(r.median)}" x2="${sx(r.median)}" y1="${by - 10}" y2="${by + 10}" class="sc-med"/>`
      + `<line x1="${sx(wl)}" x2="${sx(wl)}" y1="${by - 6}" y2="${by + 6}" class="sc-axis"/><line x1="${sx(wh)}" x2="${sx(wh)}" y1="${by - 6}" y2="${by + 6}" class="sc-axis"/>`
      + r.outliers.slice(0, 300).map(x => `<circle cx="${sx(x)}" cy="${by}" r="3" class="sc-out"><title>Outlier: ${fmt(x)}</title></circle>`).join('')
      + `<text x="${L}" y="${H - 6}" class="sc-lbl">${fmt(r.min)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="sc-lbl">${fmt(r.max)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="sc-chart" role="img" aria-label="Histogram and box plot">${svg}</svg>`;
  }

  function run() {
    const { nums, skipped } = parse($('scIn').value, $('scComma').checked);
    const out = $('scOut');
    if (!nums.length) { out.innerHTML = '<p class="muted">Paste or type numbers above: one per line, or separated by commas or spaces.</p>'; last = null; $('scPctOut').textContent = ''; return; }
    const pop = $('scPop').value === 'pop';
    const r = compute(nums, pop);
    last = r;
    const row = (k, v, hint) => `<tr><th>${k}</th><td>${v}${hint ? ` <span class="muted">${hint}</span>` : ''}</td></tr>`;
    out.innerHTML = `
      ${skipped.length ? `<div class="summary warn">Skipped ${skipped.length} value${skipped.length === 1 ? '' : 's'} that ${skipped.length === 1 ? 'is' : 'are'} not a number: ${skipped.slice(0, 5).map(s => `<code>${DataSource.esc(s)}</code>`).join(', ')}${skipped.length > 5 ? '…' : ''}</div>` : ''}
      <div class="sc-grid">
        <table class="change-table kv-table qc-table">
          ${row('Count', r.n.toLocaleString('en-US'))}
          ${row('Sum', fmt(r.sum))}
          ${row('Mean (average)', fmt(r.mean))}
          ${row('Median', fmt(r.median))}
          ${row('Mode', r.modes.length ? r.modes.slice(0, 6).map(m => fmt(m)).join(', ') + (r.modes.length > 6 ? '…' : '') : 'none', r.modes.length ? `(appears ${r.maxC} times)` : '(every value is unique)')}
          ${row('Minimum', fmt(r.min))}
          ${row('Maximum', fmt(r.max))}
          ${row('Range', fmt(r.max - r.min))}
          ${row('Geometric mean', fmt(r.geo), isNaN(r.geo) ? '(needs all values > 0)' : '')}
          ${row('Harmonic mean', fmt(r.harm))}
        </table>
        <table class="change-table kv-table qc-table">
          ${row(pop ? 'Population std deviation (σ)' : 'Sample std deviation (s)', fmt(r.sd))}
          ${row(pop ? 'Population variance (σ²)' : 'Sample variance (s²)', fmt(r.variance))}
          ${row('Standard error of the mean', fmt(r.se))}
          ${row('95% confidence interval', r.n > 1 ? `${fmt(r.ci[0])} to ${fmt(r.ci[1])}` : '–')}
          ${row('Coefficient of variation', isFinite(r.cv) ? (r.cv * 100).toFixed(2) + '%' : '–')}
          ${row('Q1 / Q3', `${fmt(r.q1)} / ${fmt(r.q3)}`)}
          ${row('Interquartile range', fmt(r.iqr))}
          ${row('Skewness', fmt(r.skew, 4), isFinite(r.skew) ? (Math.abs(r.skew) < 0.5 ? '(fairly symmetric)' : r.skew > 0 ? '(long right tail)' : '(long left tail)') : '')}
          ${row('Excess kurtosis', fmt(r.kurt, 4))}
          ${row('Outliers (1.5 × IQR)', r.outliers.length ? `${r.outliers.length}: ${r.outliers.slice(0, 8).map(x => fmt(x)).join(', ')}${r.outliers.length > 8 ? '…' : ''}` : 'none')}
        </table>
      </div>
      <p class="sc-pcts muted">Percentiles: ${r.p.map(([q, v]) => `P${Math.round(q * 100)} = <strong>${fmt(v)}</strong>`).join(' · ')}</p>
      ${chart(r)}`;
    pctOf();
  }

  function pctOf() {
    const v = parseFloat($('scPct').value);
    if (!last || !isFinite(v)) { $('scPctOut').textContent = ''; return; }
    const below = last.s.filter(x => x < v).length, eq = last.s.filter(x => x === v).length;
    const rank = ((below + 0.5 * eq) / last.n) * 100;
    const z = last.sd ? (v - last.mean) / last.sd : NaN;
    $('scPctOut').textContent = `${fmt(v)} is at the ${rank.toFixed(1)}th percentile · z-score ${fmt(z, 3)}`;
  }

  function init() {
    let t;
    $('scIn').addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 150); });
    ['scPop', 'scComma'].forEach(id => $(id).addEventListener('change', run));
    $('scPct').addEventListener('input', pctOf);
    $('scSample').addEventListener('click', () => {
      $('scIn').value = '12.5, 14.1, 13.8, 15.2, 11.9, 14.7, 13.3, 16.0, 12.8, 14.4\n13.9, 15.6, 12.2, 14.9, 13.1, 29.4, 14.2, 13.7, 15.1, 12.6';
      run();
    });
    $('scClear').addEventListener('click', () => { $('scIn').value = ''; run(); $('scIn').focus(); });
    run();
  }

  init();
})();
