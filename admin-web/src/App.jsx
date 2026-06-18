import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Map, { Marker } from 'react-map-gl';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';
import './index.css';
import Legal from './pages/Legal';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CookiePolicy from './pages/CookiePolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import ContactUs from './pages/ContactUs';
import DsaDisclosure from './pages/DsaDisclosure';
import DoNotSell from './pages/DoNotSell';
import FoodWasteSources from './pages/FoodWasteSources';
import Status from './pages/Status';

// Note: Replace with actual MapBox token in production
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const parsePickupTimeDetails = (pickupTimeStr) => {
  if (!pickupTimeStr) return { days: [], from: '18:00', to: '20:00' };
  const timeRegex = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/;
  const match = pickupTimeStr.match(timeRegex);
  const from = match ? match[1] : '18:00';
  const to = match ? match[2] : '20:00';
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [];
  ALL_DAYS.forEach(day => {
    if (pickupTimeStr.includes(day)) {
      days.push(day);
    }
  });
  return { days, from, to };
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('adminUser')));
  const [view, setView] = useState(token ? 'app' : 'landing');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (token) {
      setView('app');
    } else if (view === 'app') {
      setView('landing');
    }
  }, [token]);

  // Password reset flow states
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState('login'); // 'login', 'email', 'reset'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

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
  const chatEndRef = useRef(null);

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

  // Currency
  const CURRENCIES = [
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  ];
  const [currencyCode, setCurrencyCode] = useState(localStorage.getItem('currencyCode') || 'GBP');
  const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || '£';
  const handleCurrencyChange = (code) => { setCurrencyCode(code); localStorage.setItem('currencyCode', code); };

  // Bag form state
  const [bagStoreId, setBagStoreId] = useState('');
  const [bagOriginalPrice, setBagOriginalPrice] = useState('');
  const [bagPrice, setBagPrice] = useState('');
  const [bagQuantity, setBagQuantity] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  // Structured pickup time
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [pickupDays, setPickupDays] = useState([]);
  const [pickupFrom, setPickupFrom] = useState('18:00');
  const [pickupTo, setPickupTo] = useState('20:00');
  const buildPickupTime = (days, from, to) => days.length === 0 ? `${from} - ${to}` : `${days.join(', ')} ${from} - ${to}`;
  const toggleDay = (day) => setPickupDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const [bagDescription, setBagDescription] = useState('');
  const [bagImages, setBagImages] = useState([]);

  // Edit state
  const [editingStore, setEditingStore] = useState(null);
  const [editingBag, setEditingBag] = useState(null);

  // Store Management Sub-tabs
  const [storeSubTab, setStoreSubTab] = useState('stores');
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showBagModal, setShowBagModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showAppDownloadModal, setShowAppDownloadModal] = useState(false);

  // Food Items state
  const [foodItems, setFoodItems] = useState([]);
  const [editingFood, setEditingFood] = useState(null);
  const [foodForm, setFoodForm] = useState({ store_id: '', name: '', price: '', original_price: '', quantity: '', description: '', category: 'Other', images: [] });
  const FOOD_CATEGORIES = ['Bakery', 'Coffee & Drinks', 'Groceries', 'Meals', 'Sushi', 'Salads', 'Sandwiches', 'Pizza', 'Desserts', 'Other'];

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
        fetchFoodItems();
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

  // Polling fallback: refresh chat history every 4s when a chat is open
  // This guarantees messages appear even if the WS real-time path has any edge-case failures
  useEffect(() => {
    if (!activeChat || activeTab !== 'chats' || !token) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          `${API_URL}/chat/history?store_id=${activeChat.store_id}&customer_id=${activeChat.customer_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setChatHistory(prev => {
          const lastPrev = prev[prev.length - 1];
          const lastNew = res.data[res.data.length - 1];
          // Only update if there are new messages to avoid re-render churn
          if (prev.length === res.data.length && lastPrev?.id === lastNew?.id) return prev;
          return res.data;
        });
      } catch (_) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [activeChat, activeTab, token]);

  // Auto-scroll chat to bottom whenever messages or typing indicator change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isCustomerTyping]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chats' && activeChat) {
      markWebChatAsRead(activeChat.store_id, activeChat.customer_id);
    }
  }, [activeTab, activeChat]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/stats${selectedTenantId ? '?tenant_id=' + selectedTenantId : ''}`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(res.data);
    } catch (err) { }
  };


  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${API_URL}/superadmin/tenants`, { headers: { Authorization: `Bearer ${token}` } });
      setTenants(res.data);
    } catch (err) { }
  };
  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/staff`, { headers: { Authorization: `Bearer ${token}` } });
      setStaffList(res.data);
    } catch (err) { }
  };
  const fetchAppReviews = async () => {
    try {
      const res = await axios.get(`${API_URL}/app-reviews`, { headers: { Authorization: `Bearer ${token}` } });
      setAppReviews(res.data);
    } catch (err) { }
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

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email: resetEmail });
      setForgotPasswordStep('reset');
      setResetSuccess('OTP code has been sent to your email.');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to send OTP. Try again.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        email: resetEmail,
        otp: resetOtp,
        newPassword: newPassword
      });
      setResetSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        setForgotPasswordStep('login');
        setResetEmail('');
        setResetOtp('');
        setNewPassword('');
        setResetSuccess('');
      }, 2000);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to reset password. Try again.');
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
    } catch (err) { }
  };

  const fetchFoodItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/food-items`, { headers: { Authorization: `Bearer ${token}` } });
      setFoodItems(res.data);
    } catch (err) { }
  };

  const handleCreateFoodItem = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        store_id: parseInt(foodForm.store_id),
        name: foodForm.name,
        price: parseFloat(foodForm.price),
        original_price: foodForm.original_price ? parseFloat(foodForm.original_price) : null,
        quantity: parseInt(foodForm.quantity),
        description: foodForm.description,
        category: foodForm.category,
        images: foodForm.images
      };
      if (editingFood) {
        await axios.put(`${API_URL}/food-items/${editingFood.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        alert('Food item updated!');
      } else {
        await axios.post(`${API_URL}/food-items`, payload, { headers: { Authorization: `Bearer ${token}` } });
        alert('Food item created!');
      }
      setShowFoodModal(false);
      setEditingFood(null);
      setFoodForm({ store_id: '', name: '', price: '', original_price: '', quantity: '', description: '', category: 'Other', images: [] });
      fetchFoodItems();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save food item');
    }
  };

  const handleDeleteFoodItem = async (id) => {
    if (!window.confirm('Delete this food item?')) return;
    try {
      await axios.delete(`${API_URL}/food-items/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchFoodItems();
    } catch (err) {
      alert('Failed to delete food item');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (err) { }
  };

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API_URL}/reviews`);
      setReviews(res.data);
    } catch (err) { }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/orders`, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(res.data);
    } catch (err) { }
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

          // Use loose == to handle number/string type mismatches from different DB drivers
          // eslint-disable-next-line eqeqeq
          const isFromActiveChat = currentActive &&
            // eslint-disable-next-line eqeqeq
            msg.store_id == currentActive.store_id &&
            // eslint-disable-next-line eqeqeq
            msg.customer_id == currentActive.customer_id;

          console.log('[WS] Message received:', {
            msg_store_id: msg.store_id, msg_customer_id: msg.customer_id,
            active_store_id: currentActive?.store_id, active_customer_id: currentActive?.customer_id,
            currentTab, isFromActiveChat
          });

          if (isFromActiveChat && currentTab === 'chats') {
            setChatHistory((prev) => {
              if (prev.some(m => m.id === msg.id)) return prev;
              const optimisticIdx = msg.sender_role === 'Seller'
                ? prev.findIndex(m => String(m.id).startsWith('optimistic_') && m.message === msg.message && m.sender_role === 'Seller')
                : -1;
              if (optimisticIdx !== -1) {
                const updated = [...prev];
                updated[optimisticIdx] = msg;
                return updated;
              }
              return [...prev, msg];
            });
            markWebChatAsRead(msg.store_id, msg.customer_id);
            fetchActiveChats();
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
    } catch (err) { }
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
    } catch (err) { }
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
      // Optimistically append the message so it shows instantly, before the WS echo
      const optimisticMsg = {
        id: `optimistic_${Date.now()}`,
        store_id: activeChat.store_id,
        customer_id: activeChat.customer_id,
        sender_role: 'Seller',
        message: chatInput.trim(),
        is_read: true,
        created_at: new Date().toISOString(),
      };
      setChatHistory(prev => [...prev, optimisticMsg]);
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
      setShowBagModal(false);
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
      setShowStoreModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create store');
    }
  };

  const handleToggleStoreStatus = async (storeId, currentStatus) => {
    try {
      await axios.put(`${API_URL}/stores/${storeId}`, {
        is_active: currentStatus ? false : true
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
      setShowStoreModal(false);
      fetchStores();
    } catch (err) {
      alert('Failed to update store');
    }
  };

  const handleDeleteStore = async (id) => {
    if (!window.confirm("Delete this store? This will also delete all associated bags.")) return;
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
      setShowBagModal(false);
      fetchBags();
    } catch (err) {
      alert('Failed to update bag');
    }
  };

  const handleDeleteBag = async (id) => {
    if (!window.confirm("Delete this surprise bag?")) return;
    try {
      await axios.delete(`${API_URL}/bags/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBags();
    } catch (err) {
      alert('Failed to delete bag');
    }
  };

  const renderLandingPage = () => {
    return (
      <div className="landing-page animate-fade-in">
        {/* Navigation */}
        <header className="landing-navbar">
          <a href="#" className="landing-logo">
            <img src="/favicon.png" alt="FoodAway Logo" style={{ height: '40px', objectFit: 'contain' }} />
            <span>FoodAway</span>
          </a>
          <nav className="landing-nav-links">
            <a href="#why-use" className="landing-nav-link">About</a>
            <a href="#solutions" className="landing-nav-link">Solutions</a>
            <a href="#join" className="landing-nav-link">Impact</a>
          </nav>
          <div className="landing-actions">
            <button className="btn-landing-login" onClick={() => { setForgotPasswordStep('login'); setView('login'); }}>MyStore login</button>
            <button className="btn-landing-download" onClick={() => setShowAppDownloadModal(true)}>Download app</button>
          </div>
          {/* Mobile hamburger */}
          <button className="landing-hamburger" onClick={() => setMobileNavOpen(v => !v)} aria-label="Toggle menu">
            <span className={`ham-bar ${mobileNavOpen ? 'open' : ''}`} />
            <span className={`ham-bar ${mobileNavOpen ? 'open' : ''}`} />
            <span className={`ham-bar ${mobileNavOpen ? 'open' : ''}`} />
          </button>
        </header>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="landing-mobile-nav">
            <a href="#why-use" className="landing-mobile-nav-link" onClick={() => setMobileNavOpen(false)}>About</a>
            <a href="#solutions" className="landing-mobile-nav-link" onClick={() => setMobileNavOpen(false)}>Solutions</a>
            <a href="#join" className="landing-mobile-nav-link" onClick={() => setMobileNavOpen(false)}>Impact</a>
            <button className="btn-landing-login mobile-nav-btn" onClick={() => { setMobileNavOpen(false); setForgotPasswordStep('login'); setView('login'); }}>MyStore login</button>
            <button className="btn-landing-download mobile-nav-btn" onClick={() => { setMobileNavOpen(false); setShowAppDownloadModal(true); }}>Download app</button>
          </div>
        )}

        {/* Hero Section */}
        <section className="landing-hero">
          <video
            className="landing-hero-video"
            src="/5780292-uhd_3840_2160_24fps.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="landing-hero-overlay" />
          <div className="landing-hero-container">
            <div className="landing-hero-content">
              <span className="landing-hero-badge">Saving food from going to waste</span>
              <h1 className="landing-hero-title">Save good food<br />from going to waste</h1>
              <p className="landing-hero-subtitle">
                FoodAway connects you with local stores, cafes, and bakeries offering delicious surplus food at unbeatable prices. Rescue meals and help protect the planet.
              </p>
              <div className="landing-hero-btns">
                <button className="btn-hero-orange" onClick={() => setShowAppDownloadModal(true)}>Download the app</button>
                <button className="btn-hero-outline" onClick={() => {
                  const element = document.getElementById("solutions");
                  if (element) element.scrollIntoView({ behavior: 'smooth' });
                }}>Business solutions</button>
              </div>
            </div>
            <div className="landing-hero-mockup-wrapper">
            </div>
          </div>
        </section>

        {/* Why Use Section */}
        <section id="why-use" className="why-use-section">
          <div className="section-container">
            <span className="section-tag">Why use FoodAway</span>
            <h2 className="section-title">WHY USE FOODAWAY</h2>
            <div className="why-grid">
              <div className="why-features-col">
                <div className="why-feature-card">
                  <h3 className="why-feature-title">Enjoy good food at 1/2 price or less</h3>
                  <p className="why-feature-desc">Rescue fresh, high-quality food from your favorite local spots at a fraction of the cost.</p>
                </div>
                <div className="why-feature-card">
                  <h3 className="why-feature-title">Help the environment by reducing food waste</h3>
                  <p className="why-feature-desc">Every single surprise bag rescued directly avoids CO2e emissions and conserves natural resources.</p>
                </div>
              </div>

              <div className="why-image-wrapper">
                <img src="/groceries_bag.png" alt="FoodAway Groceries Bag" className="why-bag-image" />
              </div>

              <div className="why-features-col why-features-col-right">
                <div className="why-feature-card">
                  <h3 className="why-feature-title">Rescue food near you</h3>
                  <p className="why-feature-desc">Discover outstanding local bakeries, supermarkets, cafes, and restaurants in your area.</p>
                </div>
                <div className="why-feature-card">
                  <h3 className="why-feature-title">Try something new from local spots</h3>
                  <p className="why-feature-desc">Unpack surprise food bags from local favorites, bakeries, or sushi spots you haven't visited yet.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Moving Ribbon / Marquee */}
        <div className="marquee-ribbon">
          <div className="marquee-content">
            <span className="marquee-item"><span className="marquee-dot"></span>Sandwich</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Poke</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Burrito</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Salads</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Donuts</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Pizza</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Pastries</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Groceries</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Sushi</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Muffins</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Sandwich</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Poke</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Burrito</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Salads</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Donuts</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Pizza</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Pastries</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Groceries</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Sushi</span>
            <span className="marquee-item"><span className="marquee-dot"></span>Muffins</span>
          </div>
        </div>

        {/* Solutions Section */}
        <section id="solutions" className="solutions-section">
          <div className="section-container">
            <span className="section-tag">Our Business Solutions</span>
            <h2 className="section-title">Empowering Food Sellers</h2>
            <div className="solutions-grid">
              <div className="solutions-cards">
                <div className="solution-item">
                  <span className="solution-tag">For: Food Retail, Service, Catering</span>
                  <h3 className="solution-title">Surprise Bags</h3>
                  <p className="solution-desc">
                    Unlock extra revenue from your surplus ingredients and products. Sell your unsold food in "Surprise Bags" for customers to order and collect.
                  </p>
                </div>
                <div className="solution-item">
                  <span className="solution-tag">For: Grocery Retail</span>
                  <h3 className="solution-title">FoodAway Platform</h3>
                  <p className="solution-desc">
                    Your end-to-end surplus food management suite. Modular, intelligent software that helps grocery retailers track, manage, and redistribute surplus.
                  </p>
                </div>
                <div className="solution-item">
                  <span className="solution-tag">For: FMCGs, Wholesalers</span>
                  <h3 className="solution-title">Date Labeling Initiative</h3>
                  <p className="solution-desc">
                    Reduce waste at home by adding our customized "Look, Smell, Taste" label to Best Before products to guide household consumption.
                  </p>
                </div>
              </div>
              <div className="solutions-image-wrapper">
                <img src="/bakery_pickup.png" alt="Solutions Showcase" className="solutions-image" />
              </div>
            </div>
          </div>
        </section>

        {/* Join CTA Banner */}
        <section id="join" className="join-section">
          <div className="section-container">
            <h2 className="join-title">Join over 180,000 businesses fighting food waste with us</h2>
            <p className="join-subtitle">Download the FoodAway app today and start saving food or listing your surplus.</p>
            <div className="join-btns">
              <button className="btn-hero-orange" onClick={() => setShowAppDownloadModal(true)}>Get the App</button>
              <button className="btn-hero-outline" onClick={() => { setForgotPasswordStep('login'); setView('login'); }}>Business Sign Up</button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="giant-footer">
          <div className="footer-top">
            <div className="footer-logo">
              <img src="/favicon.png" alt="FoodAway Logo" style={{ height: '50px', objectFit: 'contain' }} />
              <span>FoodAway</span>
            </div>
            <div className="footer-links-row">
            
            </div>
            <div className="footer-badges">
              <div className="bcorp-badge">
                <div className="bcorp-circle">B</div>
                <span>Certified B Corporation</span>
              </div>
            </div>
          </div>

          <div className="giant-text-wrapper">
            <p className="giant-footer-text">FoodAway</p>
          </div>

          <div className="footer-bottom">
            <div className="footer-legal-links">
              {[
                ['Legal', 'legal'],
                ['Privacy Policy', 'privacy'],
                ['Cookie Policy', 'cookies'],
                ['Terms & Conditions', 'terms'],
                ['Contact us', 'contact'],
                ['DSA Disclosure', 'dsa'],
                ['Do Not Sell or Share My Data', 'donotsell'],
                ['Food Waste Sources', 'foodwaste'],
                ['Status', 'status'],
              ].map(([label, page]) => (
                <span key={page} className="footer-legal-link" style={{ cursor: 'pointer' }}
                  onClick={() => setView(page)}>
                  {label}
                </span>
              ))}
            </div>
            <div>
              <p>Copyright &copy; {new Date().getFullYear()} FoodAway ApS. All Rights Reserved.</p>
            </div>
          </div>
        </footer>

        {showAppDownloadModal && (
          <div className="app-modal-overlay" onClick={() => setShowAppDownloadModal(false)}>
            <div className="app-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="app-modal-title" aria-modal="true">
              <button type="button" className="app-modal-close" onClick={() => setShowAppDownloadModal(false)} aria-label="Close">
                ×
              </button>

              <div className="app-modal-header">
                <div className="app-modal-icon-wrap">
                  <img src="/favicon.png" alt="FoodAway" />
                </div>
                <span className="app-modal-badge">Coming Soon</span>
                <h3 id="app-modal-title" className="app-modal-title">Mobile App In Development</h3>
              </div>

              <p className="app-modal-text">
                Our mobile application is under development and will soon be available on iOS and Android. Sorry for the inconvenience.
              </p>

              <div className="app-modal-stores">
                <div className="app-modal-store-pill">
                  <span className="app-modal-store-label">Coming to</span>
                  <span className="app-modal-store-name">App Store</span>
                </div>
                <div className="app-modal-store-pill">
                  <span className="app-modal-store-label">Coming to</span>
                  <span className="app-modal-store-name">Google Play</span>
                </div>
              </div>

              <button type="button" className="app-modal-btn" onClick={() => setShowAppDownloadModal(false)}>
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Footer page routing ──────────────────────────────────────────────────────
  const goHome = () => setView(token ? 'app' : 'landing');
  const pageRoutes = {
    legal:      <Legal onBack={goHome} />,
    privacy:    <PrivacyPolicy onBack={goHome} />,
    cookies:    <CookiePolicy onBack={goHome} />,
    terms:      <TermsAndConditions onBack={goHome} />,
    contact:    <ContactUs onBack={goHome} />,
    dsa:        <DsaDisclosure onBack={goHome} />,
    donotsell:  <DoNotSell onBack={goHome} />,
    foodwaste:  <FoodWasteSources onBack={goHome} />,
    status:     <Status onBack={goHome} />,
  };
  if (pageRoutes[view]) return pageRoutes[view];

  if (!token) {
    if (view === 'login') {
      return (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, var(--brand-orange) 0%, var(--brand-orange-dark) 100%)' }}>
          <div className="glass-card animate-fade-in" style={{ padding: '2.5rem', width: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#111827', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <img src="/favicon.png" alt="FoodAway Logo" style={{ height: '70px', marginBottom: '1.5rem', objectFit: 'contain' }} />

            {forgotPasswordStep === 'login' && (
              <>
                <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800', color: '#111827' }}>Admin Portal</h2>
                <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Sign in to manage the platform</p>

                {authError && <div style={{ color: '#B91C1C', marginBottom: '1rem', padding: '0.5rem', background: '#FEE2E2', borderRadius: '4px', width: '100%', fontSize: '0.9rem' }}>{authError}</div>}

                <form onSubmit={handleLogin} style={{ width: '100%' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#111827' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '1rem', position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', paddingRight: '2.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#111827' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#4B5563', display: 'flex', alignItems: 'center' }}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
                    <span onClick={() => { setForgotPasswordStep('email'); setResetError(''); setResetSuccess(''); }} style={{ color: 'var(--brand-orange)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700' }}>Forgot Password?</span>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', background: 'var(--brand-orange)', border: 'none', color: 'white', fontWeight: '700', padding: '0.75rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Login</button>

                  <button
                    type="button"
                    onClick={() => setView('landing')}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #E5E7EB',
                      background: 'transparent',
                      color: '#374151',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginTop: '1rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Back to Home
                  </button>
                </form>
              </>
            )}

            {forgotPasswordStep === 'email' && (
              <>
                <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800', color: '#111827' }}>Reset Password</h2>
                <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Enter your email to receive a 6-digit OTP verification code</p>

                {resetError && <div style={{ color: '#B91C1C', marginBottom: '1rem', padding: '0.5rem', background: '#FEE2E2', borderRadius: '4px', width: '100%', fontSize: '0.9rem' }}>{resetError}</div>}
                {resetSuccess && <div style={{ color: '#065F46', marginBottom: '1rem', padding: '0.5rem', background: '#D1FAE5', borderRadius: '4px', width: '100%', fontSize: '0.9rem' }}>{resetSuccess}</div>}

                <form onSubmit={handleSendOtp} style={{ width: '100%' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#111827' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '1rem', background: 'var(--brand-orange)', border: 'none', color: 'white', fontWeight: '700' }}>Send Verification Code</button>
                  <button type="button" onClick={() => setForgotPasswordStep('login')} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB', background: 'transparent', color: '#374151', cursor: 'pointer', fontWeight: '600' }}>Back to Login</button>
                </form>
              </>
            )}

            {forgotPasswordStep === 'reset' && (
              <>
                <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800', color: '#111827' }}>Verify OTP</h2>
                <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Enter the OTP sent to your email and choose a new password</p>

                {resetError && <div style={{ color: '#B91C1C', marginBottom: '1rem', padding: '0.5rem', background: '#FEE2E2', borderRadius: '4px', width: '100%', fontSize: '0.9rem' }}>{resetError}</div>}
                {resetSuccess && <div style={{ color: '#065F46', marginBottom: '1rem', padding: '0.5rem', background: '#D1FAE5', borderRadius: '4px', width: '100%', fontSize: '0.9rem' }}>{resetSuccess}</div>}

                <form onSubmit={handleResetPassword} style={{ width: '100%' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <input
                      type="email"
                      value={resetEmail}
                      disabled
                      style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #D1D5DB', background: '#F3F4F6', color: '#374151', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="6-Digit OTP Code"
                      value={resetOtp}
                      onChange={e => setResetOtp(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#111827', letterSpacing: '2px', fontWeight: '700', textAlign: 'center' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="New Password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', paddingRight: '2.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#111827' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#4B5563', display: 'flex', alignItems: 'center' }}
                    >
                      {showNewPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '1rem', background: 'var(--brand-orange)', border: 'none', color: 'white', fontWeight: '700' }}>Reset Password</button>
                  <button type="button" onClick={() => setForgotPasswordStep('login')} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB', background: 'transparent', color: '#374151', cursor: 'pointer', fontWeight: '600' }}>Back to Login</button>
                </form>
              </>
            )}
          </div>
        </div>
      );
    }
    return renderLandingPage();
  }

  return (
    <div className="app-container">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.2rem' }}>
            {user?.logo ? (
              <img src={user.logo} alt="Brand Logo" style={{ width: '45px', height: '45px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <img src="/favicon.png" alt="FoodAway Logo" style={{ width: '45px', height: '45px', borderRadius: '10px', objectFit: 'contain', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span className="sidebar-logo" style={{ fontSize: '1.35rem', fontWeight: '800', lineHeight: '1.1', margin: 0, padding: 0 }}>FoodAway</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>Admin Portal</span>
            </div>
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">✕</button>
          </div>
          <p style={{ paddingLeft: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>Role: {user?.role}</p>
        </div>


        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}>Dashboard</div>
          {user?.role !== 'SuperAdmin' && (
            <>
              <div className={`nav-item ${activeTab === 'stores' ? 'active' : ''}`} onClick={() => { setActiveTab('stores'); setSidebarOpen(false); }}>Store Management</div>
              <div className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); setSidebarOpen(false); }}>Order Management</div>
              <div className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => { setActiveTab('reviews'); setSidebarOpen(false); }}>Customer Reviews</div>
              <div className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => { setActiveTab('chats'); setSidebarOpen(false); }}>Chat Support</div>
            </>
          )}
          {user?.role === 'SellersAdmin' && (
            <div className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => { setActiveTab('staff'); setSidebarOpen(false); }}>Staff Management</div>
          )}
          {user?.role === 'SuperAdmin' && (
            <>
              <div className={`nav-item ${activeTab === 'superadmin' ? 'active' : ''}`} onClick={() => { setActiveTab('superadmin'); setSidebarOpen(false); }}>Platform Users</div>
              <div className={`nav-item ${activeTab === 'appreviews' ? 'active' : ''}`} onClick={() => { setActiveTab('appreviews'); setSidebarOpen(false); }}>App Reviews</div>
            </>
          )}
          {user?.role !== 'SuperAdmin' && (
            <div style={{ padding: '0.75rem 1rem', marginTop: 'auto' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Currency
              </label>
              <select
                value={currencyCode}
                onChange={e => handleCurrencyChange(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>Logout</div>
        </nav>

      </aside>

      <main className="main-content">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="mobile-hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <span className="ham-bar" />
            <span className="ham-bar" />
            <span className="ham-bar" />
          </button>
          <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>FoodAway Admin</span>
          <div style={{ width: 40 }} />
        </div>

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
              <div className="portal-header-actions">
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
                <div className="stat-value">{currencySymbol}{stats.totalRevenue.toFixed(2)}</div>
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
            <header className="header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 className="header-title">Store Management</h1>
            </header>

            {/* Sub-tab nav */}
            <div className="sub-tab-bar">
              {[
                { key: 'stores', label: 'Stores', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
                { key: 'bags', label: 'Surprise Bags', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg> },
                { key: 'food', label: 'Open Food', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg> },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setStoreSubTab(t.key)}
                  style={{
                    padding: '0.55rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: storeSubTab === t.key ? 'var(--accent-primary)' : 'transparent',
                    color: storeSubTab === t.key ? '#fff' : 'var(--text-secondary)'
                  }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* ── STORES TAB ── */}
            {storeSubTab === 'stores' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button className="btn-primary" onClick={() => { setEditingStore(null); setNewStoreName(''); setNewStoreAddress(''); setNewStoreImage(null); setShowStoreModal(true); }}>+ Add Store</button>
                </div>
                <div className="glass-card portal-table" style={{ padding: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Store</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Address</th>
                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Status</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No stores yet. Add your first store!</td></tr>
                      ) : stores.map((store, idx) => (
                        <tr key={store.id} style={{ borderBottom: idx < stores.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {store.image ? (
                                <img src={store.image} alt={store.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🏪</div>
                              )}
                              <strong>{store.name}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{store.address}</td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleStoreStatus(store.id, store.is_active)}
                              style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', background: store.is_active ? '#D1FAE5' : '#FEE2E2', color: store.is_active ? '#065F46' : '#991B1B' }}>
                              {store.is_active ? 'Open' : 'Closed'}
                            </button>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => { setEditingStore(store); setNewStoreName(store.name); setNewStoreAddress(store.address); setNewStoreImage(store.image); setShowStoreModal(true); }} style={{ padding: '0.4rem 0.9rem', background: '#EEF2FF', color: '#4338CA', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Edit</button>
                              <button onClick={() => handleDeleteStore(store.id)} style={{ padding: '0.4rem 0.9rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SURPRISE BAGS TAB ── */}
            {storeSubTab === 'bags' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button className="btn-primary" onClick={() => { setEditingBag(null); setBagStoreId(''); setBagPrice(''); setBagOriginalPrice(''); setBagQuantity(''); setPickupTime(''); setBagDescription(''); setBagImages([]); setShowBagModal(true); }}>+ Add Bag</button>
                </div>
                <div className="glass-card portal-table" style={{ padding: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Store</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Price</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Qty</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Pickup</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bags.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No surprise bags yet.</td></tr>
                      ) : bags.map((bag, idx) => (
                        <tr key={bag.id} style={{ borderBottom: idx < bags.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '1rem', fontWeight: '600' }}>{bag.store_name}</td>
                          <td style={{ padding: '1rem' }}>
                            {bag.original_price && <span style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: '6px', fontSize: '0.85rem' }}>{currencySymbol}{bag.original_price.toFixed(2)}</span>}
                            <span style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{currencySymbol}{bag.price.toFixed(2)}</span>
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{bag.quantity}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{bag.pickup_time}</td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => {
                                const details = parsePickupTimeDetails(bag.pickup_time);
                                let parsedImgs = [];
                                try {
                                  parsedImgs = bag.images ? (typeof bag.images === 'string' ? JSON.parse(bag.images) : bag.images) : [];
                                } catch (e) { }
                                setEditingBag({
                                  ...bag,
                                  images: parsedImgs,
                                  _pickupDays: details.days,
                                  _pickupFrom: details.from,
                                  _pickupTo: details.to
                                });
                                setShowBagModal(true);
                              }} style={{ padding: '0.4rem 0.9rem', background: '#EEF2FF', color: '#4338CA', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Edit</button>
                              <button onClick={() => handleDeleteBag(bag.id)} style={{ padding: '0.4rem 0.9rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── OPEN FOOD TAB ── */}
            {storeSubTab === 'food' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button className="btn-primary" style={{ background: '#059669' }} onClick={() => { setEditingFood(null); setFoodForm({ store_id: '', name: '', price: '', original_price: '', quantity: '', description: '', category: 'Other', images: [] }); setShowFoodModal(true); }}>+ Add Food Item</button>
                </div>
                <div className="glass-card portal-table" style={{ padding: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Item</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Store</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Price</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Qty</th>
                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Status</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foodItems.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No food items yet.</td></tr>
                      ) : foodItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: idx < foodItems.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '1rem', fontWeight: '600' }}>{item.name}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.store_name}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ background: '#ECFDF5', color: '#065F46', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '600' }}>{item.category}</span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {item.original_price && <span style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: '6px', fontSize: '0.85rem' }}>{currencySymbol}{parseFloat(item.original_price).toFixed(2)}</span>}
                            <span style={{ color: '#059669', fontWeight: '700' }}>{currencySymbol}{parseFloat(item.price).toFixed(2)}</span>
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span style={{ padding: '0.2rem 0.7rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', background: item.is_available ? '#D1FAE5' : '#FEE2E2', color: item.is_available ? '#065F46' : '#991B1B' }}>
                              {item.is_available ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => {
                                let parsedImgs = [];
                                try {
                                  parsedImgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                                } catch (e) { }
                                setEditingFood(item);
                                setFoodForm({ store_id: item.store_id, name: item.name, price: item.price, original_price: item.original_price || '', quantity: item.quantity, description: item.description || '', category: item.category || 'Other', images: parsedImgs });
                                setShowFoodModal(true);
                              }} style={{ padding: '0.4rem 0.9rem', background: '#ECFDF5', color: '#065F46', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Edit</button>
                              <button onClick={() => handleDeleteFoodItem(item.id)} style={{ padding: '0.4rem 0.9rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── STORE MODAL ── */}
            {showStoreModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem' }}>
                <div className="glass-card portal-modal">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>{editingStore ? 'Edit Store' : 'Add New Store'}</h3>
                    <button onClick={() => setShowStoreModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                  </div>
                  <form onSubmit={editingStore ? handleUpdateStore : handleCreateStore}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Store Name *</label>
                      <input type="text" value={editingStore ? editingStore.name : newStoreName} onChange={e => editingStore ? setEditingStore({ ...editingStore, name: e.target.value }) : setNewStoreName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem' }} required />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Address *</label>
                      <input type="text" value={editingStore ? editingStore.address : newStoreAddress} onChange={e => editingStore ? setEditingStore({ ...editingStore, address: e.target.value }) : setNewStoreAddress(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem' }} required />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Store Image</label>
                      {(editingStore ? editingStore.image : newStoreImage) ? (
                        <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                          <img src={editingStore ? editingStore.image : newStoreImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button" onClick={() => editingStore ? setEditingStore({ ...editingStore, image: null }) : setNewStoreImage(null)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </div>
                      ) : (
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px', background: '#F9FAFB', cursor: 'pointer', textAlign: 'center' }}>
                          <span style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>📸</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Choose store image</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Click or drag to upload</span>
                          <input type="file" accept="image/*" onChange={(e) => editingStore ? handleSingleImageUpload(e, (b64) => setEditingStore({ ...editingStore, image: b64 })) : handleSingleImageUpload(e, setNewStoreImage)} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>
                    {!editingStore && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Location (drag pin)</label>
                        <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <Map mapboxAccessToken={MAPBOX_TOKEN} initialViewState={{ longitude: newStoreLng, latitude: newStoreLat, zoom: 12 }} style={{ width: '100%', height: '100%' }} mapStyle="mapbox://styles/mapbox/streets-v12">
                            <Marker longitude={newStoreLng} latitude={newStoreLat} draggable onDragEnd={(e) => { setNewStoreLng(e.lngLat.lng); setNewStoreLat(e.lngLat.lat); }} color="red" />
                          </Map>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="button" onClick={() => setShowStoreModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingStore ? 'Save Changes' : 'Create Store'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── BAG MODAL ── */}
            {showBagModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem' }}>
                <div className="glass-card portal-modal">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>{editingBag ? 'Edit Surprise Bag' : 'Add Surprise Bag'}</h3>
                    <button onClick={() => setShowBagModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                  </div>
                  <form onSubmit={editingBag ? handleUpdateBag : handleCreateBag}>
                    {!editingBag && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Store *</label>
                        <select value={bagStoreId} onChange={e => setBagStoreId(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required>
                          <option value="">-- Select Store --</option>
                          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="portal-form-2col">
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Original Price ({currencySymbol})</label>
                        <input type="number" step="0.01" value={editingBag ? editingBag.original_price || '' : bagOriginalPrice} onChange={e => editingBag ? setEditingBag({ ...editingBag, original_price: e.target.value }) : setBagOriginalPrice(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Sale Price ({currencySymbol}) *</label>
                        <input type="number" step="0.01" value={editingBag ? editingBag.price : bagPrice} onChange={e => editingBag ? setEditingBag({ ...editingBag, price: parseFloat(e.target.value) }) : setBagPrice(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required />
                      </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Quantity *</label>
                      <input type="number" value={editingBag ? editingBag.quantity : bagQuantity} onChange={e => editingBag ? setEditingBag({ ...editingBag, quantity: parseInt(e.target.value) }) : setBagQuantity(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required />
                    </div>
                    {/* Pickup Day + Time Picker */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Pickup Days (optional)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                        {ALL_DAYS.map(day => {
                          const currentDays = editingBag ? (editingBag._pickupDays || []) : pickupDays;
                          const isSelected = currentDays.includes(day);
                          return (
                            <button key={day} type="button"
                              onClick={() => editingBag ? setEditingBag({ ...editingBag, _pickupDays: isSelected ? currentDays.filter(d => d !== day) : [...currentDays, day] }) : toggleDay(day)}
                              style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', background: isSelected ? 'var(--accent-primary)' : 'transparent', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="portal-form-2col">
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>From</label>
                          <input type="time" value={editingBag ? (editingBag._pickupFrom || '18:00') : pickupFrom}
                            onChange={e => { if (editingBag) { const f = e.target.value; setEditingBag(b => ({ ...b, _pickupFrom: f, pickup_time: buildPickupTime(b._pickupDays || [], f, b._pickupTo || '20:00') })); } else { setPickupFrom(e.target.value); setPickupTime(buildPickupTime(pickupDays, e.target.value, pickupTo)); } }}
                            style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>To</label>
                          <input type="time" value={editingBag ? (editingBag._pickupTo || '20:00') : pickupTo}
                            onChange={e => { if (editingBag) { const t = e.target.value; setEditingBag(b => ({ ...b, _pickupTo: t, pickup_time: buildPickupTime(b._pickupDays || [], b._pickupFrom || '18:00', t) })); } else { setPickupTo(e.target.value); setPickupTime(buildPickupTime(pickupDays, pickupFrom, e.target.value)); } }}
                            style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                        </div>
                      </div>
                      {(editingBag ? editingBag.pickup_time : pickupTime) && (
                        <div style={{ marginTop: '8px', padding: '6px 12px', background: '#F0FDF4', borderRadius: '6px', fontSize: '0.85rem', color: '#059669', fontWeight: '600' }}>
                          📅 {editingBag ? editingBag.pickup_time : pickupTime}
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Description</label>
                      <textarea value={editingBag ? editingBag.description || '' : bagDescription} onChange={e => editingBag ? setEditingBag({ ...editingBag, description: e.target.value }) : setBagDescription(e.target.value)} rows="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Images</label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px', background: '#F9FAFB', cursor: 'pointer', textAlign: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🛍️</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Add bag images</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Click or drag multiple files</span>
                        <input type="file" multiple accept="image/*" onChange={editingBag ? (e => { const files = Array.from(e.target.files); Promise.all(files.map(f => new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsDataURL(f); }))).then(imgs => setEditingBag(b => ({ ...b, images: [...(b.images || []), ...imgs] }))); }) : (e => { const files = Array.from(e.target.files); Promise.all(files.map(f => new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsDataURL(f); }))).then(imgs => setBagImages(prev => [...prev, ...imgs])); })} style={{ display: 'none' }} />
                      </label>
                      {(editingBag ? (editingBag.images || []) : bagImages).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(editingBag ? (editingBag.images || []) : bagImages).map((img, idx) => (
                            <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button type="button" onClick={() => editingBag ? setEditingBag(b => ({ ...b, images: b.images.filter((_, i) => i !== idx) })) : setBagImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="button" onClick={() => setShowBagModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingBag ? 'Save Changes' : 'Create Bag'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── FOOD MODAL ── */}
            {showFoodModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem' }}>
                <div className="glass-card portal-modal">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>{editingFood ? 'Edit Food Item' : 'Add Food Item'}</h3>
                    <button onClick={() => setShowFoodModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                  </div>
                  <form onSubmit={handleCreateFoodItem}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Store *</label>
                      <select value={foodForm.store_id} onChange={e => setFoodForm(f => ({ ...f, store_id: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required>
                        <option value="">-- Select Store --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Item Name *</label>
                      <input type="text" value={foodForm.name} onChange={e => setFoodForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Category</label>
                      <select value={foodForm.category} onChange={e => setFoodForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {FOOD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Original Price ({currencySymbol})</label>
                        <input type="number" step="0.01" value={foodForm.original_price} onChange={e => setFoodForm(f => ({ ...f, original_price: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Sale Price ({currencySymbol}) *</label>
                        <input type="number" step="0.01" value={foodForm.price} onChange={e => setFoodForm(f => ({ ...f, price: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required />
                      </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Quantity *</label>
                      <input type="number" value={foodForm.quantity} onChange={e => setFoodForm(f => ({ ...f, quantity: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} required />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Description</label>
                      <textarea value={foodForm.description} onChange={e => setFoodForm(f => ({ ...f, description: e.target.value }))} rows="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }} />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Images</label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px', background: '#F9FAFB', cursor: 'pointer', textAlign: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🍔</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Add food images</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Click or drag multiple files</span>
                        <input type="file" multiple accept="image/*" onChange={e => { const files = Array.from(e.target.files); Promise.all(files.map(f => new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsDataURL(f); }))).then(imgs => setFoodForm(f => ({ ...f, images: [...(f.images || []), ...imgs] }))); }} style={{ display: 'none' }} />
                      </label>
                      {foodForm.images.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {foodForm.images.map((img, idx) => (
                            <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button type="button" onClick={() => setFoodForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="button" onClick={() => setShowFoodModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', cursor: 'pointer', fontWeight: '700' }}>{editingFood ? 'Save Changes' : 'Create Item'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
            <div className="portal-section-grid">
              <div className="glass-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Add New Staff</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await axios.post(`${API_URL}/seller/staff`, { name: newStaffName, email: newStaffEmail, password: newStaffPassword }, { headers: { Authorization: `Bearer ${token}` } });
                    alert('Staff created successfully');
                    setNewStaffName(''); setNewStaffEmail(''); setNewStaffPassword('');
                    fetchStaff();
                  } catch (err) { alert('Failed to create staff'); }
                }}>
                  <input type="text" placeholder="Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                  <input type="email" placeholder="Email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #ddd' }} />
                  <input type="password" placeholder="Password" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', borderRadius: '6px', border: '1px solid #ddd' }} />
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

            <div className="portal-section-grid">
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
              <div className="portal-filter-row">
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
              <div className="portal-filter-row">
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
                    <div key={o.id} className="glass-card" style={{ padding: '1.5rem' }}>
                      <div className="portal-order-card">
                      <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#EFF6FF', color: '#1D4ED8', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.1rem', flexShrink: 0 }}>
                        #{o.id}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="portal-order-header">
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
                              {currencySymbol}{(o.price * o.quantity).toFixed(2)}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              Pickup: {o.pickup_time}
                            </span>
                          </div>
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
          <div className="animate-fade-in chat-page-wrapper">
            <header className="header" style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
              <h1 className="header-title">Customer Live Chat Support</h1>
            </header>

            <div className="chat-split">
              {/* Left sidebar chats list */}
              <div className="glass-card chat-sidebar">
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
                    <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#FAFAFA' }}>
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
                      <div ref={chatEndRef} style={{ height: 0 }} />
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
