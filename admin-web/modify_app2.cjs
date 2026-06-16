const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Dashboard modifications
// We need to inject the Tenant Filter for SuperAdmin.
const dashboardHeaderReplace = `
            <header className="header" style={{ justifyContent: 'space-between' }}>
              <h1 className="header-title">Overview {user?.role === 'SuperAdmin' ? '(Platform)' : ''}</h1>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {user?.role === 'SuperAdmin' && (
                  <select 
                    value={selectedTenantId} 
                    onChange={e => setSelectedTenantId(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                  >
                    <option value="">All Tenants</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                {user?.role !== 'SuperAdmin' && (
                  <label style={{ cursor: 'pointer', background: '#F3F4F6', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    Upload Brand Logo
                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleUploadLogo} />
                  </label>
                )}
              </div>
            </header>
`;

content = content.replace(
  /<header className="header" style={{ justifyContent: 'space-between' }}>[\s\S]*?<\/header>/,
  dashboardHeaderReplace
);

// Add logic to hide sales chart if data is empty, or keep it.
// Also, we need to add the render blocks for 'appreviews', 'staff'

const newTabs = `
        {activeTab === 'appreviews' && user?.role === 'SuperAdmin' && (
          <div className="animate-fade-in">
            <header className="header"><h1 className="header-title">App Reviews</h1></header>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              {appReviews.map(r => (
                <div key={r.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{r.customer_name}</strong>
                    <span>{"⭐".repeat(r.rating)}</span>
                  </div>
                  <p style={{ marginTop: '0.5rem', color: '#4B5563' }}>{r.comment}</p>
                </div>
              ))}
              {appReviews.length === 0 && <p>No app reviews yet.</p>}
            </div>
          </div>
        )}

        {activeTab === 'staff' && user?.role === 'SellersAdmin' && (
          <div className="animate-fade-in">
            <header className="header"><h1 className="header-title">Staff Management</h1></header>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div className="glass-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Add New Staff</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await axios.post(\`\${API_URL}/seller/staff\`, { name: newStaffName, email: newStaffEmail, password: newStaffPassword }, { headers: { Authorization: \`Bearer \${token}\` } });
                    alert('Staff created successfully');
                    setNewStaffName(''); setNewStaffEmail(''); setNewStaffPassword('');
                    fetchStaff();
                  } catch(err) { alert('Failed to create staff'); }
                }}>
                  <input type="text" placeholder="Name" value={newStaffName} onChange={e=>setNewStaffName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                  <input type="email" placeholder="Email" value={newStaffEmail} onChange={e=>setNewStaffEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                  <input type="password" placeholder="Password" value={newStaffPassword} onChange={e=>setNewStaffPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Staff</button>
                </form>
              </div>
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Existing Staff</h3>
                {staffList.map(s => (
                  <div key={s.id} style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{s.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>{s.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
`;

// Superadmin tenant addition
// In existing 'superadmin' tab
const superAdminTenantAdd = `
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Create New Tenant (Seller Admin)</h3>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await axios.post(\`\${API_URL}/superadmin/tenants\`, { brand_name: newTenantBrand, email: newTenantEmail, password: newTenantPassword }, { headers: { Authorization: \`Bearer \${token}\` } });
                    alert('Tenant created successfully');
                    setNewTenantBrand(''); setNewTenantEmail(''); setNewTenantPassword('');
                    fetchUsers(); fetchTenants();
                  } catch(err) { alert('Failed to create tenant'); }
                }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <input type="text" placeholder="Brand Name" value={newTenantBrand} onChange={e=>setNewTenantBrand(e.target.value)} required style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                    <input type="email" placeholder="Email" value={newTenantEmail} onChange={e=>setNewTenantEmail(e.target.value)} required style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                    <input type="password" placeholder="Password" value={newTenantPassword} onChange={e=>setNewTenantPassword(e.target.value)} required style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                  </div>
                  <button type="submit" className="btn-primary">Create Tenant</button>
              </form>
            </div>
`;

content = content.replace(
  /<header className="header">\s*<h1 className="header-title">Platform Users<\/h1>\s*<\/header>/,
  '<header className="header"><h1 className="header-title">Platform Users & Tenants</h1></header>\n' + superAdminTenantAdd
);

content = content.replace(
  /\{activeTab === 'superadmin' && user\?\.role === 'SuperAdmin' && \(/,
  newTabs + "\n\n        {activeTab === 'superadmin' && user?.role === 'SuperAdmin' && ("
);

fs.writeFileSync('src/App.jsx', content);
