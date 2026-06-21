const { normalizePhone, phoneLookupVariants, phonesMatch } = require('../src/phone');

describe('phone normalization', () => {
  test('normalizes Pakistani local format', () => {
    expect(normalizePhone('03009243063')).toBe('+923009243063');
  });

  test('normalizes with country code', () => {
    expect(normalizePhone('+923009243063')).toBe('+923009243063');
  });

  test('lookup variants include common formats', () => {
    const variants = phoneLookupVariants('+923009243063');
    expect(variants).toContain('+923009243063');
    expect(variants).toContain('03009243063');
  });

  test('phonesMatch compares trailing digits', () => {
    expect(phonesMatch('+923009243063', '03009243063')).toBe(true);
    expect(phonesMatch('+923009243063', '+923009243064')).toBe(false);
  });
});
