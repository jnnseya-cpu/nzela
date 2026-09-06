import type { StackFoodClient } from "@nzela/stackfood-client";
import type { LedgerSink } from "@nzela/ledger";
import type { CreditIssuer } from "./referral.js";

/**
 * Real Crédit Tunakula issuer — turns a referral reward into money in the
 * customer's StackFood wallet via `POST /admin/customer/wallet/add-fund`
 * (Integration Spec Flow 4, Pattern B). This is the live wiring behind the
 * abuse-proof `ReferralEngine`: when a referred customer's first order
 * settles, the referrer and referee wallets are actually credited.
 *
 * Two things it must not do:
 *  - It never trusts a wa_id → customer_id mapping it can't resolve; an
 *    unresolved customer throws (surfaced + ledgered by the caller) rather
 *    than silently crediting nobody.
 *  - It carries the referral `reason` straight into the fund `reference`, so
 *    every credit is auditable back to the exact TK ref in StackFood.
 */
export interface StackFoodCreditConfig {
  client: StackFoodClient;
  /** Resolve a WhatsApp id → StackFood customer_id (Redis/PG in prod). */
  resolveCustomerId: (waId: string) => Promise<number | undefined>;
  /** Admin bearer token provider (rotatable; fetched per call). */
  adminToken: () => Promise<string>;
  ledger?: LedgerSink;
}

export class StackFoodCreditIssuer implements CreditIssuer {
  constructor(private readonly config: StackFoodCreditConfig) {}

  async issueCredit(waId: string, amountFc: number, reason: string): Promise<void> {
    if (!(amountFc > 0)) {
      throw new Error(`refusing non-positive credit (${amountFc}) for ${waId}`);
    }
    const customerId = await this.config.resolveCustomerId(waId);
    if (customerId === undefined) {
      throw new Error(`cannot credit ${waId}: no StackFood customer_id resolved`);
    }
    const token = await this.config.adminToken();
    await this.config.client.adminWalletAddFund(
      { customer_id: customerId, amount: amountFc, reference: reason },
      token,
    );
    this.config.ledger?.write({
      type: "lifecycle",
      agent: "growth",
      purpose: `wallet credit ${amountFc} FC → ${waId} (${reason})`,
      costUsd: 0,
      at: new Date(),
    });
  }
}
