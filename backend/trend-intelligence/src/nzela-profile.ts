import type { Channel } from "./brief.js";

/**
 * Platform Profile (spec §9, §16) — the host configuration that makes the
 * brand-neutral engine work for one installation. This is the NZELA-OS
 * (Tunakula-Congo) host profile: it is the ONLY place NZELA specifics live;
 * the core services never branch on it (portability rule §14).
 */
export interface PlatformProfile {
  platform_id: string;
  platform_slug: string;
  /** ISO alpha-2 market, e.g. "CD" (DR Congo). */
  default_market: string;
  /** BCP-47 locale, e.g. "fr-CD". */
  default_locale: string;
  allowed_channels: Channel[];
  /** Approved claim id → the exact approved text (the agent gets text via scoped lookup). */
  approved_claims: Record<string, string>;
  prohibited_claims: string[];
  allowed_cta_ids: string[];
  allowed_asset_ids: string[];
  /** Topic vocabulary the installation serves (maps to blog topics/features). */
  topics: string[];
  forbidden_topics: string[];
  /** Per-topic fit/intent 0–100 (profile-verified; §17 — inference may suggest, mapping decides). */
  topic_fit: Record<string, number>;
  topic_intent: Record<string, number>;
  outcome: { conversion: string; denominator: string };
  timezone: string;
}

/**
 * NZELA-OS host profile. Market CD / locale fr-CD, cash-first food delivery in
 * Bandalungwa (Kinshasa). Outcome = a completed, paid order. Approved claims
 * are the brand's real, honest propositions — the only claims an agent may use.
 */
export const NZELA_PROFILE: PlatformProfile = {
  platform_id: "nzela_tunakula",
  platform_slug: "tunakula",
  default_market: "CD",
  default_locale: "fr-CD",
  allowed_channels: ["seo", "organic_social"],
  approved_claims: {
    claim_cash_remise: "Tu paies cash à la remise, quand le sac est dans ta main — pas un franc avant.",
    claim_5km_chaud: "Livré chaud : on ne propose que des restaurants à moins de 5 km.",
    claim_mobile_money: "Mobile money (M-Pesa, Orange, Airtel, Africell) confirmé en moins de 30 secondes.",
    claim_code_retrait: "Code de retrait à 3 chiffres : seul toi peux récupérer ton sac.",
    claim_rembourse_40s: "Remboursé en 40 secondes en Crédit Tunakula en cas de souci.",
    claim_0_commission: "Restaurants partenaires : 0% de commission, vous gardez 100% du prix.",
    claim_wewa_70: "Wewa : 70% des frais de course, payé tout de suite sur les commandes prépayées.",
  },
  prohibited_claims: [
    "délai de livraison garanti",
    "faux avis ou témoignages non vérifiés",
    "service disponible partout à Kinshasa", // 5 km / Bandal only
  ],
  allowed_cta_ids: ["cta_commander_whatsapp", "cta_resto_partenaire"],
  allowed_asset_ids: ["asset_landing", "asset_blog_index"],
  topics: [
    "livraison-whatsapp-kinshasa",
    "plat-chaud-bandal",
    "mobile-money-paiement",
    "code-retrait-securite",
    "diaspora-repas-famille",
    "parrainage-credit",
    "commander-a-la-voix",
  ],
  forbidden_topics: ["politique", "santé/médical", "religion"],
  topic_fit: {
    "livraison-whatsapp-kinshasa": 95,
    "plat-chaud-bandal": 95,
    "mobile-money-paiement": 90,
    "code-retrait-securite": 85,
    "diaspora-repas-famille": 80,
    "parrainage-credit": 80,
    "commander-a-la-voix": 60, // voice is Phase 2 — lower fit until live
  },
  topic_intent: {
    "livraison-whatsapp-kinshasa": 90,
    "plat-chaud-bandal": 90,
    "mobile-money-paiement": 85,
    "code-retrait-securite": 75,
    "diaspora-repas-famille": 80,
    "parrainage-credit": 70,
    "commander-a-la-voix": 60,
  },
  outcome: { conversion: "completed_order", denominator: "eligible_session" },
  timezone: "Africa/Kinshasa",
};
