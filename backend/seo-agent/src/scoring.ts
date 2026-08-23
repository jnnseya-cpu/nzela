/**
 * Deterministic on-page SEO score (0 tokens). Grades a post 0–100 across the
 * concrete on-page factors that actually move rankings, with a transparent
 * per-check breakdown so the writer knows exactly what to fix. This is the
 * quality metric the SEO agent reports at every build — not an LLM guess.
 */
import type { BlogPost } from "./types.js";

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  /** Points this check contributes to the 100-point scale. */
  weight: number;
  /** Points actually earned (weight, a fraction, or 0). */
  earned: number;
  detail: string;
}

export interface SeoScore {
  slug: string;
  /** 0–100. */
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: SeoCheck[];
  /** Human-readable issues for anything not fully earned. */
  issues: string[];
}

export interface SeoScoreContext {
  /** Internal links pointing OUT from this post (from the link graph). */
  internalLinksOut?: number;
}

/** Strip markdown to plain text for word/keyword analysis. */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

/**
 * Keyword presence, token-based: every meaningful word (≥3 chars) of the
 * keyword phrase appears in the text. Matches how search engines read a
 * phrase — the words need not be contiguous ("commander … nourriture …
 * whatsapp" counts).
 */
function containsKeyword(haystack: string, keyword: string): boolean {
  const tokens = keyword.split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length) return false;
  return tokens.every((t) => haystack.includes(t));
}

function grade(score: number): SeoScore["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Score a post. Weights sum to 100. Each check earns its full weight when it
 * passes, partial credit where a range applies, 0 when it fails.
 */
export function seoScore(post: BlogPost, ctx: SeoScoreContext = {}): SeoScore {
  const primary = (post.keywords[0] ?? "").toLowerCase();
  const body = plainText(post.bodyMarkdown).toLowerCase();
  const words = wordCount(plainText(post.bodyMarkdown));
  const h2Count = (post.bodyMarkdown.match(/^##\s+/gm) ?? []).length;
  const titleLc = post.title.toLowerCase();
  const descLc = post.description.toLowerCase();
  const linksOut = ctx.internalLinksOut ?? 0;

  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, weight: number, earned: number, detail: string) =>
    checks.push({ id, label, weight, earned, ok: earned >= weight, detail });

  // Title length 30–60 ideal; 15–29 partial.
  const tl = post.title.length;
  add(
    "title-length",
    "Titre 30–60 caractères",
    15,
    tl >= 30 && tl <= 60 ? 15 : tl >= 15 && tl <= 70 ? 8 : 0,
    `titre = ${tl} car.`,
  );

  // Meta description 120–160 ideal; 50–119 partial.
  const dl = post.description.length;
  add(
    "desc-length",
    "Meta description 120–160",
    12,
    dl >= 120 && dl <= 160 ? 12 : dl >= 50 && dl <= 160 ? 7 : 0,
    `description = ${dl} car.`,
  );

  // Primary keyword present in title.
  add(
    "kw-in-title",
    "Mot-clé principal dans le titre",
    15,
    primary && containsKeyword(titleLc, primary) ? 15 : 0,
    primary ? `« ${primary} »` : "aucun mot-clé",
  );

  // Primary keyword in meta description.
  add(
    "kw-in-desc",
    "Mot-clé principal dans la description",
    10,
    primary && containsKeyword(descLc, primary) ? 10 : 0,
    primary ? `« ${primary} »` : "aucun mot-clé",
  );

  // Primary keyword in the first 100 words of the body.
  const intro = body.split(/\s+/).slice(0, 100).join(" ");
  add(
    "kw-in-intro",
    "Mot-clé dans l'introduction",
    10,
    primary && containsKeyword(intro, primary) ? 10 : 0,
    primary ? `« ${primary} »` : "aucun mot-clé",
  );

  // Word count ≥ 300 ideal; 150–299 partial.
  add(
    "word-count",
    "Contenu ≥ 300 mots",
    13,
    words >= 300 ? 13 : words >= 150 ? 7 : 0,
    `${words} mots`,
  );

  // At least 2 H2 headings for structure.
  add(
    "headings",
    "≥ 2 sous-titres (H2)",
    10,
    h2Count >= 2 ? 10 : h2Count === 1 ? 5 : 0,
    `${h2Count} H2`,
  );

  // Internal links out (link-graph relevance).
  add(
    "internal-links",
    "≥ 2 liens internes",
    8,
    linksOut >= 2 ? 8 : linksOut === 1 ? 4 : 0,
    `${linksOut} lien(s) interne(s)`,
  );

  // Keyword set not empty and not stuffed (2–8).
  const kw = post.keywords.length;
  add(
    "keyword-set",
    "2–8 mots-clés (ni vide, ni bourrage)",
    4,
    kw >= 2 && kw <= 8 ? 4 : kw === 1 || (kw > 8 && kw <= 12) ? 2 : 0,
    `${kw} mots-clés`,
  );

  // Clean, URL-safe slug ≤ 60 chars.
  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) && post.slug.length <= 60;
  add("slug", "Slug propre et court", 3, slugOk ? 3 : 0, post.slug);

  const total = checks.reduce((s, c) => s + c.weight, 0); // 100
  const earned = checks.reduce((s, c) => s + c.earned, 0);
  const score = Math.round((earned / total) * 100);
  const issues = checks
    .filter((c) => c.earned < c.weight)
    .map((c) => `${c.label} — ${c.detail} (${c.earned}/${c.weight})`);

  return { slug: post.slug, score, grade: grade(score), checks, issues };
}
