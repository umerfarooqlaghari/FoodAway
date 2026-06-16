const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// Add states for Superadmin/Staff
content = content.replace(
  "const [stats, setStats] = useState({ totalRevenue: 0, bagsSold: 0, dailySales: [] });",
  "const [stats, setStats] = useState({ totalRevenue: 0, bagsSold: 0, dailySales: [] });\n  const [tenants, setTenants] = useState([]);\n  const [staffList, setStaffList] = useState([]);\n  const [appReviews, setAppReviews] = useState([]);\n  const [selectedTenantId, setSelectedTenantId] = useState('');\n  const [newStaffName, setNewStaffName] = useState('');\n  const [newStaffEmail, setNewStaffEmail] = useState('');\n  const [newStaffPassword, setNewStaffPassword] = useState('');\n  const [newTenantBrand, setNewTenantBrand] = useState('');\n  const [newTenantEmail, setNewTenantEmail] = useState('');\n  const [newTenantPassword, setNewTenantPassword] = useState('');"
);

// Update fetchStats to support tenant filter
content = content.replace(
  "const res = await axios.get(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } });",
  "const res = await axios.get(`${API_URL}/seller/stats${selectedTenantId ? '?tenant_id='+selectedTenantId : ''}`, { headers: { Authorization: `Bearer ${token}` } });"
);

// Add fetch functions for new endpoints
const fetches = `
  const fetchTenants = async () => {
    try {
      const res = await axios.get(\`\${API_URL}/superadmin/tenants\`, { headers: { Authorization: \`Bearer \${token}\` } });
      setTenants(res.data);
    } catch(err) {}
  };
  const fetchStaff = async () => {
    try {
      const res = await axios.get(\`\${API_URL}/seller/staff\`, { headers: { Authorization: \`Bearer \${token}\` } });
      setStaffList(res.data);
    } catch(err) {}
  };
  const fetchAppReviews = async () => {
    try {
      const res = await axios.get(\`\${API_URL}/app-reviews\`, { headers: { Authorization: \`Bearer \${token}\` } });
      setAppReviews(res.data);
    } catch(err) {}
  };
`;
content = content.replace("const handleLogin = async (e) => {", fetches + "\n  const handleLogin = async (e) => {");

// Add them to useEffect based on activeTab
content = content.replace(
  "if (activeTab === 'dashboard') {",
  "if (activeTab === 'dashboard') {\n        fetchStats();\n        if (user?.role === 'SuperAdmin') fetchTenants();\n      }\n      // old trigger to replace:"
);

// We need to replace the old fetchStats trigger cleanly
content = content.replace(
  "// old trigger to replace:\n        fetchStats();",
  ""
);

content = content.replace(
  "if (activeTab === 'superadmin' && user?.role === 'SuperAdmin') {",
  "if (activeTab === 'appreviews' && user?.role === 'SuperAdmin') { fetchAppReviews(); }\n      if (activeTab === 'staff' && user?.role === 'SellersAdmin') { fetchStaff(); }\n      if (activeTab === 'superadmin' && user?.role === 'SuperAdmin') {"
);

// Update useEffect dependency if needed
content = content.replace(
  "}, [token, activeTab]);",
  "}, [token, activeTab, selectedTenantId]);"
);

// Refactor Sidebar navigation
const newNav = `
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className={\`nav-item \${activeTab === 'dashboard' ? 'active' : ''}\`} onClick={() => setActiveTab('dashboard')}>Dashboard</div>
          {user?.role !== 'SuperAdmin' && (
            <>
              <div className={\`nav-item \${activeTab === 'stores' ? 'active' : ''}\`} onClick={() => setActiveTab('stores')}>Store Management</div>
              <div className={\`nav-item \${activeTab === 'orders' ? 'active' : ''}\`} onClick={() => setActiveTab('orders')}>Order Management</div>
              <div className={\`nav-item \${activeTab === 'reviews' ? 'active' : ''}\`} onClick={() => setActiveTab('reviews')}>Customer Reviews</div>
              <div className={\`nav-item \${activeTab === 'chats' ? 'active' : ''}\`} onClick={() => setActiveTab('chats')}>Chat Support</div>
            </>
          )}
          {user?.role === 'SellersAdmin' && (
             <div className={\`nav-item \${activeTab === 'staff' ? 'active' : ''}\`} onClick={() => setActiveTab('staff')}>Staff Management</div>
          )}
          {user?.role === 'SuperAdmin' && (
            <>
              <div className={\`nav-item \${activeTab === 'superadmin' ? 'active' : ''}\`} onClick={() => setActiveTab('superadmin')}>Platform Users</div>
              <div className={\`nav-item \${activeTab === 'appreviews' ? 'active' : ''}\`} onClick={() => setActiveTab('appreviews')}>App Reviews</div>
            </>
          )}
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger)', marginTop: 'auto' }}>Logout</div>
        </nav>
`;

content = content.replace(
  /<nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>[\s\S]*?<\/nav>/,
  newNav
);

fs.writeFileSync('src/App.jsx', content);
