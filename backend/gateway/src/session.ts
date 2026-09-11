import { FileKV } from "@nzela/persistence";

/**
 * Conversation session — the per-customer state the order flow needs to be
 * real: which restaurant they picked, what's in the cart, which numbered
 * list they're replying to, and the phase they're in. Durable (FileKV) so a
 * conversation survives a restart; in-memory variant for tests.
 */

export type Phase =
  | "idle"
  | "selecting-restaurant"
  | "browsing-menu"
  | "cart-review"
  | "awaiting-address"
  | "awaiting-payment"
  | "placed";

export interface CartItem {
  food_id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Session {
  waId: string;
  phase: Phase;
  restaurantId?: number;
  restaurantName?: string;
  /** The last numbered list shown, so a reply of "2" resolves correctly. */
  restaurantList?: { id: number; name: string }[];
  menuList?: { food_id: number; name: string; price: number }[];
  cart: CartItem[];
  addressText?: string;
  tkRef?: string;
  orderId?: number;
}

export function emptySession(waId: string): Session {
  return { waId, phase: "idle", cart: [] };
}

export interface SessionStore {
  get(waId: string): Promise<Session>;
  save(s: Session): Promise<void>;
  reset(waId: string): Promise<void>;
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  async get(waId: string): Promise<Session> {
    return this.sessions.get(waId) ?? emptySession(waId);
  }
  async save(s: Session): Promise<void> {
    this.sessions.set(s.waId, s);
  }
  async reset(waId: string): Promise<void> {
    this.sessions.delete(waId);
  }
}

/** Durable session store — conversations survive a restart (single instance). */
export class FileSessionStore implements SessionStore {
  private readonly kv: FileKV;
  /** `encryptionKey` encrypts sessions (address/phone PII) at rest. */
  constructor(path: string, encryptionKey?: string | Buffer) {
    this.kv = new FileKV(path, { encryptionKey });
  }
  async get(waId: string): Promise<Session> {
    return this.kv.get<Session>(waId) ?? emptySession(waId);
  }
  async save(s: Session): Promise<void> {
    this.kv.set(s.waId, s);
  }
  async reset(waId: string): Promise<void> {
    this.kv.delete(waId);
  }
}
