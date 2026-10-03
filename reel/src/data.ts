/**
 * Hungrillz menu, transcribed from the printed menu card (the source of truth).
 * Names keep the menu's exact spelling and casing. Prices are in rupees.
 * `veg: true` = printed with the green veg square on the menu.
 *
 * Transcription notes:
 * - Fries carry no veg square on the menu, so they are left unmarked here.
 * - Non-veg items are not labelled on the menu; anything without a veg square is treated as non-veg.
 * - Meal prices are printed once per section ("Meal: Rs.199 (with fries & soft drink)"), so
 *   the card does not say whether they apply to every variant; they are stored per category.
 */

export type MenuItem = { name: string; price: number; veg: boolean };
export type AddOn = { name: string; price: number };
export type Meal = { price: number; includes: string };

export type Category = {
  id: "fries" | "shawarma" | "burgers" | "sandwiches" | "kebabs";
  title: string;
  items: MenuItem[];
  addOns: AddOn[];
  meal?: Meal;
  /** Cutout and hero image (public/food), produced by scripts/food_treatment.py */
  photo: { cutout: string; hero: string };
};

const MEAL_INCLUDES = "fries & soft drink";
const v = (name: string, price: number): MenuItem => ({ name, price, veg: true });
const n = (name: string, price: number): MenuItem => ({ name, price, veg: false });
const photo = (id: string) => ({ cutout: `food/${id}-cutout.png`, hero: `food/${id}-hero.png` });

export const MENU: Category[] = [
  {
    id: "fries",
    title: "Fries",
    items: [n("Classic", 79), n("Peri peri", 89)],
    addOns: [{ name: "Special Mayonnaise", price: 25 }],
    photo: photo("fries"),
  },
  {
    id: "shawarma",
    title: "Shawarma",
    items: [
      v("Classic paneer", 129),
      v("Smoky paneer", 139),
      n("Original", 129),
      n("Peri peri", 139),
      n("Tandoori", 139),
      n("Chilli garlic", 139),
      n("Butter chicken", 139),
    ],
    addOns: [{ name: "Extra chicken", price: 10 }],
    meal: { price: 199, includes: MEAL_INCLUDES },
    photo: photo("shawarma"),
  },
  {
    id: "burgers",
    title: "Burgers",
    items: [
      v("Classic paneer", 119),
      v("Smoky paneer", 129),
      n("Original", 119),
      n("Peri peri", 129),
      n("Tandoori", 129),
      n("Chilli garlic", 129),
      n("Butter chicken", 129),
    ],
    addOns: [],
    meal: { price: 189, includes: MEAL_INCLUDES },
    photo: photo("burger"),
  },
  {
    id: "sandwiches",
    title: "Sandwiches",
    items: [
      v("Classic paneer", 109),
      v("Smoky paneer", 119),
      n("Original", 109),
      n("Peri peri", 119),
      n("Tandoori", 119),
      n("Chilli garlic", 119),
      n("Butter chicken", 119),
    ],
    addOns: [],
    meal: { price: 179, includes: MEAL_INCLUDES },
    photo: photo("sandwich"),
  },
  {
    id: "kebabs",
    title: "Kebabs",
    items: [
      v("Hara bara", 110),
      v("Paneer tikka", 120),
      v("Hariyali paneer", 130),
      n("Tikka", 120),
      n("Reshmi", 120),
      n("Pahadi", 125),
      n("Hariyali", 130),
      n("Wings", 135),
      n("Garlic", 140),
      n("Tangdi (2pcs)", 150),
      n("Tandoori joint", 150),
      n("Alfaham joint", 160),
    ],
    addOns: [{ name: "Rumali roti", price: 15 }],
    photo: photo("kebab"),
  },
];

/** Taglines printed on the menu card and in the logo. */
export const TAGLINES = {
  logo: "Crave. Grill. Repeat.",
  tastes: "Yes, it tastes as good as it sounds",
  cheat: "Finally, a cheat meal that isn't cheating",
  fire: "Where there's fire, there's flavour",
} as const;

export const byId = (id: Category["id"]) => MENU.find((c) => c.id === id)!;
export const fromPrice = (c: Category) => Math.min(...c.items.map((i) => i.price));
export const ITEM_COUNT = MENU.reduce((s, c) => s + c.items.length, 0);
export const rupees = (p: number) => `₹${p}`;
