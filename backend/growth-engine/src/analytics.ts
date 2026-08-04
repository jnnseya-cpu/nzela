import type {
  Channel,
  EngagementRecord,
  GrowthTool,
  Lang,
  PartnerBrief,
} from "./types.js";

/**
 * The five deterministic growth tools (0 tokens). Every one is math on the
 * partner's own engagement data or keyword expansion — no LLM needed, so
 * they run free and instantly in the dashboard.
 */

// ---- Tool: hashtag generator ----
const BASE_TAGS: Record<Lang, string[]> = {
  fr: ["kinshasa", "bandal", "cuisinecongolaise", "livraison", "foodkin", "rdc", "tunakula", "mangeraukin"],
  en: ["kinshasa", "congofood", "delivery", "foodie", "drc", "tunakula"],
  ar: ["كينشاسا", "توصيل", "طعام", "الكونغو"],
  es: ["kinshasa", "comidacongolena", "delivery", "rdc"],
  zh: ["金沙萨", "外卖", "刚果美食"],
};

/** Deterministic: dish/quartier keywords + locale base tags, deduped,
 *  cleaned to valid hashtag tokens, capped. */
export function generateHashtags(brief: PartnerBrief, max = 12): string[] {
  const fromBrief = [
    brief.restaurantName,
    brief.quartier,
    ...brief.highlights,
  ].flatMap((s) => s.split(/\s+/));
  const clean = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ一-鿿]/g, "");
  const tags = [...fromBrief.map(clean), ...BASE_TAGS[brief.lang]]
    .filter((t) => t.length >= 3);
  return [...new Set(tags)].slice(0, max).map((t) => `#${t}`);
}

// ---- Tool: best posting time ----
export interface TimeSlot {
  /** 0=Sunday..6=Saturday */
  weekday: number;
  /** 0..23 local hour */
  hour: number;
  /** Orders-per-impression score that ranked this slot. */
  score: number;
  sampleSize: number;
}

/** Deterministic: rank (weekday,hour) slots by conversion (orders per
 *  impression), requiring a minimum sample so noise can't win. */
export function bestPostingTimes(
  records: readonly EngagementRecord[],
  opts: { top?: number; minSample?: number } = {},
): TimeSlot[] {
  const top = opts.top ?? 3;
  const minSample = opts.minSample ?? 1;
  const buckets = new Map<string, { imp: number; ord: number; n: number }>();
  for (const r of records) {
    const d = parseIso(r.postedAt);
    const key = `${d.weekday}:${d.hour}`;
    const b = buckets.get(key) ?? { imp: 0, ord: 0, n: 0 };
    b.imp += r.impressions;
    b.ord += r.orders;
    b.n += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .filter(([, b]) => b.n >= minSample && b.imp > 0)
    .map(([key, b]) => {
      const [weekday, hour] = key.split(":").map(Number);
      return { weekday: weekday!, hour: hour!, score: b.ord / b.imp, sampleSize: b.n };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

// ---- Tool: campaign analytics ----
export interface CampaignAnalytics {
  impressions: number;
  clicks: number;
  orders: number;
  spendUsd: number;
  ctr: number; // clicks / impressions
  conversionRate: number; // orders / clicks
  costPerOrderUsd: number; // spend / orders (Infinity if 0 orders)
  byChannel: Record<string, { orders: number; spendUsd: number; costPerOrderUsd: number }>;
}

/** Deterministic aggregation across all engagement records. */
export function campaignAnalytics(
  records: readonly EngagementRecord[],
): CampaignAnalytics {
  const sum = (f: (r: EngagementRecord) => number) =>
    records.reduce((s, r) => s + f(r), 0);
  const impressions = sum((r) => r.impressions);
  const clicks = sum((r) => r.clicks);
  const orders = sum((r) => r.orders);
  const spendUsd = sum((r) => r.spendUsd);
  const byChannel: CampaignAnalytics["byChannel"] = {};
  for (const r of records) {
    const c = (byChannel[r.channel] ??= { orders: 0, spendUsd: 0, costPerOrderUsd: 0 });
    c.orders += r.orders;
    c.spendUsd += r.spendUsd;
  }
  for (const c of Object.values(byChannel)) {
    c.costPerOrderUsd = c.orders ? c.spendUsd / c.orders : Infinity;
  }
  return {
    impressions,
    clicks,
    orders,
    spendUsd,
    ctr: impressions ? clicks / impressions : 0,
    conversionRate: clicks ? orders / clicks : 0,
    costPerOrderUsd: orders ? spendUsd / orders : Infinity,
    byChannel,
  };
}

// ---- Tool: performance recommendations ----
export interface Recommendation {
  severity: "info" | "warn" | "action";
  message: string;
}

/** Deterministic rules over the analytics — no LLM, fully explainable. */
export function performanceRecommendations(
  records: readonly EngagementRecord[],
  targetCostPerOrderUsd = 0.5,
): Recommendation[] {
  const a = campaignAnalytics(records);
  const recos: Recommendation[] = [];
  if (a.orders === 0) {
    recos.push({ severity: "action", message: "Aucune commande attribuée — vérifie que tes liens wa.me sont bien taggés." });
    return recos;
  }
  if (a.ctr < 0.01) {
    recos.push({ severity: "warn", message: `Taux de clic faible (${(a.ctr * 100).toFixed(1)}%) — teste des photos de plats plus appétissantes.` });
  }
  if (a.conversionRate < 0.05) {
    recos.push({ severity: "warn", message: `Peu de clics convertissent (${(a.conversionRate * 100).toFixed(1)}%) — rends l'offre plus claire dès le premier message.` });
  }
  const worst = Object.entries(a.byChannel)
    .filter(([, c]) => Number.isFinite(c.costPerOrderUsd))
    .sort((x, y) => y[1].costPerOrderUsd - x[1].costPerOrderUsd)[0];
  if (worst && worst[1].costPerOrderUsd > targetCostPerOrderUsd) {
    recos.push({ severity: "action", message: `${worst[0]} coûte $${worst[1].costPerOrderUsd.toFixed(2)}/commande (cible $${targetCostPerOrderUsd}). Réalloue le budget vers ton meilleur canal.` });
  }
  const best = Object.entries(a.byChannel)
    .filter(([, c]) => c.orders > 0)
    .sort((x, y) => x[1].costPerOrderUsd - y[1].costPerOrderUsd)[0];
  if (best) {
    recos.push({ severity: "info", message: `Ton meilleur canal est ${best[0]} à $${best[1].costPerOrderUsd.toFixed(2)}/commande — mets-y plus.` });
  }
  return recos;
}

// ---- Tool: audience optimisation ----
export interface AudienceSuggestion {
  channel: Channel;
  bestSlot?: TimeSlot;
  recommendedShare: number; // 0..1 budget share
}

/** Deterministic: split budget toward channels with the lowest cost per
 *  order, and attach each channel's best posting slot. */
export function optimiseAudience(
  records: readonly EngagementRecord[],
): AudienceSuggestion[] {
  const a = campaignAnalytics(records);
  const channels = Object.entries(a.byChannel).filter(([, c]) => c.orders > 0);
  if (!channels.length) return [];
  // Weight = orders per dollar (return on spend). A spend floor keeps
  // free channels (e.g. WhatsApp Status, $0) at a high but FINITE weight
  // so shares stay well-defined and sum to 1.
  const SPEND_FLOOR = 0.5;
  const weights = channels.map(([ch, c]) => ({
    ch: ch as Channel,
    w: c.orders / Math.max(c.spendUsd, SPEND_FLOOR),
  }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  return weights.map(({ ch, w }) => ({
    channel: ch,
    recommendedShare: w / total,
    bestSlot: bestPostingTimes(records.filter((r) => r.channel === ch), { top: 1 })[0],
  }));
}

/** Which tools are deterministic (free) vs LLM (budgeted) — drives the UI. */
export const DETERMINISTIC_TOOLS: ReadonlySet<GrowthTool> = new Set([
  "hashtags",
  "best-time",
  "performance-recos",
  "audience-optimisation",
  "campaign-analytics",
]);

function parseIso(iso: string): { weekday: number; hour: number } {
  // Pure parse (no Date.now / timezone surprises): expect
  // YYYY-MM-DDTHH:mm local. Compute weekday via Zeller-free Date in UTC
  // on the date part only, which is deterministic for a fixed string.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(iso);
  if (!m) return { weekday: 0, hour: 0 };
  const [, y, mo, d, h] = m.map(Number) as [number, number, number, number, number, number];
  const weekday = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay();
  return { weekday, hour: h! };
}
