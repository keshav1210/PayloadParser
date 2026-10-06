function loadFragment(id, file, onLoad) {
    const target = document.getElementById(id);
    if (!target) return;
    if (target.firstElementChild) {
        if (onLoad) onLoad(target);
        return;
    }
    fetch(file)
        .then(res => res.text())
        .then(html => {
            target.innerHTML = html;
            if (onLoad) onLoad(target);
        })
        .catch(err => console.error(`Failed to load ${file}`, err));
}

function toggleMenu() {
    const nav = document.querySelector('.app-header .nav-links');
    const btn = document.querySelector('.app-header .menu-toggle');
    if (!nav) return;
    const open = nav.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', String(open));
}

const NAV_ALIASES = {
    '/json-parser': '/parser', '/xml-parser': '/parser', '/json-validator': '/parser', '/json-viewer': '/parser',
    '/json-minifier': '/parser', '/json-to-xml': '/parser', '/xml-to-json': '/parser', '/json-to-csv': '/parser',
    '/json-xml-converter': '/parser', '/xml-json-converter': '/parser'
};

function markActiveNavLink(root) {
    const raw = window.location.pathname.replace(/\/+$/, '') || '/';
    const path = NAV_ALIASES[raw] || (raw.startsWith('/shared/') ? '/share' : raw);
    root.querySelectorAll('.nav-links a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === path) {
            a.classList.add('active');
            a.setAttribute('aria-current', 'page');
            const menu = a.closest('.nav-menu');
            if (menu) menu.classList.add('active');
        }
    });

    const menu = root.querySelector('.nav-menu');
    if (menu) {
        document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.open = false; });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
    }
}

loadFragment("header", "/header.html?v=15", root => {
    markActiveNavLink(root);
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
        root.querySelectorAll('.cmdk-trigger-kbd').forEach(k => { k.textContent = '⌘ K'; });
        root.querySelectorAll('.cmdk-trigger').forEach(b => { b.title = 'Search tools (⌘K)'; });
    }
    if (window.updateThemeButtons) window.updateThemeButtons();
});
loadFragment("footer", "/footer.html?v=17", root => {
    const year = root.querySelector('.footer-year');
    if (year) year.textContent = new Date().getFullYear();
});

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.append(s);
    });
}
(window.SITE_TOOLS ? Promise.resolve() : loadScript('/js/tools-list.js?v=9'))
    .then(() => loadScript('/js/palette.js?v=1'))
    .catch(err => console.error('Failed to load the tool search', err));

(function guardDevTools() {
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')) return;
    window.addEventListener('keydown', e => {
        const k = (e.key || '').toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const blocked =
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
            (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k)) ||
            (ctrl && !e.shiftKey && !e.altKey && k === 'u');
        if (blocked) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
})();
