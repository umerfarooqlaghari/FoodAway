const {
  normalizeProductCategory,
  categoriesMatch,
  PRODUCT_CATEGORIES,
} = require('../src/productCategories');

describe('productCategories', () => {
  it('normalizes legacy Household to Household & Cleaning', () => {
    expect(normalizeProductCategory('Household')).toBe('Household & Cleaning');
  });

  it('keeps supermarket and food categories', () => {
    expect(normalizeProductCategory('Household & Cleaning')).toBe('Household & Cleaning');
    expect(normalizeProductCategory('Dairy & Eggs')).toBe('Dairy & Eggs');
    expect(normalizeProductCategory('Meals')).toBe('Meals');
  });

  it('falls back unknown labels to Other', () => {
    expect(normalizeProductCategory('Random Stuff')).toBe('Other');
  });

  it('matches legacy categories when filtering', () => {
    expect(categoriesMatch('Household & Cleaning', 'Household')).toBe(true);
    expect(categoriesMatch('Groceries', 'Groceries')).toBe(true);
    expect(categoriesMatch('All', 'Anything')).toBe(true);
  });

  it('includes detergent-friendly categories', () => {
    expect(PRODUCT_CATEGORIES).toContain('Household & Cleaning');
    expect(PRODUCT_CATEGORIES).toContain('Personal Care');
    expect(PRODUCT_CATEGORIES).toContain('Baby & Kids');
  });
});
