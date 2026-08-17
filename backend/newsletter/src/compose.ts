import type { Edition, NewsletterConfig, Subscriber } from "./types.js";
import { unsubscribeUrl } from "./subscribers.js";

/**
 * Deterministic email composition — HTML + plaintext. Every edition is
 * dense with hyperlinks: each feature links to its blog post, plus the
 * WhatsApp order CTA, the referral link, the full-blog link and the
 * per-recipient unsubscribe link. No LLM, no ACU: it assembles links.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
  /** Count of hyperlinks in the HTML — asserted by tests. */
  linkCount: number;
}

export function composeEmail(
  edition: Edition,
  subscriber: Subscriber,
  cfg: NewsletterConfig,
): ComposedEmail {
  const wa = `https://wa.me/${cfg.waNumber}?text=Nakolia`;
  const blogUrl = `${cfg.baseUrl}/blog/`;
  const unsub = unsubscribeUrl(cfg.baseUrl, subscriber.email, cfg.unsubscribeSecret);
  const hi = subscriber.name ? `Bonjour ${esc(subscriber.name)},` : "Bonjour,";

  const itemsHtml = edition.items
    .map(
      (it) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
  <a href="${cfg.baseUrl}/blog/${it.slug}" style="color:#C96703;font-weight:700;text-decoration:none;font-size:16px">${esc(it.title)} →</a>
  <div style="color:#444;font-size:14px;margin-top:4px">${esc(it.blurb)}</div>
</td></tr>`,
    )
    .join("\n");

  const html =
`<!DOCTYPE html><html lang="${edition.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf7f0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c241f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden">
  <tr><td style="background:#0B120E;padding:18px 24px">
    <a href="${cfg.baseUrl}" style="color:#F6EFE0;font-weight:800;font-size:18px;text-decoration:none;font-family:Georgia,serif">TUNAKULA <span style="color:#C96703">NZELA-OS</span></a>
  </td></tr>
  <tr><td style="padding:24px 24px 8px">
    <p style="margin:0 0 8px;font-size:15px">${hi}</p>
    <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#0B120E">Ta livraison à Kinshasa, cette semaine</h1>
    <p style="margin:0;color:#555;font-size:14px">Voici ce que Tunakula fait pour toi — commande, paie et fais-toi livrer chaud, sur WhatsApp.</p>
  </td></tr>
  <tr><td style="padding:8px 24px">
    <a href="${wa}" style="display:inline-block;background:#128C4B;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:26px;margin:8px 0">💬 Commander sur WhatsApp</a>
  </td></tr>
  <tr><td style="padding:6px 24px 0"><table role="presentation" width="100%">${itemsHtml}</table></td></tr>
  <tr><td style="padding:16px 24px">
    <a href="${blogUrl}" style="color:#128C4B;font-weight:600;text-decoration:none;font-size:14px">Voir tout le blog Tunakula →</a>
  </td></tr>
  <tr><td style="padding:14px 24px;background:#FDEBD7">
    <p style="margin:0;font-size:14px;color:#7a3410"><b>Parraine un ami</b> : partagez Tunakula, et gagnez tous les deux du Crédit Tunakula.
    <a href="${wa}" style="color:#C96703;font-weight:700">Partager sur WhatsApp →</a></p>
  </td></tr>
  <tr><td style="padding:18px 24px;background:#0B120E;color:#9FB8A9;font-size:12px">
    Tunakula-Congo · Kinshasa, RDC<br>
    Tu reçois cet e-mail car tu es inscrit sur Tunakula.
    <a href="${unsub}" style="color:#E8B44C">Se désabonner</a>.
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    hi,
    "",
    "TA LIVRAISON À KINSHASA CETTE SEMAINE",
    `Commander sur WhatsApp : ${wa}`,
    "",
    ...edition.items.map((it) => `• ${it.title} — ${cfg.baseUrl}/blog/${it.slug}\n  ${it.blurb}`),
    "",
    `Tout le blog : ${blogUrl}`,
    `Parraine un ami et gagnez du Crédit Tunakula : ${wa}`,
    "",
    `Tunakula-Congo · Kinshasa, RDC`,
    `Se désabonner : ${unsub}`,
  ].join("\n");

  const linkCount = (html.match(/href="/g) ?? []).length;
  return { subject: edition.subject, html, text, linkCount };
}
