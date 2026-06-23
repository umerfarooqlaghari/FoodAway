/**
 * Canonical product categories for food, grocery, and supermarket items.
 * Shared across backend, admin-web, and mobile-app.
 */

const PRODUCT_CATEGORY_GROUPS = [
  {
    id: 'fresh_food',
    label: 'Fresh & prepared food',
    categories: [
      'Fresh Food',
      'Bakery',
      'Meals',
      'Sandwiches',
      'Pizza',
      'Sushi',
      'Salads',
      'Desserts',
      'Snacks',
    ],
  },
  {
    id: 'beverages',
    label: 'Beverages',
    categories: ['Drinks', 'Coffee & Tea', 'Coffee & Drinks'],
  },
  {
    id: 'grocery',
    label: 'Grocery & pantry',
    categories: [
      'Groceries',
      'Frozen',
      'Dairy & Eggs',
      'Meat & Seafood',
      'Produce',
      'Canned & Packaged',
    ],
  },
  {
    id: 'household',
    label: 'Household & supermarket',
    categories: [
      'Household & Cleaning',
      'Personal Care',
      'Baby & Kids',
      'Pet Supplies',
    ],
  },
  {
    id: 'other',
    label: 'Other',
    categories: ['Other'],
  },
];

/** Maps old category values saved in the DB to current labels. */
const LEGACY_CATEGORY_ALIASES = {
  Household: 'Household & Cleaning',
};

const PRODUCT_CATEGORIES = [
  ...new Set(PRODUCT_CATEGORY_GROUPS.flatMap((g) => g.categories)),
];

const LEGACY_PRODUCT_CATEGORIES = [
  'Household',
  'Pizza',
  'Coffee & Drinks',
  'Sushi',
  'Salads',
];

const BROWSE_PRODUCT_FILTERS = [
  'All',
  ...PRODUCT_CATEGORIES,
  ...LEGACY_PRODUCT_CATEGORIES.filter((c) => !PRODUCT_CATEGORIES.includes(c)),
];

const CATEGORY_COLORS = {
  Groceries: '#DCFCE7',
  Household: '#E0E7FF',
  'Household & Cleaning': '#E0E7FF',
  'Fresh Food': '#D1FAE5',
  Bakery: '#FEF3C7',
  Meals: '#D1FAE5',
  Drinks: '#DBEAFE',
  Snacks: '#FCE7F3',
  Frozen: '#E0F2FE',
  'Personal Care': '#F3E8FF',
  'Baby & Kids': '#FCE7F3',
  'Pet Supplies': '#FEF3C7',
  'Dairy & Eggs': '#FEF9C3',
  'Meat & Seafood': '#FEE2E2',
  Produce: '#D1FAE5',
  'Canned & Packaged': '#E5E7EB',
  Desserts: '#EDE9FE',
  'Coffee & Tea': '#FFEDD5',
  'Coffee & Drinks': '#FFEDD5',
  Sandwiches: '#FEE2E2',
  Pizza: '#FEE2E2',
  Sushi: '#E0F2FE',
  Salads: '#D1FAE5',
  Other: '#F3F4F6',
};

function normalizeProductCategory(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return 'Other';
  if (LEGACY_CATEGORY_ALIASES[trimmed]) return LEGACY_CATEGORY_ALIASES[trimmed];
  if (PRODUCT_CATEGORIES.includes(trimmed)) return trimmed;
  if (LEGACY_PRODUCT_CATEGORIES.includes(trimmed)) return trimmed;
  return 'Other';
}

function categoriesMatch(filter, itemCategory) {
  if (!filter || filter === 'All') return true;
  const normalized = normalizeProductCategory(itemCategory);
  return filter === itemCategory || filter === normalized;
}

module.exports = {
  PRODUCT_CATEGORY_GROUPS,
  PRODUCT_CATEGORIES,
  LEGACY_PRODUCT_CATEGORIES,
  LEGACY_CATEGORY_ALIASES,
  BROWSE_PRODUCT_FILTERS,
  CATEGORY_COLORS,
  normalizeProductCategory,
  categoriesMatch,
};
