import type { Channel, GeneratedContent, GrowthTool, PartnerBrief } from "./types.js";

/**
 * The five LLM generators. Each is a single budgeted call behind the
 * engine's BudgetMiddleware. The Generator port is the seam: a real
 * LLM client in production, a deterministic stub in tests. Every
 * generator has a deterministic fallback so a provider outage degrades
 * to a usable template, never a blank dashboard.
 */

export interface GenerationRequest {
  tool: GrowthTool;
  brief: PartnerBrief;
  channel?: Channel;
  /** Free-text extra instruction from the partner ("mets en avant le prix"). */
  instruction?: string;
  budgetUsd: number;
}

export interface Generator {
  generate(req: GenerationRequest): Promise<GeneratedContent>;
}

/** Deterministic fallback content per tool — no tokens, always shippable. */
export function fallbackContent(
  tool: GrowthTool,
  brief: PartnerBrief,
  channel?: Channel,
): GeneratedContent {
  const dish = brief.highlights[0] ?? "nos plats";
  const cta = `Commande sur WhatsApp: ${brief.waLink}`;
  const map: Record<string, () => Omit<GeneratedContent, "tool" | "costUsd">> = {
    "social-post": () => ({
      channel,
      body: `😋 ${dish} chez ${brief.restaurantName} (${brief.quartier}) — livré chaud sur WhatsApp. ${cta}`,
    }),
    advert: () => ({
      channel,
      title: `${dish} à ${brief.quartier}`,
      body: `Faim? ${brief.restaurantName} te livre ${dish} en 30 min. Paie cash ou mobile money. ${cta}`,
    }),
    "email-campaign": () => ({
      title: `${dish} vous attend chez ${brief.restaurantName}`,
      body: `Bonjour,\n\nEnvie de ${dish}? Commandez chez ${brief.restaurantName} à ${brief.quartier}, livré chaud.\n\n${cta}\n\nÀ bientôt,\n${brief.restaurantName}`,
    }),
    "landing-page": () => ({
      title: `${brief.restaurantName} — livraison à ${brief.quartier}`,
      body: `# ${brief.restaurantName}\n\n${dish}, livré chaud à ${brief.quartier}.\n\n[Commander sur WhatsApp](${brief.waLink})`,
    }),
    "video-script": () => ({
      channel,
      body: `[0-3s] Gros plan ${dish} fumant.\n[3-7s] "${brief.restaurantName}, ${brief.quartier}."\n[7-12s] Le wewa arrive au portail.\n[12-15s] "${cta}"`,
    }),
  };
  const build = map[tool] ?? (() => ({ body: cta }));
  return { tool, costUsd: 0, ...build() };
}
