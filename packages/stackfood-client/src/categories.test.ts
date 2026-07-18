import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryById, displayOrder } from "./categories.js";

const CSV_PATH = fileURLToPath(
  new URL("../../../docs/data/Categories.csv", import.meta.url),
);

/** Parse the admin export: "sl","Nom","ID","Priorité","Statut" rows. */
function parseExport(): {
  name: string;
  id: number;
  priority: string;
  active: boolean;
}[] {
  return readFileSync(CSV_PATH, "utf8")
    .split("\n")
    .map((line) => line.match(/^"(\d+)","([^"]+)","(\d+)","([^"]+)","([^"]+)"/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({
      name: m[2]!,
      id: Number(m[3]),
      priority: m[4]!,
      active: m[5] === "Actif",
    }));
}

describe("production category registry (docs/data/Categories.csv)", () => {
  it("matches the admin export exactly — no drift", () => {
    const exported = parseExport();
    expect(exported).toHaveLength(17);
    expect(
      CATEGORIES.map(({ id, name, priority, active }) => ({
        name,
        id,
        priority,
        active,
      })),
    ).toEqual(exported);
  });

  it("orders home-screen tiles haut → moyen → normale, sl order within band", () => {
    const ordered = displayOrder(CATEGORIES);
    expect(ordered.slice(0, 6).map((c) => c.name)).toEqual([
      "Menu Enfant",
      "Épiceries",
      "Promo",
      "Restaurant",
      "Fast Food",
      "Pizzérias",
    ]);
    expect(ordered[ordered.length - 1]!.priority).toBe("normale");
  });

  it("resolves StackFood category IDs", () => {
    expect(categoryById(90)?.name).toBe("Taco");
    expect(categoryById(7)?.name).toBe("Cuisine Locale");
    expect(categoryById(999)).toBeUndefined();
  });
});
