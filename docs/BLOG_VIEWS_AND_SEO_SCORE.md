# Blog View Count + SEO Score

Two blog features, both now real. Neither existed before — a static blog has
no view counter, and the SEO agent produced no numeric score. This documents
how each works and what to configure at deploy.

---

## 1. Blog post view count (real, shared across visitors)

A static site can't count views on its own, so there is a tiny counter
service behind it.

**Service:** `@nzela/views` (`backend/views`) — `createViewsServer()`:
- `POST /views/hit {slug}` → increments, returns `{ slug, views }`
- `GET /views?slug=…` / `GET /views?slugs=a,b,c` → read counts
- CORS enabled (blog is a different origin); slugs validated; best-effort
  per-IP de-dup window so refreshes don't inflate. In-memory store now;
  Redis `INCR blog:views:<slug>` behind the same `ViewStore` at deploy.

**Client:** `frontend/pwa/views.js` + `views.config.js` (shipped with the
blog). It derives the slug from the URL, counts one view per browser per day
(localStorage), otherwise just reads the total, and renders
`👁 1 234 vues` into the `<span class="tk-views">` on each post.

**To turn it on:** deploy the views service, then set the endpoint once in
`frontend/blog/views.config.js` (copied from `frontend/pwa/`):

```js
window.NZELA_VIEWS_CONFIG = { endpoint: "https://views.tunakula.com", enabled: true };
```

Until `endpoint` is set the counter is **inert** — no calls, the element
stays hidden, the blog is unaffected. That is the current state (empty
endpoint), which is why no number shows yet: the feature is built and tested;
it needs the service hosted and the endpoint filled in.

---

## 2. SEO score (per post, at every build)

**Engine:** `seoScore(post, { internalLinksOut })` in
`backend/seo-agent/src/scoring.ts` — deterministic, 0 tokens. Grades a post
0–100 across weighted on-page factors with a transparent per-check
breakdown:

| Check | Weight |
|---|---|
| Title 30–60 chars | 15 |
| Primary keyword in title | 15 |
| Content ≥ 300 words | 13 |
| Meta description 120–160 | 12 |
| Keyword in description | 10 |
| Keyword in the intro | 10 |
| ≥ 2 H2 headings | 10 |
| ≥ 2 internal links | 8 |
| 2–8 keywords (no stuffing) | 4 |
| Clean, short slug | 3 |

Grade bands: A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F < 40. Keyword matching is
token-based (the words of the phrase need not be contiguous).

**Report:** the blog build writes `frontend/blog/seo-report.json` and prints
a ranked table. Current corpus (12 posts) averages **77/100**:

```
A  94  commander-nourriture-whatsapp-kinshasa
B  87  livraison-repas-bandal / adresse-vocale-sans-gps / payer-cash… / restaurants… / devenir-wewa…
B  77  diaspora-offrir-repas-famille-kinshasa
C  72  commander-a-la-voix… / payer-mobile-money…
C  62  rembourse-40-secondes… / parraine-un-ami…
D  52  regle-5-km-plat-chaud
```

Each post's `issues[]` in the report names exactly what to fix (e.g. "Contenu
≥ 300 mots — 210 mots (7/13)") so weak posts can be lifted deliberately.

**Regenerating** the report (and the whole blog) needs the build-time dep
`marked` installed: `pnpm add -Dw marked`, then run the blog generator
(`frontend/blog/_generate.ts`). The scoring itself needs no extra deps.
