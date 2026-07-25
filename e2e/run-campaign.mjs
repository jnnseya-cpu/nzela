/**
 * NZELA-OS UI test campaign — drives the prototype end-to-end as a real
 * user (and the resto/wewa actors), asserting every behaviour before
 * stamping a PASS badge and capturing screenshot evidence.
 *
 *   node e2e/run-campaign.mjs [path-to-prototype-html] [out-dir]
 *
 * Exit code 1 if any test fails. Screenshots land in <out-dir>.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PROTO = process.argv[2] ?? "docs/prototype/tunakula-nzela-os-interactive.html";
const OUT = process.argv[3] ?? "e2e/out";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const results = [];
let page;

async function badge(id, label) {
  await page.evaluate(([i, l]) => {
    let b = document.getElementById("__t");
    if (!b) {
      b = document.createElement("div");
      b.id = "__t";
      b.style.cssText =
        "position:fixed;top:8px;left:8px;z-index:9999;background:#1d7a44;color:#fff;" +
        "font:700 13px/1.4 monospace;padding:6px 12px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.5)";
      document.body.appendChild(b);
    }
    b.textContent = `${i} PASS · ${l}`;
  }, [id, label]);
}
async function shot(id, label, sel) {
  await badge(id, label);
  const target = sel ? page.locator(sel) : page;
  await target.screenshot({ path: `${OUT}/${id}-PASS.png` });
  await page.evaluate(() => document.getElementById("__t")?.remove());
}
async function test(id, label, fn, sel) {
  try {
    await fn();
    await shot(id, label, sel);
    results.push({ id, label, ok: true });
    console.log(`PASS ${id} ${label}`);
  } catch (e) {
    results.push({ id, label, ok: false, err: String(e).slice(0, 300) });
    await page.screenshot({ path: `${OUT}/${id}-FAIL.png` }).catch(() => {});
    console.log(`FAIL ${id} ${label}: ${String(e).slice(0, 200)}`);
  }
}
// Whitespace-normalized matcher: the app renders numbers with narrow
// no-break spaces («2 450 FC»), so both sides are stripped of whitespace.
const has = (sel, txt) =>
  page.waitForFunction(
    ([s, t]) =>
      document
        .querySelector(s)
        ?.textContent.replace(/\s+/g, "")
        .includes(t.replace(/\s+/g, "")),
    [sel, txt],
    { timeout: 45000 },
  );
const rate5 = async () => {
  await page.waitForSelector("#stars button:nth-child(5)", { timeout: 45000 });
  await page.click("#stars button:nth-child(5)");
};
const state = (expr) => page.evaluate(expr);

/** Generic actor driver: clicks enabled flow buttons like a human would.
 *  prefer: substrings to pick when present (used once each, in order).
 *  avoid: substrings never to click. */
function makeDriver(prefer = [], avoid = []) {
  const pending = [...prefer];
  const iv = setInterval(async () => {
    try {
      await page.evaluate(
        ([prefs, avoids]) => {
          // Address phase has no buttons — record the Adresse Vocale like a
          // real user tapping the blinking mic (same path cinema mode uses).
          // `phase` is a top-level let — reachable as a free variable, not
          // via window.
          if (phase === "address" && !window.__e2eAddr) {
            window.__e2eAddr = 1;
            micTap();
            return;
          }
          const btns = [...document.querySelectorAll(".opt:not(:disabled)")];
          const order = document.querySelector("#orderBtn.next");
          const star = document.querySelector("#stars button:nth-child(5)");
          const pick =
            btns.find((b) => prefs[0] && b.textContent.includes(prefs[0])) ??
            btns.find(
              (b) =>
                b.classList.contains("next") &&
                !avoids.some((a) => b.textContent.includes(a)),
            ) ??
            btns.find(
              (b) =>
                b.classList.contains("hot") &&
                !avoids.some((a) => b.textContent.includes(a)),
            );
          if (pick) {
            if (prefs[0] && pick.textContent.includes(prefs[0])) prefs.shift();
            pick.click();
          } else if (order) order.click();
          else if (star && document.querySelector("#stars button:not(.lit)"))
            star.click();
        },
        [pending, avoid],
      );
    } catch {}
  }, 1200);
  return () => clearInterval(iv);
}

async function freshSession() {
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(pathToFileURL(PROTO).href);
  await page.waitForTimeout(700);
  await page.click("text=Entrer dans la simulation");
  await page.waitForTimeout(400);
}

// ---------------- RUN 1: discovery, firewall, momo order ----------------
await freshSession();

await test("T01", "Accueil: 17 catégories réelles + restos", async () => {
  const cats = await state(() => document.querySelectorAll("#hvCats .hv-cat").length);
  if (cats !== 17) throw new Error(`expected 17 categories, got ${cats}`);
  const restos = await state(() => document.querySelectorAll("#hvRestos .hv-rc").length);
  if (restos < 3) throw new Error(`expected resto cards, got ${restos}`);
}, "#pc");

await test("T02", "Langues: FR→EN→AR (RTL)→ES→ZH", async () => {
  await page.click("#langBtn"); // EN
  await page.click("#langBtn"); // AR
  await page.waitForTimeout(200);
  const dir = await state(() => document.getElementById("homeView").getAttribute("dir"));
  if (dir !== "rtl") throw new Error(`AR must be rtl, got ${dir}`);
  await page.click("#langBtn"); await page.click("#langBtn"); await page.click("#langBtn"); // →FR
  const search = await state(() => document.getElementById("hvSearchTxt").textContent);
  if (!search.includes("faim")) throw new Error(`FR not restored: ${search}`);
  await page.click("#langBtn"); await page.click("#langBtn"); // show AR for the shot
  await page.waitForTimeout(200);
}, "#pc");

await test("T03", "Entrée chat: accueil Mama Tunakula", async () => {
  await page.click("#langBtn"); await page.click("#langBtn"); await page.click("#langBtn"); // back FR
  await page.click(".hv-search");
  await has("#chatC", "Mbote");
}, "#pc");

await test("T04", "Liste restos: rayon 5 km appliqué", async () => {
  await page.click("#chatC .opt");
  await has("#chatC", "hors rayon");
  const opts = await state(() => document.querySelectorAll("#chatC .opt").length);
  if (opts < 4) throw new Error(`expected 4+ resto options, got ${opts}`);
}, "#pc");

await test("T05", "Règle 5 km: refus poli + substitution", async () => {
  await page.click("#chatC .opt:has-text('Gombe')");
  await has("#chatC", "7,9 km");
  await has("#chatC", "Mama Kito");
}, "#pc");

await test("T06", "Menu: cartes photo + chips catégories StackFood", async () => {
  await page.click("#chatC .opt:has-text('Mama Kito')");
  await page.waitForTimeout(1800);
  const cards = await state(() => document.querySelectorAll("#chatC .mcard").length);
  if (cards < 3) throw new Error(`expected photo cards, got ${cards}`);
}, "#pc");

await test("T07", "Commande libre: «2 poulets mayo et un jus» → panier", async () => {
  await page.fill("#inp", "2 poulets mayo et un jus");
  await page.press("#inp", "Enter");
  await has("#chatC", "J'ai compris");
  const total = await state(() => document.getElementById("cartTot").textContent);
  if (!total.replace(/[\s ]/g, "").includes("32000")) {
    throw new Error(`expected 32 000 FC cart, got ${total}`);
  }
}, "#pc");

await test("T08", "Pare-feu IA: hors-sujet → 0 token, bloqué et journalisé", async () => {
  await page.fill("#inp", "tu penses quoi des élections?");
  await page.press("#inp", "Enter");
  await has("#chatC", "on parle nourriture");
  const blocked = await state(() => document.getElementById("cBlk").textContent);
  if (Number(blocked) < 1) throw new Error(`block counter is ${blocked}`);
}, "#pc");

let stopDriver = makeDriver(["Mobile Money"]);

await test("T09", "Checkout: récap avec frais transparents", async () => {
  await page.click("#orderBtn");
  await has("#chatC", "Frais service");
  await has("#chatC", "À payer");
}, "#pc");

await test("T10", "Paiement: 3 moyens (momo 4 réseaux · cash · carte)", async () => {
  await has("#chatC", "Comment tu payes");
  await has("#chatC", "Carte bancaire");
  await has("#chatC", "Cash à la livraison");
  await has("#chatC", "Airtel");
}, "#pc");

await test("T11", "Paiement M-Pesa: SMS Ledger Bridge → PAYÉ", async () => {
  await has("#chatC", "Paiement reçu");
  const sms = await state(() => document.getElementById("smsFeed").textContent);
  if (!/M-?PESA/i.test(sms)) throw new Error("no M-Pesa SMS in Lipa Box");
}, "#pc");

await test("T12", "Resto: carte de commande TK-347 payée", async () => {
  await has("#chatR", "TK-347");
  await has("#chatR", "PAYÉ");
}, "#pr");

await test("T13", "Resto: accepté → cuisson → plat prêt", async () => {
  await has("#chatR", "Accepté");
  await has("#chatR", "Plat prêt");
}, "#pr");

await test("T14", "Wewa: offre de course, gain 70% affiché", async () => {
  await has("#chatW", "2450");
  await has("#chatW", "70%");
}, "#pw");

await test("T15", "Wewa: code retrait vérifié → livré", async () => {
  await has("#chatW", "Récupéré");
  await has("#chatW", "part course");
}, "#pw");

await test("T16", "Client: suivi jalons — en route → au portail", async () => {
  await has("#chatC", "est en route");
  await has("#chatC", "au portail");
}, "#pc");

await test("T17", "Client: notation 5★ puis reçu final — zéro donnée ops", async () => {
  await rate5();
  await has("#chatC", "Reçu — Commande");
  const leak = await state(() => {
    const t = document.getElementById("chatC").textContent;
    return ["Marge", "Couverture", "LLM", "token"].filter((w) => t.includes(w));
  });
  if (leak.length) throw new Error(`ops terms leaked to customer: ${leak}`);
}, "#pc");

await test("T18", "Ops: bilan au Registre + plafonds de coûts respectés", async () => {
  await has("#ledger", "Bilan");
  const { ai, msg } = await state(() => ({ ai: costAI, msg: costMsg }));
  if (ai > 0.05) throw new Error(`AI cost ${ai} > $0.05 ceiling`);
  if (msg > 0.024) throw new Error(`WA cost ${msg} > $0.024 ceiling`);
}, "#po");
stopDriver();
await page.close();

// ---------------- RUN 2: cash branch ----------------
try {
  await freshSession();
  await page.click(".hv-search");
  await has("#chatC", "Mbote");
  await page.fill("#inp", "1 thomson et un jus");
  await page.press("#inp", "Enter");
  await has("#chatC", "J'ai compris");
  stopDriver = makeDriver(["Cash à la livraison"]);
  await page.click("#orderBtn");
} catch (e) {
  results.push({ id: "T19", label: "Cash setup", ok: false, err: String(e) });
}

await test("T19", "Cash: float wewa débité, 70/30 réconcilié", async () => {
  await rate5();
  await has("#chatC", "Reçu — Commande");
  const sms = await state(() => document.getElementById("smsFeed").textContent);
  if (!sms.includes("FLOAT")) throw new Error("no float ledger entry");
  if (!sms.includes("70%")) throw new Error("no 70% split in float entry");
}, "#po");
stopDriver();
await page.close();

// ---------------- RUN 3: resto injoignable exception ----------------
try {
  await freshSession();
  await page.click(".hv-search");
  await has("#chatC", "Mbote");
  await page.fill("#inp", "2 poulets mayo");
  await page.press("#inp", "Enter");
  await has("#chatC", "J'ai compris");
  // Avoid the resto's Accepter and the resto-injoignable simulator — but
  // NOT «Simuler: je paie», which is how the customer confirms payment.
  stopDriver = makeDriver(["Mobile Money"], ["Accepter", "injoignable"]);
  await page.click("#orderBtn");
  await has("#chatR", "TK-347");
  stopDriver(); // manual control from here — the exception path is the test
  await page.waitForTimeout(800);
} catch (e) {
  results.push({ id: "T20", label: "Exception setup", ok: false, err: String(e) });
  await page.screenshot({ path: `${OUT}/T20-SETUP-FAIL.png` }).catch(() => {});
}

await test("T20", "Exception: resto injoignable → réassurance + escalade", async () => {
  await page.click("#chatR .opt:has-text('injoignable')");
  await has("#chatC", "Ton argent est en sécurité");
  await has("#chatC", "Remboursement");
}, "#pc");

await test("T21", "Exception: remboursement instantané en Crédit Tunakula", async () => {
  await page.click("#chatC .opt:has-text('Remboursement')");
  await has("#chatC", "crédité");
}, "#pc");
await page.close();
await browser.close();

// ---------------- report ----------------
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} passed`);
for (const r of results.filter((r) => !r.ok)) console.log(`  FAILED ${r.id}: ${r.err}`);
process.exit(pass === results.length ? 0 : 1);
