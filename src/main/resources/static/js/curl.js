/* ============================================================
   curl.js - Convert a cURL command into code: JavaScript fetch,
   Node.js axios, Python requests, Java HttpClient, Spring
   RestClient, Go, C# and PHP. Parses bash and Windows cmd
   quoting (as produced by browser "Copy as cURL").
   ============================================================ */

'use strict';

const CurlTool = (() => {
  // ── Shell tokenizer ────────────────────────────────────────────────────────
  function tokenize(input) {
    let s = input.trim();
    // Windows cmd "Copy as cURL (cmd)": ^ escapes and ^ line continuations
    if (/\^"|\^\s*\n/.test(s)) s = s.replace(/\^\s*\r?\n/g, ' ').replace(/\^(.)/g, '$1');
    // PowerShell backtick and bash backslash line continuations
    s = s.replace(/`\s*\r?\n/g, ' ').replace(/\\\r?\n/g, ' ');
    const out = [];
    let i = 0, cur = null;
    const push = () => { if (cur !== null) out.push(cur); cur = null; };
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { push(); i++; continue; }
      if (cur === null) cur = '';
      if (c === "'") {
        const end = s.indexOf("'", i + 1);
        if (end < 0) throw new Error('A single quote is not closed.');
        cur += s.slice(i + 1, end);
        i = end + 1;
      } else if (c === '$' && s[i + 1] === "'") {
        // ANSI-C quoting: $'...\n...'
        let j = i + 2;
        while (j < s.length && s[j] !== "'") {
          if (s[j] === '\\') {
            const n = s[j + 1];
            const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', 0: '\0', e: '\x1b' };
            if (n === 'x') { cur += String.fromCharCode(parseInt(s.substr(j + 2, 2), 16)); j += 4; continue; }
            if (n === 'u') { cur += String.fromCharCode(parseInt(s.substr(j + 2, 4), 16)); j += 6; continue; }
            cur += map[n] ?? n; j += 2; continue;
          }
          cur += s[j]; j++;
        }
        if (j >= s.length) throw new Error('A $\'…\' string is not closed.');
        i = j + 1;
      } else if (c === '"') {
        let j = i + 1;
        while (j < s.length && s[j] !== '"') {
          if (s[j] === '\\' && /["\\$`]/.test(s[j + 1] || '')) { cur += s[j + 1]; j += 2; continue; }
          cur += s[j]; j++;
        }
        if (j >= s.length) throw new Error('A double quote is not closed.');
        i = j + 1;
      } else if (c === '\\') {
        cur += s[i + 1] || ''; i += 2;
      } else {
        cur += c; i++;
      }
    }
    push();
    return out;
  }

  // ── cURL option parser ─────────────────────────────────────────────────────
  const WITH_VALUE = new Set(['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode',
    '--json', '-F', '--form', '--form-string', '-u', '--user', '-b', '--cookie', '-A', '--user-agent', '-e', '--referer', '-m', '--max-time',
    '--connect-timeout', '-x', '--proxy', '--url', '-o', '--output', '-w', '--write-out', '-T', '--upload-file', '--cacert', '--cert', '--key',
    '-E', '--retry', '--limit-rate', '-r', '--range', '-c', '--cookie-jar', '--resolve', '--oauth2-bearer', '--aws-sigv4', '-K', '--config']);
  const SHORT_FLAGS = { s: 'silent', S: 'show-error', L: 'location', k: 'insecure', v: 'verbose', i: 'include', I: 'head', G: 'get', f: 'fail', N: 'no-buffer', 4: 'ipv4', 6: 'ipv6', g: 'globoff', O: 'remote-name', '#': 'progress-bar' };

  function parse(command) {
    const t = tokenize(command);
    if (!t.length) throw new Error('Paste a curl command.');
    if (!/^curl(\.exe)?$/i.test(t[0])) throw new Error('The command should start with “curl”.');
    const req = { method: null, url: null, headers: [], data: [], dataUrlencode: [], form: [], user: null, cookies: [], get: false, head: false,
      followRedirects: false, insecure: false, compressed: false, timeout: null, connectTimeout: null, proxy: null, json: false, notes: [] };

    for (let i = 1; i < t.length; i++) {
      let tok = t[i], val;
      if (tok.startsWith('--') && tok.includes('=') && WITH_VALUE.has(tok.split('=')[0])) { val = tok.slice(tok.indexOf('=') + 1); tok = tok.split('=')[0]; }
      else if (/^-[A-Za-z]./.test(tok) && !tok.startsWith('--') && WITH_VALUE.has(tok.slice(0, 2))) { val = tok.slice(2); tok = tok.slice(0, 2); }
      else if (/^-[A-Za-z#46]{2,}$/.test(tok) && !tok.startsWith('--')) {
        // combined short flags such as -sSL; the last one may take a value (-sSX POST)
        const letters = tok.slice(1).split('');
        let handled = true;
        for (let k = 0; k < letters.length; k++) {
          const f = '-' + letters[k];
          if (WITH_VALUE.has(f)) {
            const rest = letters.slice(k + 1).join('');
            t.splice(i + 1, 0, ...(rest ? [f, rest] : [f]));
            handled = true;
            break;
          }
          applyFlag(req, SHORT_FLAGS[letters[k]] || letters[k]);
        }
        if (handled) continue;
      }
      if (WITH_VALUE.has(tok) && val === undefined) {
        if (i + 1 >= t.length) throw new Error(`${tok} needs a value.`);
        val = t[++i];
      }
      switch (tok) {
        case '-X': case '--request': req.method = val.toUpperCase(); break;
        case '-H': case '--header': {
          const idx = val.indexOf(':');
          if (idx > 0) {
            const name = val.slice(0, idx).trim(), value = val.slice(idx + 1).trim();
            if (value === '' && val.trim().endsWith(':')) req.notes.push(`The header “${name}:” with no value removes a default header in curl; it was left out.`);
            else req.headers.push([name, value]);
          } else if (val.endsWith(';')) req.headers.push([val.slice(0, -1).trim(), '']);
          break;
        }
        case '-d': case '--data': case '--data-ascii': case '--data-binary': case '--data-raw':
          if (val.startsWith('@') && tok !== '--data-raw') req.notes.push(`${val} reads the body from a file; the code sends the file name as text. Replace it with the file's contents.`);
          req.data.push(tok === '--data-binary' || tok === '--data-raw' ? val : val.replace(/\r?\n/g, ''));
          break;
        case '--data-urlencode': {
          const eq = val.indexOf('=');
          if (eq > 0) req.data.push(val.slice(0, eq) + '=' + encodeURIComponent(val.slice(eq + 1)));
          else req.data.push(encodeURIComponent(val.replace(/^=/, '')));
          break;
        }
        case '--json':
          req.json = true;
          req.data.push(val);
          break;
        case '-F': case '--form': case '--form-string': {
          const eq = val.indexOf('=');
          if (eq < 0) throw new Error(`-F needs name=value, got “${val}”.`);
          const name = val.slice(0, eq), v = val.slice(eq + 1);
          if (tok !== '--form-string' && v.startsWith('@')) {
            const [file, ...rest] = v.slice(1).split(';');
            const type = (rest.find(r => r.startsWith('type=')) || '').slice(5);
            req.form.push({ name, file: file.replace(/^"|"$/g, ''), type });
          } else if (tok !== '--form-string' && v.startsWith('<')) {
            req.form.push({ name, value: `<contents of ${v.slice(1)}>` });
          } else req.form.push({ name, value: v });
          break;
        }
        case '-u': case '--user': req.user = val; break;
        case '-b': case '--cookie':
          if (val.includes('=')) req.cookies.push(val);
          else req.notes.push(`-b ${val} reads cookies from a file; add them as a Cookie header.`);
          break;
        case '-A': case '--user-agent': req.headers.push(['User-Agent', val]); break;
        case '-e': case '--referer': req.headers.push(['Referer', val]); break;
        case '--oauth2-bearer': req.headers.push(['Authorization', 'Bearer ' + val]); break;
        case '-m': case '--max-time': req.timeout = parseFloat(val); break;
        case '--connect-timeout': req.connectTimeout = parseFloat(val); break;
        case '-x': case '--proxy': req.proxy = val; req.notes.push(`Proxy ${val} is not set in the code; configure it in your HTTP client.`); break;
        case '--url': req.url = val; break;
        case '-T': case '--upload-file': req.data.push(`<contents of ${val}>`); req.method = req.method || 'PUT'; req.notes.push(`-T uploads ${val}; replace the placeholder body with the file's contents.`); break;
        case '--aws-sigv4': req.notes.push('AWS SigV4 signing is not generated; use the AWS SDK or a signing library.'); break;
        case '-o': case '--output': case '-w': case '--write-out': case '-c': case '--cookie-jar': case '--retry': case '--limit-rate':
        case '--cacert': case '--cert': case '--key': case '-E': case '--resolve': case '-r': case '--range': case '-K': case '--config':
          if (tok === '-r' || tok === '--range') req.headers.push(['Range', 'bytes=' + val]);
          break;
        default:
          if (tok.startsWith('--')) applyFlag(req, tok.slice(2));
          else if (tok.startsWith('-') && tok.length === 2) applyFlag(req, SHORT_FLAGS[tok[1]] || tok[1]);
          else if (!req.url) req.url = tok;
          else req.notes.push(`Ignored extra argument “${tok}”.`);
      }
    }
    if (!req.url) throw new Error('No URL found in the command.');
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(req.url)) req.url = 'http://' + req.url;

    // Build final request
    const body = req.data.length ? req.data.join('&') : null;
    if (req.get && body) { req.url += (req.url.includes('?') ? '&' : '?') + body; }
    else req.body = body;
    if (req.json) {
      if (!hasHeader(req, 'content-type')) req.headers.push(['Content-Type', 'application/json']);
      if (!hasHeader(req, 'accept')) req.headers.push(['Accept', 'application/json']);
    }
    if (req.body !== null && req.body !== undefined && !req.form.length && !hasHeader(req, 'content-type')) req.headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
    if (req.cookies.length) req.headers.push(['Cookie', req.cookies.join('; ')]);
    if (req.user !== null) {
      const [u, ...p] = req.user.split(':');
      req.basic = { user: u, pass: p.join(':') };
    }
    req.method = req.method || (req.head ? 'HEAD' : (req.body || req.form.length) ? 'POST' : 'GET');
    req.contentType = (req.headers.find(([k]) => k.toLowerCase() === 'content-type') || [])[1] || '';
    req.jsonBody = null;
    if (req.body && /json/i.test(req.contentType)) {
      try { req.jsonBody = JSON.parse(req.body); } catch (_) { req.notes.push('The body is marked as JSON but is not valid JSON, so it is sent as text.'); }
    }
    if (req.insecure) req.notes.push('-k (skip TLS certificate checks) is not reproduced. Don\'t disable certificate checks in production code.');
    return req;
  }

  function applyFlag(req, name) {
    switch (name) {
      case 'location': req.followRedirects = true; break;
      case 'insecure': req.insecure = true; break;
      case 'compressed': req.compressed = true; break;
      case 'get': req.get = true; break;
      case 'head': req.head = true; break;
      default: break;                               // silent, verbose, include, etc. don't change the request
    }
  }

  const hasHeader = (req, name) => req.headers.some(([k]) => k.toLowerCase() === name);

  // ── Code generators ────────────────────────────────────────────────────────
  const q = s => JSON.stringify(s);                                           // double-quoted string with escapes
  const pyStr = s => (/'/.test(s) && !/"/.test(s) ? JSON.stringify(s) : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`);
  const phpStr = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const indent = (text, pad) => text.split('\n').map((l, i) => (i ? pad + l : l)).join('\n');

  function headersFor(req, { skipContentTypeForForm = true } = {}) {
    return req.headers.filter(([k]) => !(skipContentTypeForForm && req.form.length && k.toLowerCase() === 'content-type'));
  }

  function toPython(v, pad = '') {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return pyStr(v);
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.length ? `[\n${v.map(x => pad + '    ' + toPython(x, pad + '    ')).join(',\n')},\n${pad}]` : '[]';
    const keys = Object.keys(v);
    return keys.length ? `{\n${keys.map(k => `${pad}    ${pyStr(k)}: ${toPython(v[k], pad + '    ')}`).join(',\n')},\n${pad}}` : '{}';
  }

  const GEN = {
    fetch(req) {
      const lines = [];
      const opts = [`  method: ${q(req.method)}`];
      const hs = headersFor(req);
      if (req.basic) hs.push(['Authorization', null]);
      if (hs.length) opts.push(`  headers: {\n${hs.map(([k, v]) => v === null ? `    Authorization: 'Basic ' + btoa(${q(req.basic.user + ':' + req.basic.pass)})` : `    ${q(k)}: ${q(v)}`).join(',\n')}\n  }`);
      if (req.form.length) {
        lines.push('const form = new FormData();');
        req.form.forEach(f => lines.push(f.file ? `form.append(${q(f.name)}, fileInput.files[0]); // ${f.file}` : `form.append(${q(f.name)}, ${q(f.value)});`));
        lines.push('');
        opts.push('  body: form');
      } else if (req.jsonBody !== null) opts.push(`  body: JSON.stringify(${indent(JSON.stringify(req.jsonBody, null, 2), '  ')})`);
      else if (req.body) opts.push(`  body: ${q(req.body)}`);
      if (!req.followRedirects) opts.push(`  redirect: 'manual'`);
      if (req.timeout) opts.push(`  signal: AbortSignal.timeout(${Math.round(req.timeout * 1000)})`);
      lines.push(`const response = await fetch(${q(req.url)}, {\n${opts.join(',\n')}\n});`);
      lines.push('');
      lines.push(req.method === 'HEAD' ? 'console.log(response.status, [...response.headers]);' : /json/i.test(hs.map(h => h.join(':')).join()) || req.json ? 'const data = await response.json();\nconsole.log(data);' : 'const text = await response.text();\nconsole.log(text);');
      return lines.join('\n');
    },

    axios(req) {
      const lines = ["import axios from 'axios';", ''];
      const cfg = [`  method: ${q(req.method.toLowerCase())}`, `  url: ${q(req.url)}`];
      const hs = headersFor(req);
      if (hs.length) cfg.push(`  headers: {\n${hs.map(([k, v]) => `    ${q(k)}: ${q(v)}`).join(',\n')}\n  }`);
      if (req.basic) cfg.push(`  auth: { username: ${q(req.basic.user)}, password: ${q(req.basic.pass)} }`);
      if (req.form.length) {
        lines.splice(1, 0, "import fs from 'node:fs';");
        lines.push('const form = new FormData();');
        req.form.forEach(f => lines.push(f.file ? `form.append(${q(f.name)}, new Blob([fs.readFileSync(${q(f.file)})]), ${q(f.file.split(/[\\/]/).pop())});` : `form.append(${q(f.name)}, ${q(f.value)});`));
        lines.push('');
        cfg.push('  data: form');
      } else if (req.jsonBody !== null) cfg.push(`  data: ${indent(JSON.stringify(req.jsonBody, null, 2), '  ')}`);
      else if (req.body) cfg.push(`  data: ${q(req.body)}`);
      if (!req.followRedirects) cfg.push('  maxRedirects: 0');
      if (req.timeout) cfg.push(`  timeout: ${Math.round(req.timeout * 1000)}`);
      lines.push(`const response = await axios({\n${cfg.join(',\n')}\n});`, '', 'console.log(response.status, response.data);');
      return lines.join('\n');
    },

    python(req) {
      const lines = ['import requests', ''];
      const args = [pyStr(req.url)];
      const hs = headersFor(req).filter(([k]) => !(req.jsonBody !== null && k.toLowerCase() === 'content-type' && /^application\/json/i.test(req.contentType)));
      if (hs.length) { lines.push(`headers = {\n${hs.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)}`).join(',\n')},\n}`); args.push('headers=headers'); }
      if (req.form.length) {
        const files = req.form.filter(f => f.file), fields = req.form.filter(f => !f.file);
        if (fields.length) { lines.push(`data = {\n${fields.map(f => `    ${pyStr(f.name)}: ${pyStr(f.value)}`).join(',\n')},\n}`); args.push('data=data'); }
        if (files.length) { lines.push(`files = {\n${files.map(f => `    ${pyStr(f.name)}: open(${pyStr(f.file)}, 'rb')`).join(',\n')},\n}`); args.push('files=files'); }
      } else if (req.jsonBody !== null) { lines.push(`json_data = ${toPython(req.jsonBody)}`); args.push('json=json_data'); }
      else if (req.body) { lines.push(`data = ${pyStr(req.body)}`); args.push('data=data'); }
      if (req.basic) args.push(`auth=(${pyStr(req.basic.user)}, ${pyStr(req.basic.pass)})`);
      if (!req.followRedirects && req.method !== 'HEAD') args.push('allow_redirects=False');
      if (req.timeout || req.connectTimeout) args.push(`timeout=${req.connectTimeout && req.timeout ? `(${req.connectTimeout}, ${req.timeout})` : req.timeout || req.connectTimeout}`);
      if (lines[lines.length - 1] !== '') lines.push('');
      const fn = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method) ? `requests.${req.method.toLowerCase()}(` : `requests.request(${pyStr(req.method)}, `;
      lines.push(`response = ${fn}${args.join(', ')})`, 'print(response.status_code)', req.jsonBody !== null || req.json ? 'print(response.json())' : 'print(response.text)');
      return lines.join('\n');
    },

    java(req) {
      const lines = ['import java.net.URI;', 'import java.net.http.HttpClient;', 'import java.net.http.HttpRequest;', 'import java.net.http.HttpResponse;'];
      if (req.timeout || req.connectTimeout) lines.push('import java.time.Duration;');
      if (req.basic) lines.push('import java.nio.charset.StandardCharsets;', 'import java.util.Base64;');
      lines.push('');
      const client = ['HttpClient client = HttpClient.newBuilder()'];
      if (req.followRedirects) client.push('        .followRedirects(HttpClient.Redirect.NORMAL)');
      if (req.connectTimeout) client.push(`        .connectTimeout(Duration.ofMillis(${Math.round(req.connectTimeout * 1000)}))`);
      client.push('        .build();');
      lines.push(client.join('\n'), '');
      if (req.form.length) lines.push('// Multipart form data: java.net.http has no built-in builder.', '// Use Spring RestClient (see that tab) or a library such as Apache HttpClient 5 (MultipartEntityBuilder).');
      let body = 'HttpRequest.BodyPublishers.noBody()';
      if (req.jsonBody !== null) body = `HttpRequest.BodyPublishers.ofString("""\n        ${JSON.stringify(req.jsonBody, null, 2).replace(/\\/g, '\\\\').split('\n').join('\n        ')}\n        """)`;
      else if (req.body) body = `HttpRequest.BodyPublishers.ofString(${q(req.body)})`;
      const b = [`HttpRequest request = HttpRequest.newBuilder()`, `        .uri(URI.create(${q(req.url)}))`];
      if (req.timeout) b.push(`        .timeout(Duration.ofMillis(${Math.round(req.timeout * 1000)}))`);
      headersFor(req).forEach(([k, v]) => b.push(`        .header(${q(k)}, ${q(v)})`));
      if (req.basic) b.push(`        .header("Authorization", "Basic " + Base64.getEncoder().encodeToString(${q(req.basic.user + ':' + req.basic.pass)}.getBytes(StandardCharsets.UTF_8)))`);
      b.push(`        .method(${q(req.method)}, ${body})`, '        .build();');
      lines.push(b.join('\n'), '', 'HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());', 'System.out.println(response.statusCode());', 'System.out.println(response.body());');
      return lines.join('\n');
    },

    spring(req) {
      const lines = ['import org.springframework.http.HttpMethod;', 'import org.springframework.http.ResponseEntity;', 'import org.springframework.web.client.RestClient;'];
      if (req.form.length) lines.push('import org.springframework.core.io.FileSystemResource;', 'import org.springframework.http.MediaType;', 'import org.springframework.util.LinkedMultiValueMap;', 'import org.springframework.util.MultiValueMap;');
      lines.push('', 'RestClient restClient = RestClient.create();', '');
      if (req.form.length) {
        lines.push('MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();');
        req.form.forEach(f => lines.push(f.file ? `parts.add(${q(f.name)}, new FileSystemResource(${q(f.file)}));` : `parts.add(${q(f.name)}, ${q(f.value)});`));
        lines.push('');
      }
      const c = [`ResponseEntity<String> response = restClient.method(HttpMethod.${/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)$/.test(req.method) ? req.method : `valueOf(${q(req.method)})`})`, `        .uri(${q(req.url)})`];
      headersFor(req).forEach(([k, v]) => c.push(`        .header(${q(k)}, ${q(v)})`));
      if (req.basic) c.push(`        .headers(h -> h.setBasicAuth(${q(req.basic.user)}, ${q(req.basic.pass)}))`);
      if (req.form.length) c.push('        .contentType(MediaType.MULTIPART_FORM_DATA)', '        .body(parts)');
      else if (req.jsonBody !== null) c.push(`        .body("""\n            ${JSON.stringify(req.jsonBody, null, 2).replace(/\\/g, '\\\\').split('\n').join('\n            ')}\n            """)`);
      else if (req.body) c.push(`        .body(${q(req.body)})`);
      c.push('        .retrieve()', '        .toEntity(String.class);');
      lines.push(c.join('\n'), '', 'System.out.println(response.getStatusCode());', 'System.out.println(response.getBody());');
      if (!req.followRedirects) lines.push('', '// Note: RestClient follows redirects by default with the JDK client; curl without -L does not.');
      return lines.join('\n');
    },

    go(req) {
      const imports = new Set(['fmt', 'io', 'net/http']);
      const lines = [];
      let bodyVar = 'nil';
      if (req.form.length) {
        ['bytes', 'mime/multipart', 'os', 'path/filepath'].forEach(i => imports.add(i));
        lines.push('\tbody := &bytes.Buffer{}', '\twriter := multipart.NewWriter(body)');
        req.form.forEach(f => {
          if (f.file) lines.push(`\tfile, err := os.Open(${q(f.file)})`, '\tif err != nil {\n\t\tpanic(err)\n\t}', '\tdefer file.Close()', `\tpart, _ := writer.CreateFormFile(${q(f.name)}, filepath.Base(${q(f.file)}))`, '\tio.Copy(part, file)');
          else lines.push(`\twriter.WriteField(${q(f.name)}, ${q(f.value)})`);
        });
        lines.push('\twriter.Close()', '');
        bodyVar = 'body';
      } else if (req.body) {
        imports.add('strings');
        const text = req.jsonBody !== null ? JSON.stringify(req.jsonBody, null, 2) : req.body;
        lines.push(text.includes('`') ? `\tbody := strings.NewReader(${q(text)})` : `\tbody := strings.NewReader(\`${text}\`)`, '');
        bodyVar = 'body';
      }
      lines.push(`\treq, err := http.NewRequest(${q(req.method)}, ${q(req.url)}, ${bodyVar})`, '\tif err != nil {\n\t\tpanic(err)\n\t}');
      headersFor(req).forEach(([k, v]) => lines.push(`\treq.Header.Set(${q(k)}, ${q(v)})`));
      if (req.form.length) lines.push('\treq.Header.Set("Content-Type", writer.FormDataContentType())');
      if (req.basic) lines.push(`\treq.SetBasicAuth(${q(req.basic.user)}, ${q(req.basic.pass)})`);
      lines.push('');
      const client = [];
      if (req.timeout) { imports.add('time'); client.push(`Timeout: ${Math.round(req.timeout * 1000)} * time.Millisecond`); }
      if (!req.followRedirects) client.push('CheckRedirect: func(req *http.Request, via []*http.Request) error {\n\t\t\treturn http.ErrUseLastResponse\n\t\t}');
      lines.push(client.length ? `\tclient := &http.Client{\n\t\t${client.join(',\n\t\t')},\n\t}` : '\tclient := &http.Client{}');
      lines.push('\tresp, err := client.Do(req)', '\tif err != nil {\n\t\tpanic(err)\n\t}', '\tdefer resp.Body.Close()', '', '\tdata, _ := io.ReadAll(resp.Body)', '\tfmt.Println(resp.StatusCode)', '\tfmt.Println(string(data))');
      return `package main\n\nimport (\n${[...imports].sort().map(i => `\t"${i}"`).join('\n')}\n)\n\nfunc main() {\n${lines.join('\n')}\n}`;
    },

    csharp(req) {
      const lines = ['using System.Net.Http.Headers;', 'using System.Text;', ''];
      lines.push(req.followRedirects ? 'using var client = new HttpClient();' : 'using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });');
      if (req.timeout) lines.push(`client.Timeout = TimeSpan.FromMilliseconds(${Math.round(req.timeout * 1000)});`);
      lines.push('', `using var request = new HttpRequestMessage(new HttpMethod(${q(req.method)}), ${q(req.url)});`);
      const contentHeaders = [];
      headersFor(req).forEach(([k, v]) => {
        if (/^content-/i.test(k)) contentHeaders.push([k, v]);
        else lines.push(`request.Headers.TryAddWithoutValidation(${q(k)}, ${q(v)});`);
      });
      if (req.basic) lines.push(`request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(${q(req.basic.user + ':' + req.basic.pass)})));`);
      if (req.form.length) {
        lines.push('', 'var form = new MultipartFormDataContent();');
        req.form.forEach(f => lines.push(f.file ? `form.Add(new ByteArrayContent(File.ReadAllBytes(${q(f.file)})), ${q(f.name)}, ${q(f.file.split(/[\\/]/).pop())});` : `form.Add(new StringContent(${q(f.value)}), ${q(f.name)});`));
        lines.push('request.Content = form;');
      } else if (req.body) {
        const ct = contentHeaders.find(([k]) => k.toLowerCase() === 'content-type');
        const text = req.jsonBody !== null ? JSON.stringify(req.jsonBody, null, 2) : req.body;
        lines.push('', text.includes('"') && req.jsonBody !== null ? `request.Content = new StringContent("""\n${text}\n""");` : `request.Content = new StringContent(${q(text)});`);
        if (ct) lines.push(`request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(${q(ct[1])});`);
        contentHeaders.filter(([k]) => k.toLowerCase() !== 'content-type').forEach(([k, v]) => lines.push(`request.Content.Headers.TryAddWithoutValidation(${q(k)}, ${q(v)});`));
      }
      lines.push('', 'using var response = await client.SendAsync(request);', 'Console.WriteLine((int)response.StatusCode);', 'Console.WriteLine(await response.Content.ReadAsStringAsync());');
      return lines.join('\n');
    },

    php(req) {
      const lines = ['<?php', '', `$ch = curl_init(${phpStr(req.url)});`, '', 'curl_setopt_array($ch, [', '    CURLOPT_RETURNTRANSFER => true,'];
      if (req.method !== 'GET') lines.push(req.method === 'HEAD' ? '    CURLOPT_NOBODY => true,' : `    CURLOPT_CUSTOMREQUEST => ${phpStr(req.method)},`);
      const hs = headersFor(req);
      if (hs.length) lines.push(`    CURLOPT_HTTPHEADER => [\n${hs.map(([k, v]) => `        ${phpStr(`${k}: ${v}`)},`).join('\n')}\n    ],`);
      if (req.form.length) lines.push(`    CURLOPT_POSTFIELDS => [\n${req.form.map(f => `        ${phpStr(f.name)} => ${f.file ? `new CURLFile(${phpStr(f.file)})` : phpStr(f.value)},`).join('\n')}\n    ],`);
      else if (req.body) lines.push(`    CURLOPT_POSTFIELDS => ${phpStr(req.jsonBody !== null ? JSON.stringify(req.jsonBody) : req.body)},`);
      if (req.basic) lines.push(`    CURLOPT_USERPWD => ${phpStr(req.basic.user + ':' + req.basic.pass)},`);
      if (req.followRedirects) lines.push('    CURLOPT_FOLLOWLOCATION => true,');
      if (req.compressed) lines.push("    CURLOPT_ENCODING => '',");
      if (req.timeout) lines.push(`    CURLOPT_TIMEOUT_MS => ${Math.round(req.timeout * 1000)},`);
      if (req.connectTimeout) lines.push(`    CURLOPT_CONNECTTIMEOUT_MS => ${Math.round(req.connectTimeout * 1000)},`);
      lines.push(']);', '', '$response = curl_exec($ch);', '$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);', 'curl_close($ch);', '', 'echo $status . PHP_EOL;', 'echo $response;');
      return lines.join('\n');
    },
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const STORE = 'jxe.curl';
  let els, lang = 'fetch', timer = null;
  const SAMPLE = `curl -X POST 'https://api.example.com/v1/orders?notify=true' \\
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo' \\
  -H 'Content-Type: application/json' \\
  --data-raw '{"customerId": 42, "items": [{"sku": "A-100", "qty": 2}], "note": "Leave at the door"}' \\
  --max-time 30 -L`;

  function render() {
    try { localStorage.setItem(STORE, JSON.stringify({ cmd: els.input.value, lang })); } catch (_) { /* ignore */ }
    els.error.hidden = true;
    let req;
    try { req = parse(els.input.value); }
    catch (e) {
      els.error.textContent = e.message;
      els.error.hidden = !els.input.value.trim();
      els.output.textContent = '';
      els.summary.innerHTML = '';
      els.notes.hidden = true;
      return;
    }
    els.output.textContent = GEN[lang](req);
    const host = (() => { try { return new URL(req.url).host; } catch (_) { return req.url; } })();
    els.summary.innerHTML = `<span class="badge ok">${req.method}</span> <code>${host}</code> · ${req.headers.length} header${req.headers.length === 1 ? '' : 's'}${req.body ? ' · body' : ''}${req.form.length ? ' · multipart form' : ''}${req.basic ? ' · basic auth' : ''}`;
    els.notes.hidden = !req.notes.length;
    els.notes.innerHTML = req.notes.map(n => `<li>${n.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</li>`).join('');
  }

  function setLang(l) {
    lang = l;
    document.querySelectorAll('[data-curl-lang]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.curlLang === l)));
    render();
  }

  function init() {
    els = { input: $('curlInput'), output: $('curlOutput'), error: $('curlError'), summary: $('curlSummary'), notes: $('curlNotes') };
    if (!els.input) return;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (_) { /* ignore */ }
    els.input.value = (s && s.cmd) || SAMPLE;
    if (s && GEN[s.lang]) lang = s.lang;
    els.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 150); });
    document.querySelectorAll('[data-curl-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.curlLang)));
    $('curlSample').addEventListener('click', () => { els.input.value = SAMPLE; render(); });
    $('curlClear').addEventListener('click', () => { els.input.value = ''; render(); els.input.focus(); });
    $('curlCopy').addEventListener('click', e => {
      navigator.clipboard.writeText(els.output.textContent).then(() => { const t = e.target.textContent; e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = t; }, 1200); });
    });
    setLang(lang);
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
  return { tokenize, parse, GEN };
})();
