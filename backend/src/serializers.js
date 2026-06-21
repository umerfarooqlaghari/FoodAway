function formatStoreReview(row) {
  return {
    id: row.id,
    store_id: row.store_id,
    store_name: row.store_name,
    customer_name: row.customer_name,
    rating: row.rating,
    comment: row.comment,
    tags: row.tags,
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
};
