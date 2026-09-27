/* ============================================================
   mock.js - Mock data generator. Builds realistic fake records
   from a sample JSON document or a JSON Schema, with a seed so
   results can be reproduced. Output: JSON, NDJSON, CSV or SQL.
   ============================================================ */

'use strict';

const MockTool = (() => {
  // ── Seeded random (mulberry32) ─────────────────────────────────────────────
  let rnd = Math.random;
  function seed(s) {
    let h = 1779033703 ^ String(s).length;
    for (const ch of String(s)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const chance = p => rnd() < p;
  const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[int(0, 15)]).join('');

  // ── Word lists ─────────────────────────────────────────────────────────────
  const FIRST = ['Aarav', 'Aisha', 'Alex', 'Amara', 'Ana', 'Ben', 'Carlos', 'Chen', 'Chloe', 'Daniel', 'Diego', 'Elena', 'Emma', 'Fatima', 'Hana', 'Hiro',
    'Isabel', 'Ivan', 'James', 'Jin', 'Kavya', 'Kofi', 'Lara', 'Leo', 'Liam', 'Lucas', 'Maya', 'Mei', 'Mohammed', 'Nadia', 'Noah', 'Olivia', 'Omar',
    'Priya', 'Rahul', 'Rosa', 'Sara', 'Sofia', 'Tariq', 'Tom', 'Wei', 'Yuki', 'Zara', 'Arjun', 'Grace', 'Mateo', 'Nina', 'Ravi', 'Sam', 'Anya'];
  const LAST = ['Adams', 'Ahmed', 'Brown', 'Chen', 'Costa', 'Das', 'Dubois', 'Fischer', 'Garcia', 'Gupta', 'Hansen', 'Ito', 'Johnson', 'Kaur', 'Kim',
    'Kowalski', 'Lee', 'Lopez', 'Martin', 'Mehta', 'Miller', 'Mueller', 'Nakamura', 'Nguyen', 'Novak', 'Okafor', 'Park', 'Patel', 'Rossi', 'Santos',
    'Sharma', 'Silva', 'Singh', 'Smith', 'Suzuki', 'Tanaka', 'Taylor', 'Wang', 'Williams', 'Wilson', 'Yadav', 'Zhang', 'Iyer', 'Reddy', 'Mensah'];
  const CITIES = [['Mumbai', 'India', 'IN'], ['Bengaluru', 'India', 'IN'], ['Delhi', 'India', 'IN'], ['New York', 'United States', 'US'], ['Austin', 'United States', 'US'],
    ['Seattle', 'United States', 'US'], ['London', 'United Kingdom', 'GB'], ['Manchester', 'United Kingdom', 'GB'], ['Berlin', 'Germany', 'DE'], ['Munich', 'Germany', 'DE'],
    ['Paris', 'France', 'FR'], ['Madrid', 'Spain', 'ES'], ['Milan', 'Italy', 'IT'], ['Amsterdam', 'Netherlands', 'NL'], ['Stockholm', 'Sweden', 'SE'], ['Toronto', 'Canada', 'CA'],
    ['São Paulo', 'Brazil', 'BR'], ['Mexico City', 'Mexico', 'MX'], ['Tokyo', 'Japan', 'JP'], ['Seoul', 'South Korea', 'KR'], ['Singapore', 'Singapore', 'SG'],
    ['Sydney', 'Australia', 'AU'], ['Lagos', 'Nigeria', 'NG'], ['Nairobi', 'Kenya', 'KE'], ['Dubai', 'United Arab Emirates', 'AE'], ['Cape Town', 'South Africa', 'ZA']];
  const STREETS = ['Main', 'Park', 'Oak', 'Maple', 'Cedar', 'Lake', 'Hill', 'Church', 'Station', 'Market', 'River', 'Mill', 'Garden', 'King', 'Queen', 'High'];
  const STREET_TYPES = ['Street', 'Road', 'Avenue', 'Lane', 'Way', 'Drive'];
  const COMPANY_A = ['Blue', 'Bright', 'Cedar', 'Delta', 'Green', 'Iron', 'Lumen', 'Nova', 'North', 'Orbit', 'Pixel', 'Quantum', 'Silver', 'Summit', 'Swift', 'Vertex'];
  const COMPANY_B = ['Labs', 'Systems', 'Analytics', 'Works', 'Digital', 'Logistics', 'Health', 'Foods', 'Energy', 'Software', 'Studio', 'Networks'];
  const COMPANY_C = ['Inc.', 'Ltd', 'LLC', 'GmbH', 'Pvt Ltd', 'Co.'];
  const JOBS = ['Software Engineer', 'Data Analyst', 'Product Manager', 'Designer', 'Sales Manager', 'Accountant', 'Support Specialist', 'DevOps Engineer',
    'Marketing Lead', 'QA Engineer', 'HR Partner', 'Data Scientist', 'Operations Manager', 'Account Executive'];
  const DEPTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Support', 'Operations', 'HR', 'Product', 'Legal'];
  const PRODUCT_ADJ = ['Classic', 'Compact', 'Deluxe', 'Eco', 'Ergonomic', 'Lightweight', 'Premium', 'Smart', 'Wireless', 'Portable', 'Rugged', 'Slim'];
  const PRODUCT_NOUN = ['Backpack', 'Bottle', 'Chair', 'Desk Lamp', 'Headphones', 'Keyboard', 'Monitor', 'Mouse', 'Notebook', 'Speaker', 'Watch', 'Jacket', 'Mug', 'Charger'];
  const CATEGORIES = ['Electronics', 'Home', 'Office', 'Outdoor', 'Clothing', 'Sports', 'Books', 'Beauty', 'Toys', 'Grocery'];
  const COLORS = ['red', 'blue', 'green', 'black', 'white', 'grey', 'orange', 'purple', 'yellow', 'teal'];
  const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim ' +
    'veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat').split(' ');
  const STATUS = ['active', 'inactive', 'pending', 'suspended'];
  const ORDER_STATUS = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const DOMAINS = ['example.com', 'example.org', 'example.net', 'mail.test', 'company.test'];
  const TLDS = ['com', 'io', 'dev', 'co', 'org', 'net'];
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD'];

  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const words = (min, max) => Array.from({ length: int(min, max) }, () => pick(LOREM));
  const sentence = () => cap(words(6, 14).join(' ')) + '.';
  const uuid = () => { const h = hex(32).split(''); h[12] = '4'; h[16] = '89ab'[int(0, 3)]; const s = h.join(''); return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`; };
  const isoDate = (fromYears = -3, toYears = 0) => {
    const now = Date.UTC(2026, 8, 1);
    return new Date(now + int(fromYears * 365, toYears * 365) * 86400000 + int(0, 86399) * 1000);
  };
  const phone = cc => {
    if (cc === 'IN') return `+91 ${int(6, 9)}${hex(0)}${int(1000, 9999)} ${int(10000, 99999)}`;
    if (cc === 'US' || cc === 'CA') return `+1 ${int(201, 989)}-555-${String(int(100, 199)).padStart(4, '0')}`;   // 555-01xx is reserved for fiction
    if (cc === 'GB') return `+44 20 7946 0${int(100, 999)}`;                                                      // Ofcom drama range
    return `+${int(30, 99)} ${int(100, 999)} ${int(100, 999)} ${int(1000, 9999)}`;
  };

  // A consistent "person" per record, so email matches name, city matches country, etc.
  function newContext() {
    const first = pick(FIRST), last = pick(LAST);
    const [city, country, cc] = pick(CITIES);
    const company = `${pick(COMPANY_A)} ${pick(COMPANY_B)}`;
    return { first, last, city, country, cc, company, created: isoDate(-3, -1) };
  }

  // ── Field generator by name ────────────────────────────────────────────────
  // Returns undefined when the name gives no hint
  function byName(rawName, type, ctx) {
    const n = rawName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const has = (...keys) => keys.some(k => new RegExp(`(^|_)${k}($|_)`).test(n));
    const str = type === 'string' || type === undefined;
    const num = type === 'number' || type === 'integer';

    if (str) {
      if (has('uuid', 'guid')) return uuid();
      if (has('email', 'mail')) return `${slug(ctx.first)}.${slug(ctx.last)}${chance(0.3) ? int(1, 99) : ''}@${pick(DOMAINS)}`;
      if (has('first', 'firstname', 'given')) return ctx.first;
      if (has('last', 'lastname', 'surname', 'family')) return ctx.last;
      if (has('username', 'login', 'handle', 'nickname')) return `${slug(ctx.first)}${pick(['', '_', '.'])}${slug(ctx.last).slice(0, int(1, 4))}${int(1, 999)}`;
      if (has('full_name', 'fullname', 'display_name', 'author', 'customer_name', 'contact', 'owner') || n === 'name' && !ctx.inProduct) return `${ctx.first} ${ctx.last}`;
      if (has('company', 'organization', 'organisation', 'employer', 'vendor', 'supplier', 'brand')) return `${ctx.company} ${pick(COMPANY_C)}`;
      if (has('job', 'title') && !has('page')) return ctx.inProduct ? `${pick(PRODUCT_ADJ)} ${pick(PRODUCT_NOUN)}` : pick(JOBS);
      if (has('department', 'dept', 'team')) return pick(DEPTS);
      if (has('phone', 'mobile', 'tel', 'telephone', 'cell')) return phone(ctx.cc);
      if (has('street', 'address', 'address1', 'line1')) return `${int(1, 250)} ${pick(STREETS)} ${pick(STREET_TYPES)}`;
      if (has('city', 'town')) return ctx.city;
      if (has('country_code', 'countrycode', 'iso2')) return ctx.cc;
      if (has('country')) return ctx.country;
      if (has('zip', 'postcode', 'postal', 'pincode', 'postal_code')) return ctx.cc === 'IN' ? String(int(110001, 855999)) : ctx.cc === 'GB' ? `${pick(['SW1A', 'EC1A', 'M1', 'B2'])} ${int(1, 9)}${pick(['AA', 'BB', 'DX', 'NP'])}` : String(int(10000, 99999));
      if (has('state', 'region', 'province')) return pick(['North', 'South', 'East', 'West', 'Central']) + ' ' + pick(['Region', 'District', 'Province']);
      if (has('url', 'website', 'link', 'homepage')) return `https://www.${slug(ctx.company).replace(/\./g, '')}.${pick(TLDS)}`;
      if (has('avatar', 'image', 'photo', 'picture', 'thumbnail', 'logo')) return `https://picsum.photos/seed/${hex(6)}/200/200`;
      if (has('domain', 'host', 'hostname')) return `${slug(ctx.company).replace(/\./g, '')}.${pick(TLDS)}`;
      if (has('ip', 'ip_address', 'ipv4')) return `${int(1, 223)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`;
      if (has('mac')) return Array.from({ length: 6 }, () => hex(2)).join(':');
      if (has('user_agent', 'useragent')) return pick(['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', 'Mozilla/5.0 (Linux; Android 14)']);
      if (has('currency')) return pick(CURRENCIES);
      if (has('color', 'colour')) return chance(0.5) ? pick(COLORS) : '#' + hex(6);
      if (has('status')) return ctx.inOrder ? pick(ORDER_STATUS) : pick(STATUS);
      if (has('gender', 'sex')) return pick(['female', 'male', 'non-binary']);
      if (has('category', 'type', 'kind', 'genre')) return pick(CATEGORIES);
      if (has('sku', 'code', 'product_code')) return `${pick(['A', 'B', 'C', 'X', 'Z'])}${pick(['A', 'K', 'M', 'P'])}-${int(100, 999)}`;
      if (has('product', 'item', 'product_name')) return `${pick(PRODUCT_ADJ)} ${pick(PRODUCT_NOUN)}`;
      if (has('description', 'summary', 'bio', 'about', 'comment', 'note', 'notes', 'message', 'body', 'content', 'text', 'review')) return sentence();
      if (has('tag', 'tags', 'keyword', 'label')) return pick(LOREM);
      if (has('password', 'secret', 'token', 'api_key', 'apikey', 'hash')) return hex(32);
      if (has('iban')) return `DE${int(10, 99)}${String(int(0, 99999999)).padStart(8, '0')}${String(int(0, 9999999999)).padStart(10, '0')}`;
      if (has('card', 'credit_card', 'card_number')) return pick(['4111 1111 1111 1111', '5555 5555 5555 4444', '3782 822463 10005']);   // published test numbers
      if (has('date_of_birth', 'dob', 'birthday', 'birth_date', 'birthdate')) return isoDate(-60, -18).toISOString().slice(0, 10);
      if (has('created', 'created_at', 'updated', 'updated_at', 'modified', 'timestamp', 'time', 'at', 'last_login', 'deleted_at')) return isoDate(-2, 0).toISOString().replace(/\.\d{3}Z$/, 'Z');
      if (has('date', 'day', 'due', 'start', 'end', 'expires', 'expiry')) return isoDate(-1, 1).toISOString().slice(0, 10);
      if (has('language', 'lang', 'locale')) return pick(['en', 'en-GB', 'hi', 'de', 'fr', 'es', 'ja', 'pt-BR']);
      if (has('timezone', 'tz')) return pick(['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Tokyo']);
      if (has('version')) return `${int(0, 5)}.${int(0, 20)}.${int(0, 30)}`;
      if (has('slug')) return words(2, 4).join('-');
      if (has('id', 'key', 'ref', 'reference')) return chance(0.5) ? uuid() : `${n.slice(0, 3).toUpperCase()}-${int(10000, 99999)}`;
      if (has('name')) return ctx.inProduct ? `${pick(PRODUCT_ADJ)} ${pick(PRODUCT_NOUN)}` : `${ctx.first} ${ctx.last}`;
    }
    if (num) {
      if (has('id') || n.endsWith('id')) return int(1, 99999);
      if (has('age')) return int(18, 80);
      if (has('price', 'amount', 'total', 'cost', 'subtotal', 'balance', 'salary', 'revenue', 'fee', 'tax')) {
        const v = has('salary') ? int(30000, 180000) : int(100, 50000) / 100;
        return type === 'integer' ? Math.round(v) : v;
      }
      if (has('qty', 'quantity', 'count', 'stock', 'units')) return int(0, 50);
      if (has('rating', 'stars', 'score')) return type === 'integer' ? int(1, 5) : int(10, 50) / 10;
      if (has('percent', 'percentage', 'discount', 'rate')) return type === 'integer' ? int(0, 100) : int(0, 1000) / 10;
      if (has('year')) return int(2000, 2026);
      if (has('lat', 'latitude')) return +(rnd() * 180 - 90).toFixed(6);
      if (has('lng', 'lon', 'long', 'longitude')) return +(rnd() * 360 - 180).toFixed(6);
      if (has('timestamp', 'created', 'updated', 'time', 'epoch')) return Math.floor(isoDate(-2, 0).getTime() / 1000);
      if (has('weight')) return type === 'integer' ? int(1, 100) : int(10, 10000) / 100;
    }
    return undefined;
  }

  // ── From a sample document ─────────────────────────────────────────────────
  function fromSample(sample, name, ctx, depth = 0) {
    if (depth > 20) return null;
    if (sample === null) return chance(0.7) ? null : null;
    if (Array.isArray(sample)) {
      if (!sample.length) return [];
      const n = Math.max(1, Math.min(8, int(Math.max(1, sample.length - 1), sample.length + 2)));
      const templ = mergeSamples(sample);
      const singular = name.replace(/ies$/, 'y').replace(/s$/, '');
      return Array.from({ length: n }, () => fromSample(templ, singular, childCtx(ctx, singular), depth + 1));
    }
    if (typeof sample === 'object') {
      const c = withSiblings(childCtx(ctx, name), Object.keys(sample));
      const out = {};
      for (const [k, v] of Object.entries(sample)) out[k] = fromSample(v, k, c, depth + 1);
      return out;
    }
    if (typeof sample === 'boolean') return chance(0.5);
    if (typeof sample === 'number') {
      const t = Number.isInteger(sample) ? 'integer' : 'number';
      const named = byName(name, t, ctx);
      if (named !== undefined) return named;
      const mag = Math.abs(sample) || 10;
      const lo = sample < 0 ? -mag * 2 : 0;
      const v = lo + rnd() * (mag * 2 - lo);
      if (t === 'integer') return Math.round(v);
      const decimals = Math.min(6, (String(sample).split('.')[1] || '').length || 2);
      return +v.toFixed(decimals);
    }
    // string: keep the format of the sample value
    const s = String(sample);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return uuid();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return isoDate(-2, 0).toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isoDate(-2, 1).toISOString().slice(0, 10);
    if (/^[^@\s]+@[^@\s]+\.\w+$/.test(s)) return byName('email', 'string', ctx);
    if (/^https?:\/\//i.test(s)) return byName('url', 'string', ctx);
    if (/^#[0-9a-f]{6}$/i.test(s)) return '#' + hex(6);
    // codes like ORD-10231 and numeric strings keep the sample's own format
    if (/^[A-Z]{2,5}-\d+$/.test(s)) return s.split('-')[0] + '-' + String(int(1, 10 ** s.split('-')[1].length - 1)).padStart(s.split('-')[1].length, '0');
    if (/^\d+$/.test(s) && !/phone|mobile|tel/i.test(name)) return String(int(10 ** (s.length - 1), 10 ** s.length - 1));
    const named = byName(name, 'string', ctx);
    if (named !== undefined) return named;
    const wc = s.split(/\s+/).length;
    if (wc > 3) return cap(words(Math.max(2, wc - 2), wc + 2).join(' ')) + (s.endsWith('.') ? '.' : '');
    return wc > 1 ? words(wc, wc).map(cap).join(' ') : cap(pick(LOREM));
  }

  function mergeSamples(arr) {
    const objs = arr.filter(v => v && typeof v === 'object' && !Array.isArray(v));
    if (objs.length === arr.length && objs.length) {
      const merged = {};
      objs.forEach(o => Object.entries(o).forEach(([k, v]) => { if (!(k in merged) || merged[k] === null) merged[k] = v; }));
      return merged;
    }
    return arr[int(0, arr.length - 1)];
  }

  // Sibling fields hint at what an object is: price/sku means a product, so "name" is a product name
  function withSiblings(c, keys) {
    const k = keys.join(' ').toLowerCase();
    if (/\b(price|sku|stock|in_?stock|product|brand|rating)\b/.test(k.replace(/([a-z])([A-Z])/g, '$1_$2'))) c.inProduct = true;
    return c;
  }

  function childCtx(ctx, name) {
    const n = name.toLowerCase();
    const c = { ...ctx };
    if (/product|item|line|sku|cart/.test(n)) c.inProduct = true;
    if (/order|invoice|payment|transaction|purchase/.test(n)) c.inOrder = true;
    if (/user|customer|person|author|member|employee|contact|owner|profile|people|account/.test(n)) Object.assign(c, newContext(), { inProduct: false });
    return c;
  }

  // ── From a JSON Schema ─────────────────────────────────────────────────────
  function resolveRef(ref, root) {
    if (!ref.startsWith('#')) throw new Error(`Only references inside the same schema are supported ($ref: ${ref}).`);
    return ref.slice(1).split('/').filter(Boolean).reduce((o, k) => (o ? o[k.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined), root);
  }

  function fromSchema(schema, name, ctx, root, depth = 0) {
    if (depth > 12 || schema === true || !schema) return null;
    if (schema.$ref) return fromSchema(resolveRef(schema.$ref, root) || {}, name, ctx, root, depth + 1);
    if ('const' in schema) return schema.const;
    if (schema.enum) return pick(schema.enum);
    if (schema.examples && schema.examples.length && chance(0.3)) return pick(schema.examples);
    if (schema.allOf) return fromSchema(schema.allOf.reduce((a, s) => mergeSchema(a, s.$ref ? resolveRef(s.$ref, root) : s), {}), name, ctx, root, depth + 1);
    if (schema.oneOf || schema.anyOf) return fromSchema(pick(schema.oneOf || schema.anyOf), name, ctx, root, depth + 1);
    let type = schema.type;
    if (Array.isArray(type)) {
      const nonNull = type.filter(t => t !== 'null');
      if (type.includes('null') && chance(0.15)) return null;
      type = pick(nonNull.length ? nonNull : type);
    }
    if (!type) type = schema.properties ? 'object' : schema.items ? 'array' : 'string';

    switch (type) {
      case 'object': {
        const c = withSiblings(childCtx(ctx, name), Object.keys(schema.properties || {}));
        const out = {};
        const req = new Set(schema.required || []);
        for (const [k, s] of Object.entries(schema.properties || {})) {
          if (req.has(k) || chance(0.85)) out[k] = fromSchema(s, k, c, root, depth + 1);
        }
        return out;
      }
      case 'array': {
        const min = schema.minItems ?? 1, max = schema.maxItems ?? Math.max(min, 4);
        const n = int(min, Math.min(max, min + 5));
        const singular = name.replace(/ies$/, 'y').replace(/s$/, '');
        const items = Array.isArray(schema.prefixItems) ? schema.prefixItems : null;
        const list = Array.from({ length: n }, (_, i) => fromSchema(items && items[i] ? items[i] : schema.items || {}, singular, childCtx(ctx, singular), root, depth + 1));
        return schema.uniqueItems ? [...new Map(list.map(v => [JSON.stringify(v), v])).values()] : list;
      }
      case 'integer':
      case 'number': {
        const named = byName(name, type, ctx);
        let lo = schema.minimum ?? (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + (type === 'integer' ? 1 : 0.01) : undefined);
        let hi = schema.maximum ?? (schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum - (type === 'integer' ? 1 : 0.01) : undefined);
        if (named !== undefined && (lo === undefined || named >= lo) && (hi === undefined || named <= hi)) return named;
        lo = lo ?? 0; hi = hi ?? Math.max(lo + 1000, lo * 2);
        let v = type === 'integer' ? int(Math.ceil(lo), Math.floor(hi)) : +(lo + rnd() * (hi - lo)).toFixed(2);
        if (schema.multipleOf) v = Math.max(lo, Math.round(v / schema.multipleOf) * schema.multipleOf);
        return type === 'integer' ? Math.round(v) : +v.toFixed(6);
      }
      case 'boolean': return chance(0.5);
      case 'null': return null;
      default: {
        const f = schema.format;
        let v;
        if (f === 'email' || f === 'idn-email') v = byName('email', 'string', ctx);
        else if (f === 'uuid') v = uuid();
        else if (f === 'date-time') v = isoDate(-2, 0).toISOString().replace(/\.\d{3}Z$/, 'Z');
        else if (f === 'date') v = isoDate(-2, 1).toISOString().slice(0, 10);
        else if (f === 'time') v = `${String(int(0, 23)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`;
        else if (f === 'uri' || f === 'url' || f === 'iri') v = byName('url', 'string', ctx);
        else if (f === 'hostname') v = byName('domain', 'string', ctx);
        else if (f === 'ipv4') v = byName('ip', 'string', ctx);
        else if (f === 'ipv6') v = Array.from({ length: 8 }, () => hex(4).replace(/^0+(?=.)/, '')).join(':');
        else v = byName(name, 'string', ctx) ?? cap(words(1, 3).join(' '));
        if (schema.maxLength !== undefined && v.length > schema.maxLength) v = v.slice(0, schema.maxLength);
        if (schema.minLength !== undefined && v.length < schema.minLength) v = v.padEnd(schema.minLength, 'x');
        return v;
      }
    }
  }

  function mergeSchema(a, b) {
    return { ...a, ...b, properties: { ...(a.properties || {}), ...(b.properties || {}) }, required: [...(a.required || []), ...(b.required || [])] };
  }

  // ── Output formats ─────────────────────────────────────────────────────────
  function flatten(obj, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
    return out;
  }

  function toCsv(rows) {
    const flat = rows.map(r => (r && typeof r === 'object' && !Array.isArray(r) ? flatten(r) : { value: r }));
    const cols = [...new Set(flat.flatMap(r => Object.keys(r)))];
    const cell = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(','), ...flat.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
  }

  function toSql(rows, table) {
    const flat = rows.map(r => (r && typeof r === 'object' && !Array.isArray(r) ? flatten(r) : { value: r }));
    const cols = [...new Set(flat.flatMap(r => Object.keys(r)))];
    const id = c => `"${c.replace(/"/g, '""')}"`;
    const lit = v => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${String(v).replace(/'/g, "''")}'`);
    return `INSERT INTO ${id(table)} (${cols.map(id).join(', ')}) VALUES\n` + flat.map(r => `  (${cols.map(c => lit(r[c])).join(', ')})`).join(',\n') + ';';
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.mock';
  let els, source = 'sample', timer = null, output = '';

  const SAMPLE = `{
  "id": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  "firstName": "Priya",
  "lastName": "Sharma",
  "email": "priya.sharma@example.com",
  "phone": "+91 98765 43210",
  "age": 31,
  "active": true,
  "address": { "street": "12 Park Road", "city": "Bengaluru", "country": "India", "postcode": "560001" },
  "orders": [
    { "orderId": "ORD-10231", "total": 129.99, "status": "shipped", "createdAt": "2026-08-14T10:22:00Z" }
  ],
  "tags": ["premium", "newsletter"]
}`;

  const SCHEMA_SAMPLE = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "name", "price", "inStock"],
  "properties": {
    "id": { "type": "integer", "minimum": 1000, "maximum": 9999 },
    "name": { "type": "string" },
    "sku": { "type": "string" },
    "price": { "type": "number", "minimum": 1, "maximum": 500 },
    "currency": { "enum": ["USD", "EUR", "INR"] },
    "inStock": { "type": "boolean" },
    "rating": { "type": "number", "minimum": 1, "maximum": 5 },
    "releasedOn": { "type": "string", "format": "date" },
    "website": { "type": "string", "format": "uri" },
    "categories": { "type": "array", "items": { "type": "string", "enum": ["Office", "Home", "Outdoor", "Electronics"] }, "minItems": 1, "maxItems": 3, "uniqueItems": true }
  }
}`;

  function generate() {
    const text = els.input.value;
    const n = Math.max(1, Math.min(1000, parseInt(els.count.value, 10) || 1));
    save();
    els.error.hidden = true;
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      els.error.textContent = `The ${source === 'schema' ? 'schema' : 'sample'} is not valid JSON: ${e.message}`;
      els.error.hidden = false;
      return;
    }
    seed(els.seed.value.trim() || String(Date.now()) + Math.random());
    let rows;
    try {
      if (source === 'schema') rows = Array.from({ length: n }, () => fromSchema(parsed, els.table.value || 'record', newContext(), parsed));
      else {
        const templ = Array.isArray(parsed) ? mergeSamples(parsed) : parsed;
        rows = Array.from({ length: n }, () => fromSample(templ, els.table.value || 'record', newContext()));
      }
    } catch (e) { els.error.textContent = e.message; els.error.hidden = false; return; }

    const fmt = els.format.value;
    if (fmt === 'json') output = JSON.stringify(n === 1 && !els.forceArray.checked ? rows[0] : rows, null, 2);
    else if (fmt === 'ndjson') output = rows.map(r => JSON.stringify(r)).join('\n');
    else if (fmt === 'csv') output = toCsv(rows);
    else output = toSql(rows, els.table.value || 'records');
    els.output.value = output;
    els.stats.textContent = `${n} record${n === 1 ? '' : 's'} · ${(new Blob([output]).size / 1024).toFixed(1)} KB`;
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ source, text: els.input.value, count: els.count.value, format: els.format.value, seed: els.seed.value, table: els.table.value }));
    } catch (_) { /* ignore */ }
  }

  function setSource(s, loadSample) {
    source = s;
    document.querySelectorAll('[data-mock-src]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mockSrc === s)));
    els.inputLabel.textContent = s === 'schema' ? 'JSON Schema' : 'Sample JSON';
    if (loadSample) els.input.value = s === 'schema' ? SCHEMA_SAMPLE : SAMPLE;
  }

  function init() {
    els = {
      input: $('mockInput'), output: $('mockOutput'), count: $('mockCount'), format: $('mockFormat'), seed: $('mockSeed'), table: $('mockTable'),
      error: $('mockError'), stats: $('mockStats'), inputLabel: $('mockInputLabel'), forceArray: $('mockArray'),
    };
    if (!els.input) return;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (_) { /* ignore */ }
    if (s) {
      setSource(s.source || 'sample');
      els.input.value = s.text || (source === 'schema' ? SCHEMA_SAMPLE : SAMPLE);
      els.count.value = s.count || 10; els.format.value = s.format || 'json'; els.seed.value = s.seed || ''; els.table.value = s.table || 'users';
    } else setSource(location.hash === '#schema' ? 'schema' : 'sample', true);

    document.querySelectorAll('[data-mock-src]').forEach(b => b.addEventListener('click', () => {
      const wasSample = [SAMPLE, SCHEMA_SAMPLE].includes(els.input.value) || !els.input.value.trim();
      setSource(b.dataset.mockSrc, wasSample);
      generate();
    }));
    els.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(generate, 400); });
    [els.count, els.format, els.seed, els.table, els.forceArray].forEach(e => e.addEventListener('change', generate));
    $('mockGenerate').addEventListener('click', generate);
    $('mockCopy').addEventListener('click', e => navigator.clipboard.writeText(output).then(() => { const t = e.target.textContent; e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = t; }, 1200); }));
    $('mockDownload').addEventListener('click', () => {
      const ext = { json: 'json', ndjson: 'ndjson', csv: 'csv', sql: 'sql' }[els.format.value];
      const url = URL.createObjectURL(new Blob([output + '\n'], { type: 'text/plain' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `mock-data.${ext}` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    generate();
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return {
    fromSample: (s, n, sd) => { seed(sd); return Array.from({ length: n }, () => fromSample(Array.isArray(s) ? mergeSamples(s) : s, 'record', newContext())); },
    fromSchema: (s, n, sd) => { seed(sd); return Array.from({ length: n }, () => fromSchema(s, 'record', newContext(), s)); },
    toCsv, toSql,
  };
})();
