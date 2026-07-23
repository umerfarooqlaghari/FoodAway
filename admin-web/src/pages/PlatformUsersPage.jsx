import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../routePaths';
import LocationMapPicker from '../components/LocationMapPicker';
import ImageUploadField from '../components/ImageUploadField';
import { tenantStoreUrl, shortSubdomainFromName } from '../host';

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: '#F9FAFB',
  color: '#111827',
};

function parseStoredAddress(str) {
  if (!str) return { address: '', lat: 51.5074, lng: -0.1278 };
  const match = String(str).match(/^(.+?)\s+\(([-\d.]+),\s*([-\d.]+)\)$/);
  if (match) {
    return { address: match[1].trim(), lat: parseFloat(match[2]), lng: parseFloat(match[3]) };
  }
  return { address: String(str), lat: 51.5074, lng: -0.1278 };
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>{label}</label>
      {children}
      {hint ? <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0' }}>{hint}</p> : null}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="platform-stat-card">
      <div className="platform-stat-label">{label}</div>
      <div className="platform-stat-value">{value}</div>
      {hint ? <div className="platform-stat-hint">{hint}</div> : null}
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="glass-card portal-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} className="platform-icon-btn" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const SECTION_META = {
  tenants: {
    title: 'Tenants (Sellers)',
    addLabel: 'Add Tenant',
    resource: 'tenants',
    empty: 'No tenants yet. Click “Add Tenant” to onboard your first brand.',
  },
  partners: {
    title: 'Delivery Riders',
    addLabel: 'Add Rider',
    resource: 'partners',
    empty: 'No riders yet. Click “Add Rider” to register a delivery partner.',
  },
  customers: {
    title: 'Customers',
    addLabel: 'Add Customer',
    resource: 'customers',
    empty: 'No customers yet. Click “Add Customer” to create an account.',
  },
};

export default function PlatformUsersPage({ token, apiUrl, section = 'tenants' }) {
  const meta = SECTION_META[section] || SECTION_META.tenants;
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = () => ({
    tenantBrand: '',
    tenantEmail: '',
    tenantPhone: '',
    tenantPassword: '',
    tenantLogo: '',
    storeName: '',
    storeAddress: '',
    storeLat: 51.5074,
    storeLng: -0.1278,
    partnerName: '',
    partnerEmail: '',
    partnerPhone: '',
    partnerPassword: '',
    partnerCity: '',
    partnerLat: 51.5074,
    partnerLng: -0.1278,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerPassword: '',
    customerAddress: '',
    customerLat: 51.5074,
    customerLng: -0.1278,
  });

  const [form, setForm] = useState(emptyForm());
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/superadmin/${meta.resource}`, { headers });
      setRows(res.data || []);
      setSelectedIds([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token, section]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.name,
        row.email,
        row.phone,
        row.subdomain,
        row.primary_store_address,
        row.city,
        row.delivery_address,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    setEditingId(row.id);

    const applyTenantForm = (item) => {
      setForm({
        ...emptyForm(),
        tenantBrand: item.name || '',
        tenantEmail: item.admin_email || item.email || '',
        tenantPhone: item.phone || '',
        tenantLogo: item.logo || '',
        storeName: item.primary_store_name || '',
        storeAddress: item.primary_store_address || '',
        storeLat: item.primary_store_lat ?? 51.5074,
        storeLng: item.primary_store_lng ?? -0.1278,
      });
      setModalOpen(true);
    };

    const applyPartnerForm = (item) => {
      setForm({
        ...emptyForm(),
        partnerName: item.name || '',
        partnerEmail: item.email || '',
        partnerPhone: item.phone || '',
        partnerCity: item.city || '',
        partnerLat: item.duty_lat ?? 51.5074,
        partnerLng: item.duty_lng ?? -0.1278,
      });
      setModalOpen(true);
    };

    const applyCustomerForm = (item) => {
      const parsed = parseStoredAddress(item.delivery_address);
      setForm({
        ...emptyForm(),
        customerName: item.name || '',
        customerEmail: item.email || '',
        customerPhone: item.phone || '',
        customerAddress: parsed.address,
        customerLat: parsed.lat,
        customerLng: parsed.lng,
      });
      setModalOpen(true);
    };

    try {
      const res = await axios.get(`${apiUrl}/superadmin/${meta.resource}/${row.id}`, { headers });
      const item = res.data;
      if (section === 'tenants') applyTenantForm(item);
      else if (section === 'partners') applyPartnerForm(item);
      else applyCustomerForm(item);
    } catch (err) {
      // Fallback to list row if detail endpoint unavailable
      if (section === 'tenants') applyTenantForm(row);
      else if (section === 'partners') applyPartnerForm(row);
      else applyCustomerForm(row);
      if (!err.response || err.response.status !== 404) {
        console.warn('Edit detail fetch failed, using list row:', err.response?.data?.error || err.message);
      }
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (section === 'tenants') {
        const payload = {
          brand_name: form.tenantBrand.trim(),
          email: form.tenantEmail.trim(),
          phone: form.tenantPhone.trim(),
          logo: form.tenantLogo || undefined,
          store_name: form.storeName.trim() || form.tenantBrand.trim(),
          store_address: form.storeAddress.trim(),
          store_lat: form.storeAddress.trim() ? form.storeLat : undefined,
          store_lng: form.storeAddress.trim() ? form.storeLng : undefined,
        };
        if (editingId) {
          if (form.tenantPassword) payload.password = form.tenantPassword;
          await axios.put(`${apiUrl}/superadmin/tenants/${editingId}`, payload, { headers });
        } else {
          payload.password = form.tenantPassword;
          await axios.post(`${apiUrl}/superadmin/tenants`, payload, { headers });
        }
      } else if (section === 'partners') {
        const payload = {
          name: form.partnerName.trim(),
          email: form.partnerEmail.trim(),
          phone: form.partnerPhone.trim(),
          city: form.partnerCity.trim() || undefined,
          base_lat: form.partnerLat,
          base_lng: form.partnerLng,
        };
        if (editingId) {
          if (form.partnerPassword) payload.password = form.partnerPassword;
          await axios.put(`${apiUrl}/superadmin/partners/${editingId}`, payload, { headers });
        } else {
          payload.password = form.partnerPassword;
          await axios.post(`${apiUrl}/superadmin/partners`, payload, { headers });
        }
      } else {
        const payload = {
          name: form.customerName.trim(),
          email: form.customerEmail.trim(),
          phone: form.customerPhone.trim(),
          delivery_address: form.customerAddress.trim() || undefined,
          delivery_lat: form.customerAddress.trim() ? form.customerLat : undefined,
          delivery_lng: form.customerAddress.trim() ? form.customerLng : undefined,
        };
        if (editingId) {
          if (form.customerPassword) payload.password = form.customerPassword;
          await axios.put(`${apiUrl}/superadmin/customers/${editingId}`, payload, { headers });
        } else {
          payload.password = form.customerPassword;
          await axios.post(`${apiUrl}/superadmin/customers`, payload, { headers });
        }
      }
      closeModal();
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try {
      await axios.delete(`${apiUrl}/superadmin/${meta.resource}/${id}`, { headers });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected record(s)?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => axios.delete(`${apiUrl}/superadmin/${meta.resource}/${id}`, { headers })));
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Bulk delete failed');
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRows.map((r) => r.id));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const stats = useMemo(() => {
    if (section === 'tenants') {
      const withLocation = rows.filter((r) => r.primary_store_address).length;
      return [
        { label: 'Total Tenants', value: rows.length },
        { label: 'With Store Location', value: withLocation },
        { label: 'Total Stores', value: rows.reduce((sum, r) => sum + (r.store_count || 0), 0) },
      ];
    }
    if (section === 'partners') {
      const onDuty = rows.filter((r) => r.is_on_duty).length;
      return [
        { label: 'Total Riders', value: rows.length },
        { label: 'On Duty', value: onDuty },
        { label: 'Deliveries Completed', value: rows.reduce((sum, r) => sum + (r.delivered_count || 0), 0) },
      ];
    }
    return [
      { label: 'Total Customers', value: rows.length },
      { label: 'With Address', value: rows.filter((r) => r.delivery_address).length },
      { label: 'Total Orders', value: rows.reduce((sum, r) => sum + (r.order_count || 0), 0) },
    ];
  }, [rows, section]);

  const renderTable = () => {
    if (section === 'tenants') {
      return (
        <table>
          <thead>
            <tr>
              <th style={{ width: 42 }}><input type="checkbox" checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length} onChange={toggleAll} /></th>
              <th>Brand</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Stores</th>
              <th>Location</th>
              <th>Store URL</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={8} className="platform-table-empty">{meta.empty}</td></tr>
            ) : filteredRows.map((t) => (
              <tr key={t.id} className={selectedIds.includes(t.id) ? 'platform-row-selected' : ''}>
                <td><input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleOne(t.id)} /></td>
                <td>
                  <div className="platform-cell-brand">
                    {t.logo ? <img src={t.logo} alt="" className="platform-avatar" /> : <div className="platform-avatar platform-avatar-fallback">🏪</div>}
                    <div>
                      <strong>{t.name}</strong>
                      <div className="platform-cell-sub">{t.subdomain || '—'}</div>
                    </div>
                  </div>
                </td>
                <td>{t.email || t.admin_email || '—'}</td>
                <td>{t.phone || '—'}</td>
                <td><span className="platform-badge platform-badge-blue">{t.store_count || 0}</span></td>
                <td className="platform-cell-muted">{t.primary_store_address || 'No location'}</td>
                <td>{t.storeUrl ? <a href={t.storeUrl} target="_blank" rel="noreferrer" className="platform-link">{t.subdomain}</a> : '—'}</td>
                <td>
                  <div className="platform-row-actions">
                    <button type="button" className="platform-btn-edit" onClick={() => openEdit(t)}>Edit</button>
                    <button type="button" className="platform-btn-delete" onClick={() => handleDelete(t.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (section === 'partners') {
      return (
        <table>
          <thead>
            <tr>
              <th style={{ width: 42 }}><input type="checkbox" checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length} onChange={toggleAll} /></th>
              <th>Rider</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Service Area</th>
              <th>Status</th>
              <th>Deliveries</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={8} className="platform-table-empty">{meta.empty}</td></tr>
            ) : filteredRows.map((p) => (
              <tr key={p.id} className={selectedIds.includes(p.id) ? 'platform-row-selected' : ''}>
                <td><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} /></td>
                <td><strong>{p.name}</strong></td>
                <td>{p.email}</td>
                <td>{p.phone || '—'}</td>
                <td className="platform-cell-muted">{p.city || '—'}</td>
                <td>
                  <span className={`platform-badge ${p.is_on_duty ? 'platform-badge-green' : 'platform-badge-gray'}`}>
                    {p.is_on_duty ? 'On duty' : 'Off duty'}
                  </span>
                </td>
                <td>{p.delivered_count || 0}</td>
                <td>
                  <div className="platform-row-actions">
                    <button type="button" className="platform-btn-edit" onClick={() => openEdit(p)}>Edit</button>
                    <button type="button" className="platform-btn-delete" onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table>
        <thead>
          <tr>
            <th style={{ width: 42 }}><input type="checkbox" checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length} onChange={toggleAll} /></th>
            <th>Customer</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Delivery Address</th>
            <th>Orders</th>
            <th>Joined</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr><td colSpan={8} className="platform-table-empty">{meta.empty}</td></tr>
          ) : filteredRows.map((c) => (
            <tr key={c.id} className={selectedIds.includes(c.id) ? 'platform-row-selected' : ''}>
              <td><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleOne(c.id)} /></td>
              <td><strong>{c.name}</strong></td>
              <td>{c.email}</td>
              <td>{c.phone || '—'}</td>
              <td className="platform-cell-muted">{parseStoredAddress(c.delivery_address).address || '—'}</td>
              <td>{c.order_count || 0}</td>
              <td className="platform-cell-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
              <td>
                <div className="platform-row-actions">
                  <button type="button" className="platform-btn-edit" onClick={() => openEdit(c)}>Edit</button>
                  <button type="button" className="platform-btn-delete" onClick={() => handleDelete(c.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderForm = () => {
    if (section === 'tenants') {
      return (
        <form onSubmit={handleSubmit}>
          <Field label="Brand Name *">
            <input type="text" value={form.tenantBrand} onChange={(e) => setField('tenantBrand', e.target.value)} style={inputStyle} required />
          </Field>
          {!editingId && form.tenantBrand.trim() && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Store link: <strong style={{ color: 'var(--brand-orange)' }}>{tenantStoreUrl(shortSubdomainFromName(form.tenantBrand))}</strong>
            </p>
          )}
          <Field label="Admin Email *"><input type="email" value={form.tenantEmail} onChange={(e) => setField('tenantEmail', e.target.value)} style={inputStyle} required /></Field>
          <Field label="Phone *"><input type="tel" value={form.tenantPhone} onChange={(e) => setField('tenantPhone', e.target.value)} style={inputStyle} required /></Field>
          <Field label={editingId ? 'New Password (optional)' : 'Password *'}>
            <input type="password" value={form.tenantPassword} onChange={(e) => setField('tenantPassword', e.target.value)} style={inputStyle} required={!editingId} />
          </Field>
          <Field label="Brand Logo (optional)">
            <ImageUploadField value={form.tenantLogo} onChange={(v) => setField('tenantLogo', v)} />
          </Field>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.25rem 0' }} />
          <h4 style={{ marginBottom: '0.75rem' }}>First Store Location</h4>
          <Field label="Store Name" hint="Defaults to brand name if left blank">
            <input type="text" value={form.storeName} onChange={(e) => setField('storeName', e.target.value)} placeholder="Main branch" style={inputStyle} />
          </Field>
          <Field label="Store Address" hint="Type an address, then use Find on the map below">
            <input type="text" value={form.storeAddress} onChange={(e) => setField('storeAddress', e.target.value)} placeholder="Street, city, postcode" style={inputStyle} />
          </Field>
          <Field label="Pin on Map" hint="Search an address or drag the pin to fine-tune">
            <LocationMapPicker
              lat={form.storeLat}
              lng={form.storeLng}
              addressHint={form.storeAddress}
              onChange={(lat, lng) => { setField('storeLat', lat); setField('storeLng', lng); }}
              onAddressChange={(addr) => setField('storeAddress', addr)}
            />
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingId ? 'Save Changes' : 'Create Tenant'}</button>
          </div>
        </form>
      );
    }

    if (section === 'partners') {
      return (
        <form onSubmit={handleSubmit}>
          <Field label="Full Name *"><input type="text" value={form.partnerName} onChange={(e) => setField('partnerName', e.target.value)} style={inputStyle} required /></Field>
          <Field label="Email *"><input type="email" value={form.partnerEmail} onChange={(e) => setField('partnerEmail', e.target.value)} style={inputStyle} required /></Field>
          <Field label="Phone *"><input type="tel" value={form.partnerPhone} onChange={(e) => setField('partnerPhone', e.target.value)} style={inputStyle} required /></Field>
          <Field label={editingId ? 'New Password (optional)' : 'Password *'}>
            <input type="password" value={form.partnerPassword} onChange={(e) => setField('partnerPassword', e.target.value)} style={inputStyle} required={!editingId} />
          </Field>
          <Field label="Base City / Service Area"><input type="text" value={form.partnerCity} onChange={(e) => setField('partnerCity', e.target.value)} placeholder="e.g. London, Soho" style={inputStyle} /></Field>
          <Field label="Home Base Location" hint="Search an address or drag the pin">
            <LocationMapPicker
              lat={form.partnerLat}
              lng={form.partnerLng}
              addressHint={form.partnerCity}
              onChange={(lat, lng) => { setField('partnerLat', lat); setField('partnerLng', lng); }}
              onAddressChange={(addr) => setField('partnerCity', addr)}
            />
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingId ? 'Save Changes' : 'Create Rider'}</button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={handleSubmit}>
        <Field label="Full Name *"><input type="text" value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} style={inputStyle} required /></Field>
        <Field label="Email *"><input type="email" value={form.customerEmail} onChange={(e) => setField('customerEmail', e.target.value)} style={inputStyle} required /></Field>
        <Field label="Phone *"><input type="tel" value={form.customerPhone} onChange={(e) => setField('customerPhone', e.target.value)} style={inputStyle} required /></Field>
        <Field label={editingId ? 'New Password (optional)' : 'Password *'}>
          <input type="password" value={form.customerPassword} onChange={(e) => setField('customerPassword', e.target.value)} style={inputStyle} required={!editingId} />
        </Field>
        <Field label="Default Delivery Address (optional)"><input type="text" value={form.customerAddress} onChange={(e) => setField('customerAddress', e.target.value)} placeholder="Home address for faster checkout" style={inputStyle} /></Field>
        {form.customerAddress.trim() && (
          <Field label="Pin Delivery Location" hint="Search an address or drag the pin">
            <LocationMapPicker
              lat={form.customerLat}
              lng={form.customerLng}
              addressHint={form.customerAddress}
              onChange={(lat, lng) => { setField('customerLat', lat); setField('customerLng', lng); }}
              onAddressChange={(addr) => setField('customerAddress', addr)}
            />
          </Field>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingId ? 'Save Changes' : 'Create Customer'}</button>
        </div>
      </form>
    );
  };

  return (
    <div className="animate-fade-in platform-mgmt-page">
      <header className="header platform-mgmt-header">
        <div>
          <h1 className="header-title">Platform Management</h1>
          <p className="platform-mgmt-subtitle">{meta.title}</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>+ {meta.addLabel}</button>
      </header>

      <div className="sub-tab-bar">
        <NavLink
          to={ROUTES.dashboardUsers}
          className="platform-sub-tab"
          style={({ isActive }) => ({ background: section === 'tenants' || isActive ? 'var(--accent-primary)' : 'transparent', color: section === 'tenants' || isActive ? '#fff' : 'var(--text-secondary)' })}
        >
          Tenants
        </NavLink>
        <NavLink
          to={ROUTES.dashboardRiders}
          className="platform-sub-tab"
          style={({ isActive }) => ({ background: section === 'partners' || isActive ? 'var(--accent-primary)' : 'transparent', color: section === 'partners' || isActive ? '#fff' : 'var(--text-secondary)' })}
        >
          Delivery Riders
        </NavLink>
        <NavLink
          to={ROUTES.dashboardCustomers}
          className="platform-sub-tab"
          style={({ isActive }) => ({ background: section === 'customers' || isActive ? 'var(--accent-primary)' : 'transparent', color: section === 'customers' || isActive ? '#fff' : 'var(--text-secondary)' })}
        >
          Customers
        </NavLink>
      </div>

      <div className="platform-stat-grid">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="platform-toolbar glass-card">
        <input
          type="search"
          className="platform-search"
          placeholder={`Search ${meta.title.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={loadData} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="glass-card portal-table platform-table-wrap">
        {loading ? (
          <div className="platform-table-empty" style={{ padding: '3rem' }}>
            <div className="portal-spinner" style={{ margin: '0 auto 1rem' }} />
            Loading…
          </div>
        ) : renderTable()}
      </div>

      {selectedIds.length > 0 && (
        <div className="platform-bulk-bar">
          <span>{selectedIds.length} selected</span>
          <button type="button" className="platform-btn-delete" onClick={handleBulkDelete}>Delete selected</button>
          <button type="button" className="btn-secondary" onClick={() => setSelectedIds([])}>Clear</button>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? `Edit ${meta.title.replace(/ \(.*\)/, '')}` : meta.addLabel}
        onClose={closeModal}
      >
        {renderForm()}
      </Modal>
    </div>
  );
}
