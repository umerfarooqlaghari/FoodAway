import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Map, { Marker } from 'react-map-gl';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';
import './index.css';

// Note: Replace with actual MapBox token in production
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('adminUser')));
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Data state
  const [bags, setBags] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewStoreFilter, setReviewStoreFilter] = useState('');
  const [reviewRatingFilter, setReviewRatingFilter] = useState('');
  const [orders, setOrders] = useState([]);
  const [orderStoreFilter, setOrderStoreFilter] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('');

  // Chat States & References
  const [chatsList, setChatsList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [toastNotification, setToastNotification] = useState(null);
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);

  const wsRef = useRef(null);
  const activeChatRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const activeTabRef = useRef('dashboard');
  const isTypingRef = useRef(false);
  
  // Store form state
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreLat, setNewStoreLat] = useState(51.5074); // Default to London
  const [newStoreLng, setNewStoreLng] = useState(-0.1278);
  const [newStoreImage, setNewStoreImage] = useState(null);

  // Stats state
  const [stats, setStats] = useState({ totalRevenue: 0, bagsSold: 0, dailySales: [] });
  const [tenants, setTenants] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [appReviews, setAppReviews] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newTenantBrand, setNewTenantBrand] = useState('');
  const [newTenantEmail, setNewTenantEmail] = useState('');
  const [newTenantPassword, setNewTenantPassword] = useState('');

  // Inactivity reminders states
  const [scanningInactivity, setScanningInactivity] = useState(false);
  const [inactivityResult, setInactivityResult] = useState(null);
  const [inactiveUsersList, setInactiveUsersList] = useState([]);

  // Bag form state
  const [bagStoreId, setBagStoreId] = useState('');
  const [bagOriginalPrice, setBagOriginalPrice] = useState('');
  const [bagPrice, setBagPrice] = useState('');
  const [bagQuantity, setBagQuantity] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [bagDescription, setBagDescription] = useState('');
  const [bagImages, setBagImages] = useState([]);
  
  // Edit state
  const [editingStore, setEditingStore] = useState(null);
  const [editingBag, setEditingBag] = useState(null);
  
  // User form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserLogo, setNewUserLogo] = useState('');

  useEffect(() => {
    if (token) {
      if (activeTab === 'dashboard') {
        fetchStats();
        if (user?.role === 'SuperAdmin') fetchTenants();
      }
      if (activeTab === 'stores') {
        fetchBags();
        fetchStores();
      }
      if (activeTab === 'appreviews' && user?.role === 'SuperAdmin') { fetchAppReviews(); }
      if (activeTab === 'staff' && user?.role === 'SellersAdmin') { fetchStaff(); }
      if (activeTab === 'superadmin' && user?.role === 'SuperAdmin') {
        fetchUsers();
      }
      if (activeTab === 'reviews') {
        fetchReviews();
        fetchStores();
      }
      if (activeTab === 'orders') {
        fetchOrders();
        fetchStores();
      }
      if (activeTab === 'chats') {
        fetchActiveChats();
      }
    }
  }, [token, activeTab, selectedTenantId]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chats' && activeChat) {
      markWebChatAsRead(activeChat.store_id, activeChat.customer_id);
    }
  }, [activeTab, activeChat]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/stats${selectedTenantId ? '?tenant_id='+selectedTenantId : ''}`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(res.data);
    } catch (err) {}
  };

  
  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${API_URL}/superadmin/tenants`, { headers: { Authorization: `Bearer ${token}` } });
      setTenants(res.data);
    } catch(err) {}
  };
  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/staff`, { headers: { Authorization: `Bearer ${token}` } });
      setStaffList(res.data);
    } catch(err) {}
  };
  const fetchAppReviews = async () => {
    try {
      const res = await axios.get(`${API_URL}/app-reviews`, { headers: { Authorization: `Bearer ${token}` } });
      setAppReviews(res.data);
    } catch(err) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = res.data;
      if (user.role === 'Customers') {
        setAuthError('Access denied. Admin access only.');
        return;
      }
      setToken(token);
      setUser(user);
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      setAuthError('');
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
  };

  const fetchBags = async () => {
    try {
      const res = await axios.get(`${API_URL}/bags?all=true`, { headers: { Authorization: `Bearer ${token}` } });
      setBags(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) handleLogout();
    }
  };

  const fetchStores = async () => {
    try {
      const res = await axios.get(`${API_URL}/stores`, { headers: { Authorization: `Bearer ${token}` } });
      setStores(res.data);
    } catch (err) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (err) {}
  };

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API_URL}/reviews`);
      setReviews(res.data);
    } catch (err) {}
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/orders`, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(res.data);
    } catch (err) {}
  };

  const markWebChatAsRead = async (storeId, customerId) => {
    if (!token) return;
    try {
      await axios.post(`${API_URL}/chat/read`, { store_id: storeId, customer_id: customerId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchActiveChats();
    } catch (err) {
      console.error("Error marking chat as read:", err);
    }
  };

  const playSound = (soundFile) => {
    try {
      const audio = new Audio(soundFile);
      audio.play().catch(e => console.log("Sound play error:", e.message));
    } catch (e) {
      console.log("Audio creation error:", e.message);
    }
  };

  const connectWebSockets = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('Connecting');
    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Web WS connected');
      setConnectionStatus('Connected');
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({ type: 'register', token }));
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'message') {
          playSound('/sounds/coin.mp3');
          const msg = payload.message;
          const currentActive = activeChatRef.current;
          const currentTab = activeTabRef.current;
          const isFromActiveChat = currentActive && 
            msg.store_id === currentActive.store_id && 
            msg.customer_id === currentActive.customer_id;

          if (isFromActiveChat && currentTab === 'chats') {
            setChatHistory((prev) => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            markWebChatAsRead(msg.store_id, msg.customer_id);
          } else {
            setToastNotification({
              customerName: msg.customer_name || "Customer Support",
              storeName: msg.store_name,
              message: msg.message,
              chat: {
                store_id: msg.store_id,
                customer_id: msg.customer_id,
                customer_name: msg.customer_name,
                customer_email: msg.customer_email || "N/A",
                store_name: msg.store_name
              }
            });
            fetchActiveChats();
          }
        } else if (payload.type === 'new_order') {
          const order = payload.order;
          const isMyStore = user?.role === 'SuperAdmin' || !user?.tenant_id || Number(user.tenant_id) === Number(order.tenant_id) || Number(user.id) === Number(order.tenant_id);
          
          if (isMyStore) {
            playSound('/sounds/register.mp3');
            setToastNotification({
              type: 'order',
              storeName: order.store_name,
              message: `New order: ${order.quantity}x ${order.item_name} for £${order.price.toFixed(2)}`,
              customerName: order.customer_name
            });
            fetchOrders();
            fetchStats();
          }
        } else if (payload.type === 'typing') {
          const currentActive = activeChatRef.current;
          if (currentActive && 
              payload.customerId === currentActive.customer_id && 
              payload.storeId === currentActive.store_id &&
              payload.senderRole === 'Customer') {
            setIsCustomerTyping(payload.isTyping);
          }
        }
      } catch (err) {
        console.error('WS parsing error:', err);
      }
    };

    ws.onclose = () => {
      console.log('Web WS closed');
      setConnectionStatus('Disconnected');
      wsRef.current = null;
      setIsCustomerTyping(false);

      if (token) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSockets();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('Web WS error:', err);
    };

    wsRef.current = ws;
  };

  const fetchActiveChats = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/chats`, { headers: { Authorization: `Bearer ${token}` } });
      setChatsList(res.data);
    } catch (err) {}
  };

  const selectChat = async (chat) => {
    setActiveChat(chat);
    setChatHistory([]);
    setIsCustomerTyping(false);
    markWebChatAsRead(chat.store_id, chat.customer_id);
    try {
      const res = await axios.get(`${API_URL}/chat/history?store_id=${chat.store_id}&customer_id=${chat.customer_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatHistory(res.data);
    } catch (err) {}
  };

  const sendTypingStatus = (typing) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeChatRef.current) return;
    if (isTypingRef.current === typing) return;
    isTypingRef.current = typing;

    wsRef.current.send(JSON.stringify({
      type: 'typing',
      storeId: activeChatRef.current.store_id,
      customerId: activeChatRef.current.customer_id,
      isTyping: typing
    }));
  };

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChat || !wsRef.current) return;

    const msgPayload = {
      type: 'message',
      storeId: activeChat.store_id,
      customerId: activeChat.customer_id,
      text: chatInput.trim()
    };

    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msgPayload));
      setChatInput('');
      sendTypingStatus(false);
    } else {
      alert("Chat connection is offline. Reconnecting...");
      connectWebSockets();
    }
  };

  useEffect(() => {
    if (token) {
      connectWebSockets();
    }
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    })).then(base64Images => {
      setBagImages(base64Images);
    }).catch(err => alert("Error reading images"));
  };

  const handleSingleImageUpload = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setter(event.target.result);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      try {
        await axios.put(`${API_URL}/users/${user.id}`, { logo: base64 }, { headers: { Authorization: `Bearer ${token}` } });
        const updatedUser = { ...user, logo: base64 };
        setUser(updatedUser);
        localStorage.setItem('adminUser', JSON.stringify(updatedUser));
        alert('Brand logo updated successfully!');
      } catch (err) {
        alert('Failed to upload logo');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateBag = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/bags`, {
        store_id: bagStoreId,
        price: parseFloat(bagPrice),
        original_price: bagOriginalPrice ? parseFloat(bagOriginalPrice) : null,
        description: bagDescription,
        quantity: parseInt(bagQuantity),
        pickup_time: pickupTime,
        images: bagImages
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Surprise Bag created successfully!');
      fetchBags();
      setBagStoreId(''); setBagPrice(''); setBagOriginalPrice(''); setBagQuantity(''); setPickupTime(''); setBagDescription(''); setBagImages([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create bag');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/superadmin/tenants`, {
        brand_name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        logo: newUserLogo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Seller Account/Tenant created successfully!');
      fetchUsers();
      if (typeof fetchTenants === 'function') {
        fetchTenants();
      }
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserLogo('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleTriggerInactivityReminders = async () => {
    setScanningInactivity(true);
    setInactivityResult(null);
    try {
      const res = await axios.post(
        `${API_URL}/superadmin/trigger-inactivity-reminders`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInactivityResult(res.data);
      setInactiveUsersList(res.data.users);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to trigger reminders');
    } finally {
      setScanningInactivity(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/stores`, { 
        name: newStoreName, 
        address: newStoreAddress,
        lat: newStoreLat,
        lng: newStoreLng,
        image: newStoreImage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Store created successfully!');
      fetchStores();
      setNewStoreName('');
      setNewStoreAddress('');
      setNewStoreImage(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create store');
    }
  };

  const handleToggleStoreStatus = async (storeId, currentStatus) => {
    try {
      await axios.put(`${API_URL}/stores/${storeId}`, {
        is_active: currentStatus ? 0 : 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchStores(); // Refresh stores
    } catch (err) {
      alert('Failed to update store status');
    }
  };

  const handleUpdateStore = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/stores/${editingStore.id}`, editingStore, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Store updated successfully!');
      setEditingStore(null);
      fetchStores();
    } catch (err) {
      alert('Failed to update store');
    }
  };

  const handleDeleteStore = async (id) => {
    if(!window.confirm("Delete this store? This will also delete all associated bags.")) return;
    try {
      await axios.delete(`${API_URL}/stores/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchStores();
      fetchBags();
    } catch (err) {
      alert('Failed to delete store');
    }
  };

  const handleUpdateBag = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/bags/${editingBag.id}`, editingBag, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Bag updated successfully!');
      setEditingBag(null);
      fetchBags();
    } catch (err) {
      alert('Failed to update bag');
    }
  };

  const handleDeleteBag = async (id) => {
    if(!window.confirm("Delete this surprise bag?")) return;
    try {
      await axios.delete(`${API_URL}/bags/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBags();
    } catch (err) {
      alert('Failed to delete bag');
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <div className="glass-card" style={{ padding: '3rem', width: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <img src="/favicon.png" alt="FoodAway Logo" style={{ height: '70px', marginBottom: '1.5rem', objectFit: 'contain' }} />
          <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800' }}>Admin Portal</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Sign in to manage the platform</p>
          
          {authError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>{authError}</div>}
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#FFFFFF', color: '#111827' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#FFFFFF', color: '#111827' }}
                required
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.2rem' }}>
            {user?.logo ? (
              <img src={user.logo} alt="Brand Logo" style={{ width: '45px', height: '45px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <img src="/favicon.png" alt="FoodAway Logo" style={{ width: '45px', height: '45px', borderRadius: '10px', objectFit: 'contain', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="sidebar-logo" style={{ fontSize: '1.35rem', fontWeight: '800', lineHeight: '1.1', margin: 0, padding: 0 }}>FoodAway</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>Admin Portal</span>
            </div>
          </div>
          <p style={{ paddingLeft: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>Role: {user?.role}</p>
        </div>
        
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</div>
          {user?.role !== 'SuperAdmin' && (
            <>
              <div className={`nav-item ${activeTab === 'stores' ? 'active' : ''}`} onClick={() => setActiveTab('stores')}>Store Management</div>
              <div className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Order Management</div>
              <div className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>Customer Reviews</div>
              <div className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>Chat Support</div>
            </>
          )}
          {user?.role === 'SellersAdmin' && (
             <div className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>Staff Management</div>
          )}
          {user?.role === 'SuperAdmin' && (
            <>
              <div className={`nav-item ${activeTab === 'superadmin' ? 'active' : ''}`} onClick={() => setActiveTab('superadmin')}>Platform Users</div>
              <div className={`nav-item ${activeTab === 'appreviews' ? 'active' : ''}`} onClick={() => setActiveTab('appreviews')}>App Reviews</div>
            </>
          )}
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger)', marginTop: 'auto' }}>Logout</div>
        </nav>

      </aside>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            
            <header className="header" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {user?.role === 'SuperAdmin' ? (
                  <>
                    <h1 className="header-title" style={{ margin: 0 }}>Overview (Platform)</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Platform Admin</p>
                  </>
                ) : (
                  <>
                    <h1 className="header-title" style={{ margin: 0 }}>{user?.name || 'Overview'}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{user?.role === 'SellersStaff' ? 'Seller Staff' : 'Seller Admin'}</p>
                  </>
                )}
              </div>
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


            <section className="stats-grid">
              <div className="glass-card stat-card delay-1">
                <div className="stat-title">Total Revenue</div>
                <div className="stat-value">£{stats.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="glass-card stat-card delay-2">
                <div className="stat-title">Surprise Bags Sold</div>
                <div className="stat-value">{stats.bagsSold}</div>
              </div>
            </section>

            <div className="glass-card" style={{ padding: '1.5rem', marginTop: '2rem', height: '400px' }}>
              <h3 style={{ marginBottom: '1rem' }}>Sales Over Last 7 Days</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailySales} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#EA580C" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'stores' && (
          <div className="animate-fade-in">
            <header className="header">
              <h1 className="header-title">Store Management</h1>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Create Store Form */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>Add New Store</h3>
                  <form onSubmit={handleCreateStore}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Store Name</label>
                      <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Address</label>
                      <input type="text" value={newStoreAddress} onChange={e => setNewStoreAddress(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Store Image (Optional)</label>
                      <input type="file" accept="image/*" onChange={(e) => handleSingleImageUpload(e, setNewStoreImage)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', background: '#F9FAFB' }} />
                      {newStoreImage && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>Image selected</p>}
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Location (Drag pin to set)</label>
                      <div style={{ height: '250px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <Map
                          mapboxAccessToken={MAPBOX_TOKEN}
                          initialViewState={{
                            longitude: newStoreLng,
                            latitude: newStoreLat,
                            zoom: 12
                          }}
                          style={{width: '100%', height: '100%'}}
                          mapStyle="mapbox://styles/mapbox/streets-v12"
                        >
                          <Marker 
                            longitude={newStoreLng} 
                            latitude={newStoreLat} 
                            draggable 
                            onDragEnd={(e) => {
                              setNewStoreLng(e.lngLat.lng);
                              setNewStoreLat(e.lngLat.lat);
                            }}
                            color="red" 
                          />
                        </Map>
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Store</button>
                  </form>
                </div>

                {/* Manage Stores List */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>Manage Stores</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {stores.map(store => (
                      <div key={store.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        {editingStore?.id === store.id ? (
                          <form onSubmit={handleUpdateStore} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="text" value={editingStore.name} onChange={e => setEditingStore({...editingStore, name: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                            <input type="text" value={editingStore.address} onChange={e => setEditingStore({...editingStore, address: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                            <input type="file" accept="image/*" onChange={(e) => handleSingleImageUpload(e, (base64) => setEditingStore({...editingStore, image: base64}))} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.5rem' }}>Save</button>
                              <button type="button" onClick={() => setEditingStore(null)} style={{ flex: 1, padding: '0.5rem' }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                              {store.image ? (
                                <img src={store.image} alt={store.name} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '50px', height: '50px', borderRadius: '8px', backgroundColor: '#e5e7eb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>🏪</div>
                              )}
                              <div>
                                <strong>{store.name}</strong>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{store.address}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => setEditingStore(store)} style={{ padding: '0.5rem', background: '#F3F4F6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => handleDeleteStore(store.id)} style={{ padding: '0.5rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                              <button 
                                onClick={() => handleToggleStoreStatus(store.id, store.is_active)}
                                style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer', background: store.is_active ? 'var(--success)' : '#EF4444', color: 'white', fontWeight: 'bold' }}>
                                {store.is_active ? 'Open' : 'Closed'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Create Bag Form */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>Create Surprise Bag</h3>
                  <form onSubmit={handleCreateBag}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Select Store</label>
                      <select value={bagStoreId} onChange={e => setBagStoreId(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required>
                        <option value="">-- Choose a store --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Original Price</label>
                        <input type="number" step="0.01" value={bagOriginalPrice} onChange={e => setBagOriginalPrice(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Discount Price</label>
                        <input type="number" step="0.01" value={bagPrice} onChange={e => setBagPrice(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Quantity</label>
                        <input type="number" value={bagQuantity} onChange={e => setBagQuantity(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Pickup Time</label>
                        <input type="text" placeholder="e.g. 18:00 - 19:00" value={pickupTime} onChange={e => setPickupTime(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                      </div>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description (Optional)</label>
                      <textarea value={bagDescription} onChange={e => setBagDescription(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', resize: 'vertical' }} rows="3"></textarea>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Images</label>
                      <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', background: '#F9FAFB' }} />
                      {bagImages.length > 0 && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>{bagImages.length} image(s) selected</p>}
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Bag</button>
                  </form>
                </div>
              </div>

              {/* Active Bags List */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Manage Surprise Bags</h3>
                {bags.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No active bags or you don't have permission to view them.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {bags.map(bag => (
                      <div key={bag.id} style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                        {editingBag?.id === bag.id ? (
                          <form onSubmit={handleUpdateBag} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Price (£)</label>
                                <input type="number" step="0.01" value={editingBag.price} onChange={e => setEditingBag({...editingBag, price: parseFloat(e.target.value)})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Quantity</label>
                                <input type="number" value={editingBag.quantity} onChange={e => setEditingBag({...editingBag, quantity: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pickup Time</label>
                              <input type="text" value={editingBag.pickup_time} onChange={e => setEditingBag({...editingBag, pickup_time: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.5rem' }}>Save</button>
                              <button type="button" onClick={() => setEditingBag(null)} style={{ flex: 1, padding: '0.5rem' }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{bag.store_name}</strong>
                              <div style={{ textAlign: 'right' }}>
                                {bag.original_price && <span style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: '8px' }}>£{bag.original_price.toFixed(2)}</span>}
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>£{bag.price.toFixed(2)}</span>
                              </div>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1rem' }}>{bag.address}</p>
                            
                            {bag.description && (
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                                {bag.description}
                              </p>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
                              <span style={{ fontWeight: '500' }}>Pickup: {bag.pickup_time}</span>
                              <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Qty: {bag.quantity} left</span>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setEditingBag(bag)} style={{ padding: '0.4rem 1rem', background: '#F3F4F6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                                <button onClick={() => handleDeleteBag(bag.id)} style={{ padding: '0.4rem 1rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        
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
                    await axios.post(`${API_URL}/seller/staff`, { name: newStaffName, email: newStaffEmail, password: newStaffPassword }, { headers: { Authorization: `Bearer ${token}` } });
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


        {activeTab === 'superadmin' && user?.role === 'SuperAdmin' && (
          <div className="animate-fade-in">
            <header className="header">
              <h1 className="header-title">SuperAdmin Panel</h1>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div className="glass-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Register Seller Account</h3>
                <form onSubmit={handleCreateUser}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Brand Name</label>
                    <input type="text" placeholder="e.g. KFC, Starbucks" value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email Address</label>
                    <input type="email" placeholder="e.g. admin@brand.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
                    <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} required />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Brand Logo / Image</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="Image URL or upload below..." value={newUserLogo} onChange={e => setNewUserLogo(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                      <label style={{ cursor: 'pointer', padding: '0.75rem 1rem', background: 'var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                        Upload
                        <input type="file" accept="image/*" onChange={e => handleSingleImageUpload(e, setNewUserLogo)} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {newUserLogo && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img src={newUserLogo} alt="Logo Preview" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Logo Preview</span>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Account</button>
                </form>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Platform Users</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {users.map(u => (
                    <div key={u.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {u.logo ? (
                          <img src={u.logo} alt={u.name} style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                        ) : (
                          <div style={{ width: '45px', height: '45px', borderRadius: '8px', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                            {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div>
                          <strong style={{ display: 'block', fontSize: '1.1rem' }}>{u.name}</strong>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{u.email}</span>
                        </div>
                      </div>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', background: u.role === 'SuperAdmin' ? '#FEE2E2' : '#E0E7FF', color: u.role === 'SuperAdmin' ? '#991B1B' : '#3730A3' }}>
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Inactivity Reminders Panel */}
            <div className="glass-card" style={{ padding: '1.5rem', marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Engagement & Retention Alerts</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, marginTop: '2px' }}>
                    Find customers inactive for 3+ days and send a NayaPay-style re-engagement alert.
                  </p>
                </div>
                <button 
                  onClick={handleTriggerInactivityReminders} 
                  disabled={scanningInactivity}
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem' }}
                >
                  {scanningInactivity ? 'Scanning & Sending...' : '⚡ Scan & Send Reminders'}
                </button>
              </div>

              {inactivityResult && (
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '1.5rem' }}>
                  <strong style={{ color: 'var(--success)', fontSize: '0.95rem' }}>✓ {inactivityResult.message}</strong>
                </div>
              )}

              {inactiveUsersList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Notified Customers:</h4>
                  {inactiveUsersList.map(u => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: '#F9FAFB' }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{u.name}</strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>{u.email}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.08)', color: '#DC2626', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>
                        Last Order: {u.last_order === 'Never Ordered' ? 'Never' : new Date(u.last_order).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : inactivityResult ? (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', margin: '2rem 0' }}>
                  No inactive users found. All registered customers have placed an order in the last 3 days!
                </p>
              ) : null}
            </div>

          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="animate-fade-in">
            <header className="header">
              <h1 className="header-title">Customer Reviews</h1>
            </header>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.2rem' }}>Filters</h3>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Filter by Store</label>
                  <select 
                    value={reviewStoreFilter} 
                    onChange={e => setReviewStoreFilter(e.target.value)} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'white' }}
                  >
                    <option value="">All Stores</option>
                    {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Filter by Rating</label>
                  <select 
                    value={reviewRatingFilter} 
                    onChange={e => setReviewRatingFilter(e.target.value)} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'white' }}
                  >
                    <option value="">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {reviews
                .filter(r => !reviewStoreFilter || r.store_name === reviewStoreFilter)
                .filter(r => !reviewRatingFilter || r.rating === parseInt(reviewRatingFilter))
                .length === 0 ? (
                  <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No reviews found matching the filters.
                  </div>
                ) : (
                  reviews
                    .filter(r => !reviewStoreFilter || r.store_name === reviewStoreFilter)
                    .filter(r => !reviewRatingFilter || r.rating === parseInt(reviewRatingFilter))
                    .map(r => {
                      let parsedTags = [];
                      try {
                        parsedTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []);
                      } catch (e) {
                        parsedTags = [];
                      }
                      return (
                        <div key={r.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#FFF7ED', color: '#EA580C', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                            {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div>
                                <strong style={{ fontSize: '1.1rem' }}>{r.customer_name}</strong>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginLeft: '0.8rem' }}>for <strong style={{ color: 'var(--text-primary)' }}>{r.store_name}</strong></span>
                              </div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '2px', marginBottom: '0.8rem' }}>
                              {[...Array(5)].map((_, i) => (
                                <span key={i} style={{ color: i < r.rating ? '#F59E0B' : '#D1D5DB', fontSize: '1.2rem' }}>
                                  {i < r.rating ? '★' : '☆'}
                                </span>
                              ))}
                            </div>

                            {r.comment && (
                              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', lineHeight: '1.5', fontStyle: 'italic' }}>
                                "{r.comment}"
                              </p>
                            )}

                            {parsedTags && parsedTags.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {parsedTags.map(tag => (
                                  <span key={tag} style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FFEDD5', borderRadius: '12px', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-fade-in">
            <header className="header">
              <h1 className="header-title">Order Management</h1>
            </header>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.2rem' }}>Filters</h3>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Filter by Store</label>
                  <select 
                    value={orderStoreFilter} 
                    onChange={e => setOrderStoreFilter(e.target.value)} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'white' }}
                  >
                    <option value="">All Stores</option>
                    {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Filter by Payment Method</label>
                  <select 
                    value={orderPaymentFilter} 
                    onChange={e => setOrderPaymentFilter(e.target.value)} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'white' }}
                  >
                    <option value="">All Payment Methods</option>
                    <option value="Card">Card</option>
                    <option value="Cash at Pickup">Cash at Pickup</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {orders
                .filter(o => !orderStoreFilter || o.store_name === orderStoreFilter)
                .filter(o => !orderPaymentFilter || o.payment_method.toLowerCase() === orderPaymentFilter.toLowerCase())
                .length === 0 ? (
                  <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No active bookings found matching the filters.
                  </div>
                ) : (
                  orders
                    .filter(o => !orderStoreFilter || o.store_name === orderStoreFilter)
                    .filter(o => !orderPaymentFilter || o.payment_method.toLowerCase() === orderPaymentFilter.toLowerCase())
                    .map(o => (
                      <div key={o.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#EFF6FF', color: '#1D4ED8', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.1rem', flexShrink: 0 }}>
                          #{o.id}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                            <div>
                              <strong style={{ fontSize: '1.15rem', display: 'block', color: 'var(--text-primary)' }}>{o.store_name}</strong>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                Customer: <strong>{o.customer_name}</strong> ({o.customer_email})
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {new Date(o.created_at).toLocaleString()}
                              </span>
                              <span style={{ 
                                padding: '0.25rem 0.75rem', 
                                borderRadius: '20px', 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold', 
                                background: o.payment_method.toLowerCase() === 'card' ? '#E0F2FE' : '#FEF3C7', 
                                color: o.payment_method.toLowerCase() === 'card' ? '#0369A1' : '#B45309' 
                              }}>
                                {o.payment_method.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div style={{ padding: '1rem', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                                {o.quantity}x {o.item_name}
                              </strong>
                              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                {o.type === 'bag' ? 'Surprise Bag' : 'Food Item'}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: '800', color: 'var(--success)' }}>
                                £{(o.price * o.quantity).toFixed(2)}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                Pickup: {o.pickup_time}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
            </div>
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="animate-fade-in" style={{ height: 'calc(100vh - 6rem)', display: 'flex', flexDirection: 'column' }}>
            <header className="header" style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
              <h1 className="header-title">Customer Live Chat Support</h1>
            </header>

            <div style={{ display: 'flex', flex: 1, gap: '2rem', minHeight: 0 }}>
              {/* Left sidebar chats list */}
              <div className="glass-card" style={{ width: '340px', display: 'flex', flexDirection: 'column', padding: '1.2rem', minHeight: 0 }}>
                <h3 style={{ marginBottom: '1rem', flexShrink: 0 }}>Active Conversations</h3>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {chatsList.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem', fontSize: '0.95rem' }}>
                      No active customer chats yet.
                    </div>
                  ) : (
                    chatsList.map(chat => {
                      const isSelected = activeChat && 
                        activeChat.store_id === chat.store_id && 
                        activeChat.customer_id === chat.customer_id;
                      const hasUnread = chat.unread_count > 0;
                      return (
                        <div 
                          key={`${chat.store_id}_${chat.customer_id}`}
                          onClick={() => selectChat(chat)}
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            border: hasUnread ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'rgba(234, 88, 12, 0.08)' : hasUnread ? 'rgba(255, 90, 0, 0.03)' : 'var(--bg-secondary)',
                            borderColor: isSelected ? 'var(--accent-primary)' : hasUnread ? 'var(--accent-primary)' : 'var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: hasUnread ? '0 4px 12px rgba(255, 90, 0, 0.08)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: hasUnread ? '800' : '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {chat.customer_name}
                              {hasUnread && (
                                <span style={{
                                  background: 'var(--accent-primary)',
                                  color: 'white',
                                  borderRadius: '10px',
                                  padding: '0.1rem 0.4rem',
                                  fontSize: '0.7rem',
                                  fontWeight: '800'
                                }}>
                                  {chat.unread_count}
                                </span>
                              )}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: hasUnread ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: hasUnread ? 'bold' : 'normal' }}>
                              {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                            for {chat.store_name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: hasUnread ? '500' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chat.last_message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right active chat pane */}
              <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                {!activeChat ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', gap: '1rem' }}>
                    <span style={{ fontSize: '3.5rem' }}>💬</span>
                    <strong>Select a customer chat to start messaging in real-time</strong>
                  </div>
                ) : (
                  <>
                    {/* Chat Header */}
                    <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', display: 'block' }}>{activeChat.customer_name}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Email: {activeChat.customer_email} · Store: <strong>{activeChat.store_name}</strong>
                        </span>
                      </div>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: connectionStatus === 'Connected' ? '#DCFCE7' : connectionStatus === 'Connecting' ? '#FEF3C7' : '#FEE2E2', 
                        color: connectionStatus === 'Connected' ? '#15803D' : connectionStatus === 'Connecting' ? '#D97706' : '#B91C1C', 
                        borderRadius: '12px', 
                        padding: '0.2rem 0.6rem', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold' 
                      }}>
                        <span style={{ 
                          width: '6px', 
                          height: '6px', 
                          borderRadius: '3px', 
                          backgroundColor: connectionStatus === 'Connected' ? '#16A34A' : connectionStatus === 'Connecting' ? '#D97706' : '#EF4444' 
                        }}></span>
                        {connectionStatus}
                      </span>
                    </div>

                    {/* Messages Timeline */}
                    <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#FAFAFA' }} ref={el => {
                      if (el) el.scrollTop = el.scrollHeight;
                    }}>
                      {chatHistory.map(msg => {
                        const isSeller = msg.sender_role === 'Seller';
                        return (
                          <div 
                            key={msg.id}
                            style={{
                              alignSelf: isSeller ? 'flex-end' : 'flex-start',
                              maxWidth: '70%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isSeller ? 'flex-end' : 'flex-start'
                            }}
                          >
                            <div style={{
                              padding: '0.75rem 1.1rem',
                              borderRadius: '16px',
                              borderBottomRightRadius: isSeller ? '2px' : '16px',
                              borderBottomLeftRadius: isSeller ? '16px' : '2px',
                              backgroundColor: isSeller ? 'var(--accent-primary)' : 'white',
                              color: isSeller ? 'white' : 'var(--text-primary)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                              border: isSeller ? 'none' : '1px solid var(--border-color)',
                              lineHeight: '1.45',
                              fontSize: '0.95rem',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {msg.message}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', padding: '0 4px' }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                      {isCustomerTyping && (
                        <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#9CA3AF', borderRadius: '50%' }}></span>
                          Customer is typing...
                        </div>
                      )}
                    </div>

                    {/* Message typing area */}
                    <form onSubmit={handleSendChatMessage} style={{ padding: '1.2rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: 'white', flexShrink: 0 }}>
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={e => {
                          setChatInput(e.target.value);
                          sendTypingStatus(e.target.value.length > 0);
                        }}
                        placeholder="Type a support reply..." 
                        style={{
                          flex: 1,
                          padding: '0.85rem 1.2rem',
                          borderRadius: '24px',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.95rem',
                          outline: 'none',
                          backgroundColor: '#F9FAFB'
                        }}
                      />
                      <button 
                        type="submit" 
                        disabled={!chatInput.trim()}
                        style={{
                          height: '42px',
                          padding: '0 1.5rem',
                          borderRadius: '21px',
                          border: 'none',
                          background: chatInput.trim() ? 'var(--accent-primary)' : '#E5E7EB',
                          color: 'white',
                          fontWeight: 'bold',
                          cursor: chatInput.trim() ? 'pointer' : 'default',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Send
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {toastNotification && (
        <div className="animate-slide-in hover-glow-toast" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          width: '360px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 12px 40px rgba(234, 88, 12, 0.15), 0 4px 12px rgba(0,0,0,0.08)',
          borderRadius: '20px',
          borderLeft: toastNotification.type === 'order' ? '6px solid #EAB308' : '6px solid #EA580C',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderLeftWidth: '6px'
        }} onClick={() => {
          if (toastNotification.type === 'order') {
            setActiveTab('orders');
          } else {
            setActiveTab('chats');
            selectChat(toastNotification.chat);
          }
          setToastNotification(null);
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: toastNotification.type === 'order' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 88, 12, 0.15)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '1.2rem'
            }}>
              {toastNotification.type === 'order' ? '💰' : '💬'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1rem', color: '#111827' }}>
                  {toastNotification.type === 'order' ? 'New Order Received!' : `Message from ${toastNotification.customerName}`}
                </strong>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '600', display: 'block', marginTop: '2px' }}>
                Store: {toastNotification.storeName}
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', fontWeight: '500', paddingLeft: '4px' }}>
            {toastNotification.message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: toastNotification.type === 'order' ? '#B45309' : '#C2410C', fontWeight: '700' }}>
              {toastNotification.type === 'order' ? 'Click to view Orders' : 'Click to reply'}
            </span>
            <button 
              style={{
                border: 'none',
                background: '#F3F4F6',
                padding: '4px 10px',
                borderRadius: '12px',
                color: '#4B5563',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setToastNotification(null);
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#E5E7EB'}
              onMouseOut={(e) => e.currentTarget.style.background = '#F3F4F6'}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}


    </div>
  );
}

export default App;
