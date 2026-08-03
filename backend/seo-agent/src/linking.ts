import type { BlogPost, InternalLink } from "./types.js";

/**
 * Dynamic internal-linking engine — the deterministic heart of the SEO
 * system (0 tokens). It builds a relevance graph across all posts from
 * shared keywords, then injects contextual anchor links into each post's
 * body. Every new post automatically links to and from the existing
 * corpus, so link equity flows and grows with the content — the effect
 * the request calls "many dynamic hyperlinks … on autopilot".
 */

export interface LinkingOptions {
  /** Max internal links injected per post (avoid over-optimization). */
  maxLinksPerPost: number;
  /** Minimum shared keywords for two posts to be considered related. */
  minSharedKeywords: number;
}

export const DEFAULT_LINKING: LinkingOptions = {
  maxLinksPerPost: 5,
  minSharedKeywords: 1,
};

const norm = (s: string) => s.toLowerCase().trim();

/** Relevance = count of shared keywords (same locale only). */
export function relatedness(a: BlogPost, b: BlogPost): {
  score: number;
  via: string[];
} {
  if (a.lang !== b.lang) return { score: 0, via: [] };
  const ak = new Set(a.keywords.map(norm));
  const via = [...new Set(b.keywords.map(norm))].filter((k) => ak.has(k));
  return { score: via.length, via };
}

/**
 * Compute the internal link graph over the whole corpus. For each post,
 * pick the most-related other posts (same language), highest relevance
 * first, ties broken by newest — fresh content gets circulated.
 */
export function buildLinkGraph(
  posts: readonly BlogPost[],
  opts: LinkingOptions = DEFAULT_LINKING,
): InternalLink[] {
  const links: InternalLink[] = [];
  for (const from of posts) {
    const candidates = posts
      .filter((p) => p.slug !== from.slug)
      .map((to) => ({ to, ...relatedness(from, to) }))
      .filter((c) => c.score >= opts.minSharedKeywords)
      .sort(
        (x, y) =>
          y.score - x.score ||
          y.to.publishedAt.localeCompare(x.to.publishedAt),
      )
      .slice(0, opts.maxLinksPerPost);
    for (const c of candidates) {
      links.push({
        fromSlug: from.slug,
        toSlug: c.to.slug,
        anchor: c.to.title,
        via: c.via,
      });
    }
  }
  return links;
}

/**
 * Inject the resolved links into a post's Markdown body. The first
 * unlinked mention of a related post's primary keyword becomes an anchor
 * to that post; if no mention exists, a "À lire aussi" block is appended.
 * Idempotent: never double-links an already-linked phrase.
 */
export function injectInternalLinks(
  post: BlogPost,
  links: readonly InternalLink[],
  postsBySlug: ReadonlyMap<string, BlogPost>,
  baseUrl: string,
): string {
  const mine = links.filter((l) => l.fromSlug === post.slug);
  let body = post.bodyMarkdown;
  const appended: InternalLink[] = [];

  for (const link of mine) {
    const target = postsBySlug.get(link.toSlug);
    if (!target) continue;
    const url = `${baseUrl}/blog/${link.toSlug}`;
    const keyword = link.via[0];
    let injected = false;
    if (keyword) {
      // Match the keyword only when NOT already inside a markdown link.
      const re = new RegExp(
        `(?<!\\[)\\b(${escapeRe(keyword)})\\b(?!\\]|\\()`,
        "i",
      );
      if (re.test(body)) {
        body = body.replace(re, `[$1](${url})`);
        injected = true;
      }
    }
    if (!injected) appended.push(link);
  }

  if (appended.length) {
    const label = readAlsoLabel(post.lang);
    const items = appended
      .map((l) => `- [${l.anchor}](${baseUrl}/blog/${l.toSlug})`)
      .join("\n");
    body += `\n\n## ${label}\n\n${items}\n`;
  }
  return body;
}

function readAlsoLabel(lang: BlogPost["lang"]): string {
  return {
    fr: "À lire aussi",
    en: "Read also",
    ar: "اقرأ أيضًا",
    es: "Leer también",
    zh: "延伸阅读",
  }[lang];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Orphan detection — pages nothing links TO waste crawl budget. */
export function findOrphans(
  posts: readonly BlogPost[],
  links: readonly InternalLink[],
): string[] {
  const linkedTo = new Set(links.map((l) => l.toSlug));
  return posts.filter((p) => !linkedTo.has(p.slug)).map((p) => p.slug);
}
