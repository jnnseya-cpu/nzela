/**
 * Humanity gate — only humans sign up and log in, on every surface.
 *
 * No single signal proves humanity, so this scores several deterministic
 * signals into a verdict: allow / challenge / block. It is designed to sit
 * in FRONT of every auth and section-entry route. The WhatsApp-native
 * architecture already makes NZELA strongly sybil-resistant (a real SIM
 * plus a real payment gate every account) — this gate hardens the web
 * surfaces (ops console, partner dashboard, entry page) on top of that.
 */

export interface HumanitySignals {
  /** ms between form render and submit. Bots submit in <300ms; humans
   *  take seconds. Missing = suspicious. */
  formFillMs?: number;
  /** A hidden honeypot field. Any value means an automated filler. */
  honeypotFilled: boolean;
  /** Did the client emit real pointer/keyboard/touch events? */
  hadInteraction: boolean;
  /** Requests from this IP in the last minute (rate signal). */
  ipRequestsLastMinute: number;
  /** User-Agent string, checked against automation signatures. */
  userAgent: string;
  /** Result of an attestation/CAPTCHA challenge, if one was issued. */
  challengePassed?: boolean;
  /** WhatsApp-verified E.164 (a real SIM already received our code). */
  waVerifiedPhone?: string;
}

export type HumanityVerdict = "allow" | "challenge" | "block";

export interface HumanityResult {
  verdict: HumanityVerdict;
  score: number; // 0 (bot) .. 100 (human)
  reasons: string[];
}

/** Known automation/bot User-Agent signatures. */
const BOT_UA =
  /(bot|crawler|spider|headless|phantom|selenium|playwright|puppeteer|curl|wget|python-requests|axios|go-http|scrapy|http-client)/i;

const RATE_BLOCK = 60; // >60 req/min from one IP on an auth route = abuse
const RATE_WARN = 20;

export function assessHumanity(signals: HumanitySignals): HumanityResult {
  const reasons: string[] = [];
  let score = 60; // neutral start

  // Hard bot tells → immediate block.
  if (signals.honeypotFilled) {
    return { verdict: "block", score: 0, reasons: ["honeypot filled"] };
  }
  if (BOT_UA.test(signals.userAgent)) {
    return { verdict: "block", score: 0, reasons: ["automation user-agent"] };
  }
  if (signals.ipRequestsLastMinute > RATE_BLOCK) {
    return {
      verdict: "block",
      score: 0,
      reasons: [`rate ${signals.ipRequestsLastMinute}/min`],
    };
  }

  // Strong positive: a real WhatsApp-verified SIM already answered our OTP.
  if (signals.waVerifiedPhone) {
    score += 30;
    reasons.push("whatsapp-verified phone");
  }
  if (signals.challengePassed) {
    score += 25;
    reasons.push("challenge passed");
  }
  if (signals.hadInteraction) score += 10;
  else {
    score -= 20;
    reasons.push("no human interaction events");
  }

  // Timing: too fast is robotic; a human-plausible window is a positive.
  if (signals.formFillMs !== undefined) {
    if (signals.formFillMs < 300) {
      score -= 30;
      reasons.push("submitted too fast");
    } else if (signals.formFillMs >= 1000 && signals.formFillMs < 600_000) {
      score += 10;
    }
  } else {
    score -= 10;
    reasons.push("no timing signal");
  }

  if (signals.ipRequestsLastMinute > RATE_WARN) {
    score -= 15;
    reasons.push("elevated request rate");
  }

  score = Math.max(0, Math.min(100, score));
  const verdict: HumanityVerdict =
    score >= 70 ? "allow" : score >= 40 ? "challenge" : "block";
  return { verdict, score, reasons };
}
