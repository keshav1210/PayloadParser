/* ============================================================
   palette.js - Ctrl+K / Cmd+K command palette to jump to any tool.
   Loaded on every page by layout-loader.js. Needs tools-list.js.
   ============================================================ */

(() => {
  'use strict';

  const RECENT_KEY = 'jxe.recentTools';
  const tools = () => window.SITE_TOOLS || [];

  function readRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (_) { return []; }
  }

  function remember(href) {
    try {
      const list = [href, ...readRecent().filter(h => h !== href)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (_) { /* storage blocked */ }
  }

  // Remember the tool the visitor is on now
  const here = location.pathname.replace(/\/+$/, '') || '/';
  if (tools().some(t => t.href === here)) remember(here);

  // ── Matching ───────────────────────────────────────────────────────────────
  function score(tool, q) {
    const name = tool.name.toLowerCase();
    const hay = `${name} ${tool.keys || ''} ${tool.desc} ${tool.cat}`.toLowerCase();
    let total = 0;
    for (const word of q.split(/\s+/).filter(Boolean)) {
      let s = 0;
      if (name.startsWith(word)) s = 100;
      else if (new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) s = 70;
      else if (name.includes(word)) s = 50;
      else if (new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)) s = 30;
      else if (hay.includes(word)) s = 15;
      else if (isSubsequence(word, name)) s = 8;
      else return 0;
      total += s;
    }
    return total;
  }

  function isSubsequence(needle, text) {
    let i = 0;
    for (const ch of text) if (ch === needle[i]) i++;
    return i === needle.length;
  }

  const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── UI ─────────────────────────────────────────────────────────────────────
  let root, input, list, items = [], active = 0, lastFocus = null;

  function build() {
    root = document.createElement('div');
    root.className = 'cmdk';
    root.hidden = true;
    root.innerHTML = `
      <div class="cmdk-backdrop" data-close></div>
      <div class="cmdk-dialog" role="dialog" aria-modal="true" aria-label="Search tools">
        <div class="cmdk-search">
          <span class="cmdk-glass" aria-hidden="true">⌕</span>
          <input type="text" class="cmdk-input" placeholder="Search tools… e.g. yaml, jwt, uuid"
                 role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-autocomplete="list" autocomplete="off" spellcheck="false">
          <kbd class="cmdk-esc" data-close>Esc</kbd>
        </div>
        <ul class="cmdk-list" id="cmdkList" role="listbox"></ul>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> new tab</span><a href="/tools">All tools →</a></div>
      </div>`;
    document.body.append(root);
    input = root.querySelector('.cmdk-input');
    list = root.querySelector('.cmdk-list');

    root.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', onKey);
    list.addEventListener('mousemove', e => {
      const li = e.target.closest('[data-i]');
      if (li && +li.dataset.i !== active) setActive(+li.dataset.i, false);
    });
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    let rows;
    if (!q) {
      const recent = readRecent().map(h => tools().find(t => t.href === h)).filter(Boolean);
      const rest = tools().filter(t => !recent.includes(t));
      rows = [...recent.map(t => ({ t, recent: true })), ...rest.map(t => ({ t }))];
    } else {
      rows = tools().map(t => ({ t, s: score(t, q) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s);
    }
    items = rows.map(r => r.t);
    active = 0;
    if (!rows.length) {
      list.innerHTML = `<li class="cmdk-empty">No tool matches “${escapeHtml(input.value.trim())}”. <a href="/contact">Suggest one</a></li>`;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let lastGroup = null;
    list.innerHTML = rows.map((r, i) => {
      const group = r.recent ? 'Recent' : (q ? null : r.t.cat);
      const head = group && group !== lastGroup ? `<li class="cmdk-group" role="presentation">${group}</li>` : '';
      lastGroup = group || lastGroup;
      return `${head}<li class="cmdk-item" role="option" id="cmdk-${i}" data-i="${i}" aria-selected="${i === 0}">
        <a href="${r.t.href}"${r.t.external ? ' target="_blank" rel="noopener"' : ''} tabindex="-1">
          <span class="cmdk-icon" aria-hidden="true">${escapeHtml(r.t.icon || '•')}</span>
          <span class="cmdk-text"><strong>${escapeHtml(r.t.name)}${r.t.external ? ' ↗' : ''}</strong><small>${escapeHtml(r.t.desc)}</small></span>
        </a></li>`;
    }).join('');
    setActive(0, true);
  }

  function setActive(i, scroll) {
    const els = list.querySelectorAll('.cmdk-item');
    if (!els.length) return;
    active = (i + els.length) % els.length;
    els.forEach(el => el.setAttribute('aria-selected', String(+el.dataset.i === active)));
    input.setAttribute('aria-activedescendant', 'cmdk-' + active);
    if (scroll) els[active].scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1, true); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const t = items[active];
      if (!t) return;
      if (e.ctrlKey || e.metaKey || t.external) window.open(t.href, '_blank', 'noopener');
      else location.href = t.href;
      close();
    } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); setActive(active + (e.shiftKey ? -1 : 1), true); }
  }

  function open() {
    if (!root) build();
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('cmdk-open');
    input.value = '';
    render();
    input.focus();
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove('cmdk-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      root && !root.hidden ? close() : open();
    }
  });

  window.openToolPalette = open;
})();
