'use strict';

class DataGrid {
  constructor(host, { rowHeight = 30, onChange = null, onHeaderClick = null, cellClass = null, rowClass = null } = {}) {
    this.host = host;
    this.rowHeight = rowHeight;
    this.onChange = onChange;
    this.onHeaderClick = onHeaderClick;
    this.cellClass = cellClass;
    this.rowClass = rowClass;
    this.columns = [];
    this.rows = [];
    this.view = [];
    this.sortCol = -1;
    this.sortDir = 0;
    this.filter = '';
    host.classList.add('dg');
    host.innerHTML = '<div class="dg-scroll" tabindex="0"><div class="dg-inner"><div class="dg-head" role="row"></div><div class="dg-body"></div></div></div><div class="dg-empty" hidden></div>';
    this.scroller = host.querySelector('.dg-scroll');
    this.inner = host.querySelector('.dg-inner');
    this.head = host.querySelector('.dg-head');
    this.body = host.querySelector('.dg-body');
    this.empty = host.querySelector('.dg-empty');
    this.scroller.addEventListener('scroll', () => this.renderRows());
    this.head.addEventListener('click', e => {
      const cell = e.target.closest('[data-col]');
      if (!cell) return;
      const c = +cell.dataset.col;
      if (this.onHeaderClick && e.altKey) { this.onHeaderClick(c); return; }
      this.sortBy(c);
    });
    new ResizeObserver(() => this.renderRows()).observe(this.scroller);
  }

  setData(columns, rows) {
    this.columns = columns;
    this.rows = rows;
    this.sortCol = -1;
    this.sortDir = 0;
    this.widths = this.measure();
    this.renderHead();
    this.applyView();
    this.scroller.scrollTop = 0;
  }

  measure() {
    const sample = this.rows.length > 300 ? this.rows.filter((_, i) => i % Math.ceil(this.rows.length / 300) === 0) : this.rows;
    return this.columns.map((c, i) => {
      let len = String(c).length + 3;
      for (const r of sample) len = Math.max(len, String(r[i] ?? '').length);
      return Math.max(70, Math.min(340, len * 7.6 + 24));
    });
  }

  numberWidth() {
    return Math.max(48, String(this.rows.length).length * 8 + 22);
  }

  template() {
    return `${this.numberWidth()}px ${this.widths.map(w => w + 'px').join(' ')}`;
  }

  renderHead() {
    const cols = this.columns.map((c, i) => {
      const arrow = this.sortCol === i ? (this.sortDir > 0 ? ' ▲' : ' ▼') : '';
      return `<div class="dg-th" role="columnheader" data-col="${i}" title="${DataGrid.esc(c)} (click to sort)">${DataGrid.esc(c)}<span class="dg-sort">${arrow}</span></div>`;
    }).join('');
    this.head.style.gridTemplateColumns = this.template();
    this.head.innerHTML = `<div class="dg-th dg-rn">#</div>${cols}`;
    const total = this.numberWidth() + this.widths.reduce((a, b) => a + b, 0);
    this.inner.style.width = total + 'px';
  }

  static esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  static compare(a, b) {
    if (a === b) return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb) && /^-?[\d.]/.test(a) && /^-?[\d.]/.test(b)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  sortBy(col) {
    if (this.sortCol !== col) { this.sortCol = col; this.sortDir = 1; }
    else this.sortDir = this.sortDir === 1 ? -1 : this.sortDir === -1 ? 0 : 1;
    if (!this.sortDir) this.sortCol = -1;
    this.renderHead();
    this.applyView();
  }

  setFilter(text) {
    this.filter = text.trim().toLowerCase();
    this.applyView();
  }

  applyView() {
    let idx = this.rows.map((_, i) => i);
    if (this.filter) {
      const terms = this.filter.split(/\s+/);
      idx = idx.filter(i => {
        const line = this.rows[i].join('\u0001').toLowerCase();
        return terms.every(t => line.includes(t));
      });
    }
    if (this.sortCol >= 0) {
      const c = this.sortCol, d = this.sortDir;
      idx.sort((a, b) => d * DataGrid.compare(this.rows[a][c] ?? '', this.rows[b][c] ?? '') || a - b);
    }
    this.view = idx;
    this.body.style.height = (idx.length * this.rowHeight) + 'px';
    this.empty.hidden = idx.length > 0 || !this.columns.length;
    this.empty.textContent = this.filter ? 'No rows match the filter.' : 'No rows.';
    this.lastStart = -1;
    this.renderRows(true);
    if (this.onChange) this.onChange({ total: this.rows.length, shown: idx.length });
  }

  renderRows(force) {
    if (!this.columns.length) { this.body.innerHTML = ''; return; }
    const h = this.rowHeight;
    const top = Math.max(0, this.scroller.scrollTop - this.head.offsetHeight);
    const start = Math.max(0, Math.floor(top / h) - 10);
    const count = Math.ceil(this.scroller.clientHeight / h) + 20;
    if (!force && start === this.lastStart) return;
    this.lastStart = start;
    const end = Math.min(this.view.length, start + count);
    const tpl = this.template();
    let html = '';
    for (let k = start; k < end; k++) {
      const ri = this.view[k];
      const r = this.rows[ri];
      let cells = `<div class="dg-td dg-rn">${ri + 1}</div>`;
      for (let c = 0; c < this.columns.length; c++) {
        const v = r[c] ?? '';
        const extra = this.cellClass ? this.cellClass(ri, c, v) : '';
        const cls = extra ? ' ' + extra : '';
        cells += v === '' ? `<div class="dg-td dg-null${cls}"></div>` : `<div class="dg-td${cls}" title="${v.length > 30 ? DataGrid.esc(v.slice(0, 500)) : ''}">${DataGrid.esc(v.length > 400 ? v.slice(0, 400) + '…' : v)}</div>`;
      }
      const rc = this.rowClass ? this.rowClass(ri) : '';
      html += `<div class="dg-tr${k % 2 ? ' odd' : ''}${rc ? ' ' + rc : ''}" style="top:${k * h}px;grid-template-columns:${tpl}">${cells}</div>`;
    }
    this.body.innerHTML = html;
  }

  visibleRows() {
    return this.view.map(i => this.rows[i]);
  }
}
