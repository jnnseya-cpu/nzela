/**
 * Production category registry — exported from the StackFood admin at
 * cd.tunakula.com (docs/data/Categories.csv is the source export; a test
 * asserts this module never drifts from it). IDs are StackFood category
 * IDs; `priority` is the admin display priority driving home-screen tile
 * order (haut first, then moyen, then normale, admin sl order within each).
 *
 * Sub-categories: pending the admin sub-category export (Open Item); the
 * `parentId` field is ready for them.
 */

export type CategoryPriority = "haut" | "moyen" | "normale";

export interface Category {
  id: number;
  name: string;
  priority: CategoryPriority;
  active: boolean;
  parentId?: number;
}

export const CATEGORIES: Category[] = [
  { id: 158, name: "Menu Enfant", priority: "haut", active: true },
  { id: 151, name: "Accompagnements", priority: "moyen", active: true },
  { id: 144, name: "Boulangeries", priority: "moyen", active: true },
  { id: 139, name: "Épiceries", priority: "haut", active: true },
  { id: 138, name: "Essentiel", priority: "normale", active: true },
  { id: 110, name: "Dessert", priority: "moyen", active: true },
  { id: 108, name: "Végétarienne", priority: "moyen", active: true },
  { id: 107, name: "Promo", priority: "haut", active: true },
  { id: 95, name: "Viande et Poisson", priority: "normale", active: true },
  { id: 94, name: "Fruits et Légumes", priority: "normale", active: true },
  { id: 93, name: "Boisson", priority: "normale", active: true },
  { id: 90, name: "Taco", priority: "moyen", active: true },
  { id: 7, name: "Cuisine Locale", priority: "moyen", active: true },
  { id: 6, name: "Supermarché", priority: "moyen", active: true },
  { id: 5, name: "Restaurant", priority: "haut", active: true },
  { id: 4, name: "Fast Food", priority: "haut", active: true },
  { id: 3, name: "Pizzérias", priority: "haut", active: true },
];

const PRIORITY_RANK: Record<CategoryPriority, number> = {
  haut: 0,
  moyen: 1,
  normale: 2,
};

/**
 * Home-screen / chip display order: admin priority bands, keeping the
 * export's sl order within each band (matches the prototype's tile row).
 */
export function displayOrder(categories: readonly Category[]): Category[] {
  return categories
    .map((c, sl) => ({ c, sl }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.c.priority] - PRIORITY_RANK[b.c.priority] ||
        a.sl - b.sl,
    )
    .map(({ c }) => c);
}

export function categoryById(id: number): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
