// --- Pure Validation & Business Logic Helpers ---
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(normalized);
};

const isValidPakPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('923') && digitsOnly.length === 12) return true;
  if (digitsOnly.startsWith('03') && digitsOnly.length === 11) return true;
  if (digitsOnly.startsWith('3') && digitsOnly.length === 10) return true;
  return false;
};

const normalizePhone = (phone) => {
  const digitsOnly = String(phone || '').replace(/\D/g, '');
  if (digitsOnly.startsWith('923') && digitsOnly.length === 12) return `+${digitsOnly}`;
  if (digitsOnly.startsWith('03') && digitsOnly.length === 11) return `+92${digitsOnly.slice(1)}`;
  if (digitsOnly.startsWith('3') && digitsOnly.length === 10) return `+92${digitsOnly}`;
  return phone;
};

const isValidPassword = (pass) => {
  if (!pass || typeof pass !== 'string') return false;
  if (pass.length < 8) return false;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasDigit = /[0-9]/.test(pass);
  return hasUpper && hasLower && hasDigit;
};

describe('Grabengo Application Bug Fixes - Unit & Integration Test Suite', () => {

  describe('Bug 7, 8, 9: Field Validations (Email, Password, Pakistani Phone)', () => {
    it('should validate email addresses correctly (Bug 7)', () => {
      expect(isValidEmail('sabeerah@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);

      expect(isValidEmail('sabeerah+1@.com')).toBe(false);
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missinguser.com')).toBe(false);
    });

    it('should validate Pakistani mobile numbers strictly starting with 03 or +923 (Bug 9)', () => {
      expect(isValidPakPhone('03001234567')).toBe(true);
      expect(isValidPakPhone('+923001234567')).toBe(true);
      expect(isValidPakPhone('923451234567')).toBe(true);

      expect(isValidPakPhone('00000000')).toBe(false);
      expect(isValidPakPhone('04235711111')).toBe(false); // landline 042 invalid
      expect(isValidPakPhone('030012345')).toBe(false);    // too short
    });

    it('should normalize Pakistani phone numbers to E.164 +923xx format', () => {
      expect(normalizePhone('03001234567')).toBe('+923001234567');
      expect(normalizePhone('923001234567')).toBe('+923001234567');
      expect(normalizePhone('+923001234567')).toBe('+923001234567');
    });

    it('should enforce strong password policy requiring 8+ chars, upper, lower, and digit (Bug 8)', () => {
      expect(isValidPassword('StrongPass123')).toBe(true);
      expect(isValidPassword('Grabengo20')).toBe(true);

      expect(isValidPassword('Qwerty')).toBe(false);      // weak / short
      expect(isValidPassword('alllowercase1')).toBe(false); // missing uppercase
      expect(isValidPassword('ALLUPPERCASE1')).toBe(false); // missing lowercase
      expect(isValidPassword('NoDigitsHere')).toBe(false);  // missing digit
    });
  });

  describe('Bug 13: Dynamic Stock Counter Calculation & Max Capacity', () => {
    function computeRemainingStock(initialStock, cartQuantity) {
      const init = Number(initialStock) || 0;
      const cart = Number(cartQuantity) || 0;
      return Math.max(0, init - cart);
    }

    it('should dynamically calculate remaining stock when items are added to cart', () => {
      expect(computeRemainingStock(30, 0)).toBe(30);
      expect(computeRemainingStock(30, 1)).toBe(29);
      expect(computeRemainingStock(30, 5)).toBe(25);
      expect(computeRemainingStock(30, 30)).toBe(0);
      expect(computeRemainingStock(30, 35)).toBe(0);
    });

    it('should identify when max stock is reached while keeping stepper enabled for decrement', () => {
      const initialStock = 1;
      const cartQuantity = 1;
      const remainingStock = computeRemainingStock(initialStock, cartQuantity);
      const isAtMaxStock = initialStock > 0 && remainingStock === 0;

      expect(remainingStock).toBe(0);
      expect(isAtMaxStock).toBe(true);
      expect(cartQuantity > 0).toBe(true);
    });
  });

  describe('Bug 16: Unified Single Transaction Booking Reference Code', () => {
    function formatOrderRef(orderIds) {
      const primaryId = Array.isArray(orderIds) && orderIds.length > 0 ? orderIds[0] : orderIds;
      return `GTG-${String(primaryId || 1).padStart(5, '0')}`;
    }

    it('should map a single checkout transaction to one unique booking reference ID', () => {
      expect(formatOrderRef([106, 107, 108])).toBe('GTG-00106');
      expect(formatOrderRef(106)).toBe('GTG-00106');
      expect(formatOrderRef([42])).toBe('GTG-00042');
    });
  });

  describe('Bug 20: Custom Distance Filter Auto-Reset', () => {
    function processCustomDistance(inputValue) {
      const trimmed = String(inputValue || '').trim();
      if (!trimmed) return null;
      const n = parseFloat(trimmed);
      return (!isNaN(n) && n > 0) ? n : null;
    }

    it('should auto-reset to null (Any distance) when custom distance value is cleared or empty', () => {
      expect(processCustomDistance('5')).toBe(5);
      expect(processCustomDistance('12.5')).toBe(12.5);
      expect(processCustomDistance('')).toBeNull();
      expect(processCustomDistance('   ')).toBeNull();
      expect(processCustomDistance(null)).toBeNull();
    });
  });

  describe('Bug 21 & 31: Full Name Special Character & Digit Validation', () => {
    function isValidName(name) {
      if (!name || typeof name !== 'string' || !name.trim()) return false;
      return !/[0-9!@#$%^&*()_+=\[\]{};:"\\|,.<>\/?]/.test(name);
    }

    it('should validate full names and reject digits or special characters', () => {
      expect(isValidName('Sabeera Khan')).toBe(true);
      expect(isValidName('John Doe')).toBe(true);
      expect(isValidName('Mary-Jane')).toBe(true);

      expect(isValidName('John Doe 123')).toBe(false);
      expect(isValidName('Sabeerah@Khan')).toBe(false);
      expect(isValidName('Jane#Doe')).toBe(false);
    });
  });

  describe('Bug 28: Food Item Pickup Time Fallback', () => {
    function resolvePickupTime(bagPickupTime, storePickupWindow) {
      if (bagPickupTime && bagPickupTime !== 'N/A') return bagPickupTime;
      return storePickupWindow || 'Everyday 10:00 AM - 10:00 PM';
    }

    it('should fallback to store pickup window or standard hours instead of N/A for regular food items', () => {
      expect(resolvePickupTime('Today 17:00 - 18:00', 'Mon-Fri 09:00 - 21:00')).toBe('Today 17:00 - 18:00');
      expect(resolvePickupTime(null, 'Mon-Fri 09:00 - 21:00')).toBe('Mon-Fri 09:00 - 21:00');
      expect(resolvePickupTime('N/A', null)).toBe('Everyday 10:00 AM - 10:00 PM');
    });
  });

  describe('Bug 33: Profile Form Pristine State Check', () => {
    function isFormModified(initial, current) {
      return (
        (current.name || '').trim() !== (initial.name || '').trim() ||
        (current.email || '').trim() !== (initial.email || '').trim() ||
        (current.phone || '').trim() !== (initial.phone || '').trim()
      );
    }

    it('should correctly detect pristine versus modified profile form states', () => {
      const user = { name: 'Sabeera', email: 'sab@example.com', phone: '+923001234567' };
      expect(isFormModified(user, { name: 'Sabeera', email: 'sab@example.com', phone: '+923001234567' })).toBe(false);
      expect(isFormModified(user, { name: 'Sabeera Khan', email: 'sab@example.com', phone: '+923001234567' })).toBe(true);
    });
  });
});
