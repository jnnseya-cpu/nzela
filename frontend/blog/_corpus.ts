import type { BlogPost } from "/home/user/nzela/backend/seo-agent/src/types.ts";

const AUTHOR = "Tunakula-Congo";
const D = "2026-08-13";

/** One post per feature/function — French, SEO-targeted, cross-linked by
 *  shared keywords so the engine builds a dense internal link graph.
 *  Each body is ≥ 300 words with ≥ 2 sous-titres and the primary keyword in
 *  the introduction (see backend/seo-agent scoring). */
export const CORPUS: BlogPost[] = [
  {
    slug: "commander-nourriture-whatsapp-kinshasa",
    title: "Commander de la nourriture sur WhatsApp à Kinshasa",
    description: "Commande ton repas sur WhatsApp à Kinshasa — sans application, sans carte, livré chaud. Écris «Nakolia» et Mama Tunakula s'occupe de tout.",
    keywords: ["whatsapp", "kinshasa", "commander", "livraison", "sans app"],
    keyTakeaways: [
      "Sur WhatsApp, tu commandes ton repas à Kinshasa sans installer aucune application.",
      "Écris «Nakolia» ou «menu» à Mama Tunakula pour voir les restaurants ouverts près de toi.",
      "Tu peux commander à la voix en lingala ou en français, sans rien taper.",
      "Tu paies cash, mobile money ou carte, et tu donnes ton adresse par repères, sans GPS.",
    ],
    faq: [
      { q: "Faut-il télécharger une application pour commander ?", a: "Non, tout se passe sur WhatsApp, l'appli que tu utilises déjà. Zéro téléchargement, zéro mémoire prise, zéro carte bancaire obligatoire." },
      { q: "Comment je lance ma commande ?", a: "Écris simplement «Nakolia» ou «menu» à Mama Tunakula. Elle te propose les restaurants ouverts près de toi avec leurs plats et prix clairs." },
      { q: "Comment payer et donner mon adresse ?", a: "Tu paies cash à la livraison, par mobile money (M-Pesa, Orange, Airtel, Africell) ou par carte. Tu donnes ton adresse par repères, du style «après l'église, portail vert», sans aucune coordonnée GPS." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Commander de la nourriture sur WhatsApp à Kinshasa

À Kinshasa, tu n'as plus besoin d'installer une application pour bien manger. Avec Tunakula, tout se passe sur **WhatsApp**, l'appli que tu utilises déjà tous les jours. Zéro téléchargement, zéro mémoire prise sur ton téléphone, zéro carte bancaire obligatoire. Tu écris, tu choisis, tu manges.

## Comment ça marche, étape par étape

Écris simplement **«Nakolia»** ou «menu» à Mama Tunakula. Elle te propose les restaurants ouverts près de toi, avec leurs plats et leurs prix clairs. Tu choisis ton plat, tu confirmes la quantité, et tu valides — le tout dans ta conversation WhatsApp habituelle, sans quitter l'appli.

Tu peux même **commander à la voix** en lingala ou en français : envoie un message vocal comme «deux poulets mayo et un jus de gingembre» et ta commande est comprise en un instant. Pas besoin de taper, pas besoin d'épeler.

## Pourquoi c'est fait pour Kinshasa

Les applis classiques supposent des smartphones pleins de mémoire, de la data pas chère et des adresses GPS précises. Kinshasa fonctionne autrement — et Tunakula aussi. Tu donnes ton adresse par repères («après l'église, portail vert»), tu paies **cash, mobile money ou carte**, et tu te fais **livrer à Bandal** ou dans ton quartier sans jamais taper une coordonnée GPS.

## Ce que tu gagnes

Tu gagnes du temps, tu économises ta data, et tu manges chaud. Chaque commande est suivie par des messages simples : acceptée, en cuisine, ton wewa arrive. Si un souci arrive, ton argent est protégé et tu es remboursé vite. C'est la livraison pensée pour la vraie vie kinoise. Et parce que tout reste dans WhatsApp, tu retrouves l'historique de tes commandes, tu recommandes ton plat préféré en un seul message, et tu peux même partager une adresse à un proche sans rien réinstaller ni recopier.

Prêt à commander ta nourriture sur WhatsApp à Kinshasa ? Écris à Mama Tunakula, c'est parti.`,
  },
  {
    slug: "livraison-repas-bandal",
    title: "Livraison de repas à Bandal en 30 minutes",
    description: "Livraison de repas rapide à Bandal, Kinshasa : commande sur WhatsApp, paie comme tu veux, reçois ton plat chaud au portail en 30 minutes.",
    keywords: ["bandal", "livraison", "kinshasa", "commander", "wewa"],
    keyTakeaways: [
      "À Bandal, Tunakula livre ton plat chaud en une trentaine de minutes, commandé sur WhatsApp.",
      "On ne propose que des restaurants à moins de 5 km pour que ton plat arrive chaud.",
      "Tu paies cash à la livraison, par mobile money ou par carte, montant affiché avant de confirmer.",
      "Ton wewa vérifie la commande avec un code de retrait pour que personne d'autre ne prenne ton sac.",
    ],
    faq: [
      { q: "En combien de temps je suis livré à Bandal ?", a: "En une trentaine de minutes. Comme on ne propose que des restaurants à moins de 5 km, ton plat fait peu de route et arrive chaud malgré les embouteillages." },
      { q: "Et quand il pleut à Bandal ?", a: "Quand il pleut, on resserre encore le rayon de livraison pour garder la qualité du plat et la sécurité du wewa. Ton repas reste chaud et ton livreur ne prend pas de risque inutile." },
      { q: "Comment je sais que c'est bien mon sac qui m'est remis ?", a: "Ton wewa vérifie ta commande avec un code de retrait. Personne d'autre que toi ne peut récupérer ton sac." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Livraison de repas à Bandal en 30 minutes

Tu habites **Bandal** et tu as faim ? Tunakula te livre ton plat préféré, chaud, en une trentaine de minutes — commandé depuis WhatsApp, sans application à installer. Que tu sois vers la Sainte-Anne, la deuxième avenue ou près du marché, un restaurant proche est prêt à cuisiner pour toi.

## Chaud, parce qu'on reste près

On ne te propose que des restaurants à moins de 5 km, pour que ton plat arrive chaud malgré les embouteillages de Kin. C'est la règle 5 km, et elle change tout : moins de route, moins d'attente, plus de goût. Quand il pleut, on resserre encore le rayon pour garder la qualité.

## Suivi léger, sans vider ton forfait

Tu reçois quelques notifications claires — commande acceptée, en cuisine, ton **wewa** est en route, arrivé au portail — sans carte GPS qui mange ta data. Ton wewa navigue par repères, exactement comme toi quand tu expliques un chemin à un ami.

## Paie comme ça t'arrange

À Bandal, tu paies **cash à la livraison**, par mobile money (M-Pesa, Orange, Airtel, Africell) ou par carte. Le montant total s'affiche avant que tu confirmes, sans frais caché. Ton wewa a la monnaie et vérifie ta commande avec un code de retrait, pour que personne d'autre ne prenne ton sac.

## Une commande, et tu recommences en un clic

Ta première **commande** enregistre ton adresse par repères. La prochaine fois, tu recommandes ton plat en un seul message. La **livraison à Bandal** devient une habitude simple, rapide et fiable. Que ce soit pour un déjeuner rapide au bureau, un dîner en famille le week-end ou un petit creux le soir, elle s'adapte à ton rythme sans jamais te faire attendre trop longtemps ni vider ton portefeuille en frais cachés.

Écris à Mama Tunakula sur WhatsApp et fais-toi livrer à Bandal maintenant.`,
  },
  {
    slug: "commander-a-la-voix-lingala-francais",
    title: "Commander à la voix, en lingala et en français",
    description: "Envoie un message vocal en lingala ou en français et ta commande est comprise instantanément. Le moyen le plus rapide de commander à Kinshasa.",
    keywords: ["lingala", "vocal", "commander", "whatsapp", "kinshasa"],
    keyTakeaways: [
      "Tu commandes en lingala, en français ou dans le mélange des deux, en envoyant un simple vocal.",
      "Envoie un message vocal à Mama Tunakula et ta commande est montée toute seule.",
      "Le vocal sert aussi à donner ton adresse par repères, sans GPS.",
      "Après ton vocal, tu reçois un récapitulatif écrit à vérifier avant de payer.",
    ],
    faq: [
      { q: "Je peux commander en parlant lingala ?", a: "Oui, tu peux envoyer un vocal en lingala, en français ou dans le mélange des deux qu'on utilise au quotidien. Pas besoin d'écrire ni de connaître le nom exact du plat." },
      { q: "Comment je suis sûr que ma commande est bonne ?", a: "Après ton vocal, Mama Tunakula te montre un récapitulatif écrit : le plat, la quantité, le prix et l'adresse. Tu vérifies d'un coup d'œil et tu confirmes avant de payer." },
      { q: "Le vocal marche-t-il aussi pour l'adresse ?", a: "Oui, tu peux donner ton adresse par repères en vocal, du style «Bandal, après l'église Sainte-Anne, portail vert». Elle est comprise, confirmée et gardée pour tes prochaines commandes." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Commander à la voix, en lingala et en français

Pas envie de taper ? Parle. Sur WhatsApp, envoie un **vocal** à Mama Tunakula — «mbala mibale poulet mayo na jus ya tangawisi» — et ta commande est montée toute seule. C'est le moyen le plus rapide et le plus naturel de commander à Kinshasa, surtout quand tu es pressé ou que tu as les mains prises.

## La voix, la vraie langue de Kin

À Kinshasa on envoie des notes vocales tout le temps. Tunakula parle ta langue : lingala, français, ou le mélange des deux qu'on utilise vraiment au quotidien. Tu **commandes** comme tu parles à un ami — pas besoin d'écrire parfaitement, pas besoin de connaître le nom exact du plat sur le menu.

## Aussi pour donner ton adresse

Le vocal sert aussi à donner ton adresse par repères : «Bandal, après l'église Sainte-Anne, portail vert, deuxième maison». Fini les adresses GPS qui n'existent pas ou qui envoient ton wewa au mauvais endroit. Ton chemin est compris, confirmé et gardé pour tes prochaines commandes.

## Rapide, clair, sans erreur

Après ton vocal, Mama Tunakula te montre un récapitulatif écrit : le plat, la quantité, le prix, l'adresse. Tu vérifies d'un coup d'œil et tu confirmes. Si tu as dit «sans piment» ou «bien pimenté», c'est noté. La voix va vite, mais tu gardes toujours le contrôle avant de payer.

## Pour qui c'est parfait

Pour le taximan entre deux courses, la maman occupée, l'étudiant qui révise, ou simplement quand écrire est pénible. La commande vocale rend Tunakula accessible à tout le monde à **Kinshasa**, quel que soit ton niveau de lecture ou d'écriture. Un simple message vocal, et le repas est en route — c'est la commande la plus rapide de toute la ville, aussi bien pour manger que pour donner ton adresse par repères.

Essaie maintenant : touche le micro dans ta conversation WhatsApp avec Mama Tunakula.`,
  },
  {
    slug: "regle-5-km-plat-chaud",
    title: "La règle des 5 km : ton plat arrive toujours chaud",
    description: "Pourquoi Tunakula ne livre que dans un rayon de 5 km à Kinshasa : pour que ton plat arrive chaud, et ton wewa en sécurité. La qualité d'abord.",
    keywords: ["plat chaud", "5 km", "livraison", "bandal", "kinshasa"],
    keyTakeaways: [
      "La règle des 5 km garantit un plat chaud : Tunakula ne propose que des restaurants à moins de 5 km.",
      "Au-delà de 5 km, un plat perd sa chaleur dans les embouteillages de Kinshasa.",
      "Quand il pleut, le rayon passe automatiquement à 3 km pour la sécurité du wewa.",
      "La proximité rend la livraison plus rapide et permet au wewa de faire plus de courses.",
    ],
    faq: [
      { q: "Pourquoi Tunakula livre seulement à 5 km ?", a: "Pour que ton plat arrive chaud. Au-delà de 5 km dans les embouteillages de Kinshasa, le plat refroidit, la sauce fige et le wewa reste coincé trop longtemps." },
      { q: "Le rayon change-t-il quand il pleut ?", a: "Oui, quand il pleut on resserre automatiquement le rayon à 3 km. Ton plat reste chaud et ton wewa reste en sécurité sur des routes difficiles." },
      { q: "Et si mon restaurant préféré est trop loin ?", a: "On te propose le même style de cuisine dans un restaurant plus proche de toi. Mieux vaut un bon plat proche qu'un plat lointain qui refroidit." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# La règle des 5 km : ton plat arrive toujours chaud

Chez Tunakula, on ne te propose que des restaurants à moins de 5 km de toi, pour une seule raison : que ton **plat** arrive **chaud**. Ce n'est pas une limite subie, c'est une promesse de qualité que nous avons choisie dès le départ. Un bon repas froid n'est pas un bon repas.

## Pourquoi cinq kilomètres, exactement

Au-delà de 5 km dans les embouteillages de Kinshasa, un plat perd sa chaleur, sa sauce fige et ton **wewa** reste coincé trop longtemps sur la route. Plutôt que de te livrer loin et mal, on préfère te proposer le même style de cuisine tout près de chez toi. Résultat : ta **livraison à Bandal** ou dans ton quartier est chaude, rapide et fiable.

## Le mode pluie

Quand il pleut à Kin, les routes deviennent difficiles et dangereuses. On resserre alors automatiquement le rayon à 3 km : ton **plat** reste **chaud**, ton wewa reste en sécurité, et personne ne prend de risque inutile pour une course. La qualité et la sécurité passent avant le kilométrage.

## Ce que la proximité change pour toi

Rester près, c'est moins d'attente, moins de plats ratés, et une nourriture qui goûte comme au restaurant. C'est aussi un wewa qui fait plus de courses dans la journée, donc qui gagne mieux — un cercle vertueux pour tout le quartier. La densité locale, c'est ce qui rend la **livraison** vraiment rapide à **Kinshasa**.

## La qualité d'abord, toujours

La règle des 5 km résume notre philosophie : mieux vaut le bon plat proche que le plat lointain qui refroidit. C'est simple, honnête, et pensé pour la réalité de Kin.

Commande sur WhatsApp — on te montre déjà les meilleurs restaurants près de toi.`,
  },
  {
    slug: "adresse-vocale-sans-gps",
    title: "Adresse Vocale : se faire livrer sans adresse GPS",
    description: "À Kinshasa on navigue par repères, pas par GPS. L'Adresse Vocale de Tunakula transforme «après l'église, portail vert» en adresse réutilisable à vie.",
    keywords: ["adresse", "repères", "bandal", "livraison", "vocal"],
    keyTakeaways: [
      "L'Adresse Vocale transforme «après l'église, portail vert» en adresse réutilisable à vie, sans GPS.",
      "Un simple vocal enregistre ton chemin sous un nom comme «Maison» ou «Bureau».",
      "Ton wewa reçoit ton chemin en repères, pas en coordonnées, la vraie façon de rouler à Kin.",
      "Tu peux enregistrer plusieurs adresses : maison, travail, chez maman, l'église.",
    ],
    faq: [
      { q: "Comment donner mon adresse sans GPS à Kinshasa ?", a: "Tu envoies un vocal décrivant ton chemin par repères, comme tu le ferais à un ami. Tunakula le comprend, le confirme et l'enregistre comme adresse réutilisable." },
      { q: "Dois-je réexpliquer mon adresse à chaque commande ?", a: "Non, une fois enregistrée sous un nom comme «Maison» ou «Bureau», un seul clic suffit à la prochaine commande. Tu ne réexpliques jamais deux fois." },
      { q: "Puis-je enregistrer plusieurs adresses ?", a: "Oui, tu peux enregistrer la maison, le travail, chez maman ou l'église, chacune par repères clairs. Tu choisis l'adresse en un geste au moment de commander." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Adresse Vocale : se faire livrer sans adresse GPS

Kinshasa n'a pas d'**adresse** GPS fiable — mais tout le monde connaît les repères. Tunakula en fait une force avec l'Adresse Vocale : tu décris ton chemin comme tu le ferais à un ami, et ça devient une adresse réutilisable à vie. Plus besoin de coordonnées, plus besoin d'un plan qui n'existe pas.

## Un vocal, et c'est gardé pour toujours

Envoie un **vocal** : «Bandal, deuxième avenue, après l'église Sainte-Anne, portail vert, à côté de la pharmacie». C'est compris, confirmé et enregistré sous un nom simple comme «Maison» ou «Bureau». À ta prochaine commande, un seul clic suffit — tu ne réexpliques jamais deux fois.

## Ton wewa te trouve du premier coup

Ton **wewa** reçoit ton chemin en repères, pas en coordonnées : la vraie façon de rouler à Kin. Il sait quel virage prendre, quel commerce chercher, quel portail viser. Résultat : moins de livraisons ratées, moins d'appels «tu es où ?», et surtout des plats qui arrivent encore chauds.

## Plusieurs adresses, pour toute ta vie

Tu peux enregistrer plusieurs adresses : la maison, le travail, chez maman, l'église. Chacune est sauvegardée par **repères** clairs. Que tu commandes pour toi à **Bandal** ou pour un proche ailleurs, tu choisis l'adresse en un geste et la **livraison** part au bon endroit.

## Pensé pour la réalité de Kin

Les autres services te demandent une adresse GPS que personne n'a. Tunakula part de comment Kinshasa fonctionne vraiment — les repères, les avenues, les commerces connus. C'est plus rapide, plus juste, et beaucoup moins stressant. Une fois ton adresse enregistrée, chaque commande suivante démarre plus vite, ton wewa perd moins de temps à chercher le bon portail, et ton plat arrive encore chaud parce que personne ne tourne en rond dans le quartier.

Enregistre ton Adresse Vocale dès ta première commande sur WhatsApp.`,
  },
  {
    slug: "payer-mobile-money-mpesa-orange-airtel-africell",
    title: "Payer par Mobile Money : M-Pesa, Orange, Airtel, Africell",
    description: "Paie ta commande Tunakula par mobile money — M-Pesa, Orange Money, Airtel Money, Africell — confirmé automatiquement en moins de 30 secondes.",
    keywords: ["mobile money", "mpesa", "paiement", "whatsapp", "kinshasa"],
    keyTakeaways: [
      "Le mobile money Tunakula marche avec M-Pesa, Orange, Airtel et Africell, sans compte spécial à créer.",
      "Ton paiement est confirmé automatiquement en moins de 30 secondes.",
      "Pas besoin d'envoyer une capture d'écran : le système reconnaît ton versement tout seul.",
      "En cas de souci, tu es remboursé vite en Crédit Tunakula, utilisable dès ta prochaine commande.",
    ],
    faq: [
      { q: "Quels opérateurs mobile money sont acceptés ?", a: "M-Pesa, Orange Money, Airtel Money et Africell. Pas de compte spécial à créer : tu paies avec l'opérateur que tu as déjà en poche." },
      { q: "En combien de temps mon paiement est confirmé ?", a: "En moins de 30 secondes, automatiquement. Tu n'as jamais à demander «vous avez reçu mon argent ?» ni à envoyer une capture d'écran." },
      { q: "Que se passe-t-il si ma commande est annulée ?", a: "Ton argent est protégé car tu paies chez Tunakula, pas directement chez le restaurant. Tu es remboursé vite en Crédit Tunakula, utilisable dès ta prochaine commande." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Payer par M-Pesa, Orange, Airtel ou Africell Money

Chez Tunakula, tu paies avec le **mobile money** que tu utilises déjà : M-Pesa, Orange Money, Airtel Money ou Africell. Pas de compte spécial à créer, pas de nouvelle carte, pas de manipulation compliquée. Tu envoies ton paiement comme d'habitude, et ta commande est réglée.

## Confirmé en 30 secondes, sans stress

Tu envoies le **paiement** au numéro indiqué avec ton code de commande, et c'est confirmé automatiquement en moins de 30 secondes. Tu n'as jamais à demander «vous avez reçu mon argent ?» ni à envoyer une capture d'écran. Le système reconnaît ton versement et fait avancer ta commande tout seul.

## Ton argent est protégé

Tu paies chez Tunakula, pas directement chez le restaurant. Si un souci arrive — resto injoignable, commande annulée — tu es remboursé vite en Crédit Tunakula, utilisable dès ta prochaine commande. Le **mobile money** devient donc aussi sûr que pratique.

## Ou paie cash, ou par carte

Tu préfères le cash à la livraison ? C'est possible, ton wewa a la monnaie. Tu es dans la diaspora et tu veux payer par carte ? Aussi. Au total, plusieurs façons de payer, toutes transparentes, avec le montant complet affiché avant que tu confirmes — sans frais caché.

## Pensé pour Kinshasa

Le mobile money est la façon dont **Kinshasa** paie vraiment. Tunakula s'y adapte au lieu de forcer une carte bancaire que peu de gens utilisent. C'est le **paiement** local, sur **WhatsApp**, sans friction. Que tu sois à Bandal, Lemba, Matete ou Ngaliema, tu règles ta commande avec l'opérateur que tu as déjà en poche, et tu reçois une confirmation nette. Plus besoin d'attendre, de rappeler, ou d'envoyer une capture d'écran pour prouver que tu as bien payé : le système reconnaît ton versement et fait avancer ta commande tout seul.

Commande sur WhatsApp et paie comme ça t'arrange.`,
  },
  {
    slug: "payer-cash-a-la-livraison",
    title: "Payer cash à la livraison à Kinshasa",
    description: "Pas de mobile money ? Paie cash à la livraison. Ton wewa a la monnaie, ton paiement est simple et sûr. La livraison à Kinshasa comme tu la connais.",
    keywords: ["cash", "paiement", "livraison", "kinshasa", "wewa"],
    keyTakeaways: [
      "Tu paies cash ton wewa au moment de la remise, sans avancer un franc à l'avance.",
      "Le montant total s'affiche avant de confirmer, sans surprise ni frais caché.",
      "Ton wewa arrive avec la monnaie et vérifie la commande avec un code de retrait à trois chiffres.",
      "Le paiement cash ne demande aucun compte mobile money, aucune carte, aucune application.",
    ],
    faq: [
      { q: "Puis-je payer sans mobile money ni carte ?", a: "Oui, tu paies cash à la livraison au moment de la remise. Ça ne demande aucun compte mobile money, aucune carte et aucune application." },
      { q: "Le wewa a-t-il la monnaie ?", a: "Oui, ton wewa arrive avec la monnaie et le montant total t'est montré avant de confirmer, sans frais caché." },
      { q: "Comment être sûr que c'est bien ma commande ?", a: "Ton wewa vérifie la commande avec toi grâce à un code de retrait à trois chiffres. Personne d'autre que toi ne peut récupérer ton sac." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Payer cash à la livraison à Kinshasa

Le **cash** reste roi à Kinshasa, et Tunakula le respecte pleinement. Tu commandes sur WhatsApp, et tu paies ton **wewa** en liquide au moment de la remise, sans avancer un franc à l'avance. C'est la livraison comme tu la connais, en plus simple et mieux organisée.

## Simple et sûr

Le montant total t'est montré avant de confirmer, sans surprise ni frais caché. Ton **wewa** arrive avec la monnaie et vérifie la commande avec toi grâce à un code de retrait à trois chiffres. Personne d'autre que toi ne peut récupérer ton sac : le code, c'est ta sécurité et la sienne.

## Pas besoin de compte ni de carte

Le **paiement** cash ne demande aucun compte mobile money, aucune carte, aucune application. C'est parfait si tu préfères garder tes habitudes, si ton crédit mobile money est vide, ou si tu commandes pour quelqu'un qui paiera sur place. Tout le monde peut commander.

## Tu préfères sans cash ?

Tu peux aussi payer par mobile money (M-Pesa, Orange, Airtel, Africell) confirmé en 30 secondes, ou par carte pour la diaspora. Tu choisis au moment de commander, et tu peux changer d'un jour à l'autre. La **livraison** reste la même : chaude, proche, suivie.

## Le cash, bien fait

Payer **cash à la livraison** à **Kinshasa**, c'est rassurant : tu vois ton plat, tu vérifies, tu paies. Tunakula ajoute juste ce qu'il faut de structure — code de retrait, montant clair, wewa identifié — pour que ce moment soit toujours net. Tu vérifies le contenu du sac, tu confirmes le code de retrait à trois chiffres, tu règles le montant exact affiché à l'avance, et l'affaire est bouclée en quelques secondes, sans discussion ni mauvaise surprise sur le prix au moment de payer.

Écris à Mama Tunakula et choisis «cash à la livraison».`,
  },
  {
    slug: "rembourse-40-secondes-credit-tunakula",
    title: "Remboursement en 40 secondes : le Crédit Tunakula",
    description: "Un souci avec ta commande ? Remboursement immédiat en Crédit Tunakula, utilisable dès ta prochaine commande. Ton argent est toujours en sécurité.",
    keywords: ["remboursement", "crédit", "paiement", "kinshasa", "commander"],
    keyTakeaways: [
      "Le remboursement Tunakula est immédiat car tu paies chez Tunakula, pas directement chez le restaurant.",
      "Si un resto ne répond pas, tu es remboursé en 40 secondes en Crédit Tunakula.",
      "Le Crédit Tunakula s'applique tout seul à ta prochaine commande, sans code à saisir.",
      "Zéro paperasse : pas de formulaire, pas de service client à supplier, pas d'attente de plusieurs jours.",
    ],
    faq: [
      { q: "Que se passe-t-il si le restaurant ne répond pas ?", a: "Tu as deux choix immédiats : être rerouté vers un restaurant équivalent tout près, ou être remboursé en 40 secondes en Crédit Tunakula. Tu décides, en un clic." },
      { q: "Combien de temps pour être remboursé ?", a: "40 secondes, en Crédit Tunakula. Comme le paiement transite par Tunakula, le remboursement est instantané et automatique, sans formulaire à remplir." },
      { q: "Comment utiliser mon Crédit Tunakula ?", a: "Il s'applique tout seul à ta prochaine commande, sans code à saisir. Tu manges, il se déduit, c'est tout." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Remboursé en 40 secondes : le Crédit Tunakula

Un resto injoignable ? Une commande annulée ? Chez Tunakula, le **remboursement** est immédiat parce que ton argent est en sécurité : tu paies chez Tunakula, pas directement chez le restaurant. Tu n'attends jamais des jours pour récupérer ce qui t'appartient.

## Deux choix immédiats

Si ton restaurant ne répond pas, on ne te laisse pas bloqué. Soit on te reroute vers un restaurant équivalent tout près, avec le même style de plat, soit on te rembourse en 40 secondes en **Crédit Tunakula**, utilisable dès ta prochaine **commande**. Tu décides, en un clic, sans discussion.

## Zéro paperasse

Pas de formulaire à remplir, pas de service client à supplier, pas d'attente de plusieurs jours comme ailleurs. Le **paiement** transite par Tunakula, donc le **remboursement** est instantané et automatique. C'est la différence entre subir un problème et le voir réglé sur-le-champ.

## Un crédit qui se dépense vite

Le Crédit Tunakula n'est pas un bon compliqué : c'est de l'argent prêt à l'emploi dans ton compte. Il s'applique tout seul à ta prochaine commande, sans code à saisir. Tu manges, il se déduit, c'est tout.

## Commander l'esprit tranquille

Savoir que tu seras remboursé vite change la façon de commander : tu essaies un nouveau restaurant sans crainte, tu commandes pour la famille sans stress. À **Kinshasa**, où la confiance est précieuse, Tunakula la construit avec des règles claires et un **remboursement** qui tient parole. Contrairement aux services où un litige traîne des semaines, ici tout est réglé pendant que tu es encore dans la conversation, sans appel, sans file d'attente et sans preuve à fournir. C'est cette rapidité qui fait la différence au quotidien. Et tu gardes toujours la main : tu choisis toi-même entre le nouveau restaurant proposé tout près ou le crédit immédiat, rien ne se décide à ta place, jamais.

Commande l'esprit tranquille sur WhatsApp.`,
  },
  {
    slug: "restaurants-gardez-100-du-prix",
    title: "Restaurants : gardez 100% du prix de vos plats",
    description: "Rejoignez Tunakula à Kinshasa et gardez 100% du prix de vos plats. Zéro commission restaurant, un seul Android, et des outils marketing IA offerts.",
    keywords: ["restaurant", "partenaire", "kinshasa", "commander", "livraison"],
    keyTakeaways: [
      "En tant que restaurant partenaire, tu encaisses 100% du prix de tes plats : zéro commission.",
      "Les frais de service sont côté client (modèle «client-paie»), ta marge reste entière.",
      "Un seul Android suffit : les commandes arrivent sur WhatsApp avec deux boutons, Accepter et Prêt.",
      "Des outils marketing IA offerts écrivent tes posts, créent tes pubs et trouvent ton meilleur horaire.",
    ],
    faq: [
      { q: "Combien Tunakula prend-il de commission sur mes plats ?", a: "Rien. Tu encaisses 100% du prix de tes plats. Le modèle est «client-paie» : les frais de service sont côté client, ta marge reste entière." },
      { q: "Faut-il acheter du matériel spécial ?", a: "Non, un seul Android suffit. Les commandes arrivent sur WhatsApp avec deux boutons simples, Accepter et Prêt, sans tablette ni logiciel à apprendre." },
      { q: "Qu'est-ce que je reçois en plus des commandes ?", a: "Des outils marketing IA offerts qui écrivent tes posts, créent tes pubs et trouvent ton meilleur horaire de publication, pour attirer plus de clients sans budget d'agence." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Restaurants : gardez 100% du prix de vos plats

Là où les autres plateformes prennent 25 à 35% de commission, Tunakula ne prend rien sur vos plats. En tant que **restaurant** partenaire à **Kinshasa**, vous encaissez 100% de votre prix de vente. Le modèle est «client-paie» : les frais de service sont côté client, votre marge reste entière.

## Un seul Android suffit

Les **commandes** arrivent sur WhatsApp avec deux boutons simples : Accepter et Prêt. Pas de tablette spéciale à acheter, pas de logiciel à apprendre, pas de formation longue. Vos commandes WhatsApp apparaissent exactement comme vos commandes habituelles, et votre cuisine garde son rythme.

## Le marketing IA offert

Vous recevez des outils qui écrivent vos posts, créent vos pubs et trouvent votre meilleur horaire de publication — pour attirer plus de clients à Kinshasa sans effort ni budget d'agence. Vos plats se vendent pendant que vous cuisinez, grâce à un moteur de croissance inclus.

## Des livraisons qui protègent votre nom

Grâce à la règle des 5 km, vos plats partent vers des clients proches et arrivent chauds. Une bonne **livraison** protège votre réputation : le client se souvient d'un plat chaud, pas d'une attente. Chaque wewa a un code de retrait, donc la remise est propre et sûre.

## Rejoindre est simple et sans risque

Pas d'abonnement piège, pas de commission sur vos plats, pas d'engagement compliqué. Vous testez, vous voyez les nouvelles **commandes** entrer, et vous décidez. Pour un **restaurant** de Kinshasa, c'est le moyen le plus direct d'ajouter des ventes sans rogner sur vos prix. Vous restez maîtres de votre menu, de vos horaires et de vos tarifs ; Tunakula apporte simplement les clients et la logistique de **livraison**, pendant que votre cuisine se concentre sur ce qu'elle fait de mieux.

Devenez restaurant partenaire : contactez Tunakula sur WhatsApp.`,
  },
  {
    slug: "devenir-wewa-70-pourcent",
    title: "Devenir wewa : 70% des frais de course, payé tout de suite",
    description: "Deviens wewa Tunakula à Kinshasa : n'importe quel téléphone avec WhatsApp, 70% des frais de course payés immédiatement, et un code anti-vol.",
    keywords: ["wewa", "livreur", "kinshasa", "livraison", "cash"],
    keyTakeaways: [
      "Le wewa Tunakula garde 70% des frais de course, et sur les commandes prépayées c'est payé tout de suite.",
      "N'importe quel téléphone avec WhatsApp suffit, pas besoin du dernier smartphone.",
      "Chaque commande a un code de retrait anti-vol : seul le bon client peut récupérer le sac.",
      "Grâce à la règle des 5 km, tes courses restent proches : moins d'essence, plus de livraisons par jour.",
    ],
    faq: [
      { q: "Combien gagne un wewa par course ?", a: "Tu gardes 70% des frais de course. Sur les commandes prépayées, c'est payé tout de suite, pas à la fin du mois." },
      { q: "Quel téléphone faut-il pour devenir wewa ?", a: "N'importe quel téléphone avec WhatsApp suffit. Pas besoin du dernier smartphone, et ton itinéraire est donné en repères, pas en GPS compliqué." },
      { q: "Comment le code de retrait me protège ?", a: "Chaque commande a un code de retrait anti-vol : seul le bon client peut récupérer le sac, ce qui te protège toi aussi lors de la remise." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Devenir wewa : 70% des frais de course, payé tout de suite

Tu as une moto et un téléphone ? Deviens **wewa** Tunakula et gagne à chaque **livraison** à Kinshasa. Pas de diplôme, pas de matériel spécial : ton engin, ton téléphone, ta connaissance des quartiers, et c'est parti. Tu roules quand tu veux, tu gagnes à chaque course.

## 70% pour toi, immédiatement

Sur chaque course, tu gardes 70% des frais de livraison — et sur les commandes prépayées, c'est payé tout de suite, pas à la fin du mois. Ton effort, ton argent, sans attente. Plus tu fais de courses dans ton rayon, plus tu gagnes, simplement.

## Sécurité et simplicité

N'importe quel téléphone avec WhatsApp suffit — pas besoin du dernier smartphone. Chaque commande a un code de retrait anti-vol : seul le bon client peut récupérer le sac, ce qui te protège toi aussi. Ton itinéraire est donné en repères, pas en GPS compliqué, comme tu roules déjà tous les jours.

## Le cash bien organisé

Quand le client paie en **cash** à la livraison, tu encaisses avec la monnaie, et le compte est réconcilié simplement chaque jour au point agent. Pas de casse-tête, pas de comptes flous : tu sais exactement ce que tu as gagné et ce que tu dois.

## Rouler malin, pas loin

Grâce à la règle des 5 km, tes courses restent proches : moins d'essence brûlée, plus de livraisons par jour, moins de temps perdu dans les embouteillages. À **Kinshasa**, un bon **wewa** qui reste dans son secteur gagne mieux et se fatigue moins. Tu organises tes journées comme tu veux, tu acceptes les courses qui t'arrangent, et chaque **livraison** réussie renforce ta réputation auprès des clients de ton quartier, qui finissent par te reconnaître et te faire confiance.

Rejoins les wewas Tunakula : écris-nous sur WhatsApp.`,
  },
  {
    slug: "diaspora-offrir-repas-famille-kinshasa",
    title: "Diaspora : offrir un repas à ta famille à Kinshasa",
    description: "Diaspora congolaise : depuis Londres, Paris ou Bruxelles, offre un repas chaud à ta famille à Kinshasa. Paie par carte, ils sont livrés à Bandal.",
    keywords: ["diaspora", "kinshasa", "livraison", "paiement", "bandal"],
    keyTakeaways: [
      "La diaspora peut offrir un repas chaud à sa famille à Kinshasa depuis Londres, Paris ou Bruxelles.",
      "Tu paies par carte de ton côté, sans mobile money congolais ni argent liquide à faire transiter.",
      "La livraison est suivie de bout en bout : acceptée, en cuisine, wewa en route, arrivée.",
      "L'adresse par repères est gardée une fois donnée, pour que tes prochaines surprises prennent une minute.",
    ],
    faq: [
      { q: "Comment offrir un repas à ma famille depuis l'étranger ?", a: "Tu commandes sur WhatsApp et tu paies par carte de ton côté. Ta famille reçoit un repas chaud à son portail à Bandal ou ailleurs à Kinshasa." },
      { q: "Ai-je besoin d'un mobile money congolais ?", a: "Non, tu paies par carte, sans mobile money congolais ni argent liquide à faire transiter. Tu vois le montant complet avant de valider." },
      { q: "Puis-je savoir si le repas est bien arrivé ?", a: "Oui, la livraison est suivie étape par étape : acceptée, en cuisine, wewa en route, arrivée. Tu suis à distance et tu es rassuré." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Diaspora : offrir un repas à ta famille à Kinshasa

Pour la **diaspora** congolaise, garder le lien avec la famille restée au pays est précieux. Avec Tunakula, depuis Londres, Paris ou Bruxelles, tu commandes un repas chaud et ta famille est livrée à Bandal ou ailleurs à **Kinshasa**. La distance ne t'empêche plus d'être présent au moment du repas.

## Tu paies, ils mangent

Tu paies par carte de ton côté, sans avoir besoin de mobile money congolais ni de faire transiter de l'argent liquide. Ta famille reçoit un repas chaud à son portail, et toi tu as la tranquillité de savoir que c'est arrivé. Le **paiement** est clair, sécurisé, et tu vois le montant complet avant de valider.

## Une livraison suivie de bout en bout

Comme pour toute commande Tunakula, la **livraison** est suivie étape par étape : acceptée, en cuisine, wewa en route, arrivée. Tu peux suivre à distance et être rassuré. Grâce à la règle des 5 km, le plat part d'un restaurant proche de chez eux et arrive chaud.

## Le lien qui nourrit

C'est plus qu'une commande : c'est une façon d'être là malgré les kilomètres. Un anniversaire, un dimanche en famille, un simple «je pense à vous» — livré en vrai, à leur portail, à **Bandal** ou dans leur quartier. Un repas offert vaut souvent mieux qu'un long message.

## Simple, même à distance

Tu donnes l'adresse par repères une fois, et elle est gardée pour tes prochaines surprises. La prochaine fois, offrir un repas prend une minute. La **diaspora** mérite un outil aussi simple que fiable pour rester proche. Que tu envoies un déjeuner du dimanche en famille ou un cadeau surprise en pleine semaine, tout part de la même conversation WhatsApp, en quelques secondes, où que tu sois dans le monde.

Offre un repas dès aujourd'hui : écris à Tunakula sur WhatsApp.`,
  },
  {
    slug: "parraine-un-ami-gagne-du-credit",
    title: "Parrainage : parraine un ami, gagnez du Crédit Tunakula",
    description: "Parrainage Tunakula : partage ton code, et quand ton ami commande à Kinshasa, vous gagnez tous les deux du Crédit Tunakula. Le bon plan qui se partage.",
    keywords: ["parrainage", "crédit", "kinshasa", "commander", "whatsapp"],
    keyTakeaways: [
      "Avec le parrainage Tunakula, ton ami et toi gagnez tous les deux du Crédit Tunakula.",
      "Partage ton code personnel sur WhatsApp, par message ou dans un groupe de quartier.",
      "La récompense arrive sur une vraie première commande payée et livrée, pas de faux comptes.",
      "Le Crédit Tunakula gagné se déduit tout seul dès ta prochaine commande.",
    ],
    faq: [
      { q: "Comment marche le parrainage Tunakula ?", a: "Partage ton code personnel sur WhatsApp. Quand ton ami passe sa première commande payée, il reçoit du Crédit Tunakula de bienvenue, et toi aussi en récompense." },
      { q: "Quand est-ce que je reçois ma récompense ?", a: "Uniquement sur une vraie première commande payée et livrée. Pas de triche, pas de faux comptes, ce qui garde le parrainage sain pour tout le monde." },
      { q: "Comment utiliser le crédit gagné ?", a: "Ton Crédit Tunakula s'utilise dès ta prochaine commande, sans code compliqué à saisir : il se déduit tout seul." },
    ],
    publishedAt: D, author: AUTHOR, lang: "fr",
    bodyMarkdown:
`# Parraine un ami, gagnez tous les deux du Crédit Tunakula

Le bon plan, ça se partage. Avec le **parrainage** Tunakula, ton ami découvre la livraison facile à **Kinshasa**, et vous gagnez tous les deux du Crédit Tunakula. C'est la façon la plus simple de manger pour moins cher : tu recommandes ce que tu aimes déjà, et ça te rapporte.

## Comment ça marche

Partage ton code personnel sur **WhatsApp**, par message ou dans un groupe de quartier. Quand ton ami passe sa première **commande** payée, il reçoit du Crédit Tunakula de bienvenue — et toi aussi, en récompense de l'avoir amené. Tout est automatique, sans réclamation à faire.

## Une récompense honnête

La récompense arrive uniquement sur une vraie première commande payée et livrée : pas de triche, pas de faux comptes, pas de crédit distribué dans le vide. C'est ce qui garde le **parrainage** sain et durable pour tout le monde, et ce qui protège la valeur de ton **crédit**.

## Du crédit qui se dépense vite

Ton **Crédit Tunakula** s'utilise dès ta prochaine commande, sans code compliqué à saisir : il se déduit tout seul. Plus tu partages autour de toi, plus tu accumules, et plus tu **commandes** pour moins cher. C'est un cercle simple et gagnant.

## Parfait pour les groupes de Kin

À Kinshasa, tout passe par les groupes WhatsApp : famille, église, bureau, quartier. Un seul code partagé au bon endroit, et plusieurs amis découvrent Tunakula la même semaine. Le **parrainage** transforme ta recommandation en repas offerts, sans que tu aies à vendre quoi que ce soit — tu partages juste une bonne adresse, comme tu le fais déjà naturellement entre amis. Et plus ton entourage rejoint Tunakula, plus les restaurants proches reçoivent de **commandes**, ce qui améliore le service et les délais pour tout le quartier : tout le monde y gagne, pas seulement toi.

Récupère ton code de parrainage : écris à Mama Tunakula sur WhatsApp.`,
  },
];
