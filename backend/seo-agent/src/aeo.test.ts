import { describe, expect, it } from "vitest";
import {
  aeoScore,
  renderFaqSchema,
  renderBreadcrumbSchema,
  renderSpeakableSchema,
  renderAllSchema,
  renderSiteSchema,
  renderLlmsTxt,
  type BlogPost,
  type SiteConfig,
} from "./index.js";

const SITE: SiteConfig = {
  baseUrl: "https://tunakula.com",
  siteName: "Tunakula-Congo",
  defaultAuthor: "Tunakula-Congo",
  waLink: "https://wa.me/243000000000?text=Nakolia",
  ogImage: "https://tunakula.com/pwa/og-image.png",
};

const fullPost = (over: Partial<BlogPost> = {}): BlogPost => ({
  slug: "payer-mobile-money",
  title: "Payer par Mobile Money à Kinshasa : M-Pesa, Orange, Airtel",
  description:
    "Paie ta commande Tunakula par mobile money — M-Pesa, Orange, Airtel, Africell — confirmé automatiquement en moins de 30 secondes.",
  keywords: ["mobile money", "mpesa", "paiement", "kinshasa"],
  publishedAt: "2026-08-13",
  updatedAt: "2026-09-10",
  author: "Tunakula-Congo",
  lang: "fr",
  bodyMarkdown:
    "# Payer par Mobile Money\n\nAvec Tunakula tu paies par mobile money en 30 secondes.\n\n## Comment payer par mobile money\n\nEnvoie le montant au numéro indiqué avec ta référence.\n\n## Ton argent est protégé\n\nRemboursé en 40 secondes si souci.",
  keyTakeaways: [
    "Le mobile money (M-Pesa, Orange, Airtel, Africell) est confirmé en moins de 30 secondes.",
    "Tu paies chez Tunakula, pas au resto : remboursé en 40 s en cas de souci.",
    "Aucune capture d'écran à envoyer — le versement est reconnu tout seul.",
  ],
  faq: [
    { q: "Quels opérateurs mobile money acceptez-vous ?", a: "M-Pesa, Orange Money, Airtel Money et Africell." },
    { q: "En combien de temps mon paiement est-il confirmé ?", a: "En moins de 30 secondes, automatiquement." },
    { q: "Dois-je envoyer une capture d'écran ?", a: "Non. Le système reconnaît ton versement tout seul." },
  ],
  citations: [{ url: "https://www.gsma.com/mobilemoney/", anchor: "GSMA — Mobile Money", rel: "nofollow" }],
  ...over,
});

describe("aeoScore (answer-engine optimization)", () => {
  it("scores a fully-enriched post at 90+ (A)", () => {
    const s = aeoScore(fullPost());
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(s.grade).toBe("A");
  });

  it("collapses without takeaways and FAQ (the two dominant signals)", () => {
    const s = aeoScore(fullPost({ keyTakeaways: [], faq: [] }));
    expect(s.score).toBeLessThan(60);
    expect(s.issues.join(" ")).toMatch(/essentiel/i);
  });

  it("rewards concise takeaways and penalizes bloated ones", () => {
    const long = "x".repeat(200);
    const bloated = aeoScore(fullPost({ keyTakeaways: [long, long, long] }));
    const concise = aeoScore(fullPost());
    expect(concise.score).toBeGreaterThan(bloated.score);
  });

  it("needs 3 FAQ pairs for full FAQ credit", () => {
    const two = aeoScore(fullPost({ faq: [
      { q: "Q1 ?", a: "A1." },
      { q: "Q2 ?", a: "A2." },
    ] }));
    const three = aeoScore(fullPost());
    expect(three.score).toBeGreaterThan(two.score);
  });

  it("gives partial freshness credit without an explicit updatedAt", () => {
    const withMod = aeoScore(fullPost());
    const without = aeoScore(fullPost({ updatedAt: undefined }));
    expect(withMod.score).toBeGreaterThan(without.score);
  });
});

describe("structured data for AI engines", () => {
  it("emits valid FAQPage JSON-LD from the post FAQ", () => {
    const json = renderFaqSchema(fullPost().faq);
    const parsed = JSON.parse(json.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(3);
    expect(parsed.mainEntity[0].acceptedAnswer.text).toContain("M-Pesa");
  });

  it("returns empty FAQ schema when there is no FAQ", () => {
    expect(renderFaqSchema(undefined)).toBe("");
    expect(renderFaqSchema([])).toBe("");
  });

  it("emits a 3-level BreadcrumbList", () => {
    const parsed = JSON.parse(
      renderBreadcrumbSchema(fullPost(), SITE).replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""),
    );
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toHaveLength(3);
    expect(parsed.itemListElement[2].item).toBe("https://tunakula.com/blog/payer-mobile-money");
  });

  it("emits Speakable targeting the takeaways + FAQ selectors", () => {
    const parsed = JSON.parse(
      renderSpeakableSchema(fullPost(), SITE).replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""),
    );
    expect(parsed.speakable.cssSelector).toEqual([".tk-essentiel", ".tk-faq"]);
  });

  it("bundles every schema block via renderAllSchema (valid JSON each)", () => {
    const all = renderAllSchema(fullPost(), SITE);
    const blocks = all.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? [];
    expect(blocks.length).toBe(4); // Article + Breadcrumb + FAQ + Speakable
    for (const b of blocks) {
      expect(() => JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""))).not.toThrow();
    }
  });

  it("renderSiteSchema emits Organization + WebSite", () => {
    const s = renderSiteSchema(SITE);
    expect(s).toContain('"@type":"Organization"');
    expect(s).toContain('"@type":"WebSite"');
  });

  it("renderLlmsTxt lists every post with an absolute URL", () => {
    const txt = renderLlmsTxt([fullPost()], SITE, "tagline");
    expect(txt).toContain("# Tunakula-Congo");
    expect(txt).toContain("https://tunakula.com/blog/payer-mobile-money");
  });
});
