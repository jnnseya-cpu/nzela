import { FileKV } from "@nzela/persistence";

/**
 * Native measurement (spec §18) — first-party, file-backed, no external
 * analytics tag. Captures eligible page visits and CTA completions per
 * asset/revision/variant, suppresses small cohorts in reports, and counts CTA
 * outcomes as CTA outcomes (downstream orders only if ingested separately).
 * Invisible: it stores aggregate counters, nothing user-facing.
 */

interface Counter {
  eligibleVisits: number;
  ctaOutcomes: number;
}

export interface MeasurementRow {
  assetId: string;
  revision: number;
  variant: string;
  eligibleVisits: number;
  ctaOutcomes: number;
  /** CTA completion rate, or null when the cohort is too small to report. */
  rate: number | null;
  sample: "ok" | "insufficient";
}

export class NativeMeasurement {
  constructor(
    private readonly kv: FileKV,
    private readonly installationId: string,
    /** Minimum eligible visits before a rate is shown (small-cohort suppression). */
    private readonly minCohort = 30,
  ) {}

  private key(assetId: string, revision: number, variant: string): string {
    return `measure:${this.installationId}:${assetId}:${revision}:${variant}`;
  }

  recordVisit(assetId: string, revision: number, variant = "default"): void {
    this.bump(assetId, revision, variant, { eligibleVisits: 1, ctaOutcomes: 0 });
  }
  recordCtaOutcome(assetId: string, revision: number, variant = "default"): void {
    this.bump(assetId, revision, variant, { eligibleVisits: 0, ctaOutcomes: 1 });
  }

  private bump(assetId: string, revision: number, variant: string, delta: Counter): void {
    const k = this.key(assetId, revision, variant);
    const cur = this.kv.get<Counter>(k) ?? { eligibleVisits: 0, ctaOutcomes: 0 };
    this.kv.set(k, { eligibleVisits: cur.eligibleVisits + delta.eligibleVisits, ctaOutcomes: cur.ctaOutcomes + delta.ctaOutcomes });
  }

  /** Report rows for an asset; rates suppressed under the cohort threshold. */
  report(assetId: string): MeasurementRow[] {
    const prefix = `measure:${this.installationId}:${assetId}:`;
    return this.kv.keys()
      .filter((key) => key.startsWith(prefix))
      .map((key) => {
        const parts = key.slice(prefix.length).split(":");
        const revision = Number(parts[0]);
        const variant = parts[1] ?? "default";
        const c = this.kv.get<Counter>(key)!;
        const sample: "ok" | "insufficient" = c.eligibleVisits >= this.minCohort ? "ok" : "insufficient";
        const rate = sample === "ok" && c.eligibleVisits > 0 ? c.ctaOutcomes / c.eligibleVisits : null;
        return { assetId, revision, variant, eligibleVisits: c.eligibleVisits, ctaOutcomes: c.ctaOutcomes, rate, sample };
      })
      .sort((a, b) => a.revision - b.revision);
  }
}
