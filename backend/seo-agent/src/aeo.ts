/**
 * Answer-Engine Optimization score (0 tokens, deterministic). Classic
 * `seoScore` grades a page for the ten blue links; this grades it for the
 * way discovery ACTUALLY happens now — generative engines (ChatGPT,
 * Perplexity, Google AI Overviews, Gemini), voice assistants, and social
 * search — which quote self-contained answers, parse FAQ pairs, and reward
 * structured, entity-rich pages. A post that wins here is one an AI is
 * willing to lift and cite.
 *
 * Every check maps to a signal those systems verifiably use, and to an asset
 * the content model can actually carry (takeaways, FAQ, citations, freshness)
 * — so a fully-enriched post genuinely earns its score rather than gaming it.
 * Weights sum to 100; the breakdown is transparent so the writer sees exactly
 * what to add.
 */
import type { BlogPost } from "./types.js";

export interface AeoCheck {
  id: string;
  label: string;
  weight: number;
  earned: number;
  ok: boolean;
  detail: string;
}

export interface AeoScore {
  slug: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: AeoCheck[];
  issues: string[];
}

function grade(score: number): AeoScore["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Every ≥3-char token of the phrase appears in the text (search-engine read). */
function phraseIn(haystack: string, phrase: string): boolean {
  const tokens = phrase.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length) return false;
  const h = haystack.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

export function aeoScore(post: BlogPost): AeoScore {
  const checks: AeoCheck[] = [];
  const add = (id: string, label: string, weight: number, earned: number, detail: string) =>
    checks.push({ id, label, weight, earned, ok: earned >= weight, detail });

  const primary = (post.keywords[0] ?? "").toLowerCase();
  const takeaways = post.keyTakeaways ?? [];
  const faq = post.faq ?? [];
  const h2s = post.bodyMarkdown.match(/^##\s+(.+)$/gm)?.map((h) => h.replace(/^##\s+/, "")) ?? [];
  const takeawayText = takeaways.join(" \n ");
  const faqText = faq.map((f) => `${f.q} ${f.a}`).join(" \n ");

  // 1. Key takeaways — the single strongest lift signal. 3–5, each concise
  // enough (≤ 160 chars) to be quoted whole by an answer engine.
  const goodTakeaways = takeaways.filter((t) => t.trim().length > 0 && t.length <= 160).length;
  add(
    "takeaways",
    "Bloc « L'essentiel » (3–5 faits extractibles)",
    25,
    goodTakeaways >= 3 ? 25 : goodTakeaways === 2 ? 14 : goodTakeaways === 1 ? 7 : 0,
    `${goodTakeaways} point(s) concis`,
  );

  // 2. FAQ pairs with concise, answer-first answers (≤ 320 chars) → FAQPage.
  const goodFaq = faq.filter((f) => f.q.trim() && f.a.trim() && f.a.length <= 320).length;
  add(
    "faq",
    "FAQ ≥ 3 paires concises (schema FAQPage)",
    25,
    goodFaq >= 3 ? 25 : goodFaq === 2 ? 14 : goodFaq === 1 ? 7 : 0,
    `${goodFaq} Q/R exploitables`,
  );

  // 3. Description reads as a direct answer: right length + carries the keyword.
  const dl = post.description.length;
  const descAnswer = dl >= 110 && dl <= 160 && !!primary && phraseIn(post.description, primary);
  add(
    "desc-answer",
    "Description = réponse directe (110–160, mot-clé)",
    12,
    descAnswer ? 12 : dl >= 80 && dl <= 160 ? 6 : 0,
    `${dl} car.`,
  );

  // 4. Entity anchoring: the primary keyword appears in a quotable structured
  // part — an H2, a takeaway, or an FAQ question.
  const kwAnchored =
    !!primary &&
    (h2s.some((h) => phraseIn(h, primary)) ||
      takeaways.some((t) => phraseIn(t, primary)) ||
      faq.some((f) => phraseIn(f.q, primary)));
  add("kw-anchored", "Mot-clé dans un titre / point / question", 10, kwAnchored ? 10 : 0, kwAnchored ? "oui" : "non");

  // 5. Question-format content: a question H2, or a real FAQ present.
  const questionFormat = h2s.some((h) => h.includes("?")) || goodFaq >= 1;
  add("question-format", "Contenu en format question", 8, questionFormat ? 8 : 0, questionFormat ? "oui" : "non");

  // 6. Concrete facts: a number (price, delay, %, km) somewhere in the
  // answerable payload — body, takeaways or FAQ. AI engines prefer specifics.
  const hasNumbers = /\d/.test(post.bodyMarkdown + takeawayText + faqText);
  add("concrete-facts", "Faits chiffrés (prix, délai, %…)", 8, hasNumbers ? 8 : 0, hasNumbers ? "oui" : "non");

  // 7. Outbound authority citations (E-E-A-T context signal).
  const cites = post.citations?.length ?? 0;
  add("citations", "≥ 1 citation externe d'autorité", 6, cites >= 1 ? 6 : 0, `${cites} citation(s)`);

  // 8. Freshness signal: an explicit dateModified helps AI trust recency.
  add("freshness", "Date de mise à jour explicite", 6, post.updatedAt ? 6 : 3, post.updatedAt ? "updatedAt" : "publishedAt");

  const total = checks.reduce((s, c) => s + c.weight, 0); // 100
  const earned = checks.reduce((s, c) => s + c.earned, 0);
  const score = Math.round((earned / total) * 100);
  const issues = checks
    .filter((c) => c.earned < c.weight)
    .map((c) => `${c.label} — ${c.detail} (${c.earned}/${c.weight})`);

  return { slug: post.slug, score, grade: grade(score), checks, issues };
}
