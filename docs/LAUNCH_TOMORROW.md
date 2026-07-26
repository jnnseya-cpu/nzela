# LANCEMENT DEMAIN — Canal WhatsApp manuel sur cd.tunakula.com

**La vérité stratégique:** cd.tunakula.com est DÉJÀ lancé et encaisse déjà.
Ce qui peut être lancé demain n'est pas le bot automatisé (bloqué par des
délais externes — voir les blockers) mais un **canal WhatsApp opéré par un
humain** qui suit exactement les scripts NZELA-OS, saisit les commandes
dans l'admin StackFood existant, et vérifie les paiements mobile money à
la main (KODA Door 1 — Manual Mode). Zéro nouveau serveur. Zéro validation
Meta. Revenus dès la première commande, via les rails existants.

C'est aussi la meilleure étude de marché possible: chaque conversation
manuelle valide (ou corrige) les scripts avant qu'ils deviennent le bot.

---

## Mise en place — 4 heures, demain matin

1. **WhatsApp Business App** (l'app gratuite, PAS l'API Cloud) installée
   sur un Android dédié avec le numéro Tunakula. Aucune validation Meta
   requise. Configurer: nom «Tunakula — Mama Tunakula», photo, catalogue
   (photos des plats vedettes depuis l'admin), message d'accueil et
   réponses rapides (scripts ci-dessous).
2. **SIM(s) marchande(s)** mobile money dans le même téléphone ou à côté:
   M-Pesa, Orange, Airtel, Africell. L'opérateur lit l'inbox à la main —
   c'est le Lipa Box version humaine.
3. **Un opérateur formé** (2 h de formation avec ce document) + l'admin
   cd.tunakula.com ouvert sur un PC.
4. **Landing page en ligne**: `frontend/landing/landing.html` +
   `splash.html` sont autonomes (polices incluses). Glisser sur Netlify
   Drop ou héberger sur le serveur du site; remplacer le numéro
   `243000000000` dans les liens `wa.me` par le vrai numéro. 10 minutes.
5. **Annonce**: post WhatsApp Status + groupes Bandal + QR code du lien
   wa.me chez les 3–5 restos pilotes.

## Le flux opérateur (par commande)

| Étape | Action opérateur | Script |
|---|---|---|
| 1 | Client écrit | «Mbote! 🍲 Mama Tunakula na yo. Dis-moi ce que tu veux — ou je t'envoie les restos près de toi.» |
| 2 | Localiser | Demander le quartier + repères («Bandal, après Sainte-Anne, portail vert»). Refuser poliment au-delà de ~5 km avec substitution: «Au-delà de 5 km ton plat arrive froid 😅 Même style tout près: {resto} — {km} km» |
| 3 | Panier + récap | TOUJOURS le récap complet avant paiement: sous-total, service 10%, traitement 2%, livraison zone (3 500/5 000/7 000 FC), total. Attribuer un code **TK-XXX** (carnet numéroté). |
| 4 | Paiement | Momo: «Envoie {total} au {numéro marchand} avec la référence TK-XXX». Vérifier le SMS reçu sur la SIM: montant + réf. **Un code utilisé une fois est mort** — cocher le carnet (anti-rejeu). Cash: noter COD. Carte: renvoyer vers cd.tunakula.com. |
| 5 | Saisie StackFood | Créer la commande dans l'admin cd.tunakula.com (note: «NZELA TK-XXX»). La cuisine et le livreur suivent le flux NORMAL de la plateforme — rien ne change pour eux. |
| 6 | Jalons | Copier les statuts admin vers le client: «👩🏾‍🍳 {resto} a accepté», «🔥 En cuisine», «🏍️ {wewa} est en route», «📍 Au portail!» |
| 7 | Clôture | «Bien reçu?» → reçu complet (date, resto, articles, frais détaillés, total payé, réf TK-XXX) → «Note ta commande ⭐1-5» |
| 8 | Exception | Resto muet >5 min: appeler le resto. Échec → «Ton argent est en sécurité — payé chez Tunakula» + 2 options: reroute même catégorie OU remboursement immédiat en crédit (noté au carnet, utilisable à la prochaine commande). |

**Interdit dans le chat client:** marge, coûts, répartition 70/30,
mention d'IA — le client ne voit que son reçu (règle FR-W4).

## Registre quotidien (le futur ops-console, version papier/tableur)

Par commande: TK-réf · heure · client · resto · total · mode paiement ·
SMS vérifié O/N · statut final · incident. Rapprochement 18h: SMS SIM ↔
carnet ↔ admin StackFood. Objectifs pilotes: ≥85% complétées, paiement
vérifié ≤ 5 min, zéro code réutilisé.

## Ce que ça prouve (et nourrit le bot)

Chaque script validé ici EST la copie des 6 templates Meta (FR-M3).
Chaque SMS opérateur reçu = fixture pour affiner les regex Lipa.
Chaque adresse-repère notée = premier nœud du Landmark Graph.
Le jour où l'automatisation arrive, on remplace l'opérateur, pas le
produit.
