import { BudgetMiddleware, type AcuGating, type LedgerSink } from "@nzela/ledger";
import type { BacklinkTarget, BlogPost, SiteConfig } from "./types.js";
import {
  buildLinkGraph,
  DEFAULT_LINKING,
  injectInternalLinks,
  type LinkingOptions,
} from "./linking.js";
import {
  renderArticleSchema,
  renderHeadTags,
  renderRobots,
  renderSitemap,
  validatePost,
} from "./metadata.js";
import { outreachQueue } from "./backlinks.js";

/**
 * SEO autopilot orchestrator. One publish cycle:
 *   1. (LLM, budgeted) draft prose for a target keyword — the ONLY cost.
 *   2. (deterministic) validate metadata,
 *   3. (deterministic) rebuild the whole internal link graph so the new
 *      post links to/from the corpus,
 *   4. (deterministic) render head tags, JSON-LD, refreshed sitemap,
 *   5. (deterministic) queue backlink outreach for the new post.
 * Steps 2–5 cost zero tokens and are what actually compounds rankings.
 */

/** The prose writer — real LLM in prod, injectable for tests. */
export interface DraftWriter {
  /** Returns {markdown, costUsd} for a keyword-targeted draft. */
  write(
    keyword: string,
    lang: BlogPost["lang"],
    budgetUsd: number,
  ): Promise<{ markdown: string; title: string; description: string; costUsd: number }>;
}

export interface PublishInput {
  keyword: string;
  slug: string;
  keywords: string[];
  lang?: BlogPost["lang"];
  publishedAt: string; // ISO — injected (no Date.now in pure core)
}

export interface PublishResult {
  post: BlogPost;
  headHtml: string;
  schemaJson: string;
  bodyWithLinks: string;
  sitemapXml: string;
  robotsTxt: string;
  outreach: BacklinkTarget[];
  /** Metadata problems that blocked or would block indexing. */
  issues: string[];
}

export class SeoAutopilot {
  private readonly budget: BudgetMiddleware;

  constructor(
    private readonly site: SiteConfig,
    private readonly writer: DraftWriter,
    ledger: LedgerSink,
    private readonly linking: LinkingOptions = DEFAULT_LINKING,
    /** ACU gating — the draft call is billed to this account. */
    private readonly acu?: AcuGating,
  ) {
    this.budget = new BudgetMiddleware(ledger, acu);
  }

  /**
   * Publish one post into an existing corpus and return everything the
   * site needs to serve it. `corpus` is the current published set; the
   * returned post should be appended by the caller.
   */
  async publish(
    input: PublishInput,
    corpus: readonly BlogPost[],
    targets: readonly BacklinkTarget[] = [],
  ): Promise<PublishResult> {
    const lang = input.lang ?? "fr";

    // 1. LLM draft — the single budgeted call, with a deterministic
    //    fallback so a provider outage never blocks the pipeline.
    const draft = await this.budget.run(
      "seo",
      { purpose: `draft "${input.keyword}"` },
      async (budgetUsd) => {
        const r = await this.writer.write(input.keyword, lang, budgetUsd);
        return { value: r, costUsd: r.costUsd };
      },
      () => ({
        markdown: `# ${input.keyword}\n\nContenu à venir.`,
        title: input.keyword,
        description: `${input.keyword} — Tunakula, livraison à Kinshasa sur WhatsApp.`,
        costUsd: 0,
      }),
    );

    const post: BlogPost = {
      slug: input.slug,
      title: draft.title,
      description: draft.description,
      keywords: input.keywords.map((k) => k.toLowerCase()),
      publishedAt: input.publishedAt,
      author: this.site.defaultAuthor,
      bodyMarkdown: `${draft.markdown}\n\n[Commander sur WhatsApp](${this.site.waLink})`,
      lang,
    };

    // 2. Validate (deterministic).
    const { issues } = validatePost(post);

    // 3. Rebuild the internal link graph over corpus + new post.
    const all = [...corpus, post];
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    const graph = buildLinkGraph(all, this.linking);
    const bodyWithLinks = injectInternalLinks(
      post,
      graph,
      bySlug,
      this.site.baseUrl,
    );

    // 4. Metadata + sitemap across the whole corpus.
    const alternates = all.filter(
      (p) => p.slug === post.slug && p.lang !== post.lang,
    );
    return {
      post,
      headHtml: renderHeadTags(post, this.site, alternates),
      schemaJson: renderArticleSchema(post, this.site),
      bodyWithLinks,
      sitemapXml: renderSitemap(all, this.site),
      robotsTxt: renderRobots(this.site),
      outreach: outreachQueue(targets, post),
      issues,
    };
  }
}
