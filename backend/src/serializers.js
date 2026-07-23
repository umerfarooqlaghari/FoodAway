function parseReviewTags(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string') {
    try {
      let parsed = JSON.parse(raw);
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return raw.trim() ? [raw.trim()] : [];
    }
  }
  return [];
}

function formatStoreReview(row) {
  return {
    id: row.id,
    store_id: row.store_id,
    store_name: row.store_name,
    customer_name: row.customer_name,
    rating: Number(row.rating) || 0,
    comment: row.comment,
    tags: parseReviewTags(row.tags),
    created_at: row.created_at,
  };
}

function formatAppReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    customer_name: row.customer_name,
  };
}

function stripStoreTenantId(store, role) {
  if (role === 'SuperAdmin') return store;
  const { tenant_id, ...rest } = store;
  return rest;
}

module.exports = {
  formatStoreReview,
  formatAppReview,
  stripStoreTenantId,
  parseReviewTags,
};
