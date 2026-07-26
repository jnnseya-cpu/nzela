# Getting the cd.tunakula.com API from your admin

StackFood already exposes the full REST API your Flutter apps and web
store use — there is nothing to "enable". You need three things: proof of
the endpoints, credentials, and admin configuration. All three come from
what you already own.

## 1 · Confirm the API is live (2 minutes, browser only)

Open these in a normal browser tab:

- `https://cd.tunakula.com/api/v1/config` → JSON with currency, delivery
  charge model, min order. Public, no login.
- `https://cd.tunakula.com/api/v1/restaurants/get-restaurants/all?offset=1&limit=50`
  → may require the `zoneId` header (then it errors politely — that
  itself confirms the route exists).

If `/api/v1/config` returns JSON, the whole v1 API is live. Save that
JSON and send it to dev — it's Open Item #1.

## 2 · Ground truth for exact field names (15 minutes)

The install's own web store is the best "Postman export":

1. Open `https://cd.tunakula.com` in Chrome → F12 → **Network** tab →
   filter `api/v1`.
2. Browse: pick a zone, open a restaurant, add to cart, go to checkout
   (stop before paying, or place a 1-item test order).
3. Right-click the request list → **Save all as HAR with content**.
4. Send the `.har` file to dev — it contains every real endpoint, header
   (including how `zoneId` is formatted) and payload field for YOUR
   exact StackFood version. This replaces the Postman diff in Week 1 of
   the integration spec.

Alternative: the CodeCanyon purchase of StackFood includes a
`Documentation` folder with the official Postman collection — whoever
bought the licence has it in their Envato downloads.

## 3 · Credentials to create in the admin panel

| Credential | Where in admin | Used for |
|---|---|---|
| One **vendor login** per pilot restaurant | Restaurant → owner email/password (they already have one to use the vendor app) | `POST /api/v1/auth/vendor/login` → token for accept/ready buttons (Flow 5) |
| One **delivery-man login** per wewa | Deliveryman management | `POST /api/v1/auth/delivery-man/login` → token for pickup/delivered |
| **nzela-admin employee** | Employee management → new role with: order view/edit, customer wallet, offline-payment verification only (least privilege) | Wallet credit (Crédit Tunakula, Flow 4 Pattern B) and offline-payment verification |
| Test **customer** | Register via the web store with a test phone | End-to-end order rehearsal |

Collect them into the vault (never WhatsApp/email in clear text).

## 4 · Admin configuration that the WhatsApp channel mirrors

In Business Settings / Zone Setup (your team already knows these
screens): deliveryman commission = **70%** · zone delivery charges =
**3 500 / 5 000 / 7 000 FC** · service 10% + processing 2% client-pays ·
per-restaurant coverage radius = **5 km** · enable an **Offline Payment**
method named "Mobile Money" with required field `référence` (if your
version has it — if not, dev falls back to the wallet bridge, no
schedule impact).

## 5 · For the observer module later (not needed at launch)

Hosting/cPanel or SSH access to the Laravel codebase — that's where the
~120-line OrderObserver package gets installed in week 2. Polling covers
day 1.

**Summary: nothing to buy, nothing to build — browser + admin panel +
30 minutes produces everything dev needs.**
