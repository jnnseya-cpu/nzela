import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { marked } from "marked";
import { buildLinkGraph, injectInternalLinks, findOrphans } from "/home/user/nzela/backend/seo-agent/src/linking.ts";
import {
  renderHeadTags, renderArticleSchema, renderSitemap, renderRobots,
  validatePost, canonicalUrl,
} from "/home/user/nzela/backend/seo-agent/src/metadata.ts";
import type { SiteConfig } from "/home/user/nzela/backend/seo-agent/src/types.ts";
import { seoScore } from "/home/user/nzela/backend/seo-agent/src/scoring.ts";
import { CORPUS } from "./_corpus.ts";

const SITE: SiteConfig = {
  baseUrl: "https://tunakula.com",
  siteName: "Tunakula-Congo",
  defaultAuthor: "Tunakula-Congo",
  waLink: "https://wa.me/447493216101?text=Nakolia",
  ogImage: "https://tunakula.com/pwa/og-image.png",
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

// --- 4. Page shell (premium design system, matches the landing page) ---
const PAGE_CSS = `
:root{--nuit:#070C09;--paper:#FBF6EC;--ink:#1A211C;--ink2:#3B463E;--wax:#C25E08;--wax2:#E0730F;--gold:#E8C77A;--smoke:#6E8377;--wa:#128C4B;--line:#e7dcc6;--disp:'Unbounded',Georgia,serif;--body:'Space Grotesk',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--body);color:var(--ink);background:var(--paper);line-height:1.75;-webkit-font-smoothing:antialiased}
::selection{background:rgba(224,115,15,.22)}
img,svg{display:block;max-width:100%}
.nav{position:sticky;top:0;z-index:20;background:rgba(7,12,9,.95);backdrop-filter:blur(10px);border-bottom:1px solid rgba(246,239,224,.1)}
.nav .in{max-width:960px;margin:0 auto;padding:0 22px;height:60px;display:flex;align-items:center;gap:14px}
.nav .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#F7F1E4}
.nav .brand svg{width:30px;height:30px}
.nav .brand b{font-family:var(--disp);font-weight:800;font-size:.9rem}
.nav .brand b i{font-style:normal;color:var(--gold)}
.nav .cta{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-family:var(--body);font-weight:600;font-size:.8rem;color:#25D366;border:1px solid rgba(37,211,102,.45);border-radius:10px;padding:8px 14px;text-decoration:none}
.nav .cta svg{width:15px;height:15px}
.wrap{max-width:720px;margin:0 auto;padding:46px 22px 12px}
.eyebrow{font-family:var(--mono);font-size:.64rem;letter-spacing:.22em;text-transform:uppercase;color:var(--wax);display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow::before{content:'';width:20px;height:1px;background:var(--wax)}
.back{display:inline-block;margin-bottom:24px;font-family:var(--mono);font-size:.72rem;color:var(--smoke);text-decoration:none}
.back:hover{color:var(--wax)}
.artmeta{font-family:var(--mono);font-size:.72rem;color:var(--smoke);margin:0 0 28px;letter-spacing:.02em}
.tk-views{display:inline-block;margin:0 0 22px}
article h1{font-family:var(--disp);font-weight:800;font-size:clamp(1.9rem,4.6vw,2.7rem);line-height:1.12;color:var(--ink);letter-spacing:-.01em;margin-bottom:18px}
article h2{font-family:var(--disp);font-weight:700;font-size:1.3rem;color:var(--wax);margin:40px 0 12px;line-height:1.22}
article p{margin:16px 0;font-size:1.06rem;color:#2b332c}
article strong{color:var(--ink);font-weight:600}
article > p:first-of-type{font-size:1.2rem;line-height:1.62;color:var(--ink2)}
article a{color:var(--wa);font-weight:600;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
article a:hover{color:var(--wax)}
article ul,article ol{margin:16px 0 16px 22px}article li{margin:7px 0}
article a[href*="wa.me"]{display:inline-flex;align-items:center;gap:9px;margin:16px 0 6px;background:#25D366;color:#052012;padding:14px 24px;border-radius:13px;font-weight:600;text-decoration:none;box-shadow:0 12px 26px -12px rgba(37,211,102,.5)}
article a[href*="wa.me"]:hover{background:#2ee06f}
.related{max-width:720px;margin:44px auto 0;padding:26px 22px 0;border-top:1px solid var(--line)}
.related h3{font-family:var(--disp);font-weight:700;color:var(--ink);font-size:1.05rem;margin-bottom:14px}
.related a{display:flex;justify-content:space-between;gap:12px;padding:15px 17px;margin-bottom:9px;background:#fff;border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-weight:600;font-size:.92rem;transition:transform .12s,border-color .2s}
.related a:hover{transform:translateX(3px);border-color:var(--wax)}
.related a b{font-weight:600}.related a span{color:var(--wax);flex:none}
.idx-hero{max-width:960px;margin:0 auto;padding:58px 22px 6px}
.idx-hero h1{font-family:var(--disp);font-weight:800;font-size:clamp(2rem,5vw,2.9rem);line-height:1.1;color:var(--ink);margin:4px 0 12px;letter-spacing:-.01em}
.idx-hero .lead{font-size:1.14rem;color:var(--ink2);max-width:580px}
.grid{max-width:960px;margin:28px auto 0;padding:0 22px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
@media(max-width:680px){.grid{grid-template-columns:1fr}}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;text-decoration:none;color:var(--ink);display:flex;flex-direction:column;gap:9px;box-shadow:0 16px 36px -32px rgba(0,0,0,.55);transition:transform .14s,box-shadow .25s}
.card:hover{transform:translateY(-4px);box-shadow:0 26px 46px -30px rgba(0,0,0,.45)}
.card h3{font-family:var(--disp);font-weight:700;color:var(--ink);font-size:1.06rem;line-height:1.22}
.card p{color:var(--smoke);font-size:.9rem;line-height:1.55}
.card .more{margin-top:auto;font-family:var(--mono);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--wax)}
.foot{background:#060907;margin-top:58px;border-top:1px solid rgba(246,239,224,.1)}
.foot .in{max-width:960px;margin:0 auto;padding:32px 22px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-family:var(--mono);font-size:.66rem;letter-spacing:.04em;color:#6E8377}
.foot a{color:#B7C7B9;text-decoration:none}.foot a:hover{color:var(--gold)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const MARK = `<svg viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="11" fill="#0F1712" stroke="#20281f"/><path d="M8 30c4-14 20-14 24 0" stroke="#E0730F" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="12.5" r="3.1" fill="#E8C77A"/></svg>`;
const WAICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm-3 6.3c.2 0 .4 0 .6.4.3.5.9 1.8.9 2 .1.1.1.3 0 .5l-.5.6-.5.5c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.3-.2.6-.2.3.1 1.5.8 1.8.9l.6.4s0 .7-.2 1.3c-.2.7-1.3 1.3-1.8 1.3-.5.1-1 .3-3.4-.7C11 15.4 9.1 12.5 9 12.3c-.2-.2-1.2-1.6-1.2-2.9s.7-2 1-2.3c.2-.4.5-.4.7-.4z"/></svg>`;

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const readingMin = (md: string) =>
  Math.max(2, Math.round(md.replace(/[#>*_\`\[\]()-]/g, " ").split(/\s+/).filter(Boolean).length / 200));

const shell = (head: string, bodyHtml: string) =>
`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${head}
<link rel="stylesheet" href="fonts.css">
<script src="analytics.config.js" defer></script>
<script src="analytics.js" defer></script>
<script src="views.config.js" defer></script>
<script src="views.js" defer></script>
<style>${PAGE_CSS}</style></head><body>
<header class="nav"><div class="in"><a class="brand" href="/">${MARK}<b>TUNAKULA <i>NZELA-OS</i></b></a><a class="cta" href="${SITE.waLink}">${WAICON} Commander</a></div></header>
${bodyHtml}
<footer class="foot"><div class="in"><span>© 2026 Groupe JNN · Tunakula-Congo · Kinshasa, RDC</span><span><a href="https://cd.tunakula.com">cd.tunakula.com</a> · <a href="${SITE.waLink}">Commander sur WhatsApp</a></span></div></footer>
</body></html>`;

// --- 5. Write each post page ---
for (const { post, body } of rendered) {
  const alternates = CORPUS.filter((p) => p.slug === post.slug && p.lang !== post.lang);
  const head = [
    renderHeadTags(post, SITE, alternates),
    renderArticleSchema(post, SITE),
  ].join("\n");
  const related = graph.filter((l) => l.fromSlug === post.slug).slice(0, 5)
    .map((l) => `<a href="/blog/${l.toSlug}.html"><b>${bySlug.get(l.toSlug)!.title}</b><span>→</span></a>`).join("");
  const meta = `${fmtDate(post.publishedAt)} · ${readingMin(post.bodyMarkdown)} min de lecture · Tunakula`;
  // Localize the engine's absolute internal links to local .html so the
  // article body navigates in a static preview. Scoped to the ARTICLE BODY
  // only — the head's canonical/og:url stay absolute (what search engines
  // and social crawlers require).
  const articleHtml = String(marked.parse(body))
    .replace(/https:\/\/tunakula\.com\/blog\/([a-z0-9-]+)(?!\.html)/g, "/blog/$1.html");
  const html = shell(head,
    `<main class="wrap"><a class="back" href="/blog/">← Tous les articles</a>` +
    `<div class="eyebrow">Guide Tunakula</div>` +
    `<span class="tk-views" hidden></span>` +
    `<div class="artmeta">${meta}</div>` +
    `<article>${articleHtml}</article></main>` +
    (related ? `<div class="related"><h3>À lire aussi</h3>${related}</div>` : ""));
  writeFileSync(`${OUT}/${post.slug}.html`, html);
}

// --- 6. Blog index ---
const cards = CORPUS.map((p) =>
  `<a class="card" href="/blog/${p.slug}.html"><h3>${p.title}</h3><p>${p.description}</p><span class="more">Lire l'article →</span></a>`).join("");
writeFileSync(`${OUT}/index.html`, shell(
  `<title>Blog Tunakula — Manger à Kinshasa, sur WhatsApp</title><meta name="description" content="Le blog Tunakula : comment commander, payer et se faire livrer à Kinshasa sur WhatsApp — mobile money, règle 5 km, wewa, diaspora et plus.">`,
  `<section class="idx-hero"><div class="eyebrow">Le blog Tunakula</div>
   <h1>Manger à Kinshasa, sur WhatsApp.</h1>
   <p class="lead">Comment commander, payer et se faire livrer — sans app, sans carte, livré chaud.</p></section>
   <div class="grid">${cards}</div>`));

// --- 7. Sitemap + robots (real engine output) ---
writeFileSync(`${OUT}/sitemap.xml`, renderSitemap(CORPUS, SITE));
writeFileSync(`${OUT}/robots.txt`, renderRobots(SITE));

// --- 7b. Ship the shared analytics kit alongside the blog (single source
// lives in frontend/pwa; copied so the blog deploy is self-contained). ---
const PWA = "/home/user/nzela/frontend/pwa";
for (const f of ["analytics.config.js", "analytics.js", "views.config.js", "views.js"]) {
  copyFileSync(`${PWA}/${f}`, `${OUT}/${f}`);
}
// Same embedded font kit as the landing page — one look, offline-safe.
copyFileSync("/home/user/nzela/frontend/landing/fonts.css", `${OUT}/fonts.css`);

// --- 8. SEO score every post (deterministic engine) + write report ---
const scores = CORPUS.map((post) => {
  const linksOut = graph.filter((l) => l.fromSlug === post.slug).length;
  return seoScore(post, { internalLinksOut: linksOut });
}).sort((a, b) => b.score - a.score);
const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);
const report = {
  generatedForCorpusSize: CORPUS.length,
  averageScore: avgScore,
  posts: scores.map((s) => ({
    slug: s.slug,
    score: s.score,
    grade: s.grade,
    issues: s.issues,
  })),
};
writeFileSync(`${OUT}/seo-report.json`, JSON.stringify(report, null, 2));

console.log(`posts: ${CORPUS.length}`);
console.log(`internal links injected by engine: ${totalLinks}`);
console.log(`orphans (linked to by nobody): ${orphans.length ? orphans.join(", ") : "none"}`);
console.log(`avg links per post: ${(totalLinks / CORPUS.length).toFixed(1)}`);
console.log(`\nSEO scores (avg ${avgScore}/100):`);
for (const s of scores) {
  console.log(`  ${s.grade}  ${String(s.score).padStart(3)}  ${s.slug}`);
}
console.log("seo-report.json written");
console.log("written to", OUT);
