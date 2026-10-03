'use strict';

const Profiler = (() => {
  const RE = {
    integer: /^-?(0|[1-9]\d{0,15})$/,
    number: /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/,
    boolean: /^(true|false|yes|no|TRUE|FALSE|True|False|Yes|No)$/,
    date: /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^https?:\/\/\S+$/i,
  };

  function kind(v) {
    if (RE.integer.test(v)) return 'integer';
    if (RE.number.test(v)) return 'number';
    if (RE.boolean.test(v)) return 'boolean';
    if (RE.date.test(v) && !isNaN(Date.parse(v.replace(' ', 'T')))) return 'date';
    return 'text';
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function profileColumn(name, values) {
    const total = values.length;
    let empty = 0;
    const kinds = { integer: 0, number: 0, boolean: 0, date: 0, text: 0 };
    const counts = new Map();
    let capped = false;
    let minLen = Infinity, maxLen = 0, emails = 0, urls = 0, padded = 0;
    for (const raw of values) {
      const v = raw ?? '';
      if (v === '') { empty++; continue; }
      if (v !== v.trim()) padded++;
      kinds[kind(v.trim())]++;
      if (v.length < minLen) minLen = v.length;
      if (v.length > maxLen) maxLen = v.length;
      if (RE.email.test(v)) emails++;
      else if (RE.url.test(v)) urls++;
      if (!capped) {
        counts.set(v, (counts.get(v) || 0) + 1);
        if (counts.size > 500000) capped = true;
      }
    }
    const filled = total - empty;
    const numeric = kinds.integer + kinds.number;
    let type = 'empty';
    if (filled) {
      if (numeric / filled >= 0.95) type = kinds.number ? 'decimal' : 'integer';
      else if (kinds.boolean / filled >= 0.95) type = 'boolean';
      else if (kinds.date / filled >= 0.95) type = 'date';
      else if (emails / filled >= 0.9) type = 'email';
      else if (urls / filled >= 0.9) type = 'url';
      else type = 'text';
    }
    const p = {
      name, type, total, empty, filled,
      distinct: capped ? null : counts.size,
      unique: !capped && filled > 0 && counts.size === filled,
      mixed: filled > 0 && type === 'text' && numeric > 0 && numeric / filled >= 0.5,
      padded,
      top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
    if (type === 'integer' || type === 'decimal') {
      const nums = values.filter(v => v !== '' && v != null && RE.number.test(v.trim())).map(v => Number(v)).sort((a, b) => a - b);
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, nums.length - 1);
      Object.assign(p, {
        min: nums[0], max: nums[nums.length - 1], sum, mean,
        median: quantile(nums, 0.5), q1: quantile(nums, 0.25), q3: quantile(nums, 0.75),
        std: Math.sqrt(variance), zeros: nums.filter(n => n === 0).length, negatives: nums.filter(n => n < 0).length,
        histogram: histogram(nums),
      });
    } else if (type === 'date') {
      const ds = values.filter(v => v).map(v => v.trim()).sort();
      Object.assign(p, { min: ds[0], max: ds[ds.length - 1] });
    } else if (filled) {
      Object.assign(p, { minLen, maxLen });
    }
    return p;
  }

  function histogram(nums, bins = 12) {
    if (!nums.length) return [];
    const lo = nums[0], hi = nums[nums.length - 1];
    if (lo === hi) return [nums.length];
    const out = new Array(bins).fill(0);
    const w = (hi - lo) / bins;
    for (const n of nums) out[Math.min(bins - 1, Math.floor((n - lo) / w))]++;
    return out;
  }

  function profile(columns, rows) {
    return columns.map((c, i) => profileColumn(c, rows.map(r => r[i] ?? '')));
  }

  const fmt = n => {
    if (n === null || n === undefined || Number.isNaN(n)) return '–';
    if (typeof n !== 'number') return String(n);
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString('en-US');
    const abs = Math.abs(n);
    return n.toLocaleString('en-US', { maximumFractionDigits: abs >= 1000 ? 2 : abs >= 1 ? 3 : 6 });
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(profiles, rowCount) {
    return profiles.map((p, idx) => {
      const pct = n => (p.total ? Math.round((n / p.total) * 1000) / 10 : 0);
      const rows = [];
      rows.push(['Filled', `${fmt(p.filled)} <span class="muted">(${pct(p.filled)}%)</span>`]);
      rows.push(['Empty', p.empty ? `<span class="${p.empty / p.total > 0.2 ? 'pf-warn' : ''}">${fmt(p.empty)} (${pct(p.empty)}%)</span>` : '0']);
      rows.push(['Distinct', p.distinct === null ? 'over 500,000' : `${fmt(p.distinct)}${p.unique ? ' <span class="badge ok">unique</span>' : ''}`]);
      if (p.type === 'integer' || p.type === 'decimal') {
        rows.push(['Min / Max', `${fmt(p.min)} / ${fmt(p.max)}`]);
        rows.push(['Mean / Median', `${fmt(p.mean)} / ${fmt(p.median)}`]);
        rows.push(['Std deviation', fmt(p.std)]);
        rows.push(['Sum', fmt(p.sum)]);
        if (p.negatives) rows.push(['Negatives', fmt(p.negatives)]);
      } else if (p.type === 'date') {
        rows.push(['Earliest', esc(p.min)]);
        rows.push(['Latest', esc(p.max)]);
      } else if (p.filled) {
        rows.push(['Length', `${fmt(p.minLen)} – ${fmt(p.maxLen)} chars`]);
      }
      const warnings = [];
      if (p.mixed) warnings.push('Mostly numbers, but some values are text');
      if (p.padded) warnings.push(`${fmt(p.padded)} value${p.padded === 1 ? ' has' : 's have'} leading or trailing spaces`);
      if (p.type === 'empty') warnings.push('Column is completely empty');
      const hist = p.histogram && p.histogram.length > 1
        ? `<div class="pf-hist" title="Distribution from ${fmt(p.min)} to ${fmt(p.max)}">${p.histogram.map(h => `<span style="height:${Math.max(4, Math.round((h / Math.max(...p.histogram)) * 100))}%"></span>`).join('')}</div>` : '';
      const top = p.top.length && p.type !== 'empty' && !p.unique
        ? `<ol class="pf-top">${p.top.map(([v, n]) => `<li><span class="pf-v" title="${esc(v)}">${esc(v.length > 40 ? v.slice(0, 40) + '…' : v)}</span><span class="pf-bar"><i style="width:${Math.max(3, Math.round((n / p.filled) * 100))}%"></i></span><span class="muted">${fmt(n)}</span></li>`).join('')}</ol>` : '';
      return `<article class="pf-card" data-col="${idx}">
        <header><h3 title="${esc(p.name)}">${esc(p.name)}</h3><span class="pf-type pf-${p.type}">${p.type}</span></header>
        <dl class="pf-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${hist}
        ${top ? '<div class="pf-label">Most common</div>' + top : ''}
        ${warnings.length ? `<ul class="pf-warnings">${warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      </article>`;
    }).join('');
  }

  return { profile, render, kind };
})();
