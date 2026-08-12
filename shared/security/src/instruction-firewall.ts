/**
 * Non-human-instruction firewall — blocks messages that are not a human
 * ordering food but an attempt to command the system: prompt injection,
 * automation directives, role-play jailbreaks, system-prompt extraction,
 * or machine-to-machine control strings. Deterministic, 0 tokens, runs
 * before any LLM sees the text (defense that complements the Router's
 * off-topic firewall, FR-A3).
 */

export type InstructionVerdict = "human-ok" | "blocked";

export interface FirewallResult {
  verdict: InstructionVerdict;
  category?:
    | "prompt-injection"
    | "system-extraction"
    | "automation-directive"
    | "jailbreak"
    | "code-injection";
  matched?: string;
}

interface Rule {
  category: NonNullable<FirewallResult["category"]>;
  re: RegExp;
}

const RULES: Rule[] = [
  { category: "prompt-injection", re: /\b(ignore|disregard|forget|override)\b.{0,30}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instruction|prompt|rule|context)/i },
  { category: "prompt-injection", re: /\b(ignorez?|oubliez?|annulez?)\b.{0,30}\b(instructions?|consignes?|r[eè]gles?)\b/i },
  { category: "system-extraction", re: /\b(system|développeur|developer)\s*(prompt|message|instruction)s?\b|\breveal\b.{0,20}\b(prompt|instructions?)\b|\bmontre.{0,15}(prompt|instructions?)/i },
  { category: "jailbreak", re: /\b(you are now|tu es maintenant|act as|agis comme|pretend to be|DAN mode|developer mode|jailbreak|sans restriction|no restrictions?|unfiltered)\b/i },
  { category: "automation-directive", re: /\b(as an ai|en tant qu'?ia|assistant|language model|mod[eè]le de langage)\b.{0,40}\b(you must|tu dois|obey|ob[eé]is|comply)\b/i },
  { category: "automation-directive", re: /<\|?(im_start|im_end|system|assistant|user)\|?>|\[INST\]|\[\/INST\]|```system/i },
  { category: "code-injection", re: /(\bdrop\s+table\b|\bunion\s+select\b|<script[\s>]|javascript:|onerror\s*=|\$\{.*\}|;\s*rm\s+-rf|\.\.\/\.\.\/|\bexec\s*\()/i },
];

export function screenInstruction(text: string): FirewallResult {
  const t = text ?? "";
  for (const rule of RULES) {
    const m = rule.re.exec(t);
    if (m) return { verdict: "blocked", category: rule.category, matched: m[0].slice(0, 60) };
  }
  return { verdict: "human-ok" };
}

/** Canned French redirect for a blocked instruction — same warm voice as
 *  the Router firewall; never echoes the payload back. */
export const INSTRUCTION_BLOCK_REPLY =
  "Maman, ici on prend juste ta commande 😊 Dis-moi un plat — ex. «poulet mayo» — ou touche les boutons.";
