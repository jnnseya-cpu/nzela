# How to get StackFood tokens (cd.tunakula.com)

**There is no single "API key" in StackFood.** The v1 REST API uses
**per-role bearer tokens** obtained from login endpoints, plus a few config
values. This is the practical, copy-paste guide to get each one. Field names
and a couple of endpoint paths vary slightly by StackFood version — **confirm
yours with the HAR capture in §6** (that is the single source of truth for
your install).

Base URL: `https://cd.tunakula.com/api/v1`

---

## 0 · The four token types (who needs which)

| Token | From | Used for |
|---|---|---|
| **Customer** | `POST /auth/login` (or register→login) | Placing orders on a customer's behalf (the WhatsApp channel). **Auto-provisioned by our code** — see §2. |
| **Vendor** | `POST /auth/vendor/login` | Restaurant Accept / Ready buttons. |
| **Delivery-man** | `POST /auth/delivery-man/login` | Wewa pickup / delivered. |
| **Admin / employee** | admin session/token | Wallet credit (Crédit Tunakula) + offline-payment verification. |

You do **not** generate these in a "developers" screen — you obtain them by
authenticating a real account of that role.

---

## 1 · Confirm the API is live (2 minutes, browser only)

Open in a normal tab:

- `https://cd.tunakula.com/api/v1/config` → returns JSON (currency, delivery
  model, min order). Public, no login. **If this returns JSON, the whole v1
  API is live.** Save this JSON — dev needs it.

---

## 2 · Customer token (the main one — mostly automatic)

Our gateway provisions a customer account per WhatsApp number and logs in
automatically (`shared/stackfood-client/src/auth.ts`, `CustomerAuthProvisioner`):
synthetic email `<phone>@wa.tunakula.com`, a vault password, register on
first contact, login after. **You don't manage per-customer tokens by hand** —
you only need `/auth/register` + `/auth/login` to work. Verify with curl:

```bash
# Register a test customer (once)
curl -sS -X POST https://cd.tunakula.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"f_name":"Client","l_name":"Test","phone":"+243810000047",
       "email":"243810000047@wa.tunakula.com","password":"Tk!test123"}'

# Log in → returns { "token": "..." }
curl -sS -X POST https://cd.tunakula.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+243810000047","password":"Tk!test123"}'
```

Use the token (note the `zoneId` header our client sends on catalog calls):

```bash
curl -sS https://cd.tunakula.com/api/v1/customer/info \
  -H "Authorization: Bearer <TOKEN>" -H 'zoneId: [1]'
```

If a call returns a localization/module error, add `-H 'X-localization: fr'`
(and, on some versions, a module header) — the HAR in §6 shows exactly which.

---

## 3 · Vendor & delivery-man tokens (one per pilot partner)

```bash
# Vendor (restaurant owner's email/password — they already have one)
curl -sS -X POST https://cd.tunakula.com/api/v1/auth/vendor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"resto@exemple.cd","password":"<vendor-pass>"}'

# Delivery-man (wewa)
curl -sS -X POST https://cd.tunakula.com/api/v1/auth/delivery-man/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2439xxxxxxx","password":"<wewa-pass>"}'
```

Create these logins in the admin panel (Restaurant → owner; Deliveryman
management). One vendor login per pilot restaurant, one delivery-man login
per wewa.

---

## 4 · Admin / employee token (least privilege)

In **Employee management**, create a role `nzela-admin` with **only**: order
view/edit, customer wallet, offline-payment verification. Log in as that
employee to get its token. Used for Crédit Tunakula wallet credit and
mobile-money (offline) verification. Never use the super-admin account for
the integration.

---

## 5 · The non-token config to collect at the same time

- **zoneId** — the zone number(s) for Kinshasa/Bandal (header format `[1]`).
  Get it from `GET /config/get-zone-id?lat=..&lng=..` or the HAR.
- **StackFood webhook secret** — the shared secret for the OrderObserver HMAC
  (only needed in week 2; polling covers launch).
- Enable an **Offline Payment** method named "Mobile Money" with a
  `référence` field (Business Settings), so mobile-money orders carry the TK
  ref.

---

## 6 · Confirm exact field names for YOUR version (15 min — do this)

StackFood versions differ in field names and a few paths. Capture ground truth:

1. Open `https://cd.tunakula.com` in Chrome → **F12 → Network** → filter `api/v1`.
2. Browse: pick a zone, open a restaurant, add to cart, go to checkout (stop
   before paying, or place a 1-item test order).
3. Right-click the request list → **Save all as HAR with content**.
4. Send the `.har` to dev. It contains every real endpoint, header (incl. how
   `zoneId` is formatted) and payload field for your exact install.

Alternative: the CodeCanyon purchase includes a `Documentation/` folder with
the **official Postman collection** — whoever bought the StackFood licence has
it in their Envato downloads. That collection lists every auth endpoint and
token.

---

## 7 · Security (do not skip)

- Store every credential and token in the **secrets vault**, never in
  WhatsApp/email/plaintext or committed to git.
- Give the integration its own least-privilege admin/employee account.
- Tokens can expire — our client caches them and re-authenticates on a 401
  (`CustomerAuthProvisioner.invalidate`), so rotation is handled in code.

## 8 · What to hand to dev (the checklist)

1. `/api/v1/config` JSON (§1)
2. The HAR file (§6) — or the Postman collection
3. Vendor login(s), delivery-man login(s), the `nzela-admin` employee login
4. zoneId for Kinshasa, and the StackFood webhook secret (for week 2)

That's everything the WhatsApp channel needs to place real orders — no
purchase, no build, just the admin panel plus ~30 minutes.
