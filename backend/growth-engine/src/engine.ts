import { BudgetMiddleware, type AcuGating, type LedgerSink } from "@nzela/ledger";
import type {
  EngagementRecord,
  GeneratedContent,
  GrowthTool,
  PartnerBrief,
} from "./types.js";
import { fallbackContent, type Generator, type GenerationRequest } from "./generators.js";
import {
  bestPostingTimes,
  campaignAnalytics,
  DETERMINISTIC_TOOLS,
  generateHashtags,
  optimiseAudience,
  performanceRecommendations,
  type CampaignAnalytics,
  type Recommendation,
} from "./analytics.js";

/**
 * Partner Growth Engine facade — the one object the dashboard talks to.
 * LLM generators run behind the ledger BudgetMiddleware (agent "growth");
 * deterministic analytics tools run free and never touch the budget.
 */
export class GrowthEngine {
  private readonly budget: BudgetMiddleware;

  constructor(
    private readonly generator: Generator,
    private readonly ledger: LedgerSink,
    /** ACU gating — partner generators are billed to the partner account. */
    acu?: AcuGating,
  ) {
    this.budget = new BudgetMiddleware(ledger, acu);
  }

  isDeterministic(tool: GrowthTool): boolean {
    return DETERMINISTIC_TOOLS.has(tool);
  }

  /**
   * Run one of the five LLM generators under budget + ACU gate, with
   * fallback. `account` bills the ACU cost (3× resale) to the partner.
   */
  async generate(
    req: Omit<GenerationRequest, "budgetUsd"> & { account?: string },
  ): Promise<GeneratedContent> {
    if (DETERMINISTIC_TOOLS.has(req.tool)) {
      throw new Error(`${req.tool} is a deterministic tool — call its method`);
    }
    return this.budget.run(
      "growth",
      {
        purpose: `${req.tool} for ${req.brief.restaurantName}`,
        account: req.account,
      },
      async (budgetUsd) => {
        const content = await this.generator.generate({ ...req, budgetUsd });
        return { value: content, costUsd: content.costUsd };
      },
      () => fallbackContent(req.tool, req.brief, req.channel),
    );
  }

  // ---- Deterministic tools (0 tokens) ----
  hashtags(brief: PartnerBrief, max?: number): string[] {
    this.logDet("hashtags", brief.restaurantName);
    return generateHashtags(brief, max);
  }
  bestTimes(records: readonly EngagementRecord[]) {
    this.logDet("best-time");
    return bestPostingTimes(records);
  }
  analytics(records: readonly EngagementRecord[]): CampaignAnalytics {
    this.logDet("campaign-analytics");
    return campaignAnalytics(records);
  }
  recommendations(records: readonly EngagementRecord[]): Recommendation[] {
    this.logDet("performance-recos");
    return performanceRecommendations(records);
  }
  audience(records: readonly EngagementRecord[]) {
    this.logDet("audience-optimisation");
    return optimiseAudience(records);
  }

  private logDet(tool: GrowthTool, subject = ""): void {
    this.ledger.write({
      type: "deterministic",
      agent: "growth",
      purpose: `${tool}${subject ? ` (${subject})` : ""}`,
      costUsd: 0,
      at: new Date(),
    });
  }
}
