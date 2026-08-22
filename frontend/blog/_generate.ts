import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { marked } from "marked";
import { buildLinkGraph, injectInternalLinks, findOrphans } from "/home/user/nzela/backend/seo-agent/src/linking.ts";
import {
  renderHeadTags, renderArticleSchema, renderSitemap, renderRobots,
  validatePost, canonicalUrl,
} from "/home/user/nzela/backend/seo-agent/src/metadata.ts";
import type { SiteConfig } from "/home/user/nzela/backend/seo-agent/src/types.ts";
import { CORPUS } from "./corpus.ts";

const SITE: SiteConfig = {
  baseUrl: "https://tunakula.com",
  siteName: "Tunakula-Congo",
  defaultAuthor: "Tunakula-Congo",
  waLink: "https://wa.me/447493216101?text=Nakolia",
};
const OUT = "/home/user/nzela/frontend/blog";
mkdirSync(OUT, { recursive: true });

// --- 1. Validate every post (real engine gate) ---
const problems = CORPUS.flatMap((p) => validatePost(p).issues.map((i) => `${p.slug}: ${i}`));
if (problems.length) { console.error("VALIDATION FAILED:\n" + problems.join("\n")); process.exit(1); }

// --- 2. Build the dynamic internal-link graph over the whole corpus ---
const graph = buildLinkGraph(CORPUS, { maxLinksPerPost: 5, minSharedKeywords: 1 });
const bySlug = new Map(CORPUS.map((p) => [p.slug, p]));
const orphans = findOrphans(CORPUS, graph);

// --- 3. Append the wa.me CTA + inject internal links into each body ---
for (const post of CORPUS) {
  post.bodyMarkdown += `\n\n[Commander sur WhatsApp maintenant](${SITE.waLink})`;
}
let totalLinks = 0;
const rendered = CORPUS.map((post) => {
  const body = injectInternalLinks(post, graph, bySlug, SITE.baseUrl);
  totalLinks += (body.match(/\]\(https:\/\/tunakula\.com\/blog\//g) ?? []).length;
  return { post, body };
});

// --- 4. Page shell ---
const PAGE_CSS = `
:root{--nuit:#0B120E;--manioc:#F6EFE0;--wax:#C96703;--gold:#B8860B;--ink:#1c241f;--smoke:#5E7466;--wa:#128C4B;--line:#e6ddc9}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:var(--ink);background:#faf7f0;line-height:1.65}
.top{background:var(--nuit);color:var(--manioc);padding:14px 22px}
.top a{color:var(--manioc);text-decoration:none;font-weight:800;font-family:Georgia,serif}
.top a em{font-style:normal;color:var(--wax)}
.wrap{max-width:720px;margin:0 auto;padding:34px 22px 60px}
article h1{font-family:Georgia,serif;font-size:2rem;line-height:1.2;color:var(--nuit);margin-bottom:14px}
article h2{font-family:Georgia,serif;font-size:1.25rem;color:var(--wax);margin:26px 0 10px}
article p{margin:12px 0}
article a{color:var(--wa);font-weight:600}
.cta{display:inline-block;margin:22px 0 6px;background:var(--wa);color:#fff!important;padding:13px 24px;border-radius:28px;font-weight:700;text-decoration:none;box-shadow:0 6px 18px -6px rgba(18,140,75,.6)}
.meta{color:var(--smoke);font-size:.82rem;margin-bottom:22px;font-family:monospace}
.related{margin-top:34px;padding-top:18px;border-top:2px solid var(--line)}
.related h3{font-family:Georgia,serif;color:var(--nuit);font-size:1rem;margin-bottom:10px}
.related a{display:block;padding:7px 0;color:var(--wa);text-decoration:none;border-bottom:1px solid var(--line)}
.foot{color:var(--smoke);font-size:.78rem;text-align:center;padding:24px;border-top:1px solid var(--line);margin-top:30px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:24px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;text-decoration:none;color:var(--ink);transition:transform .12s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 24px -12px rgba(0,0,0,.3)}
.card h3{font-family:Georgia,serif;color:var(--nuit);font-size:1.05rem;margin-bottom:8px}
.card p{color:var(--smoke);font-size:.86rem}
.lead{font-size:1.05rem;color:var(--smoke);margin:6px 0 20px}
`;

const shell = (head: string, bodyHtml: string) =>
`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${head}
<script src="analytics.config.js" defer></script>
<script src="analytics.js" defer></script>
<style>${PAGE_CSS}</style></head><body>
<div class="top"><a href="/blog/">TUNAKULA <em>NZELA-OS</em> · Blog</a></div>
<div class="wrap">${bodyHtml}</div>
<div class="foot">© Tunakula-Congo · Kinshasa, RDC · <a href="${SITE.waLink}" style="color:var(--wa)">Commander sur WhatsApp</a></div>
</body></html>`;

// --- 5. Write each post page ---
for (const { post, body } of rendered) {
  const alternates = CORPUS.filter((p) => p.slug === post.slug && p.lang !== post.lang);
  const head = [
    renderHeadTags(post, SITE, alternates),
    renderArticleSchema(post, SITE),
  ].join("\n");
  const related = graph.filter((l) => l.fromSlug === post.slug).slice(0, 5)
    .map((l) => `<a href="/blog/${l.toSlug}.html">${bySlug.get(l.toSlug)!.title} →</a>`).join("");
  const html = shell(head,
    `<article>${marked.parse(body)}</article>` +
    (related ? `<div class="related"><h3>À lire aussi</h3>${related}</div>` : ""));
  // Rewrite absolute blog URLs to local .html for a static preview.
  writeFileSync(`${OUT}/${post.slug}.html`, html.replace(/https:\/\/tunakula\.com\/blog\/([a-z0-9-]+)(?!\.html)/g, "/blog/$1.html"));
}

// --- 6. Blog index ---
const cards = CORPUS.map((p) =>
  `<a class="card" href="/blog/${p.slug}.html"><h3>${p.title}</h3><p>${p.description}</p></a>`).join("");
writeFileSync(`${OUT}/index.html`, shell(
  `<title>Blog Tunakula — Livraison sur WhatsApp à Kinshasa</title><meta name="description" content="Tout sur la livraison de repas sur WhatsApp à Kinshasa : commande, paiement mobile money, règle 5 km, wewa, diaspora et plus.">`,
  `<h1 style="font-family:Georgia,serif;color:#0B120E">Le blog Tunakula</h1>
   <p class="lead">Comment commander, payer et se faire livrer à Kinshasa — sur WhatsApp, sans app.</p>
   <div class="grid">${cards}</div>`));

// --- 7. Sitemap + robots (real engine output) ---
writeFileSync(`${OUT}/sitemap.xml`, renderSitemap(CORPUS, SITE));
writeFileSync(`${OUT}/robots.txt`, renderRobots(SITE));

// --- 7b. Ship the shared analytics kit alongside the blog (single source
// lives in frontend/pwa; copied so the blog deploy is self-contained). ---
const PWA = "/home/user/nzela/frontend/pwa";
for (const f of ["analytics.config.js", "analytics.js"]) {
  copyFileSync(`${PWA}/${f}`, `${OUT}/${f}`);
}

console.log(`posts: ${CORPUS.length}`);
console.log(`internal links injected by engine: ${totalLinks}`);
console.log(`orphans (linked to by nobody): ${orphans.length ? orphans.join(", ") : "none"}`);
console.log(`avg links per post: ${(totalLinks / CORPUS.length).toFixed(1)}`);
console.log("written to", OUT);
