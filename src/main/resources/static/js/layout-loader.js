function loadFragment(id, file, onLoad) {
    const target = document.getElementById(id);
    if (!target) return;
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

// Tool pages that live under the "Formatter" menu item
const NAV_ALIASES = {
    '/json-parser': '/parser', '/xml-parser': '/parser', '/csv-converter': '/parser',
    '/yaml-converter': '/parser', '/toml-converter': '/parser',
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
        }
    });
}

loadFragment("header", "/header.html?v=4", markActiveNavLink);
loadFragment("footer", "/footer.html?v=4", root => {
    const year = root.querySelector('.footer-year');
    if (year) year.textContent = new Date().getFullYear();
});
