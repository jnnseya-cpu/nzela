import { describe, it, expect } from "vitest";
import {
  InMemoryPasswordVault,
  emailForWaId,
  tokenCacheKey,
  type PasswordVault,
} from "./auth.js";

describe("InMemoryPasswordVault", () => {
  it("returns the same password for a wa_id across calls (stable within process)", async () => {
    const vault = new InMemoryPasswordVault();
    const a = await vault.passwordFor("+243810000047");
    const b = await vault.passwordFor("+243810000047");
    expect(a).toBe(b);
  });

  it("produces distinct passwords for distinct wa_ids", async () => {
    const vault = new InMemoryPasswordVault();
    const a = await vault.passwordFor("+243810000047");
    const b = await vault.passwordFor("+243990000011");
    expect(a).not.toBe(b);
  });

  it("emits a strong-shaped password (symbol + letters + digits, length >= 12)", async () => {
    const vault = new InMemoryPasswordVault();
    const pw = await vault.passwordFor("+243810000047");
    expect(pw.length).toBeGreaterThanOrEqual(12);
    expect(pw).toMatch(/[!@#$%^&*]/);
    expect(pw).toMatch(/[a-zA-Z]/);
    expect(pw).toMatch(/[0-9]/);
  });

  it("satisfies the PasswordVault interface (assignable, injectable)", async () => {
    const vault: PasswordVault = new InMemoryPasswordVault();
    await expect(vault.passwordFor("+243810000047")).resolves.toBeTypeOf("string");
  });
});

describe("auth helpers", () => {
  it("builds the synthetic StackFood email without a leading +", () => {
    expect(emailForWaId("+243810000047")).toBe("243810000047@wa.tunakula.com");
  });

  it("namespaces the token cache key per customer wa_id", () => {
    expect(tokenCacheKey("+243810000047")).toBe("token:cust:+243810000047");
  });
});
