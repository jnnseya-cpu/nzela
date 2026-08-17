import type { NewsletterItem } from "./types.js";

/**
 * The feature catalog — the newsletter's content, mirroring the blog corpus
 * (frontend/blog) so each item links to its full post. This is the single
 * list the weekly edition draws from; keep slugs in sync with the blog.
 */
export const FEATURE_CATALOG: NewsletterItem[] = [
  { slug: "commander-nourriture-whatsapp-kinshasa", title: "Commander sur WhatsApp, sans app", blurb: "Écris «Nakolia» et commande en quelques secondes — zéro téléchargement." },
  { slug: "livraison-repas-bandal", title: "Livré chaud à Bandal en 30 min", blurb: "Ton plat préféré à ta porte, chaud, en une trentaine de minutes." },
  { slug: "commander-a-la-voix-lingala-francais", title: "Commande à la voix", blurb: "Un vocal en lingala ou français suffit — la voix, la vraie langue de Kin." },
  { slug: "regle-5-km-plat-chaud", title: "La règle des 5 km", blurb: "On ne livre que tout près, pour que ça arrive chaud." },
  { slug: "adresse-vocale-sans-gps", title: "Adresse Vocale", blurb: "«Après l'église, portail vert» — enregistrée pour toujours, sans GPS." },
  { slug: "payer-mobile-money-mpesa-orange-airtel-africell", title: "Paie par mobile money", blurb: "M-Pesa, Orange, Airtel, Africell — confirmé en 30 secondes." },
  { slug: "payer-cash-a-la-livraison", title: "Paie cash à la livraison", blurb: "Le cash reste roi — ton wewa a la monnaie." },
  { slug: "rembourse-40-secondes-credit-tunakula", title: "Remboursé en 40 secondes", blurb: "Un souci ? Ton argent est en sécurité, crédité instantanément." },
  { slug: "restaurants-gardez-100-du-prix", title: "Restos : gardez 100%", blurb: "Zéro commission sur vos plats. Un seul Android suffit." },
  { slug: "devenir-wewa-70-pourcent", title: "Deviens wewa", blurb: "70% des frais de course, payé tout de suite." },
  { slug: "diaspora-offrir-repas-famille-kinshasa", title: "Diaspora : offre un repas", blurb: "Depuis l'étranger, fais livrer un repas chaud à ta famille à Kin." },
  { slug: "parraine-un-ami-gagne-du-credit", title: "Parraine et gagne", blurb: "Partage ton code — vous gagnez tous les deux du Crédit Tunakula." },
];
