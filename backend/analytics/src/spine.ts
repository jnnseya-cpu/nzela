import type { ConversionEvent, ConversionSink, SinkResult } from "./types.js";

export interface AnalyticsSpineOptions {
  sinks: ConversionSink[];
  /** Optional observer (never given PII — just event name + sink results). */
  logger?: (eventName: string, results: SinkResult[]) => void;
}

/**
 * Fans a conversion to every sink. NEVER throws — analytics must not be able
 * to break the order/payment path. A sink that throws is captured as a
 * failed result, not a rejection.
 */
export class AnalyticsSpine {
  constructor(private readonly opts: AnalyticsSpineOptions) {}

  async emit(event: ConversionEvent): Promise<SinkResult[]> {
    const results = await Promise.all(
      this.opts.sinks.map(async (s) => {
        try {
          return await s.send(event);
        } catch (e) {
          return { sink: s.name, ok: false, error: String(e).slice(0, 200) };
        }
      }),
    );
    try {
      this.opts.logger?.(event.name, results);
    } catch {
      /* logging must never throw either */
    }
    return results;
  }

  get sinkNames(): string[] {
    return this.opts.sinks.map((s) => s.name);
  }
}

/** A sink that does nothing (default injection so callers never null-check). */
export class NoopSink implements ConversionSink {
  readonly name = "noop";
  async send(): Promise<SinkResult> {
    return { sink: this.name, ok: true, skipped: true };
  }
}
