import { FileKV } from "@nzela/persistence";
import type { AcuWallet, AcuReservation } from "./acu.js";
import type { FundingLedger } from "./funding.js";

/**
 * Durable, file-backed implementations of the money-critical stores. These
 * are drop-in replacements for the in-memory versions that actually SURVIVE
 * A RESTART — the "reward once / fund once / balance" guarantees no longer
 * evaporate when the process restarts. Single-instance durability with no
 * external database (see FileKV); a multi-instance deploy still wants Redis
 * behind the same interfaces.
 */

/** File-backed idempotency store for top-ups & subscription-period grants. */
export class FileFundingLedger implements FundingLedger {
  private readonly kv: FileKV;
  constructor(path: string) {
    this.kv = new FileKV(path);
  }
  has(key: string): boolean {
    return this.kv.has(`f:${key}`);
  }
  add(key: string): void {
    this.kv.set(`f:${key}`, 1);
  }
}

/** File-backed ACU wallet — same validation/clamp guarantees as in-memory. */
export class FileAcuWallet implements AcuWallet {
  private readonly kv: FileKV;
  constructor(path: string) {
    this.kv = new FileKV(path);
  }
  private bal(a: string): number {
    return this.kv.get<number>(`bal:${a}`) ?? 0;
  }
  private held(a: string): number {
    return this.kv.get<number>(`held:${a}`) ?? 0;
  }

  topUp(account: string, acu: number): void {
    if (!Number.isInteger(acu) || acu <= 0) {
      throw new RangeError(`topUp requires a positive integer ACU, got ${acu}`);
    }
    this.kv.set(`bal:${account}`, this.bal(account) + acu);
  }

  balance(account: string): number {
    return this.bal(account) - this.held(account);
  }

  reserve(account: string, maxAcu: number): AcuReservation {
    const available = this.balance(account);
    if (!Number.isFinite(maxAcu) || maxAcu <= 0 || available < maxAcu) {
      return { ok: false, reserved: 0, balanceAfter: available };
    }
    this.kv.set(`held:${account}`, this.held(account) + maxAcu);
    return { ok: true, reserved: maxAcu, balanceAfter: this.balance(account) };
  }

  commit(account: string, reserved: number, actualAcu: number): void {
    const spend = Math.min(Math.max(actualAcu, 0), Math.max(reserved, 0));
    this.kv.set(`held:${account}`, Math.max(0, this.held(account) - reserved));
    this.kv.set(`bal:${account}`, Math.max(0, this.bal(account) - spend));
  }

  release(account: string, reserved: number): void {
    this.kv.set(`held:${account}`, Math.max(0, this.held(account) - reserved));
  }
}
