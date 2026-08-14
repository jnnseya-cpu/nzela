import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import {
  backlinkHealth,
  buildLinkGraph,
  findOrphans,
  injectInternalLinks,
  outreachQueue,
  renderArticleSchema,
  renderHeadTags,
  renderSitemap,
  SeoAutopilot,
  validatePost,
  type BacklinkTarget,
  type BlogPost,
  type SiteConfig,
} from "./index.js";

const SITE: SiteConfig = {
  baseUrl: "https://tunakula.com",
  siteName: "Tunakula-Congo",
  defaultAuthor: "Tunakula-Congo",
  waLink: "https://wa.me/243000000000?text=Nakolia",
};

const post = (over: Partial<BlogPost>): BlogPost => ({
  slug: "s",
  title: "Livraison de poulet mayo à Bandal en 30 minutes",
  description:
    "Commande ton poulet mayo à Bandal sur WhatsApp et reçois-le chaud en 30 minutes, sans application.",
  keywords: ["poulet mayo", "bandal", "livraison"],
  publishedAt: "2026-07-01",
  author: "Tunakula-Congo",
  bodyMarkdown: "Le poulet mayo est un classique. On livre à Bandal vite.",
  lang: "fr",
  ...over,
});

describe("dynamic internal linking (deterministic, 0 tokens)", () => {
  const a = post({ slug: "poulet-mayo-bandal", keywords: ["poulet mayo", "bandal"] });
  const b = post({
    slug: "meilleurs-restos-bandal",
    title: "Les meilleurs restos de Bandal",
    keywords: ["bandal", "restaurant"],
    bodyMarkdown: "Bandal regorge de bons restos.",
  });
  const c = post({
    slug: "payer-mobile-money",
    title: "Payer par mobile money à Kinshasa",
    keywords: ["mobile money", "paiement"],
    bodyMarkdown: "Le mobile money simplifie tout.",
  });

  it("links posts that share keywords, not unrelated ones", () => {
    const graph = buildLinkGraph([a, b, c]);
    const fromA = graph.filter((l) => l.fromSlug === "poulet-mayo-bandal");
    expect(fromA.map((l) => l.toSlug)).toContain("meilleurs-restos-bandal");
    expect(fromA.map((l) => l.toSlug)).not.toContain("payer-mobile-money");
  });

  it("injects a real anchor into the body on the shared keyword", () => {
    const graph = buildLinkGraph([a, b]);
    const bySlug = new Map([a, b].map((p) => [p.slug, p]));
    const body = injectInternalLinks(a, graph, bySlug, SITE.baseUrl);
    expect(body).toContain(
      "[Bandal](https://tunakula.com/blog/meilleurs-restos-bandal)",
    );
  });

  it("never injects a link inside an existing link's URL (corruption bug)", () => {
    // Post whose body mentions BOTH a slug-word and another keyword that
    // appears inside the first injected URL. Pre-fix, the 2nd injection
    // matched 'whatsapp' inside /blog/...-whatsapp-... and broke the URL.
    const src = post({
      slug: "src",
      keywords: ["commander", "whatsapp"],
      bodyMarkdown: "Tu peux commander sur whatsapp facilement.",
    });
    const t1 = post({ slug: "commander-nourriture-whatsapp-kinshasa", title: "Commander sur WhatsApp", keywords: ["commander"] });
    const t2 = post({ slug: "guide-whatsapp", title: "Guide WhatsApp", keywords: ["whatsapp"] });
    const graph = buildLinkGraph([src, t1, t2]);
    const bySlug = new Map([src, t1, t2].map((p) => [p.slug, p]));
    const body = injectInternalLinks(src, graph, bySlug, SITE.baseUrl);
    // Every injected URL must be a clean, whole slug — no nested brackets.
    const urls = [...body.matchAll(/\]\((https:\/\/tunakula\.com\/blog\/[^)]+)\)/g)].map((m) => m[1]);
    for (const u of urls) {
      expect(u).not.toContain("[");
      expect(u).toMatch(/^https:\/\/tunakula\.com\/blog\/[a-z0-9-]+$/);
    }
  });

  it("appends an 'À lire aussi' block when no keyword mention exists", () => {
    const noMention = post({
      slug: "actu",
      keywords: ["bandal"],
      bodyMarkdown: "Texte sans le mot-clé cible ici.",
    });
    const graph = buildLinkGraph([noMention, b]);
    const bySlug = new Map([noMention, b].map((p) => [p.slug, p]));
    const body = injectInternalLinks(noMention, graph, bySlug, SITE.baseUrl);
    expect(body).toContain("## À lire aussi");
    expect(body).toContain("/blog/meilleurs-restos-bandal");
  });

  it("respects maxLinksPerPost and never links across languages", () => {
    const en = post({ slug: "en", lang: "en", keywords: ["bandal"] });
    const graph = buildLinkGraph([a, en]);
    expect(graph.filter((l) => l.fromSlug === "poulet-mayo-bandal")).toHaveLength(0);
  });

  it("flags orphan pages nothing links to", () => {
    const orphan = post({ slug: "orphan", keywords: ["xyz-unique"] });
    const graph = buildLinkGraph([a, b, orphan]);
    expect(findOrphans([a, b, orphan], graph)).toContain("orphan");
  });
});

describe("SEO metadata (deterministic)", () => {
  it("validates title/description length and slug shape", () => {
    expect(validatePost(post({})).ok).toBe(true);
    expect(validatePost(post({ title: "Court" })).issues[0]).toContain("title");
    expect(validatePost(post({ slug: "Bad Slug!" })).issues.join()).toContain("slug");
  });

  it("renders canonical, OG, hreflang and Article schema", () => {
    const fr = post({ slug: "x", lang: "fr" });
    const en = post({ slug: "x", lang: "en" });
    const head = renderHeadTags(fr, SITE, [en]);
    expect(head).toContain('<link rel="canonical" href="https://tunakula.com/blog/x">');
    expect(head).toContain('hreflang="en"');
    const schema = renderArticleSchema(fr, SITE);
    expect(JSON.parse(schema.replace(/<\/?script[^>]*>/g, ""))["@type"]).toBe("Article");
  });

  it("builds a sitemap over the corpus", () => {
    const xml = renderSitemap([post({ slug: "a" }), post({ slug: "b" })], SITE);
    expect(xml).toContain("https://tunakula.com/blog/a");
    expect(xml).toContain("https://tunakula.com/blog/b");
  });
});

describe("backlink pipeline (honest — match, prioritize, track)", () => {
  const targets: BacklinkTarget[] = [
    { domain: "kinshasa-food.cd", authority: 40, topics: ["bandal", "restaurant"], status: "prospect" },
    { domain: "random-crypto.io", authority: 90, topics: ["crypto"], status: "prospect" },
    { domain: "diaspora-rdc.uk", authority: 55, topics: ["livraison"], status: "live", liveUrl: "https://diaspora-rdc.uk/tunakula" },
  ];
  it("ranks only topically relevant prospects by fit × authority", () => {
    const q = outreachQueue(targets, post({ keywords: ["bandal", "restaurant"] }));
    expect(q.map((t) => t.domain)).toEqual(["kinshasa-food.cd"]);
  });
  it("reports earned-link health", () => {
    const h = backlinkHealth(targets);
    expect(h.live).toBe(1);
    expect(h.earnedAuthority).toBe(55);
  });
});

describe("SEO autopilot (budget-governed, agent #9)", () => {
  const writer = {
    async write(keyword: string) {
      return {
        markdown: `# ${keyword}\n\nUn article sur bandal et la livraison à Kinshasa.`,
        title: "Livraison à Bandal sur WhatsApp en 30 minutes chrono",
        description:
          "Découvre comment commander à Bandal sur WhatsApp et être livré chaud en 30 minutes, sans app ni carte bancaire.",
        costUsd: 0.015,
      };
    },
  };

  it("publishes a post, links it into the corpus, meters the LLM cost", async () => {
    const ledger = new MemoryLedger();
    const corpus = [post({ slug: "meilleurs-restos-bandal", title: "Les meilleurs restos de Bandal", keywords: ["bandal"] })];
    const pilot = new SeoAutopilot(SITE, writer, ledger);
    const res = await pilot.publish(
      { keyword: "livraison bandal", slug: "livraison-bandal", keywords: ["bandal", "livraison"], publishedAt: "2026-07-15" },
      corpus,
    );
    expect(res.issues).toEqual([]);
    expect(res.bodyWithLinks).toContain("/blog/meilleurs-restos-bandal"); // dynamic link injected
    expect(res.bodyWithLinks).toContain("wa.me"); // conversion CTA present
    expect(res.headHtml).toContain("canonical");
    expect(res.sitemapXml).toContain("livraison-bandal");
    const ai = ledger.events.find((e) => e.agent === "seo" && e.type === "ai");
    expect(ai?.costUsd).toBeCloseTo(0.015);
  });

  it("degrades to a deterministic draft if the writer overspends the budget", async () => {
    const ledger = new MemoryLedger();
    const greedy = {
      async write(keyword: string) {
        return { markdown: "x", title: keyword, description: "y", costUsd: 5 };
      },
    };
    const pilot = new SeoAutopilot(SITE, greedy, ledger);
    const res = await pilot.publish(
      { keyword: "test", slug: "test-post", keywords: ["bandal"], publishedAt: "2026-07-15" },
      [],
    );
    // Budget middleware discards the overspend; fallback prose used.
    expect(res.post.bodyMarkdown).toContain("Contenu à venir");
    expect(ledger.events.some((e) => e.type === "budget-exhausted")).toBe(true);
  });
});
