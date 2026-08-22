/*
 * Tunakula NZELA-OS — unified web analytics: Meta Pixel + Google gtag.js
 * (GA4 + optional Ads). One shared module for EVERY surface. Include it
 * right after the config, both deferred so order is preserved:
 *
 *   <script src="../pwa/analytics.config.js" defer></script>
 *   <script src="../pwa/analytics.js" defer></script>
 *
 * Behaviour:
 * - No-ops safely when IDs are still __PLACEHOLDER__ (nothing loads).
 * - Fires PageView (Meta) + page_view (GA4) on load.
 * - Auto-tracks wa.me / WhatsApp clicks as a conversion — Meta: Contact,
 *   GA4: whatsapp_click — and any element with data-track="event_name".
 * - Tracks PWA install (appinstalled) as pwa_install.
 * - window.nzelaTrack(name, params) fires a custom event to BOTH platforms
 *   with one shared event_id, so browser events dedup against the
 *   server-side Conversions API / Measurement Protocol (@nzela/analytics).
 */
(function () {
  "use strict";
  var cfg = window.NZELA_ANALYTICS_CONFIG || {};
  function set(v) {
    return !!v && String(v).indexOf("__") !== 0 && String(v).length > 3;
  }
  var hasPixel = set(cfg.metaPixelId);
  var hasGa4 = set(cfg.ga4Id);
  var hasAds = set(cfg.googleAdsId);
  // Inert unless something is configured and consent is not withdrawn.
  if (cfg.consent === false || (!hasPixel && !hasGa4 && !hasAds)) return;

  // ---- Meta Pixel (official bootstrap, guarded) ----
  if (hasPixel) {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", cfg.metaPixelId);
    window.fbq("track", "PageView");
  }

  // ---- Google gtag.js (GA4 + optional Ads) ----
  if (hasGa4 || hasAds) {
    var gid = hasGa4 ? cfg.ga4Id : cfg.googleAdsId;
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gid);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    if (hasGa4) window.gtag("config", cfg.ga4Id);
    if (hasAds) window.gtag("config", cfg.googleAdsId);
  }

  // ---- shared event id (dedup with server-side CAPI / MP) ----
  function eid() {
    try {
      return "w-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    } catch (e) {
      return "w-" + new Date().getTime();
    }
  }

  // Canonical name -> Meta standard event.
  var META = {
    whatsapp_click: "Contact",
    begin_checkout: "InitiateCheckout",
    generate_lead: "Lead",
    purchase: "Purchase",
    sign_up: "CompleteRegistration",
    view_content: "ViewContent",
  };
  var META_STANDARD = {
    Contact: 1, InitiateCheckout: 1, Lead: 1, Purchase: 1,
    CompleteRegistration: 1, PageView: 1, ViewContent: 1,
  };

  // ---- unified track(): fires to Meta + GA4 with one shared id ----
  function track(name, params) {
    params = params || {};
    var id = params.event_id || eid();
    if (window.fbq) {
      var metaName = META[name] || name;
      window.fbq(
        META_STANDARD[metaName] ? "track" : "trackCustom",
        metaName,
        { value: params.value, currency: params.currency, content_name: params.label },
        { eventID: id },
      );
    }
    if (window.gtag) {
      var gp = {};
      for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) gp[k] = params[k];
      gp.event_id = id;
      window.gtag("event", name, gp);
    }
    return id;
  }
  window.nzelaTrack = track;

  // ---- auto-instrument WhatsApp CTAs + [data-track] elements ----
  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      var a = t && t.closest ? t.closest("a,[data-track]") : null;
      if (!a) return;
      var custom = a.getAttribute("data-track");
      if (custom) {
        track(custom, {
          label:
            a.getAttribute("data-track-label") ||
            (a.textContent || "").trim().slice(0, 64),
        });
        return;
      }
      var href = a.getAttribute("href") || "";
      if (/wa\.me\//.test(href) || /whatsapp/i.test(href)) {
        track("whatsapp_click", { label: (a.textContent || "").trim().slice(0, 64) || "wa.me" });
      }
    },
    true,
  );

  // ---- PWA install as a conversion signal ----
  window.addEventListener("appinstalled", function () {
    track("pwa_install", {});
  });
})();
