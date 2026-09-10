import type { BlogPost, FaqItem, SiteConfig } from "./types.js";

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

/** Word count of the body (markdown stripped) — an Article richness signal. */
function bodyWordCount(md: string): number {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** JSON-LD Article schema — rich-result eligibility, enriched for AI engines. */
export function renderArticleSchema(post: BlogPost, site: SiteConfig): string {
  const url = canonicalUrl(post, site);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    inLanguage: post.lang,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: post.author, url: site.baseUrl },
    publisher: {
      "@type": "Organization",
      name: site.siteName,
      url: site.baseUrl,
      ...(site.ogImage ? { logo: { "@type": "ImageObject", url: site.ogImage } } : {}),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.keywords,
    articleSection: cap(post.keywords[0] ?? ""),
    wordCount: bodyWordCount(post.bodyMarkdown),
    isAccessibleForFree: true,
  };
  if (site.ogImage) {
    schema.image = {
      "@type": "ImageObject",
      url: site.ogImage,
      width: 1200,
      height: 630,
    };
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/**
 * FAQPage schema from a post's FAQ. This is the highest-leverage GEO/AEO
 * signal after key-takeaways: it feeds Google "People Also Ask", voice
 * answers, and AI-engine citations with pre-parsed question→answer pairs.
 * Returns "" when the post carries no FAQ.
 */
export function renderFaqSchema(faq: readonly FaqItem[] | undefined): string {
  if (!faq || !faq.length) return "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/** BreadcrumbList schema — Accueil › Blog › <post>. Crawl clarity + SERP UI. */
export function renderBreadcrumbSchema(post: BlogPost, site: SiteConfig): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: site.baseUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${site.baseUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: canonicalUrl(post, site) },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/**
 * Speakable schema — points voice assistants / AI readers at the parts of the
 * page worth reading aloud (the takeaways block and the FAQ). Pure GEO signal.
 */
export function renderSpeakableSchema(post: BlogPost, site: SiteConfig): string {
  const parts: string[] = [];
  if (post.keyTakeaways?.length) parts.push(".tk-essentiel");
  if (post.faq?.length) parts.push(".tk-faq");
  if (!parts.length) return "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": canonicalUrl(post, site),
    speakable: { "@type": "SpeakableSpecification", cssSelector: parts },
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

/** Organization + WebSite schema for the site (emit on the blog index). */
export function renderSiteSchema(site: SiteConfig): string {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.siteName,
    url: site.baseUrl,
    ...(site.ogImage ? { logo: site.ogImage } : {}),
    areaServed: { "@type": "City", name: "Kinshasa" },
    sameAs: [] as string[],
  };
  const web = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.siteName,
    url: site.baseUrl,
    inLanguage: "fr",
  };
  return (
    `<script type="application/ld+json">${JSON.stringify(org)}</script>\n` +
    `<script type="application/ld+json">${JSON.stringify(web)}</script>`
  );
}

/**
 * Every structured-data block a post should carry, in one call: Article,
 * Breadcrumb, FAQPage (if any), Speakable (if any). Order is irrelevant to
 * parsers; kept stable for diff-friendliness.
 */
export function renderAllSchema(post: BlogPost, site: SiteConfig): string {
  return [
    renderArticleSchema(post, site),
    renderBreadcrumbSchema(post, site),
    renderFaqSchema(post.faq),
    renderSpeakableSchema(post, site),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * llms.txt — the emerging convention (llmstxt.org) that tells AI crawlers
 * what the site is and lists its canonical, quotable pages. A cheap, direct
 * lever for AI-engine discovery and citation.
 */
export function renderLlmsTxt(
  posts: readonly BlogPost[],
  site: SiteConfig,
  tagline: string,
): string {
  const lines = [
    `# ${site.siteName}`,
    "",
    `> ${tagline}`,
    "",
    "## Blog",
    "",
    ...posts.map((p) => `- [${p.title}](${canonicalUrl(p, site)}): ${p.description}`),
    "",
  ];
  return lines.join("\n");
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
