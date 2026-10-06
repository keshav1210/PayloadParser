'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const API = '/api/sdlc';
  const STORE_KEY = 'jxe.sdlcgen';
  const IGNORE = new Set(['.git', 'node_modules', 'target', 'build', 'dist', 'out', 'bin', 'obj', '.gradle', '.idea',
    '.vscode', 'venv', '.venv', '__pycache__', '.pytest_cache', 'coverage', '.next', '.nuxt', 'vendor', '.terraform',
    '.cache', '.parcel-cache', '.angular', '.svelte-kit', 'Pods', 'DerivedData', '.dart_tool']);
  const BUILD_FILES = /^(pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|package\.json|tsconfig\.json|requirements[\w-]*\.txt|pyproject\.toml|go\.mod|Gemfile|composer\.json|Package\.swift|Cargo\.toml|.+\.csproj|CLAUDE\.md)$/;
  const NOTES = {
    'src': 'Source code', 'src/main/java': 'Java source code', 'src/main/kotlin': 'Kotlin source code',
    'src/main/resources': 'Configuration and resources', 'src/test': 'Automated tests', 'src/test/java': 'Unit and integration tests',
    'src/main': 'Application code and resources', 'src/main/resources/static': 'Static front-end files', 'src/main/resources/templates': 'Server-side page templates',
    'test': 'Automated tests', 'tests': 'Automated tests', 'spec': 'Automated tests', 'e2e': 'End-to-end tests',
    'cypress': 'Cypress end-to-end tests', 'docs': 'Documentation', '.github': 'GitHub configuration',
    '.github/workflows': 'CI pipelines (GitHub Actions)', 'public': 'Static files served as-is', 'static': 'Static assets',
    'assets': 'Images, fonts and other assets', 'components': 'UI components', 'pages': 'Pages and routes',
    'app': 'Application code', 'api': 'API code', 'routes': 'Route definitions', 'controllers': 'Request handlers',
    'services': 'Business logic', 'models': 'Data models', 'lib': 'Shared library code', 'utils': 'Helpers',
    'scripts': 'Build and helper scripts', 'config': 'Configuration', 'migrations': 'Database migrations',
    'db': 'Database scripts and migrations', 'cmd': 'Program entry points', 'internal': 'Internal packages',
    'pkg': 'Public packages', 'k8s': 'Kubernetes manifests', 'helm': 'Helm charts', 'terraform': 'Infrastructure as code',
    'infra': 'Infrastructure', 'android': 'Android app', 'ios': 'iOS app', 'packages': 'Monorepo packages',
    'frontend': 'Front end', 'backend': 'Back end', 'web': 'Web front end', 'server': 'Server code', 'client': 'Client code',
    'hooks': 'Hooks', 'store': 'State management', 'styles': 'Stylesheets', 'types': 'Type definitions',
  };

  let catalog = [];
  let previewFiles = [];
  let selected = null;
  let timer = null;
  let requestId = 0;
  let state = defaults();

  function defaults() {
    return {
      developer: true, tester: true, projectName: '', projectDescription: '', projectStack: '',
      profiles: [], testFrameworks: [], extras: [], folders: [], commandPrefix: '', existingClaudeMd: false,
      lintCommand: '', hookShell: 'bash', format: 'project', services: [], edits: {}, step: 0, visited: [0],
    };
  }

  function steps() {
    return [...document.querySelectorAll('.sg-step')];
  }

  function hasData(i) {
    switch (i) {
      case 0: return state.developer || state.tester;
      case 1: return state.folders.length > 0 || (isWorkspace() && state.services.length > 0);
      case 2: return !!(state.projectName || state.projectDescription || state.projectStack);
      case 3: return state.profiles.length > 0 || state.testFrameworks.length > 0;
      case 4: return state.extras.length > 0;
      default: return false;
    }
  }

  function renderStepper() {
    const list = $('sgStepper');
    list.replaceChildren();
    steps().forEach((section, i) => {
      const li = el('li');
      const active = i === state.step;
      const done = !active && (hasData(i) || state.visited.includes(i));
      if (active) li.classList.add('active');
      if (done) li.classList.add('done');
      const btn = el('button');
      btn.type = 'button';
      if (active) btn.setAttribute('aria-current', 'step');
      btn.append(el('span', 'sg-dot', done ? '✓' : String(i + 1)), el('span', 'sg-step-label', section.dataset.label));
      btn.addEventListener('click', () => goTo(i, true));
      li.append(btn);
      list.append(li);
    });
  }

  function isWorkspace() {
    return state.format === 'workspace';
  }

  function lastStepLabel() {
    return state.format === 'plugin' ? 'Download plugin ↓' : isWorkspace() ? 'Download workspace kit ↓' : 'Download kit ↓';
  }

  function goTo(i, userAction) {
    const all = steps();
    state.step = Math.max(0, Math.min(all.length - 1, i));
    if (!Array.isArray(state.visited)) state.visited = [];
    if (!state.visited.includes(state.step)) state.visited.push(state.step);
    all.forEach((s, k) => { s.hidden = k !== state.step; });
    const last = state.step === all.length - 1;
    $('sgBack').disabled = state.step === 0;
    $('sgNext').textContent = last ? lastStepLabel() : 'Next →';
    $('sgStepCount').textContent = `Step ${state.step + 1} of ${all.length}`;
    renderStepper();
    save();
    if (userAction) {
      const top = $('sgStepper').getBoundingClientRect().top;
      if (top < 60 || top > innerHeight) window.scrollBy({ top: top - 90, behavior: 'smooth' });
      const heading = all[state.step].querySelector('h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function bindSteps() {
    $('sgBack').addEventListener('click', () => goTo(state.step - 1, true));
    $('sgNext').addEventListener('click', () => {
      if (state.step === steps().length - 1) download();
      else goTo(state.step + 1, true);
    });
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && typeof saved === 'object') state = Object.assign(defaults(), saved);
    } catch (_) { }
  }

  function save() {
    try {
      const json = JSON.stringify(state);
      if (json.length < 1500000) localStorage.setItem(STORE_KEY, json);
    } catch (_) { }
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function packs(group) {
    return catalog.filter(p => p.group === group && !p.hidden);
  }

  function roleOk(p) {
    if (!p.requires) return true;
    return (p.requires === 'dev' && state.developer) || (p.requires === 'tester' && state.tester);
  }

  function chip(p, list, onChange) {
    const label = el('label', 'sg-chip');
    const box = el('input');
    box.type = 'checkbox';
    box.value = p.id;
    box.checked = state[list].includes(p.id);
    box.disabled = !roleOk(p);
    box.addEventListener('change', () => {
      state[list] = box.checked ? [...new Set([...state[list], p.id])] : state[list].filter(x => x !== p.id);
      onChange();
    });
    label.append(box, el('span', '', p.label));
    if (p.description) label.title = p.description;
    return label;
  }

  function renderPacks() {
    const prof = $('sgProfiles');
    prof.replaceChildren(...packs('profile').map(p => chip(p, 'profiles', changed)));

    const fw = $('sgFrameworks');
    fw.replaceChildren();
    const byLang = new Map();
    for (const p of packs('framework')) {
      const key = p.language || 'Other';
      if (!byLang.has(key)) byLang.set(key, []);
      byLang.get(key).push(p);
    }
    for (const [lang, list] of byLang) {
      const row = el('div', 'sg-fw-row');
      row.append(el('span', 'sg-fw-lang', lang), ...list.map(p => chip(p, 'testFrameworks', changed)));
      fw.append(row);
    }
    $('sgFrameworksWrap').hidden = !state.tester;

    const ex = $('sgExtras');
    ex.replaceChildren(...packs('extra').map(p => {
      const card = el('label', 'sg-extra');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = state.extras.includes(p.id);
      box.disabled = !roleOk(p);
      box.addEventListener('change', () => {
        state.extras = box.checked ? [...new Set([...state.extras, p.id])] : state.extras.filter(x => x !== p.id);
        changed();
      });
      const text = el('span');
      text.append(el('strong', '', p.label), el('small', '', p.description + (roleOk(p) ? '' : ' (needs the Developer role)')));
      card.append(box, text);
      return card;
    }));
  }

  function bindInputs() {
    const bindText = (id, key) => {
      const input = $(id);
      input.value = state[key] || '';
      input.addEventListener('input', () => { state[key] = input.value; changed(); });
    };
    bindText('sgName', 'projectName');
    bindText('sgDesc', 'projectDescription');
    bindText('sgStack', 'projectStack');
    bindText('sgPrefix', 'commandPrefix');
    bindText('sgLint', 'lintCommand');

    const bindCheck = (id, key, after) => {
      const box = $(id);
      box.checked = !!state[key];
      box.addEventListener('change', () => { state[key] = box.checked; if (after) after(); changed(); });
    };
    bindCheck('sgDev', 'developer', renderPacks);
    bindCheck('sgTester', 'tester', renderPacks);
    bindCheck('sgExisting', 'existingClaudeMd');

    $('sgShell').value = state.hookShell;
    $('sgShell').addEventListener('change', () => { state.hookShell = $('sgShell').value; changed(); });

    document.querySelectorAll('input[name="sgFormat"]').forEach(r => {
      r.checked = r.value === state.format;
      r.addEventListener('change', () => { if (r.checked) setFormat(r.value); });
    });
    $('sgWorkspace').addEventListener('change', () => setFormat($('sgWorkspace').checked ? 'workspace' : 'project'));
    syncFormat();
  }

  function setFormat(format) {
    if (format === state.format) return true;
    if (Object.keys(state.edits).length && !confirm('Switching the format discards your edits in the preview. Continue?')) {
      syncFormat();
      return false;
    }
    state.format = format;
    state.edits = {};
    selected = null;
    syncFormat();
    changed();
    return true;
  }

  function syncFormat() {
    const plugin = state.format === 'plugin';
    document.querySelectorAll('input[name="sgFormat"]').forEach(r => { r.checked = r.value === state.format; });
    $('sgWorkspace').checked = isWorkspace();
    $('sgPrefixWrap').hidden = plugin;
    $('sgExistingWrap').hidden = state.format !== 'project';
    $('sgDownload').textContent = plugin ? 'Download plugin (.zip)' : isWorkspace() ? 'Download workspace kit (.zip)' : 'Download kit (.zip)';
    if (state.step === steps().length - 1) $('sgNext').textContent = lastStepLabel();
    renderServices();
  }

  const SERVICE_FOLDER = /^[A-Za-z0-9._-]{1,80}$/;
  const NOT_SERVICES = new Set(['docs', 'doc', '.github', '.gitlab', '.claude', 'scripts', 'tools', '.devcontainer']);

  function serviceFolder(v) {
    return normalise(v || '');
  }

  function folderOk(v) {
    return !String(v || '').trim() || SERVICE_FOLDER.test(serviceFolder(v));
  }

  function renderServices() {
    $('sgServicesWrap').hidden = !isWorkspace();
    if (!isWorkspace()) return;
    const rows = $('sgServiceRows');
    rows.replaceChildren();
    const cell = (s, key, placeholder, max, label) => {
      const td = el('td');
      const input = el('input', 'text-input');
      input.type = 'text';
      input.value = s[key] || '';
      input.placeholder = placeholder;
      input.maxLength = max;
      input.setAttribute('aria-label', label);
      if (key === 'folder') input.classList.toggle('sg-bad', !folderOk(input.value));
      input.addEventListener('input', () => {
        s[key] = input.value;
        if (key === 'folder') input.classList.toggle('sg-bad', !folderOk(input.value));
        changed();
      });
      td.append(input);
      return td;
    };
    state.services.forEach((s, i) => {
      const tr = el('tr');
      const del = el('button', 'mini-btn', '✕');
      del.type = 'button';
      del.title = 'Remove this service';
      del.setAttribute('aria-label', `Remove ${s.folder || 'service'}`);
      del.addEventListener('click', () => { state.services.splice(i, 1); renderServices(); changed(); });
      const tdDel = el('td');
      tdDel.append(del);
      tr.append(cell(s, 'folder', 'order-service', 80, 'Service folder'),
        cell(s, 'purpose', 'Orders and checkout', 200, 'What the service does'),
        cell(s, 'stack', 'Java 17, Spring Boot', 200, 'Service stack'),
        cell(s, 'repo', 'https://github.com/org/order-service.git', 300, 'Git URL'), tdDel);
      rows.append(tr);
    });
    if (!state.services.length) {
      const tr = el('tr');
      const td = el('td', 'muted', 'No services yet. Pick your workspace folder above or add them by hand.');
      td.colSpan = 5;
      tr.append(td);
      rows.append(tr);
    }
  }

  function mergeServices(found) {
    const byFolder = new Map(state.services.map(s => [serviceFolder(s.folder), s]));
    for (const n of found) {
      const old = byFolder.get(n.folder);
      if (old) {
        if (!old.stack && n.stack) old.stack = n.stack;
        if (!old.repo && n.repo) old.repo = n.repo;
      } else {
        state.services.push(n);
        byFolder.set(n.folder, n);
      }
    }
    state.services = state.services.slice(0, 60);
  }

  function normalise(p) {
    let s = String(p).trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    s = s.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
    return s;
  }

  function addFolder(set, path) {
    const parts = normalise(path).split('/').filter(Boolean);
    if (!parts.length || parts.some(x => IGNORE.has(x) || x === '..' || x === '.')) return;
    for (let i = 1; i <= Math.min(parts.length, 3); i++) set.add(parts.slice(0, i).join('/'));
  }

  const CONNECTOR = /^((?:[│|]\s{3}|\s{4})*)(?:├── |└── |\|-- |`-- |\+---|\\---)(.+)$/;
  const FILE_LIKE = /\.[A-Za-z0-9]{1,8}$/;

  function parseFolderText(text) {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter(Boolean);
    const set = new Set();
    if (lines.some(l => CONNECTOR.test(l))) {
      const entries = [];
      for (const l of lines) {
        const m = CONNECTOR.exec(l);
        if (!m) continue;
        const depth = Math.round(m[1].length / 4) + 1;
        const name = m[2].replace(/\s+->.*$/, '').replace(/\/$/, '').trim();
        entries.push({ depth, name });
      }
      const stack = [];
      entries.forEach((e, i) => {
        stack[e.depth - 1] = e.name;
        stack.length = e.depth;
        const next = entries[i + 1];
        const isDir = (next && next.depth > e.depth) || !FILE_LIKE.test(e.name);
        if (isDir) addFolder(set, stack.join('/'));
      });
    } else {
      const paths = lines.map(l => l.trim().replace(/\\/g, '/'));
      const absolute = paths.filter(p => /^([A-Za-z]:)?\//.test(p));
      let prefix = '';
      if (absolute.length) {
        const split = absolute.map(p => p.split('/'));
        const first = split[0];
        let n = 0;
        while (n < first.length - 1 && split.every(s => s[n] === first[n])) n++;
        prefix = first.slice(0, n).join('/') + '/';
      }
      for (let p of paths) {
        if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length);
        else if (/^([A-Za-z]:)?\//.test(p)) continue;
        const parts = normalise(p).split('/');
        if (FILE_LIKE.test(parts[parts.length - 1])) parts.pop();
        if (parts.length) addFolder(set, parts.join('/'));
      }
    }
    return [...set].sort();
  }

  function noteFor(path) {
    if (NOTES[path]) return NOTES[path];
    const last = path.split('/').pop();
    return path.split('/').length <= 2 && NOTES[last] ? NOTES[last] : '';
  }

  function setFolders(paths, source) {
    const old = new Map(state.folders.map(f => [f.path, f.note]));
    state.folders = paths.slice(0, 1500).map(p => ({ path: p, note: old.get(p) ?? noteFor(p) }));
    $('sgFolderInfo').textContent = paths.length
      ? `${paths.length.toLocaleString('en-US')} folders from ${source}${paths.length > 1500 ? ' (first 1,500 kept)' : ''}. Only folder names are sent.`
      : '';
    renderFolderTable();
    changed();
  }

  function renderFolderTable() {
    const body = $('sgFolderRows');
    body.replaceChildren();
    const shown = state.folders.filter(f => f.path.split('/').length <= 2).slice(0, 40);
    $('sgFolderTable').hidden = !shown.length;
    for (const f of shown) {
      const tr = el('tr');
      const td1 = el('td');
      td1.append(el('code', '', f.path + '/'));
      const td2 = el('td');
      const input = el('input', 'text-input');
      input.type = 'text';
      input.value = f.note;
      input.placeholder = 'What lives here (optional)';
      input.maxLength = 200;
      input.setAttribute('aria-label', `What lives in ${f.path}`);
      input.addEventListener('input', () => { f.note = input.value; changed(); });
      td2.append(input);
      tr.append(td1, td2);
      body.append(tr);
    }
  }

  async function readPicked(files) {
    const list = [...files];
    if (!list.length) return;
    $('sgFolderInfo').textContent = `Reading ${list.length.toLocaleString('en-US')} file names…`;
    const root = (list[0].webkitRelativePath || '').split('/')[0];
    const set = new Set();
    const reads = [];
    const gitReads = [];
    let hasClaude = false;
    let rootBuild = false;
    for (const f of list) {
      const parts = (f.webkitRelativePath || f.name).split('/').slice(1);
      if (parts.length === 3 && parts[1] === '.git' && parts[2] === 'config' && f.size < 65536) {
        gitReads.push(f.text().then(t => ({ dir: parts[0], text: t })));
        continue;
      }
      if (!parts.length || parts.some(p => IGNORE.has(p))) continue;
      const name = parts[parts.length - 1];
      if (parts.length > 1) addFolder(set, parts.slice(0, -1).join('/'));
      if (parts.length === 1 && name === 'CLAUDE.md') hasClaude = true;
      const build = BUILD_FILES.test(name) && name !== 'CLAUDE.md';
      if (parts.length === 1 && build && !/^(package\.json|tsconfig\.json)$/.test(name)) rootBuild = true;
      if (parts.length <= 3 && build && f.size < 524288) reads.push(f.text().then(t => ({ name, dir: parts.length > 1 ? parts[0] : '', depth: parts.length, text: t })));
    }
    const contents = await Promise.all(reads);
    const gits = await Promise.all(gitReads);
    setFolders([...set].sort(), `“${root}”`);
    const services = findServices(contents, gits, rootBuild);
    if (services.length >= 2) {
      mergeServices(services);
      if (!isWorkspace()) setFormat('workspace');
      renderServices();
      $('sgFolderInfo').textContent += isWorkspace()
        ? ` Found ${services.length} services, so we switched to the workspace kit.`
        : ` Found ${services.length} services; tick “This folder holds several services” to set up all of them.`;
    }
    detect(contents.filter(c => c.depth <= 2), root, hasClaude);
  }

  function findServices(contents, gits, rootBuild) {
    if (rootBuild) return [];
    const dirs = new Set([...contents.filter(c => c.depth === 2).map(c => c.dir), ...gits.map(g => g.dir)]);
    const out = [];
    for (const dir of [...dirs].sort()) {
      if (!SERVICE_FOLDER.test(dir) || NOT_SERVICES.has(dir.toLowerCase())) continue;
      const own = contents.filter(c => c.dir === dir).map(c => ({ name: c.name, text: c.text }));
      const git = gits.find(g => g.dir === dir);
      const origin = git ? /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/.exec(git.text) : null;
      const repo = origin && /^(https?:\/\/|ssh:\/\/|git@)/.test(origin[1]) ? origin[1].replace(/\/\/[^/@]+@/, '//') : '';
      out.push({ folder: dir, purpose: '', stack: stackFrom(own), repo });
    }
    return out;
  }

  function detect(contents, root, hasClaude) {
    const names = contents.map(c => c.name);
    const text = names.join('\n') + '\n' + contents.map(c => c.text).join('\n');
    const found = [];
    for (const p of catalog) {
      if (!p.detect || !(p.group === 'profile' || p.group === 'framework')) continue;
      if (!p.detect.some(d => text.includes(d))) continue;
      const list = p.group === 'profile' ? 'profiles' : 'testFrameworks';
      if (list === 'testFrameworks' && !state.tester) continue;
      if (!state[list].includes(p.id)) state[list].push(p.id);
      found.push(p.label);
    }
    if (!state.projectName && root) { state.projectName = root; $('sgName').value = root; }
    if (!state.projectStack) {
      const stack = stackFrom(contents);
      if (stack) { state.projectStack = stack; $('sgStack').value = stack; }
    }
    if (hasClaude && state.format === 'project') { state.existingClaudeMd = true; $('sgExisting').checked = true; }
    $('sgDetected').textContent = found.length
      ? `Detected: ${found.join(', ')}. Check the selections below.`
      : 'No known frameworks detected; pick them below.';
    renderPacks();
    changed();
  }

  function stackFrom(contents) {
    const parts = [];
    const find = n => contents.find(c => c.name === n || (n.startsWith('*') && c.name.endsWith(n.slice(1))));
    const pom = find('pom.xml');
    if (pom) {
      const java = /<java\.version>\s*([\d.]+)/.exec(pom.text);
      parts.push(java ? `Java ${java[1]}` : 'Java');
      const boot = /<artifactId>spring-boot-starter-parent<\/artifactId>\s*<version>([^<]+)</.exec(pom.text);
      if (boot) parts.push(`Spring Boot ${boot[1].trim()}`);
    } else if (find('build.gradle') || find('build.gradle.kts')) parts.push('Java / Kotlin (Gradle)');
    const pkg = find('package.json');
    if (pkg) {
      parts.push(find('tsconfig.json') ? 'TypeScript' : 'JavaScript');
      try {
        const j = JSON.parse(pkg.text);
        const deps = Object.assign({}, j.dependencies, j.devDependencies);
        for (const [dep, label] of [['react', 'React'], ['next', 'Next.js'], ['vue', 'Vue'], ['@angular/core', 'Angular'], ['express', 'Express'], ['@nestjs/core', 'NestJS'], ['fastify', 'Fastify']]) {
          if (deps[dep]) {
            const major = /\d+/.exec(deps[dep]);
            parts.push(major ? `${label} ${major[0]}` : label);
          }
        }
      } catch (_) { }
    }
    if (find('pyproject.toml') || contents.some(c => c.name.startsWith('requirements'))) parts.push('Python');
    if (find('go.mod')) parts.push('Go');
    if (find('*.csproj')) parts.push('C# / .NET');
    if (find('Gemfile')) parts.push('Ruby');
    if (find('composer.json')) parts.push('PHP');
    if (find('Package.swift')) parts.push('Swift');
    if (find('Cargo.toml')) parts.push('Rust');
    return [...new Set(parts)].join(', ').slice(0, 200);
  }

  function body() {
    return {
      projectName: state.projectName.slice(0, 80),
      projectDescription: state.projectDescription.slice(0, 600),
      projectStack: state.projectStack.slice(0, 200),
      developer: state.developer,
      tester: state.tester,
      profiles: state.profiles,
      testFrameworks: state.tester ? state.testFrameworks : [],
      extras: state.extras.filter(id => { const p = catalog.find(x => x.id === id); return p && roleOk(p); }),
      folders: state.folders.map(f => ({ path: f.path, note: (f.note || '').slice(0, 200) })),
      commandPrefix: state.format !== 'plugin' ? state.commandPrefix : '',
      existingClaudeMd: state.format === 'project' && state.existingClaudeMd,
      lintCommand: state.lintCommand,
      hookShell: state.hookShell,
      edits: state.edits,
      services: isWorkspace()
        ? state.services.filter(s => serviceFolder(s.folder)).map(s => ({
          folder: serviceFolder(s.folder), purpose: (s.purpose || '').slice(0, 200),
          stack: (s.stack || '').slice(0, 200), repo: (s.repo || '').trim().slice(0, 300),
        }))
        : [],
    };
  }

  function changed() {
    save();
    renderStepper();
    clearTimeout(timer);
    $('sgStatus').textContent = 'Updating preview…';
    timer = setTimeout(preview, 650);
  }

  async function errorMessage(res) {
    if (res.status === 429) return 'Too many requests. Please wait a minute and try again.';
    try { return (await res.json()).message || `Request failed (${res.status}).`; } catch (_) { return `Request failed (${res.status}).`; }
  }

  async function preview() {
    const id = ++requestId;
    let res;
    try {
      res = await fetch(`${API}/preview?format=${state.format}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()),
      });
    } catch (_) {
      if (id === requestId) showError('Could not reach the server. Check your connection.');
      return;
    }
    if (id !== requestId) return;
    if (!res.ok) { showError(await errorMessage(res)); return; }
    const data = await res.json();
    if (id !== requestId) return;
    previewFiles = data.files;
    const s = data.summary;
    $('sgStatus').textContent = `${s.files} files · ${s.commands} commands · ${s.agents} agents · ${Math.round(s.bytes / 1024)} KB`;
    $('sgDownload').disabled = !s.downloadable;
    renderIssues(data.issues);
    renderFiles();
  }

  function showError(msg) {
    $('sgStatus').textContent = '';
    $('sgDownload').disabled = true;
    renderIssues([{ severity: 'ERROR', path: '', message: msg }]);
  }

  function renderIssues(issues) {
    const box = $('sgIssues');
    box.replaceChildren();
    box.hidden = !issues.length;
    for (const i of issues) {
      const li = el('li', i.severity === 'ERROR' ? 'sg-err' : 'sg-warn');
      li.textContent = (i.path ? i.path + ': ' : '') + i.message;
      box.append(li);
    }
  }

  let fileFilter = 'all';

  function textOf(f) {
    return state.edits[f.path] ?? f.content;
  }

  function fillSections(text) {
    const out = [];
    const fences = [];
    const fence = /^```[^\n]*\n[\s\S]*?^```/gm;
    let f;
    while ((f = fence.exec(text))) fences.push([f.index, f.index + f[0].length]);
    const re = /(?<!`)<!-- FILL/g;
    let m;
    while ((m = re.exec(text))) {
      if (fences.some(([a, b]) => m.index > a && m.index < b)) continue;
      const before = text.slice(0, m.index).split('\n');
      let title = '';
      for (let i = before.length - 1; i >= 0; i--) {
        const h = /^#{1,6}\s+(.+)$/.exec(before[i]);
        if (h) { title = h[1].trim(); break; }
      }
      const close = text.indexOf('-->', m.index);
      out.push({ title: title || 'Untitled section', start: m.index, end: close < 0 ? m.index + 9 : close + 3 });
    }
    return out;
  }

  function badgeFor(count) {
    const b = el('span', 'sg-fill-badge', `✎ ${count}`);
    b.title = `${count} section${count === 1 ? '' : 's'} to fill in`;
    return b;
  }

  function renderFiles() {
    const list = $('sgFiles');
    list.replaceChildren();
    if (!previewFiles.some(f => f.path === selected)) {
      const firstFill = previewFiles.find(f => fillSections(textOf(f)).length);
      selected = firstFill ? firstFill.path : previewFiles.length ? previewFiles[0].path : null;
    }
    const fillCount = previewFiles.filter(f => fillSections(textOf(f)).length).length;
    $('sgFilterFill').textContent = `To fill in (${fillCount})`;
    let lastDir = null;
    for (const f of previewFiles) {
      const count = fillSections(textOf(f)).length;
      if (fileFilter === 'fill' && !count) continue;
      const skill = /^((?:.*\/)?skills\/)(.+)$/.exec(f.path);
      const slash = skill ? skill[1].length - 1 : f.path.lastIndexOf('/');
      const dir = slash < 0 ? '' : f.path.slice(0, slash + 1);
      if (dir && dir !== lastDir) list.append(el('li', 'sg-dir', dir));
      lastDir = dir;
      const li = el('li');
      const btn = el('button', 'sg-file' + (f.path === selected ? ' on' : '') + (count ? ' fillable' : ''));
      btn.type = 'button';
      btn.title = f.path;
      btn.dataset.path = f.path;
      btn.append(el('span', 'sg-file-name', f.path.slice(slash + 1)));
      if (dir) btn.classList.add('nested');
      if (count) btn.append(badgeFor(count));
      if (state.edits[f.path] !== undefined) btn.append(el('span', 'sg-edited', 'edited'));
      btn.addEventListener('click', () => { selected = f.path; renderFiles(); });
      li.append(btn);
      list.append(li);
    }
    if (!list.children.length) list.append(el('li', 'sg-dir', 'Nothing left to fill in.'));
    showSelected();
  }

  function renderFillBar() {
    const text = $('sgEditor').value;
    const sections = selected ? fillSections(text) : [];
    $('sgFillBar').hidden = !sections.length;
    const links = $('sgFillLinks');
    links.replaceChildren(...sections.map(s => {
      const b = el('button', 'sg-fill-link', s.title);
      b.type = 'button';
      b.addEventListener('click', () => jumpTo(s));
      return b;
    }));
    const btn = document.querySelector(`.sg-file[data-path="${CSS.escape(selected || '')}"]`);
    if (btn) {
      btn.querySelector('.sg-fill-badge')?.remove();
      btn.classList.toggle('fillable', sections.length > 0);
      if (sections.length) btn.querySelector('.sg-file-name').after(badgeFor(sections.length));
    }
  }

  function jumpTo(section) {
    const ed = $('sgEditor');
    const style = getComputedStyle(ed);
    const mirror = el('div');
    for (const p of ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderLeftWidth', 'borderRightWidth', 'boxSizing', 'tabSize']) mirror.style[p] = style[p];
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', wordWrap: 'break-word', width: ed.clientWidth + 'px', top: '0', left: '-9999px' });
    mirror.textContent = ed.value.slice(0, section.start);
    document.body.append(mirror);
    const offset = mirror.scrollHeight;
    mirror.remove();
    ed.focus({ preventScroll: true });
    ed.setSelectionRange(section.start, section.end);
    ed.scrollTop = Math.max(0, offset - ed.clientHeight / 3);
  }

  function setFullScreen(on) {
    const aside = document.querySelector('.sg-preview');
    aside.classList.toggle('sg-full', on);
    document.body.classList.toggle('sg-noscroll', on);
    $('sgFull').textContent = on ? '✕ Exit full screen' : '⤢ Full screen';
    $('sgFull').setAttribute('aria-pressed', String(on));
  }

  function guideAnchor(path) {
    const p = path.replace(/^templates\//, '');
    const base = s => s.replace(/\.[a-z]+$/, '').toLowerCase();
    if (/^CLAUDE(\.sdlc)?\.md$/.test(p)) return 'claude-md';
    if (p === 'SDLC-QUICKSTART.md') return 'quickstart';
    if (p === 'README.md') return 'plugin-readme';
    if (p === 'WORKSPACE-README.md') return 'workspace-readme';
    if (p === 'services.txt') return 'services-txt';
    if (/^clone-services\.(sh|ps1)$/.test(p)) return 'clone-services';
    if (p === '.gitignore') return 'workspace-gitignore';
    if (p === '.claude-plugin/plugin.json') return 'plugin-json';
    if (p === 'hooks/hooks.json') return 'hooks-json';
    if (p === '.claude/settings.json') return 'settings';
    let m = /(?:^|\/)skills\/([^/]+)\//.exec(p);
    if (m) {
      const prefix = (state.commandPrefix || '').trim().toLowerCase().replace(/-?$/, '-');
      const name = state.format !== 'plugin' && prefix !== '-' && m[1].startsWith(prefix) ? m[1].slice(prefix.length) : m[1];
      return 'cmd-' + name;
    }
    if ((m = /(?:^|\/)agents\/([^/]+)\.md$/.exec(p))) return 'agent-' + m[1];
    if ((m = /^\.claude\/rules\/testing\/([^/]+)\.md$/.exec(p))) return m[1] === 'finding-the-test-setup' ? 'rule-finding-the-test-setup' : 'framework-rules';
    if ((m = /^\.claude\/rules\/([^/]+)\.md$/.exec(p))) return 'rule-' + m[1];
    if ((m = /^docs\/sdlc\/(.+)$/.exec(p))) {
      const segs = m[1].split('/');
      if (segs[0] === 'testing' && segs.length > 1) return 'doc-testing-' + base(segs[1]);
      return 'doc-' + base(segs[0]);
    }
    return 'overview';
  }

  function showSelected() {
    const f = previewFiles.find(x => x.path === selected);
    $('sgWhatIs').href = '/guides/claude-code-sdlc-kit#' + (f ? guideAnchor(f.path) : 'overview');
    const edited = f && state.edits[f.path] !== undefined;
    $('sgPath').textContent = f ? f.path + (edited ? ' · your edit (form changes no longer update this file)' : '') : 'No file';
    $('sgEditor').value = f ? textOf(f) : '';
    $('sgEditor').disabled = !f;
    $('sgReset').hidden = !edited;
    renderFillBar();
  }

  async function download() {
    const btn = $('sgDownload');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Preparing…';
    try {
      const res = await fetch(`${API}/generate?format=${state.format}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()),
      });
      if (!res.ok) {
        if (res.status === 422) renderIssues((await res.json()).issues || []);
        else showError(await errorMessage(res));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url, download: state.format === 'plugin' ? 'claude-sdlc-plugin.zip' : isWorkspace() ? 'claude-sdlc-workspace.zip' : 'claude-sdlc-kit.zip',
      });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      $('sgAfter').hidden = false;
      $('sgAfterProject').hidden = state.format !== 'project';
      $('sgAfterPlugin').hidden = state.format !== 'plugin';
      $('sgAfterWorkspace').hidden = !isWorkspace();
    } catch (_) {
      showError('The download failed. Check your connection and try again.');
    } finally {
      btn.textContent = label;
      btn.disabled = false;
    }
  }

  function bindPreview() {
    let editTimer = null;
    $('sgEditor').addEventListener('input', () => {
      if (!selected) return;
      const original = (previewFiles.find(f => f.path === selected) || {}).content;
      if ($('sgEditor').value === original) delete state.edits[selected];
      else state.edits[selected] = $('sgEditor').value;
      $('sgReset').hidden = state.edits[selected] === undefined;
      renderFillBar();
      save();
      clearTimeout(editTimer);
      editTimer = setTimeout(() => changed(), 1200);
    });
    $('sgReset').addEventListener('click', () => {
      delete state.edits[selected];
      changed();
      showSelected();
    });
    $('sgCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('sgEditor').value);
        $('sgCopy').textContent = 'Copied ✓';
        setTimeout(() => { $('sgCopy').textContent = 'Copy'; }, 1400);
      } catch (_) { }
    });
    $('sgDownload').addEventListener('click', download);
    $('sgFull').addEventListener('click', () => setFullScreen(!document.querySelector('.sg-preview').classList.contains('sg-full')));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.querySelector('.sg-preview.sg-full')) setFullScreen(false);
    });
    document.querySelectorAll('.sg-filter-btn').forEach(b => b.addEventListener('click', () => {
      fileFilter = b.dataset.filter;
      document.querySelectorAll('.sg-filter-btn').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderFiles();
    }));
  }

  function bindFolders() {
    const picker = $('sgPick');
    picker.addEventListener('change', () => { readPicked(picker.files); picker.value = ''; });
    $('sgPickBtn').addEventListener('click', () => picker.click());
    $('sgParse').addEventListener('click', () => {
      const paths = parseFolderText($('sgPaste').value);
      if (!paths.length) { $('sgFolderInfo').textContent = 'No folders found in the pasted text.'; return; }
      setFolders(paths, 'the pasted text');
      if (isWorkspace()) {
        const tops = paths.filter(p => !p.includes('/') && SERVICE_FOLDER.test(p) && !NOT_SERVICES.has(p.toLowerCase()));
        mergeServices(tops.map(folder => ({ folder, purpose: '', stack: '', repo: '' })));
        renderServices();
        changed();
      }
    });
    $('sgAddService').addEventListener('click', () => {
      if (state.services.length >= 60) return;
      state.services.push({ folder: '', purpose: '', stack: '', repo: '' });
      renderServices();
      changed();
      const inputs = $('sgServiceRows').querySelectorAll('tr:last-child input');
      if (inputs[0]) inputs[0].focus();
    });
    $('sgClearFolders').addEventListener('click', () => {
      state.folders = [];
      $('sgFolderInfo').textContent = '';
      $('sgDetected').textContent = '';
      renderFolderTable();
      changed();
    });
    $('sgResetAll').addEventListener('click', () => {
      if (!confirm('Clear all your answers and edits?')) return;
      try { localStorage.removeItem(STORE_KEY); } catch (_) { }
      location.reload();
    });
  }

  async function init() {
    load();
    try {
      const res = await fetch(`${API}/packs`);
      catalog = (await res.json()).packs || [];
    } catch (_) {
      showError('Could not load the options. Refresh the page to try again.');
      return;
    }
    const known = new Set(catalog.map(p => p.id));
    for (const key of ['profiles', 'testFrameworks', 'extras']) state[key] = state[key].filter(id => known.has(id));
    if (!Array.isArray(state.services)) state.services = [];
    if (!['project', 'workspace', 'plugin'].includes(state.format)) state.format = 'project';
    for (const p of catalog) {
      const card = document.querySelector(`[data-role-desc="${p.id}"]`);
      if (card) card.textContent = p.description;
    }
    bindInputs();
    renderPacks();
    renderFolderTable();
    if (state.folders.length) $('sgFolderInfo').textContent = `${state.folders.length.toLocaleString('en-US')} folders from your last visit.`;
    bindFolders();
    bindPreview();
    bindSteps();
    goTo(state.step, false);
    preview();
  }

  init();
})();
