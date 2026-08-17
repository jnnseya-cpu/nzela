/*
 * Tunakula PWA splash — shared, self-contained. Include on any installable
 * surface with: <script src="../pwa/pwa-splash.js" defer></script>
 * It injects a branded splash overlay on launch and fades it once the page
 * is ready (min ~700ms so it doesn't flash), reusing the NZELA identity.
 * Shown once per app launch (sessionStorage), respects reduced-motion, and
 * registers the service worker for offline/installability.
 */
(function () {
  "use strict";
  // Only splash on a fresh launch (cold start / installed PWA), not on
  // every in-app navigation within the same session.
  var KEY = "tk_splash_shown";
  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  var alreadyShown = sessionStorage.getItem(KEY) === "1";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Register the service worker (best-effort; harmless if absent).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  if (alreadyShown) return;
  sessionStorage.setItem(KEY, "1");

  var css =
    "#tk-splash{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;text-align:center;" +
    "background:radial-gradient(900px 500px at 50% 118%,rgba(242,130,10,.35),rgba(242,130,10,.06) 45%,transparent 70%),#080D0A;" +
    "transition:opacity .5s ease,visibility .5s ease}" +
    "#tk-splash.tk-gone{opacity:0;visibility:hidden}" +
    "#tk-splash .tk-in{animation:tk-rise .8s cubic-bezier(.16,.8,.3,1) both}" +
    "#tk-splash .tk-mark{font-family:'Unbounded',Georgia,serif;font-weight:900;letter-spacing:.04em;font-size:clamp(1.1rem,5vw,1.6rem);color:#F6EFE0}" +
    "#tk-splash .tk-os{font-family:'Unbounded',Georgia,serif;font-weight:900;font-size:clamp(2rem,11vw,3.4rem);line-height:1.05;margin-top:2px;" +
    "background:linear-gradient(95deg,#F2820A,#E8B44C 50%,#F2820A);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    "#tk-splash .tk-tag{margin-top:14px;font:600 .72rem/1.5 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#9FB8A9}" +
    "#tk-splash .tk-bar{margin:20px auto 0;width:150px;height:2px;background:rgba(246,239,224,.12);border-radius:2px;overflow:hidden}" +
    "#tk-splash .tk-bar i{display:block;height:100%;width:40%;border-radius:2px;background:linear-gradient(90deg,#F2820A,#E8B44C);animation:tk-load 1.1s ease-in-out infinite}" +
    "@keyframes tk-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}" +
    "@keyframes tk-load{0%{transform:translateX(-120%)}100%{transform:translateX(520%)}}" +
    "@media (prefers-reduced-motion:reduce){#tk-splash *{animation:none!important}#tk-splash{transition:opacity .2s}}";

  function build() {
    var s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
    var el = document.createElement("div");
    el.id = "tk-splash";
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", "Chargement de Tunakula");
    el.innerHTML =
      '<div class="tk-in"><div class="tk-mark">TUNAKULA</div>' +
      '<div class="tk-os">NZELA-OS</div>' +
      '<div class="tk-tag">Bandal · Kinshasa · RDC</div>' +
      (reduce ? "" : '<div class="tk-bar"><i></i></div>') +
      "</div>";
    document.body.appendChild(el);

    var start = Date.now();
    var MIN = 700;
    function dismiss() {
      var wait = Math.max(0, MIN - (Date.now() - start));
      setTimeout(function () {
        el.classList.add("tk-gone");
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 550);
      }, wait);
    }
    if (document.readyState === "complete") dismiss();
    else window.addEventListener("load", dismiss, { once: true });
    // Safety: never trap the user if 'load' never fires.
    setTimeout(dismiss, 4000);
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build, { once: true });
})();
