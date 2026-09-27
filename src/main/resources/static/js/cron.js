/* ============================================================
   cron.js - Cron expression explainer: parses Unix (5 fields),
   Spring (6 fields) and Quartz (6-7 fields) expressions, describes
   them in plain English and lists the next run times.
   ============================================================ */

'use strict';

const CronTool = (() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth'];

  const MACROS = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *',
  };

  class CronError extends Error {}

  const pad = n => String(n).padStart(2, '0');
  const listJoin = arr => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];

  // ── Parsing ────────────────────────────────────────────────────────────────
  function fieldSpecs(dialect) {
    return {
      second: { label: 'Second', min: 0, max: 59 },
      minute: { label: 'Minute', min: 0, max: 59 },
      hour: { label: 'Hour', min: 0, max: 23 },
      dom: { label: 'Day of month', min: 1, max: 31 },
      month: { label: 'Month', min: 1, max: 12, names: MON_NAMES, nameBase: 1 },
      dow: dialect === 'quartz'
        ? { label: 'Day of week', min: 1, max: 7, names: DOW_NAMES, nameBase: 1 }
        : { label: 'Day of week', min: 0, max: 7, names: DOW_NAMES, nameBase: 0 },
      year: { label: 'Year', min: 1970, max: 2099 },
    };
  }

  function toNumber(tok, spec, fieldName) {
    const up = tok.toUpperCase();
    if (spec.names) {
      const i = spec.names.indexOf(up);
      if (i >= 0) return i + spec.nameBase;
    }
    if (!/^\d+$/.test(tok)) throw new CronError(`${spec.label}: “${tok}” is not a valid value.`);
    const n = +tok;
    if (n < spec.min || n > spec.max) throw new CronError(`${spec.label}: ${n} is out of range (${spec.min}–${spec.max}).`);
    return n;
  }

  function parseField(raw, name, spec, dialect) {
    const field = { raw, name, all: false, star: raw.startsWith('*'), ignore: raw === '?', set: new Set(), specials: [], parts: [] };
    if (raw === '?') {
      if (name !== 'dom' && name !== 'dow') throw new CronError(`${spec.label}: “?” is only allowed in the day-of-month and day-of-week fields.`);
      if (dialect === 'unix') throw new CronError('“?” is not used in Unix cron. Use * instead, or switch the dialect to Spring or Quartz.');
      field.all = true;
      return field;
    }
    for (const part of raw.split(',')) {
      if (!part) throw new CronError(`${spec.label}: empty value in “${raw}”.`);
      const up = part.toUpperCase();

      // Day-of-month specials
      if (name === 'dom' && dialect !== 'unix') {
        let m;
        if (up === 'L') { field.specials.push({ type: 'L', offset: 0 }); field.parts.push({ kind: 'L', offset: 0 }); continue; }
        if ((m = up.match(/^L-(\d+)$/))) { field.specials.push({ type: 'L', offset: +m[1] }); field.parts.push({ kind: 'L', offset: +m[1] }); continue; }
        if (up === 'LW') { field.specials.push({ type: 'LW' }); field.parts.push({ kind: 'LW' }); continue; }
        if ((m = up.match(/^(\d+)W$/))) { const d = toNumber(m[1], spec); field.specials.push({ type: 'W', day: d }); field.parts.push({ kind: 'W', day: d }); continue; }
      }
      // Day-of-week specials
      if (name === 'dow' && dialect !== 'unix') {
        let m;
        if ((m = up.match(/^([A-Z]{3}|\d)L$/))) { const d = normDow(toNumber(m[1], spec), dialect); field.specials.push({ type: 'lastDow', dow: d }); field.parts.push({ kind: 'lastDow', dow: d }); continue; }
        if ((m = up.match(/^([A-Z]{3}|\d)#([1-5])$/))) { const d = normDow(toNumber(m[1], spec), dialect); field.specials.push({ type: 'nth', dow: d, n: +m[2] }); field.parts.push({ kind: 'nth', dow: d, n: +m[2] }); continue; }
        if (up === 'L' && dialect === 'quartz') { field.set.add(6); field.parts.push({ kind: 'single', v: 6 }); continue; }
      }

      const [rangePart, stepPart, extra] = part.split('/');
      if (extra !== undefined) throw new CronError(`${spec.label}: “${part}” has more than one “/”.`);
      let step = 1;
      if (stepPart !== undefined) {
        if (!/^\d+$/.test(stepPart) || +stepPart === 0) throw new CronError(`${spec.label}: the step in “${part}” must be a positive number.`);
        step = +stepPart;
      }
      let from, to, kind;
      if (rangePart === '*') {
        from = spec.min; to = spec.max; kind = step === 1 ? 'all' : 'step';
        if (name === 'dow' && dialect !== 'quartz') to = 6;
      } else if (rangePart.includes('-')) {
        const [a, b] = rangePart.split('-');
        if (a === '' || b === '' || b === undefined) throw new CronError(`${spec.label}: “${part}” is not a valid range.`);
        from = toNumber(a, spec); to = toNumber(b, spec); kind = 'range';
      } else {
        from = toNumber(rangePart, spec);
        to = stepPart !== undefined ? (name === 'dow' && dialect !== 'quartz' ? 6 : spec.max) : from;
        kind = stepPart !== undefined ? 'stepFrom' : 'single';
      }
      if (kind === 'all') field.all = true;

      const values = [];
      if (from <= to) for (let v = from; v <= to; v += step) values.push(v);
      else if (name === 'dow' || name === 'month') {               // wrap-around range such as FRI-MON or NOV-FEB
        const lo = spec.min, hi = name === 'dow' && dialect !== 'quartz' ? 6 : spec.max;
        const end = name === 'dow' && dialect !== 'quartz' ? to % 7 : to;
        for (let v = from, i = 0; ; i++) {
          if (i % step === 0) values.push(v);
          if (v === end) break;
          v = v === hi ? lo : v + 1;
        }
      } else throw new CronError(`${spec.label}: the range “${part}” goes backwards.`);

      for (const v of values) field.set.add(name === 'dow' ? normDow(v, dialect) : v);
      field.parts.push({ kind, from: name === 'dow' ? normDow(from, dialect) : from, to: name === 'dow' ? normDow(to, dialect) : to, step, v: name === 'dow' ? normDow(from, dialect) : from });
    }
    return field;
  }

  // Day of week as 0 = Sunday … 6 = Saturday
  function normDow(v, dialect) {
    if (dialect === 'quartz') return (v - 1) % 7;
    return v % 7;
  }

  function detectDialect(fields) {
    if (fields.length === 7) return 'quartz';
    // Quartz requires "?" in one day field; Spring allows it but it's rarely used there
    if (fields.length === 6) return fields.includes('?') ? 'quartz' : 'spring';
    return 'unix';
  }

  function parse(expr, dialectChoice = 'auto') {
    let text = expr.trim().replace(/\s+/g, ' ');
    if (!text) throw new CronError('Enter a cron expression.');
    if (/^@reboot$/i.test(text)) return { reboot: true, dialect: 'unix', text, expr: expr.trim(), warnings: [] };
    const macro = MACROS[text.toLowerCase()];
    if (macro) text = macro;
    else if (text.startsWith('@')) throw new CronError(`Unknown shortcut “${text}”. Use @yearly, @monthly, @weekly, @daily, @hourly or @reboot.`);

    const raw = text.split(' ');
    const dialect = dialectChoice === 'auto' ? detectDialect(raw) : dialectChoice;
    const expected = { unix: [5], spring: [6], quartz: [6, 7] }[dialect];
    if (!expected.includes(raw.length)) {
      const names = { unix: 'Unix cron uses 5 fields: minute hour day-of-month month day-of-week', spring: 'Spring uses 6 fields: second minute hour day-of-month month day-of-week', quartz: 'Quartz uses 6 or 7 fields: second minute hour day-of-month month day-of-week [year]' };
      throw new CronError(`Found ${raw.length} field${raw.length === 1 ? '' : 's'}. ${names[dialect]}.`);
    }
    const specs = fieldSpecs(dialect);
    const order = dialect === 'unix' ? ['minute', 'hour', 'dom', 'month', 'dow'] : ['second', 'minute', 'hour', 'dom', 'month', 'dow', 'year'];
    const f = {};
    order.forEach((name, i) => { if (raw[i] !== undefined) f[name] = parseField(raw[i], name, specs[name], dialect); });
    if (!f.second) f.second = { all: false, set: new Set([0]), parts: [{ kind: 'single', v: 0 }], raw: '0', implicit: true };

    const warnings = [];
    if (dialect === 'quartz' && !f.dom.ignore && !f.dow.ignore) throw new CronError('Quartz needs “?” in either the day-of-month or the day-of-week field, for example 0 0 12 ? * MON.');
    if (dialect === 'quartz' && f.dom.ignore && f.dow.ignore) throw new CronError('Quartz allows “?” in only one of day-of-month and day-of-week.');
    if (dialect !== 'unix' && /\d/.test(f.dow.raw.replace(/#\d/, '')) && !f.dow.all && !f.dow.ignore) warnings.push('Day-of-week numbers differ between tools: in Spring and Unix 0 or 7 is Sunday and 1 is Monday; in Quartz 1 is Sunday and 2 is Monday. Names such as MON-FRI avoid the confusion.');
    return { dialect, fields: f, text, expr: expr.trim(), warnings, macro: !!macro };
  }

  // ── Matching ───────────────────────────────────────────────────────────────
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }       // m is 1-12
  function weekday(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

  function domMatches(field, y, m, d) {
    if (field.set.has(d)) return true;
    const last = daysInMonth(y, m);
    for (const s of field.specials) {
      if (s.type === 'L' && d === last - s.offset) return true;
      if (s.type === 'LW') {
        let t = last;
        while (weekday(y, m, t) === 0 || weekday(y, m, t) === 6) t--;
        if (d === t) return true;
      }
      if (s.type === 'W') {
        let t = Math.min(s.day, last);
        const wd = weekday(y, m, t);
        if (wd === 6) t = t === 1 ? t + 2 : t - 1;
        else if (wd === 0) t = t === last ? t - 2 : t + 1;
        if (d === t) return true;
      }
    }
    return false;
  }

  function dowMatches(field, y, m, d) {
    const wd = weekday(y, m, d);
    if (field.set.has(wd)) return true;
    for (const s of field.specials) {
      if (s.type === 'lastDow' && wd === s.dow && d + 7 > daysInMonth(y, m)) return true;
      if (s.type === 'nth' && wd === s.dow && Math.ceil(d / 7) === s.n) return true;
    }
    return false;
  }

  function dayMatches(p, y, m, d) {
    const { dom, dow } = p.fields;
    if (p.dialect === 'unix') {
      // Vixie cron: if either field starts with *, both must match; otherwise either may match
      if (dom.star || dow.star) return domMatches(dom, y, m, d) && dowMatches(dow, y, m, d);
      return domMatches(dom, y, m, d) || dowMatches(dow, y, m, d);
    }
    const a = dom.ignore || dom.all || domMatches(dom, y, m, d);
    const b = dow.ignore || dow.all || dowMatches(dow, y, m, d);
    return a && b;
  }

  function nextRuns(p, count, from = new Date(), utc = false) {
    if (p.reboot) return [];
    const f = p.fields;
    const hasSec = p.dialect !== 'unix';
    const parts = t => {
      const d = new Date(t);
      return utc
        ? { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }
        : { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
    };
    const make = (y, mo, d, h, mi, s) => utc ? Date.UTC(y, mo - 1, d, h, mi, s) : new Date(y, mo - 1, d, h, mi, s).getTime();

    const unit = hasSec ? 1000 : 60000;
    let t = Math.floor(from.getTime() / unit) * unit + unit;
    const limit = from.getTime() + 10 * 366 * 86400000;
    const out = [];
    for (let guard = 0; guard < 400000 && out.length < count && t < limit; guard++) {
      const c = parts(t);
      let next;
      if (f.year && !f.year.all && !f.year.set.has(c.y)) next = make(c.y + 1, 1, 1, 0, 0, 0);
      else if (!f.month.set.has(c.mo)) next = make(c.y, c.mo + 1, 1, 0, 0, 0);
      else if (!dayMatches(p, c.y, c.mo, c.d)) next = make(c.y, c.mo, c.d + 1, 0, 0, 0);
      else if (!f.hour.set.has(c.h)) next = make(c.y, c.mo, c.d, c.h + 1, 0, 0);
      else if (!f.minute.set.has(c.mi)) next = make(c.y, c.mo, c.d, c.h, c.mi + 1, 0);
      else if (hasSec && !f.second.set.has(c.s)) next = make(c.y, c.mo, c.d, c.h, c.mi, c.s + 1);
      else { out.push(new Date(t)); next = t + unit; }
      t = next > t ? next : t + unit;            // always move forward (DST edge cases)
    }
    return out;
  }

  // ── Description ────────────────────────────────────────────────────────────
  const onlySingles = field => field.parts.length > 0 && field.parts.every(p => p.kind === 'single');
  const singleValue = field => field.parts.length === 1 && field.parts[0].kind === 'single' ? field.parts[0].v : null;
  const time = (h, m, s) => `${pad(h)}:${pad(m)}${s ? ':' + pad(s) : ''}`;

  function unitPhrase(field, unit, fmt = v => String(v)) {
    const bits = field.parts.map(p => {
      if (p.kind === 'all') return `every ${unit}`;
      if (p.kind === 'step') return `every ${p.step} ${unit}s`;
      if (p.kind === 'stepFrom') return `every ${p.step} ${unit}s starting at ${unit} ${fmt(p.from)}`;
      if (p.kind === 'range') return p.step > 1 ? `every ${p.step} ${unit}s from ${fmt(p.from)} through ${fmt(p.to)}` : `${unit}s ${fmt(p.from)} through ${fmt(p.to)}`;
      return null;
    });
    const singles = field.parts.filter(p => p.kind === 'single').map(p => fmt(p.v));
    const text = bits.filter(Boolean);
    if (singles.length) text.unshift(`${unit}${singles.length > 1 ? 's' : ''} ${listJoin(singles)}`);
    return listJoin(text);
  }

  function describeTime(f, hasSec) {
    const s = singleValue(f.second), m = singleValue(f.minute), h = singleValue(f.hour);
    const secIsZero = f.second.implicit || s === 0;

    // At 09:30 / At 09:30:15
    if (m !== null && h !== null && s !== null) return `At ${time(h, m, s)}`;

    // A few exact times: At 09:00, 12:00 and 18:00
    if (onlySingles(f.minute) && onlySingles(f.hour) && (secIsZero || s !== null) && f.minute.set.size * f.hour.set.size <= 6) {
      const times = [];
      [...f.hour.set].sort((a, b) => a - b).forEach(hh => [...f.minute.set].sort((a, b) => a - b).forEach(mm => times.push(time(hh, mm, s))));
      return `At ${listJoin(times)}`;
    }

    let secText = '';
    if (hasSec && !secIsZero) {
      secText = f.second.all ? 'Every second' : (s !== null ? `At second ${s}` : cap(unitPhrase(f.second, 'second')));
    }

    let minText;
    if (f.minute.all) minText = secText ? '' : 'Every minute';
    else if (m !== null) minText = `At minute ${m}`;
    else minText = cap(unitPhrase(f.minute, 'minute'));

    let hourText = '';
    if (f.hour.all) hourText = m !== null && !secText ? ' past every hour' : '';
    else if (h !== null) hourText = `, between ${time(h, 0)} and ${time(h, 59)}`;
    else if (f.hour.parts.length === 1 && f.hour.parts[0].kind === 'range' && f.hour.parts[0].step === 1) hourText = `, between ${time(f.hour.parts[0].from, 0)} and ${time(f.hour.parts[0].to, 59)}`;
    else hourText = `, ${unitPhrase(f.hour, 'hour', v => pad(v))}`;

    if (secText && minText) return `${secText}, ${lower(minText)}${hourText}`;
    if (secText) return secText + hourText;
    return minText + hourText;
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  function describeDom(field) {
    if (field.ignore || field.all) return '';
    const bits = field.parts.map(p => {
      if (p.kind === 'L') return p.offset ? `${p.offset} day${p.offset > 1 ? 's' : ''} before the last day of the month` : 'the last day of the month';
      if (p.kind === 'LW') return 'the last weekday of the month';
      if (p.kind === 'W') return `the weekday nearest the ${ordinal(p.day)}`;
      if (p.kind === 'single') return `the ${ordinal(p.v)}`;
      if (p.kind === 'range') return p.step > 1 ? `every ${p.step} days from the ${ordinal(p.from)} through the ${ordinal(p.to)}` : `the ${ordinal(p.from)} through the ${ordinal(p.to)}`;
      if (p.kind === 'step') return `every ${ordinal(p.step)} day (the 1st, ${ordinal(1 + p.step)}, ${ordinal(1 + 2 * p.step)}…)`;
      if (p.kind === 'stepFrom') return `every ${p.step} days starting on the ${ordinal(p.from)}`;
      return '';
    });
    const text = listJoin(bits);
    return /^(the|every)/.test(text) && !/month/.test(text) ? `on ${text} of the month` : `on ${text}`;
  }

  function describeDow(field) {
    if (field.ignore || field.all) return '';
    const bits = field.parts.map(p => {
      if (p.kind === 'lastDow') return `the last ${DAYS[p.dow]} of the month`;
      if (p.kind === 'nth') return `the ${ORD[p.n]} ${DAYS[p.dow]} of the month`;
      if (p.kind === 'single') return DAYS[p.v];
      if (p.kind === 'range') return p.step > 1 ? `every ${p.step} days from ${DAYS[p.from]} through ${DAYS[p.to]}` : `${DAYS[p.from]} through ${DAYS[p.to]}`;
      if (p.kind === 'step' || p.kind === 'stepFrom') return listJoin([...field.set].sort().map(d => DAYS[d]));
      return '';
    });
    return `on ${listJoin(bits)}`;
  }

  function describeMonth(field) {
    if (field.all) return '';
    const bits = field.parts.map(p => {
      if (p.kind === 'single') return MONTHS[p.v - 1];
      if (p.kind === 'range') return p.step > 1 ? `every ${p.step} months from ${MONTHS[p.from - 1]} through ${MONTHS[p.to - 1]}` : `${MONTHS[p.from - 1]} through ${MONTHS[p.to - 1]}`;
      if (p.kind === 'step') return `every ${p.step} months`;
      if (p.kind === 'stepFrom') return `every ${p.step} months starting in ${MONTHS[p.from - 1]}`;
      return '';
    });
    return /^every/.test(bits[0]) ? listJoin(bits) : `in ${listJoin(bits)}`;
  }

  function describe(p) {
    if (p.reboot) return 'Once, when the system starts (@reboot). There are no scheduled run times.';
    const f = p.fields;
    let out = describeTime(f, p.dialect !== 'unix');
    const dom = describeDom(f.dom), dow = describeDow(f.dow);
    if (dom && dow) {
      const either = p.dialect === 'unix' && !f.dom.star && !f.dow.star;
      out += either ? `, ${dom} or ${dow.replace(/^on /, 'on any ')}` : `, ${dom}, but only if it is ${dow.replace(/^on /, 'a ')}`;
    } else if (dom || dow) out += ', ' + (dom || dow);
    if (!dom && !dow && /^At /.test(out) && f.month.all && (!f.year || f.year.all)) out += ', every day';
    const month = describeMonth(f.month);
    if (month) out += ', ' + month;
    if (f.year && !f.year.all) out += ', ' + (onlySingles(f.year) ? `in ${listJoin([...f.year.set])}` : unitPhrase(f.year, 'year'));
    return out.replace(/\s+/g, ' ').trim() + '.';
  }

  function fieldMeaning(field, name) {
    if (field.ignore) return 'No specific value (“?”)';
    if (field.all) return { second: 'Every second', minute: 'Every minute', hour: 'Every hour', dom: 'Every day', month: 'Every month', dow: 'Every day of the week', year: 'Every year' }[name];
    if (name === 'dom') return cap(describeDom(field).replace(/^on /, ''));
    if (name === 'dow') return cap(describeDow(field).replace(/^on /, ''));
    if (name === 'month') return cap(describeMonth(field).replace(/^in /, ''));
    if (name === 'hour') return cap(unitPhrase(field, 'hour'));
    return cap(unitPhrase(field, name));
  }

  // Equivalent expression in the other common format
  function convert(p) {
    if (p.reboot) return null;
    const f = p.fields;
    if (p.dialect === 'unix') {
      return { label: 'Spring @Scheduled', value: `@Scheduled(cron = "0 ${p.text}")`, note: 'Spring adds a seconds field at the start.' };
    }
    if (p.dialect === 'spring' && (f.second.raw === '0') && !/[LW#?]/i.test(f.dom.raw + f.dow.raw)) {
      return { label: 'Unix crontab', value: p.text.split(' ').slice(1).join(' ') + ' /path/to/command', note: 'Unix cron has no seconds field, so the leading 0 is dropped.' };
    }
    return null;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.cron';
  let els, timer = null;

  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function relative(date) {
    const diff = date.getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'in under a minute';
    if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    const days = Math.round(hours / 24);
    if (days < 60) return `in ${days} days`;
    const months = Math.round(days / 30.4);
    return months < 24 ? `in ${months} months` : `in ${Math.round(days / 365)} years`;
  }

  function render() {
    const expr = els.input.value;
    try { localStorage.setItem(STORE, JSON.stringify({ expr, dialect: els.dialect.value, tz: els.tz.value })); } catch (_) { /* ignore */ }
    let p;
    try {
      p = parse(expr, els.dialect.value);
    } catch (e) {
      if (!(e instanceof CronError)) throw e;
      els.input.classList.add('invalid');
      els.desc.textContent = e.message;
      els.desc.className = 'cron-desc bad';
      els.fields.innerHTML = '';
      els.runs.innerHTML = '';
      els.warn.hidden = true;
      els.convert.hidden = true;
      els.detected.textContent = '';
      return;
    }
    els.input.classList.remove('invalid');
    els.desc.textContent = describe(p);
    els.desc.className = 'cron-desc';
    els.detected.textContent = { unix: 'Unix / Linux crontab (5 fields)', spring: 'Spring (6 fields, with seconds)', quartz: 'Quartz (with seconds' + (p.fields.year ? ' and year)' : ')') }[p.dialect] + (p.macro ? ' · shortcut' : '');

    els.warn.hidden = !p.warnings.length;
    els.warn.textContent = p.warnings.join(' ');

    if (p.reboot) { els.fields.innerHTML = ''; els.runs.innerHTML = '<li class="muted">@reboot has no schedule.</li>'; els.convert.hidden = true; return; }

    const order = p.dialect === 'unix' ? ['minute', 'hour', 'dom', 'month', 'dow'] : ['second', 'minute', 'hour', 'dom', 'month', 'dow', 'year'];
    const specs = fieldSpecs(p.dialect);
    const allowed = { second: '0-59', minute: '0-59', hour: '0-23', dom: p.dialect === 'unix' ? '1-31' : '1-31 L W ?', month: '1-12 or JAN-DEC',
      dow: p.dialect === 'quartz' ? '1-7 (1 = SUN) or SUN-SAT, L #' : (p.dialect === 'spring' ? '0-7 (0 or 7 = SUN) or SUN-SAT, L #' : '0-7 (0 or 7 = SUN) or SUN-SAT'), year: '1970-2099' };
    els.fields.innerHTML = order.filter(n => p.fields[n] && !(n === 'year' && !p.fields.year.raw)).map(n => `
      <tr><td>${specs[n].label}</td><td class="val"><code>${escapeHtml(p.fields[n].raw)}</code></td><td>${escapeHtml(fieldMeaning(p.fields[n], n))}</td><td class="muted">${allowed[n]}</td></tr>`).join('');

    const utc = els.tz.value === 'utc';
    const runs = nextRuns(p, 10, new Date(), utc);
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: p.dialect === 'unix' ? undefined : '2-digit', hour12: false, timeZone: utc ? 'UTC' : undefined });
    els.runs.innerHTML = runs.length
      ? runs.map(d => `<li><span>${escapeHtml(fmt.format(d))}</span><span class="muted">${relative(d)}</span></li>`).join('')
      : '<li class="muted">This schedule never runs in the next 10 years (for example 30 February).</li>';

    const c = convert(p);
    els.convert.hidden = !c;
    if (c) {
      els.convertLabel.textContent = c.label;
      els.convertValue.textContent = c.value;
      els.convertNote.textContent = c.note;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 100);
  }

  function init() {
    els = {
      input: $('cronInput'), dialect: $('cronDialect'), tz: $('cronTz'), desc: $('cronDesc'), detected: $('cronDetected'),
      fields: $('cronFields'), runs: $('cronRuns'), warn: $('cronWarn'),
      convert: $('cronConvert'), convertLabel: $('cronConvertLabel'), convertValue: $('cronConvertValue'), convertNote: $('cronConvertNote'),
    };
    if (!els.input) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (_) { /* ignore */ }
    const fromHash = decodeURIComponent(location.hash.slice(1)).replace(/_/g, ' ');
    els.input.value = fromHash || (saved && saved.expr) || '30 9 * * MON-FRI';
    if (saved && !fromHash) { els.dialect.value = saved.dialect || 'auto'; els.tz.value = saved.tz || 'local'; }
    $('cronTzLocal').textContent = `Local time (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;

    els.input.addEventListener('input', schedule);
    els.dialect.addEventListener('change', render);
    els.tz.addEventListener('change', render);
    document.querySelectorAll('[data-cron]').forEach(b => b.addEventListener('click', () => {
      els.input.value = b.dataset.cron;
      els.dialect.value = b.dataset.dialect || 'auto';
      render();
      els.input.focus();
    }));
    $('cronCopy').addEventListener('click', e => navigator.clipboard.writeText(els.input.value.trim()).then(() => {
      const t = e.target.textContent; e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = t; }, 1200);
    }));
    $('cronCopyConvert').addEventListener('click', e => navigator.clipboard.writeText(els.convertValue.textContent).then(() => {
      const t = e.target.textContent; e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = t; }, 1200);
    }));
    render();
    setInterval(() => { if (!document.hidden) render(); }, 30000);   // keep "in N minutes" fresh
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { parse, describe, nextRuns, CronError };
})();
