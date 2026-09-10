/**
 * SEO Agent (agent #9) content model. The agent writes prose once (one
 * budgeted LLM call); everything that actually moves SEO rankings — the
 * internal link graph, structured data, sitemap, meta tags — is
 * deterministic and runs at zero tokens on autopilot.
 */

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description; ≤ 160 chars enforced by validation. */
  description: string;
  /** Primary + secondary keywords, lower-cased, drive internal linking. */
  keywords: string[];
  /** ISO date; used for sitemap lastmod and Article schema. */
  publishedAt: string;
  updatedAt?: string;
  author: string;
  /** Body in Markdown (from the LLM), pre internal-link injection. */
  bodyMarkdown: string;
  /** Locale of this post (fr default; en/ar/es/zh for reach). */
  lang: "fr" | "en" | "ar" | "es" | "zh";
  /** Curated outbound authority links (context, not manipulation). */
  citations?: OutboundLink[];
  /**
   * Answer-first key takeaways (the "L'essentiel" / TL;DR block). 3–5 short,
   * self-contained facts an AI answer engine can quote verbatim. This is the
   * single biggest GEO/AEO signal: generative engines (ChatGPT, Perplexity,
   * Google AI Overviews) lift concise, standalone statements, not prose.
   */
  keyTakeaways?: string[];
  /**
   * FAQ pairs → a visible FAQ section AND FAQPage structured data. Powers
   * Google "People Also Ask", voice answers, and AI-engine citations.
   */
  faq?: FaqItem[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface OutboundLink {
  url: string;
  anchor: string;
  /** rel policy — external refs default to nofollow unless a partner. */
  rel?: "nofollow" | "noopener" | "sponsored" | "";
}

/** A resolved internal link between two posts. */
export interface InternalLink {
  fromSlug: string;
  toSlug: string;
  anchor: string;
  /** Shared keywords that justified the link (relevance signal). */
  via: string[];
}

/** An external site we want a backlink FROM (outreach pipeline). */
export interface BacklinkTarget {
  domain: string;
  contactUrl?: string;
  /** Domain authority estimate 0-100, for prioritization. */
  authority: number;
  /** Topical fit tags to match against post keywords. */
  topics: string[];
  status: "prospect" | "contacted" | "live" | "declined";
  /** The live backlink URL once earned. */
  liveUrl?: string;
}

export interface SiteConfig {
  baseUrl: string;
  siteName: string;
  defaultAuthor: string;
  /** wa.me deep link used as the conversion CTA in every post. */
  waLink: string;
  /** Absolute URL of the social share image (1200×630). Optional. */
  ogImage?: string;
}
