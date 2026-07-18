import type { StackFoodClient } from "./client.js";
import { StackFoodHttpError } from "./client.js";

/**
 * Identity strategy — Integration Spec §2: one StackFood customer per
 * WhatsApp number. On first order the Adapter auto-provisions an account
 * keyed to the customer's wa_id; passwords live only in the secrets vault,
 * customers never see them.
 */

export interface TokenCache {
  /** Key convention: `token:cust:<wa_id>`. */
  get(key: string): Promise<string | undefined>;
  set(key: string, token: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryTokenCache implements TokenCache {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | undefined> {
    return this.store.get(key);
  }
  async set(key: string, token: string): Promise<void> {
    this.store.set(key, token);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export interface PasswordVault {
  /** Returns the stored password for the wa_id, generating on first use. */
  passwordFor(waId: string): Promise<string>;
}

/** Synthetic e-mail per §2: `<phone>@wa.tunakula.com` (no leading +). */
export function emailForWaId(waId: string): string {
  return `${waId.replace(/^\+/, "")}@wa.tunakula.com`;
}

export const tokenCacheKey = (waId: string): string => `token:cust:${waId}`;

export class CustomerAuthProvisioner {
  constructor(
    private readonly client: StackFoodClient,
    private readonly cache: TokenCache,
    private readonly vault: PasswordVault,
  ) {}

  /**
   * Returns a bearer token for the wa_id: cached when warm; login when the
   * account exists; register-then-login on first contact. A 401/403 on
   * login for an unknown account falls through to registration.
   */
  async tokenFor(waId: string): Promise<string> {
    const cached = await this.cache.get(tokenCacheKey(waId));
    if (cached) return cached;

    const password = await this.vault.passwordFor(waId);
    let token: string;
    try {
      token = await this.login(waId, password);
    } catch (err) {
      if (err instanceof StackFoodHttpError && err.status < 500) {
        await this.register(waId, password);
        token = await this.login(waId, password);
      } else {
        throw err;
      }
    }
    await this.cache.set(tokenCacheKey(waId), token);
    return token;
  }

  /** Drop a cached token after a 401 so the next call re-authenticates. */
  async invalidate(waId: string): Promise<void> {
    await this.cache.delete(tokenCacheKey(waId));
  }

  private async login(waId: string, password: string): Promise<string> {
    const res = await this.client.request<{ token: string }>(`/auth/login`, {
      method: "POST",
      body: { phone: waId, password },
    });
    return res.token;
  }

  private async register(waId: string, password: string): Promise<void> {
    await this.client.request(`/auth/register`, {
      method: "POST",
      body: {
        f_name: "Client",
        l_name: "WhatsApp",
        phone: waId,
        email: emailForWaId(waId),
        password,
      },
    });
  }
}
