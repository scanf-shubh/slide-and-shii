// Boot the unified game once the DOM and all modules are ready.
(function () {
  function boot() {
    if (!window.VOX || !window.VOX.App) {
      setTimeout(boot, 40);
      return;
    }
    window.VOX.App.init();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
