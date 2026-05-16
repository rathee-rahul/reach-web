(function () {
  function setAppHeight() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${height}px`);
  }

  setAppHeight();
  window.addEventListener("resize", setAppHeight, { passive: true });
  window.addEventListener("orientationchange", setAppHeight, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setAppHeight, { passive: true });
  }
})();
