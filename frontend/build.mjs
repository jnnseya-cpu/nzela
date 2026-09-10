// Assemble every front-facing surface into one deployable static site:
//   /        → landing        (frontend/landing/landing.html)
//   /blog    → blog + posts   (frontend/blog)
//   /pro     → partner dash   (frontend/partner-dashboard)
//   /pwa/*   → shared kit (icons, sw, splash, analytics, views)
//   /fonts.css, /manifest.webmanifest, /sw.js  shared at root
// Asset references are rewritten to absolute (/pwa, /fonts.css) so every
// route resolves the same way. Host configs for Netlify/Cloudflare, Vercel
// and Apache/cPanel are emitted so it drops onto any of them.
//
// Run:  node frontend/build.mjs   → outputs frontend/dist/
import {
  rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { WA_NUMBER } from "./site.config.mjs";

const ROOT = "/home/user/nzela/frontend";
const DIST = join(ROOT, "dist");
// The number baked into the static sources; build.mjs swaps it for the
// configured WA_NUMBER across the whole site so one config edit is the job.
const LEGACY_WA = "447493216101";

const rmrf = (p) => rmSync(p, { recursive: true, force: true });
const write = (p, s) => writeFileSync(p, s);
const read = (p) => readFileSync(p, "utf8");
const rewrite = (src, dest, subs) => {
  let html = read(src);
  for (const [from, to] of subs) html = html.split(from).join(to);
  write(dest, html);
};

// --- fresh dist tree ---
rmrf(DIST);
mkdirSync(DIST, { recursive: true });
mkdirSync(join(DIST, "pwa"), { recursive: true });
mkdirSync(join(DIST, "pro"), { recursive: true });

// --- shared PWA kit → /pwa ---
cpSync(join(ROOT, "pwa"), join(DIST, "pwa"), { recursive: true });

// --- shared root assets ---
cpSync(join(ROOT, "landing/fonts.css"), join(DIST, "fonts.css"));
cpSync(join(ROOT, "landing/sw.js"), join(DIST, "sw.js"));
if (existsSync(join(ROOT, "landing/splash.html")))
  cpSync(join(ROOT, "landing/splash.html"), join(DIST, "splash.html"));
// Root manifest: force PWA scope to the site root.
write(
  join(DIST, "manifest.webmanifest"),
  read(join(ROOT, "landing/manifest.webmanifest"))
    .replace(/"start_url"\s*:\s*"[^"]*"/, '"start_url": "/"')
    .replace(/"scope"\s*:\s*"[^"]*"/, '"scope": "/"'),
);

// --- landing → /index.html (relative ../pwa & local refs → absolute) ---
rewrite(join(ROOT, "landing/landing.html"), join(DIST, "index.html"), [
  ['"../pwa/', '"/pwa/'],
  ['href="fonts.css"', 'href="/fonts.css"'],
  ['href="manifest.webmanifest"', 'href="/manifest.webmanifest"'],
]);

// --- /tech.html (relocated engineering story for press/partners) ---
rewrite(join(ROOT, "landing/tech.html"), join(DIST, "tech.html"), [
  ['"../pwa/', '"/pwa/'],
  ['href="fonts.css"', 'href="/fonts.css"'],
]);

// --- partner dashboard → /pro/index.html ---
rewrite(join(ROOT, "partner-dashboard/dashboard.html"), join(DIST, "pro/index.html"), [
  ['"../pwa/', '"/pwa/'],
  ['href="../landing/fonts.css"', 'href="/fonts.css"'],
  ['href="manifest.webmanifest"', 'href="/pro/manifest.webmanifest"'],
]);
write(
  join(DIST, "pro/manifest.webmanifest"),
  read(join(ROOT, "partner-dashboard/manifest.webmanifest"))
    .replace(/"start_url"\s*:\s*"[^"]*"/, '"start_url": "/pro/"')
    .replace(/"scope"\s*:\s*"[^"]*"/, '"scope": "/pro/"'),
);
cpSync(join(ROOT, "partner-dashboard/sw.js"), join(DIST, "pro/sw.js"));

// --- blog → /blog (asset refs rewritten to absolute so the bare /blog URL
//     works too — same-dir refs would break without a trailing slash) ---
const BLOG_SUBS = [
  ['src="analytics.config.js"', 'src="/pwa/analytics.config.js"'],
  ['src="analytics.js"', 'src="/pwa/analytics.js"'],
  ['src="views.config.js"', 'src="/pwa/views.config.js"'],
  ['src="views.js"', 'src="/pwa/views.js"'],
  ['href="fonts.css"', 'href="/fonts.css"'],
];
mkdirSync(join(DIST, "blog"), { recursive: true });
for (const f of readdirSync(join(ROOT, "blog"))) {
  if (f.endsWith(".ts")) continue;                 // build sources
  if (f === "_redirects" || f === ".htaccess") continue; // site-wide below
  if (f.endsWith(".html")) rewrite(join(ROOT, "blog", f), join(DIST, "blog", f), BLOG_SUBS);
  else cpSync(join(ROOT, "blog", f), join(DIST, "blog", f));
}

// --- host configs ---------------------------------------------------------
// Netlify / Cloudflare Pages
write(join(DIST, "_redirects"), `# Tunakula — clean routes
/pro            /pro/               301
/blog           /blog/              301
/blog/:slug     /blog/:slug.html    200
/*              /404.html           404
`);

// Apache / cPanel (cd.tunakula.com family)
write(join(DIST, ".htaccess"), `Options -MultiViews -Indexes
RewriteEngine On
# pretty blog article URLs → the .html file
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^blog/([a-z0-9-]+)/?$ /blog/$1.html [L]
# /pro and /blog land on their index
RewriteRule ^pro/?$ /pro/index.html [L]
RewriteRule ^blog/?$ /blog/index.html [L]
ErrorDocument 404 /404.html
# long-cache static assets
<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType text/css "access plus 1 year"
ExpiresByType image/png "access plus 1 year"
ExpiresByType image/svg+xml "access plus 1 year"
ExpiresByType application/javascript "access plus 7 days"
</IfModule>
`);

// robots + a unified sitemap (site root)
const HOST = "https://tunakula.com";
const posts = readdirSync(join(ROOT, "blog"))
  .filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "404.html")
  .map((f) => f.replace(/\.html$/, ""));
write(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${HOST}/sitemap.xml\n`);
// llms.txt at the site root (llmstxt.org) — AI crawlers look here first.
if (existsSync(join(ROOT, "blog/llms.txt")))
  cpSync(join(ROOT, "blog/llms.txt"), join(DIST, "llms.txt"));
const urls = [
  `${HOST}/`, `${HOST}/pro`, `${HOST}/blog`,
  ...posts.map((s) => `${HOST}/blog/${s}`),
];
write(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`,
);

// branded 404
write(join(DIST, "404.html"), `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Page introuvable — Tunakula</title>
<link rel="stylesheet" href="/fonts.css">
<style>html,body{margin:0;height:100%}body{background:#070C09;color:#F7F1E4;font-family:'Space Grotesk',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
h1{font-family:'Unbounded',Georgia,serif;font-weight:800;font-size:clamp(2rem,6vw,3.4rem);margin:0 0 10px}
p{color:#9DB3A6;margin:0 0 26px}a{display:inline-block;background:#25D366;color:#052012;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:13px}</style></head>
<body><div><div style="font:600 .7rem/1 'IBM Plex Mono',monospace;letter-spacing:.28em;color:#E0730F;text-transform:uppercase;margin-bottom:14px">Erreur 404</div>
<h1>Cette nzela n'existe pas.</h1><p>La page que tu cherches a bougé. Reviens à l'accueil.</p>
<a href="/">← Retour à l'accueil</a></div></body></html>`);

// --- single-source WhatsApp number: swap the baked-in legacy number for the
//     configured WA_NUMBER across every assembled HTML file (one config edit
//     → whole site). No-op when they already match. ---
let waSwaps = 0;
if (WA_NUMBER !== LEGACY_WA) {
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".html")) {
        const src = read(p);
        if (src.includes(LEGACY_WA)) {
          write(p, src.split(LEGACY_WA).join(WA_NUMBER));
          waSwaps++;
        }
      }
    }
  };
  walk(DIST);
}

console.log("dist assembled →", DIST);
console.log("routes: /  ·  /blog  ·  /blog/<post>  ·  /pro");
console.log(`posts in sitemap: ${posts.length}`);
console.log(
  WA_NUMBER === LEGACY_WA
    ? `WhatsApp number: ${WA_NUMBER} (default — set WA_NUMBER in site.config.mjs to go live)`
    : `WhatsApp number: swapped → ${WA_NUMBER} in ${waSwaps} file(s)`,
);
