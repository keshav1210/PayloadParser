/* theme.js - light / dark theme. Loaded in <head> so the saved theme applies before the page paints. */
(function () {
  var KEY = 'jxe.theme';

  function apply(theme) {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#111317');
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage disabled */ }
  apply(saved);

  window.updateThemeButtons = function () {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = light ? '☾' : '☀';
      buttons[i].title = light ? 'Switch to dark theme' : 'Switch to light theme';
      buttons[i].setAttribute('aria-label', buttons[i].title);
    }
  };

  window.toggleTheme = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
    window.updateThemeButtons();
  };
})();
