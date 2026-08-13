/**
 * Acquisition funnel & viral analytics — deterministic (0 tokens). Tells
 * you, from your own data, whether growth is actually happening and where
 * it leaks: the metrics that answer "why no customers" with numbers, and
 * the targeting for win-back re-engagement.
 */

export interface FunnelCounts {
  /** People who opened the WhatsApp chat / landing (top of funnel). */
  reached: number;
  /** Started building a cart. */
  startedOrder: number;
  /** Confirmed the récap. */
  confirmedOrder: number;
  /** Paid (mobile money matched or cash committed). */
  paid: number;
  /** Delivered + closed the loop. */
  delivered: number;
}

export interface FunnelReport extends FunnelCounts {
  reachToStart: number;
  startToConfirm: number;
  confirmToPaid: number;
  paidToDelivered: number;
  overallConversion: number;
  /** The single worst drop-off stage — where to focus next. */
  biggestLeak: keyof Omit<FunnelReport, keyof FunnelCounts | "biggestLeak">;
}

const rate = (num: number, den: number) => (den > 0 ? num / den : 0);

export function analyseFunnel(c: FunnelCounts): FunnelReport {
  const stages = {
    reachToStart: rate(c.startedOrder, c.reached),
    startToConfirm: rate(c.confirmedOrder, c.startedOrder),
    confirmToPaid: rate(c.paid, c.confirmedOrder),
    paidToDelivered: rate(c.delivered, c.paid),
  };
  const biggestLeak = (Object.entries(stages).sort(
    (a, b) => a[1] - b[1],
  )[0]?.[0] ?? "reachToStart") as FunnelReport["biggestLeak"];
  return {
    ...c,
    ...stages,
    overallConversion: rate(c.delivered, c.reached),
    biggestLeak,
  };
}

/**
 * Viral coefficient (k-factor): invites sent per customer × conversion of
 * those invites. k ≥ 1 means self-sustaining organic growth; below 1 you
 * must keep feeding the top of funnel.
 */
export function viralCoefficient(
  customers: number,
  invitesSent: number,
  invitesConverted: number,
): { invitesPerCustomer: number; inviteConversion: number; k: number } {
  const invitesPerCustomer = rate(invitesSent, customers);
  const inviteConversion = rate(invitesConverted, invitesSent);
  return { invitesPerCustomer, inviteConversion, k: invitesPerCustomer * inviteConversion };
}

// ---- Win-back targeting ----
export interface CustomerActivity {
  waId: string;
  lastOrderDaysAgo: number;
  totalOrders: number;
  creditBalanceFc: number;
}

export type WinBackTier = "active" | "cooling" | "lapsing" | "churned";

export function classifyLifecycle(a: CustomerActivity): WinBackTier {
  if (a.lastOrderDaysAgo <= 14) return "active";
  if (a.lastOrderDaysAgo <= 30) return "cooling";
  if (a.lastOrderDaysAgo <= 60) return "lapsing";
  return "churned";
}

/** Deterministic win-back list: who to re-engage, in priority order
 *  (most valuable, most recoverable first). Excludes active users. */
export function winBackTargets(
  customers: readonly CustomerActivity[],
): { waId: string; tier: WinBackTier; priority: number }[] {
  return customers
    .map((c) => ({ waId: c.waId, tier: classifyLifecycle(c), c }))
    .filter((x) => x.tier !== "active")
    .map((x) => ({
      waId: x.waId,
      tier: x.tier,
      // Priority: higher order history + credit sitting unused + not too
      // far gone = most worth a nudge.
      priority:
        x.c.totalOrders * 2 +
        (x.c.creditBalanceFc > 0 ? 5 : 0) +
        (x.tier === "cooling" ? 4 : x.tier === "lapsing" ? 2 : 0),
    }))
    .sort((a, b) => b.priority - a.priority);
}
