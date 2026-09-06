import type { BlogPost, SiteConfig } from "./types.js";

/**
 * Deterministic SEO metadata generation (0 tokens): title tags, meta
 * description, canonical, Open Graph, hreflang alternates, JSON-LD
 * Article + Breadcrumb schema, XML sitemap and robots.txt. These are the
 * machine-readable signals search engines actually rank on.
 */

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface MetaValidation {
  ok: boolean;
  issues: string[];
}

/** Guardrails Google actually cares about. */
export function validatePost(post: BlogPost): MetaValidation {
  const issues: string[] = [];
  if (post.title.length < 15 || post.title.length > 60) {
    issues.push(`title length ${post.title.length} (want 15–60)`);
  }
  if (post.description.length < 50 || post.description.length > 160) {
    issues.push(`description length ${post.description.length} (want 50–160)`);
  }
  if (!post.keywords.length) issues.push("no keywords");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    issues.push(`slug not URL-safe: ${post.slug}`);
  }
  return { ok: issues.length === 0, issues };
}

export function canonicalUrl(post: BlogPost, site: SiteConfig): string {
  return `${site.baseUrl}/blog/${post.slug}`;
}

/** <head> tags for a post, ready to inline. */
export function renderHeadTags(
  post: BlogPost,
  site: SiteConfig,
  alternates: readonly BlogPost[] = [],
): string {
  const url = canonicalUrl(post, site);
  const tags = [
    `<title>${esc(post.title)} · ${esc(site.siteName)}</title>`,
    `<meta name="description" content="${esc(post.description)}">`,
    `<meta name="keywords" content="${esc(post.keywords.join(", "))}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(post.title)}">`,
    `<meta property="og:description" content="${esc(post.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="${esc(site.siteName)}">`,
    `<meta property="og:locale" content="${post.lang === "fr" ? "fr_CD" : post.lang}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(post.title)}">`,
    `<meta name="twitter:description" content="${esc(post.description)}">`,
  ];
  if (site.ogImage) {
    tags.push(
      `<meta property="og:image" content="${site.ogImage}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${esc(site.siteName)}">`,
      `<meta name="twitter:image" content="${site.ogImage}">`,
    );
  }
  for (const alt of alternates) {
    tags.push(
      `<link rel="alternate" hreflang="${alt.lang}" href="${canonicalUrl(alt, site)}">`,
    );
  }
  return tags.join("\n");
}

/** JSON-LD Article schema — rich-result eligibility. */
export function renderArticleSchema(post: BlogPost, site: SiteConfig): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    inLanguage: post.lang,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: site.siteName,
      url: site.baseUrl,
    },
    mainEntityOfPage: canonicalUrl(post, site),
    keywords: post.keywords.join(", "),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/** XML sitemap across the corpus — submit to Search Console once. */
export function renderSitemap(
  posts: readonly BlogPost[],
  site: SiteConfig,
): string {
  const urls = posts
    .map(
      (p) =>
        `  <url><loc>${canonicalUrl(p, site)}</loc>` +
        `<lastmod>${(p.updatedAt ?? p.publishedAt).slice(0, 10)}</lastmod>` +
        `<changefreq>weekly</changefreq></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function renderRobots(site: SiteConfig): string {
  return `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`;
}
