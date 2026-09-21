// Applies the saved theme before first paint to avoid a light flash. Served as a file because the CSP forbids inline scripts.
(function () {
  try {
    var saved = localStorage.getItem('recall-theme');
    var dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
