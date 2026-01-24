function loadFragment(id, file) {
    fetch(file)
        .then(res => res.text())
        .then(html => {
            document.getElementById(id).innerHTML = html;
        })
        .catch(err => console.error(`Failed to load ${file}`, err));
}

loadFragment("header", "/header.html");
loadFragment("footer", "/footer.html");
