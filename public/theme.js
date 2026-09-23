// Applies the saved theme before first paint to avoid a light flash. Served as a file because the CSP
// forbids inline scripts, which also means it cannot import the brand config. The storage keys are
// handed to it on the script tag instead, so a rename still only happens in one place.
(function () {
  var el = document.currentScript;
  var keys = (el && el.dataset.themeKeys ? el.dataset.themeKeys : 'theme').split(',');
  try {
    var saved = null;
    for (var i = 0; i < keys.length && saved === null; i++) saved = localStorage.getItem(keys[i]);
    var dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
