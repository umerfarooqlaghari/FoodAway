/** Strip to digits only. */
function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Normalize to E.164-style +923001234567 (default country PK).
 */
function normalizePhone(phone, defaultCountry = 'PK') {
  const digits = phoneDigits(phone);
  if (!digits) return '';

  if (defaultCountry === 'PK') {
    if (digits.startsWith('92') && digits.length >= 12) {
      return `+${digits}`;
    }
    if (digits.startsWith('0') && digits.length === 11) {
      return `+92${digits.slice(1)}`;
    }
    if (digits.length === 10 && digits.startsWith('3')) {
      return `+92${digits}`;
    }
    if (digits.length >= 10) {
      return `+${digits}`;
    }
  }

  return digits.startsWith('+') ? phone.trim() : `+${digits}`;
}

/** Variants to match stored phone formats (+92…, 92…, 03…, etc.). */
function phoneLookupVariants(phone) {
  const digits = phoneDigits(phone);
  if (!digits) return [];

  const variants = new Set();
  const add = (v) => {
    if (v) variants.add(v);
  };

  add(normalizePhone(phone));
  add(`+${digits}`);
  add(digits);

  if (digits.startsWith('92') && digits.length >= 12) {
    add(`0${digits.slice(2)}`);
    add(digits.slice(2));
  } else if (digits.startsWith('0') && digits.length === 11) {
    add(`+92${digits.slice(1)}`);
    add(`92${digits.slice(1)}`);
    add(digits.slice(1));
  } else if (digits.length === 10 && digits.startsWith('3')) {
    add(`+92${digits}`);
    add(`92${digits}`);
    add(`0${digits}`);
  }

  return [...variants];
}

function phonesMatch(a, b) {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const tail = (d) => (d.length >= 10 ? d.slice(-10) : d);
  return tail(da) === tail(db);
}

module.exports = {
  phoneDigits,
  normalizePhone,
  phoneLookupVariants,
  phonesMatch,
};
