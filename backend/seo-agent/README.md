# SEO Agent (agent #9) — autopilot blog + dynamic link engine

Grows organic search traffic for Tunakula on autopilot, on the same
NZELA discipline: the LLM writes prose **once per post** under a hard
budget ($0.02/call, ledgered); everything that actually moves rankings
is **deterministic and free**.

## What runs at zero tokens (the SEO win)

- **Dynamic internal linking** (`linking.ts`) — rebuilds a relevance
  graph across the whole corpus on every publish, so each new post links
  to and from related posts automatically. Anchors are injected on the
  first real keyword mention, or an "À lire aussi" block is appended.
  Cross-language links are never made; orphan pages are flagged.
- **SEO metadata** (`metadata.ts`) — title/description validation
  (length + URL-safe slug), canonical, Open Graph, hreflang alternates,
  JSON-LD Article schema, XML sitemap, robots.txt.
- **Backlink pipeline** (`backlinks.ts`) — honest by design: you cannot
  fabricate backlinks without a Google penalty. Autopilot matches your
  content to relevant high-authority prospects, ranks outreach by
  fit × authority, and tracks earned links. Durable backlinks come from
  the link-worthy asset (the proprietary Kinshasa delivery data).

## The one budgeted step

`autopilot.ts` → `SeoAutopilot.publish()` runs the LLM draft behind the
ledger's `BudgetMiddleware`. Overspend or a provider outage degrades to
a deterministic placeholder draft — the pipeline never blocks, exactly
like every other agent.

## Autopilot scheduling

`publish()` is pure and side-effect-free (dates injected, no `Date.now`),
so it drives from any scheduler: a cron/Cloud Scheduler job picks the
next target keyword, calls `publish(input, corpus, backlinkTargets)`,
and writes the returned `bodyWithLinks`, `headHtml`, `schemaJson`,
`sitemapXml` to the site. Run it daily and the internal link graph
compounds with zero marginal token cost beyond the single draft.

Tested: 14 cases covering link injection, keyword relevance, hreflang,
schema, sitemap, backlink ranking, budget metering and fallback.
