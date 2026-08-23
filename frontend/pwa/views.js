/*
 * Tunakula blog view counter (client). Renders a real, shared-across-visitors
 * "👁 N vues" on each post, backed by the @nzela/views service.
 *
 * Include after its config on blog pages:
 *   <script src="analytics.config.js" defer></script>  (optional, unrelated)
 *   <script src="views.config.js" defer></script>
 *   <script src="views.js" defer></script>
 * and place an empty element where the count should appear:
 *   <span class="tk-views" hidden></span>
 *
 * - Inert if the endpoint is not configured (element stays hidden, no calls).
 * - Slug is derived from the URL (…/blog/<slug>.html). index/404 are skipped.
 * - Counts a given browser once per slug per day (localStorage); other loads
 *   just read the current total, so a refresh doesn't inflate the number.
 */
(function () {
  "use strict";
  var cfg = window.NZELA_VIEWS_CONFIG || {};
  var endpoint = (cfg.endpoint || "").replace(/\/+$/, "");
  if (cfg.enabled === false || !endpoint) return;

  function slugFromPath() {
    var m = location.pathname.match(/\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/i);
    if (!m) return null;
    var s = m[1].toLowerCase();
    if (s === "index" || s === "404") return null;
    return s;
  }

  function render(el, n) {
    if (typeof n !== "number" || n < 0) return;
    el.textContent = "👁 " + n.toLocaleString("fr-FR") + (n === 1 ? " vue" : " vues");
    el.style.cssText =
      "display:inline-block;font:600 .78rem/1 monospace;color:#5E7466;" +
      "background:rgba(94,116,102,.10);border:1px solid rgba(94,116,102,.22);" +
      "padding:4px 9px;border-radius:999px;letter-spacing:.02em";
    el.removeAttribute("hidden");
  }

  function once(slug) {
    // one counted view per browser per slug per calendar day
    try {
      var d = new Date();
      var key =
        "tk_viewed_" + slug + "_" + d.getFullYear() + (d.getMonth() + 1) + d.getDate();
      if (localStorage.getItem(key)) return false;
      localStorage.setItem(key, "1");
      return true;
    } catch (e) {
      return true; // storage blocked → still count (server de-dups by IP)
    }
  }

  function start() {
    var el = document.querySelector(".tk-views");
    var slug = slugFromPath();
    if (!el || !slug) return;

    var count = once(slug);
    var req = count
      ? fetch(endpoint + "/views/hit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slug }),
        })
      : fetch(endpoint + "/views?slug=" + encodeURIComponent(slug));

    req
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (d && typeof d.views === "number") render(el, d.views);
      })
      .catch(function () {
        /* counter is best-effort; never disrupt the page */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
