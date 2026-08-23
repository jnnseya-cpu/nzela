import { describe, it, expect } from "vitest";
import { seoScore } from "./scoring.js";
import type { BlogPost } from "./types.js";

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: "commander-nourriture-whatsapp-kinshasa",
    title: "Commander de la nourriture sur WhatsApp à Kinshasa en 2 min",
    description:
      "Guide complet pour commander de la nourriture sur WhatsApp à Kinshasa : " +
      "menu, paiement mobile money ou cash, livraison en moins de 30 minutes.",
    keywords: ["commander nourriture whatsapp", "livraison kinshasa", "mobile money"],
    publishedAt: "2026-08-01",
    author: "Tunakula-Congo",
    lang: "fr",
    bodyMarkdown:
      "Commander nourriture whatsapp à Kinshasa n'a jamais été aussi simple. " +
      "Voici comment faire.\n\n## Choisir son plat\n\n" +
      "Ouvrez la conversation et parcourez le menu. ".repeat(20) +
      "\n\n## Payer et se faire livrer\n\n" +
      "Payez en cash ou mobile money, puis suivez le wewa. ".repeat(20),
    ...overrides,
  };
}

describe("seoScore", () => {
  it("gives a strong, well-formed post an A/B score", () => {
    const r = seoScore(post(), { internalLinksOut: 3 });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(["A", "B"]).toContain(r.grade);
    expect(r.checks.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(r.slug).toBe("commander-nourriture-whatsapp-kinshasa");
  });

  it("penalizes a missing primary keyword in the title", () => {
    const good = seoScore(post(), { internalLinksOut: 3 });
    const bad = seoScore(post({ title: "Un titre sans le mot important ici du tout" }), {
      internalLinksOut: 3,
    });
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.checks.find((c) => c.id === "kw-in-title")?.ok).toBe(false);
  });

  it("penalizes thin content and missing headings", () => {
    const r = seoScore(
      post({ bodyMarkdown: "Trop court. Pas de structure ici." }),
      { internalLinksOut: 0 },
    );
    expect(r.checks.find((c) => c.id === "word-count")?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "headings")?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "internal-links")?.ok).toBe(false);
    expect(r.score).toBeLessThan(60);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("flags a bad slug and empty keywords", () => {
    const r = seoScore(post({ slug: "Bad Slug!", keywords: [] }));
    expect(r.checks.find((c) => c.id === "slug")?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "kw-in-title")?.ok).toBe(false);
  });

  it("is deterministic (same input → same score)", () => {
    expect(seoScore(post(), { internalLinksOut: 2 }).score).toBe(
      seoScore(post(), { internalLinksOut: 2 }).score,
    );
  });

  it("awards partial credit for one heading / one internal link", () => {
    const r = seoScore(
      post({ bodyMarkdown: "## Seul titre\n\n" + "Du contenu suffisant ici. ".repeat(60) }),
      { internalLinksOut: 1 },
    );
    expect(r.checks.find((c) => c.id === "headings")?.earned).toBe(5);
    expect(r.checks.find((c) => c.id === "internal-links")?.earned).toBe(4);
  });
});
