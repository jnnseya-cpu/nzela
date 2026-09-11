import { FileKV } from "@nzela/persistence";
import type { OpenOrder } from "@nzela/lipa-ingest";

/**
 * The join between the two live services: the gateway PLACES an order (knows
 * its TK ref, total and the customer's wa_id) and the lipa ingest VERIFIES
 * the payment (knows only the amount + TK ref parsed from an SMS). Without a
 * shared record of what's owed, lipa has nothing to match a payment against
 * and the gateway can never tell the customer "payment received".
 *
 * This is that shared, durable record. It is the `openOrders()` source lipa
 * reads and the `markPaid()` sink its verified callback writes — file-backed
 * so a placed-but-unpaid order survives a restart (single instance). A
 * multi-instance deploy puts the same three methods on Redis/Postgres.
 */
export interface OpenOrderRecord {
  tkRef: string;
  totalFc: number;
  waId: string;
  placedAtIso: string;
  paidAtIso?: string;
  operator?: string;
}

export class OpenOrderBook {
  private readonly kv: FileKV;
  /** `encryptionKey` encrypts the order book (customer wa_id PII) at rest. */
  constructor(path: string, encryptionKey?: string | Buffer) {
    this.kv = new FileKV(path, { encryptionKey });
  }

  /** Record a freshly placed, unpaid order. */
  add(rec: { tkRef: string; totalFc: number; waId: string; placedAt?: Date }): void {
    this.kv.set(rec.tkRef, {
      tkRef: rec.tkRef,
      totalFc: rec.totalFc,
      waId: rec.waId,
      placedAtIso: (rec.placedAt ?? new Date()).toISOString(),
    } satisfies OpenOrderRecord);
  }

  /** Unpaid orders in the shape lipa's matcher expects. */
  open(): readonly OpenOrder[] {
    return this.kv
      .keys()
      .map((k) => this.kv.get<OpenOrderRecord>(k))
      .filter((r): r is OpenOrderRecord => !!r && !r.paidAtIso)
      .map((r) => ({
        tkRef: r.tkRef,
        totalFc: r.totalFc,
        waId: r.waId,
        placedAt: new Date(r.placedAtIso),
      }));
  }

  /** Look up the customer behind a TK ref (to notify on payment). */
  waIdFor(tkRef: string): string | undefined {
    return this.kv.get<OpenOrderRecord>(tkRef)?.waId;
  }

  /** Flip an order to paid. Idempotent — a replayed callback is a no-op. */
  markPaid(tkRef: string, operator: string): boolean {
    const rec = this.kv.get<OpenOrderRecord>(tkRef);
    if (!rec || rec.paidAtIso) return false;
    this.kv.set(tkRef, {
      ...rec,
      paidAtIso: new Date().toISOString(),
      operator,
    } satisfies OpenOrderRecord);
    return true;
  }
}
