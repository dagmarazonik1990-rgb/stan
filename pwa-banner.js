/* STAN:PWA_BANNER v1
   - pokazuje banner instalacji na iOS (Safari)
   - ukrywa się po dodaniu do ekranu / po kliknięciu "Nie teraz"
*/

(function () {
  const STORAGE_KEY = "stan_pwa_banner_dismissed_v1";

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isInStandaloneMode() {
    // iOS Safari PWA
    return window.navigator.standalone === true
      // inne przeglądarki (czasem)
      || window.matchMedia?.("(display-mode: standalone)")?.matches;
  }

  function isSafariOnIos() {
    const ua = window.navigator.userAgent;
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    return isIos() && isSafari;
  }

  function dismissed() {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  }

  function setDismissed() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }

  function createBanner() {
    // HTML (wstrzykujemy go, żeby nie trzeba było przebudowywać całego index.html)
    const wrap = document.createElement("div");
    wrap.id = "stan-pwa-banner";
    wrap.innerHTML = `
      <div class="stan-pwa-inner">
        <div class="stan-pwa-left">
          <div class="stan-pwa-title">Dodaj STAN do ekranu</div>
          <div class="stan-pwa-text">
            W Safari kliknij <span class="stan-pwa-icon">⬆️</span> Udostępnij → <b>Dodaj do ekranu</b>.
          </div>
        </div>
        <div class="stan-pwa-right">
          <button class="stan-pwa-btn" id="stan-pwa-ok">OK</button>
          <button class="stan-pwa-close" id="stan-pwa-close" aria-label="Zamknij">✕</button>
        </div>
      </div>
    `;
    return wrap;
  }

  function mountBanner() {
    if (!isSafariOnIos()) return;
    if (isInStandaloneMode()) return;      // już dodane
    if (dismissed()) return;

    const banner = createBanner();
    document.body.appendChild(banner);

    const close = () => {
      banner.classList.add("hide");
      setTimeout(() => banner.remove(), 250);
    };

    document.getElementById("stan-pwa-close")?.addEventListener("click", () => {
      setDismissed();
      close();
    });

    document.getElementById("stan-pwa-ok")?.addEventListener("click", () => {
      // nie ustawiamy dismissed na zawsze, bo "OK" ma tylko schować na chwilę
      close();
    });
  }

  // SW register (opcjonalne, ale warto)
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  registerServiceWorker();
  mountBanner();
})();