// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Highlight current section in TOC while scrolling
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('.section');
    const scrollPos = window.scrollY + 100;

    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');

        if (scrollPos >= top && scrollPos < top + height) {
            document.querySelectorAll('.toc a').forEach(link => {
                link.style.color = '#5a7d9a';
            });
            const activeLink = document.querySelector(`.toc a[href="#${id}"]`);
            if (activeLink) {
                activeLink.style.color = '#7aa3c5';
                activeLink.style.fontWeight = 'bold';
            }
        }
    });
});