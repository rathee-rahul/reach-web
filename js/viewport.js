(function () {
  function setAppHeight() {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${Math.max(320, Math.round(height))}px`);
  }

  setAppHeight();
  window.addEventListener("load", setAppHeight, { passive: true });
  window.addEventListener("pageshow", setAppHeight, { passive: true });
  window.addEventListener("focusin", setAppHeight, { passive: true });
  window.addEventListener("focusout", setAppHeight, { passive: true });
  window.addEventListener("resize", setAppHeight, { passive: true });
  window.addEventListener("orientationchange", setAppHeight, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setAppHeight, { passive: true });
    window.visualViewport.addEventListener("scroll", setAppHeight, { passive: true });
  }
})();
