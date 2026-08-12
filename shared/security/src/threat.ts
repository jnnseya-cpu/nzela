/**
 * Deterministic threat detection — the WAF + rate-limit + anomaly core the
 * Sentinelle agent runs at 0 tokens. Catches the common web attack classes
 * (from the hardening review) before any of them reach business logic.
 */

export type ThreatClass =
  | "sql-injection"
  | "xss"
  | "path-traversal"
  | "command-injection"
  | "credential-stuffing"
  | "rate-abuse"
  | "replay"
  | "clean";

export interface ThreatSignal {
  /** Raw request surface to scan: path + query + body + relevant headers. */
  payload: string;
  ip: string;
  /** Failed auth attempts from this IP recently (credential stuffing). */
  authFailuresLastMinute?: number;
  requestsLastMinute?: number;
}

export interface ThreatVerdict {
  threat: ThreatClass;
  severity: "none" | "low" | "medium" | "high" | "critical";
  /** True when the rules are confident; false → escalate to AI triage. */
  confident: boolean;
  detail?: string;
}

const SIGNATURES: { threat: ThreatClass; severity: ThreatVerdict["severity"]; re: RegExp }[] = [
  { threat: "sql-injection", severity: "critical", re: /(\bunion\b.{0,20}\bselect\b|\bor\b\s+1\s*=\s*1|\bdrop\s+table\b|';\s*--|\bexec(\s|\()+xp_)/i },
  { threat: "xss", severity: "high", re: /(<script[\s>]|javascript:|onerror\s*=|onload\s*=|<iframe|<img[^>]+src\s*=\s*["']?j)/i },
  { threat: "path-traversal", severity: "high", re: /(\.\.\/|\.\.\\|%2e%2e%2f|\/etc\/passwd|\/proc\/self)/i },
  { threat: "command-injection", severity: "critical", re: /(;\s*rm\s+-rf|\|\s*nc\s|\$\(.*\)|`.*`|&&\s*curl\s|\bwget\s+http)/i },
];

const RATE_CRITICAL = 300; // req/min from one IP
const STUFFING_THRESHOLD = 5; // failed logins/min

export function detectThreat(signal: ThreatSignal): ThreatVerdict {
  for (const sig of SIGNATURES) {
    const m = sig.re.exec(signal.payload);
    if (m) {
      return { threat: sig.threat, severity: sig.severity, confident: true, detail: m[0].slice(0, 60) };
    }
  }
  if ((signal.authFailuresLastMinute ?? 0) >= STUFFING_THRESHOLD) {
    return {
      threat: "credential-stuffing",
      severity: "high",
      confident: true,
      detail: `${signal.authFailuresLastMinute} failed logins/min from ${signal.ip}`,
    };
  }
  if ((signal.requestsLastMinute ?? 0) >= RATE_CRITICAL) {
    return {
      threat: "rate-abuse",
      severity: "high",
      confident: true,
      detail: `${signal.requestsLastMinute} req/min from ${signal.ip}`,
    };
  }
  return { threat: "clean", severity: "none", confident: true };
}

/** Fixed-window per-key rate limiter (IP or account). Deterministic, in
 *  memory here; Redis-backed in production with the same contract. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if allowed, false if the key is over its limit. `now`
   *  is injected so the limiter stays pure/testable. */
  allow(key: string, now: number): boolean {
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  count(key: string): number {
    return this.hits.get(key)?.count ?? 0;
  }
}
