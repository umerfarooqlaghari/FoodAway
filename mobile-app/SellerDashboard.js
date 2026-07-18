import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert, ScrollView,
  Image, Modal, StyleSheet, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const { PRODUCT_CATEGORIES } = require('./shared/productCategories');

const ORANGE = '#FF5C00';
const ORANGE_DARK = '#E55200';
const ORANGE_LIGHT = '#FFFFFF';

const NAV_ITEMS = [
  { key: 'stores', label: 'Stores', icon: 'storefront-outline' },
  { key: 'bags', label: 'Bags', icon: 'bag-handle-outline' },
  { key: 'food', label: 'Products', icon: 'pricetag-outline' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { key: 'staff', label: 'Staff', icon: 'people-outline', adminOnly: true },
  { key: 'reviews', label: 'Reviews', icon: 'star-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubbles-outline' },
];

function parsePickupTimeDetails(pickupTimeStr) {
  if (!pickupTimeStr) return { days: [], from: '18:00', to: '20:00' };
  const timeRegex = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/;
  const match = pickupTimeStr.match(timeRegex);
  const from = match ? match[1] : '18:00';
  const to = match ? match[2] : '20:00';
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = ALL_DAYS.filter(day => pickupTimeStr.includes(day));
  return { days, from, to };
}

function SellerMapPicker({ lat, lng, onChange }) {
  let MapView, Marker;
  if (Platform.OS !== 'web') {
    try {
      const Maps = require('react-native-maps');
      MapView = Maps.default || Maps;
      Marker = Maps.Marker;
    } catch (_) {}
  }
  if (!MapView) {
    return (
      <View style={s.mapFallback}>
        <Ionicons name="map-outline" size={28} color="#64748B" />
        <Text style={s.mapFallbackText}>Map preview · {lat.toFixed(4)}, {lng.toFixed(4)}</Text>
        <Text style={s.mapFallbackSub}>Use location button to set coordinates</Text>
      </View>
    );
  }
  return (
    <MapView
      style={s.map}
      initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      region={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
    >
      <Marker
        coordinate={{ latitude: lat, longitude: lng }}
        draggable
        onDragEnd={(e) => onChange(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
      />
    </MapView>
  );
}

export default function SellerDashboardScreen({ AuthContext, API_URL }) {
  const { token, logout, user, currencyCode, currencySymbol, changeCurrency, CURRENCIES } = useContext(AuthContext);

  const [sellerTab, setSellerTab] = useState('stores');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingTab, setLoadingTab] = useState(false);

  const [stores, setStores] = useState([]);
  const [sellerBags, setSellerBags] = useState([]);
  const [sellerFoodItems, setSellerFoodItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [chatsList, setChatsList] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, bagsSold: 0, dailySales: [] });

  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLat, setStoreLat] = useState(51.5074);
  const [storeLng, setStoreLng] = useState(-0.1278);
  const [storeImage, setStoreImage] = useState(null);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [showStoreModal, setShowStoreModal] = useState(false);

  const [bagStoreId, setBagStoreId] = useState(null);
  const [bagPrice, setBagPrice] = useState('');
  const [bagOriginalPrice, setBagOriginalPrice] = useState('');
  const [bagQuantity, setBagQuantity] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [bagDescription, setBagDescription] = useState('');
  const [bagImages, setBagImages] = useState([]);
  const [editingBagId, setEditingBagId] = useState(null);
  const [showBagModal, setShowBagModal] = useState(false);

  const [foodStoreId, setFoodStoreId] = useState(null);
  const [foodName, setFoodName] = useState('');
  const [foodDescription, setFoodDescription] = useState('');
  const [foodPrice, setFoodPrice] = useState('');
  const [foodOriginalPrice, setFoodOriginalPrice] = useState('');
  const [foodQuantity, setFoodQuantity] = useState('');
  const [foodCategory, setFoodCategory] = useState('Other');
  const [foodImages, setFoodImages] = useState([]);
  const [editingFoodId, setEditingFoodId] = useState(null);
  const [showFoodModal, setShowFoodModal] = useState(false);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);

  const [activeChat, setActiveChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [pickupDays, setPickupDays] = useState([]);
  const [pickupFrom, setPickupFrom] = useState('18:00');
  const [pickupTo, setPickupTo] = useState('20:00');
  const [activeTimePicker, setActiveTimePicker] = useState(null); // 'from' | 'to' | null

  const buildPickupTime = (days, from, to) => days.length === 0 ? `${from} - ${to}` : `${days.join(', ')} ${from} - ${to}`;
  const timeToDate = (hhmm) => {
    const [h, m] = (hhmm || '').split(':').map(Number);
    const d = new Date();
    d.setHours(Number.isFinite(h) ? h : 18, Number.isFinite(m) ? m : 0, 0, 0);
    return d;
  };
  const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const onTimePicked = (which) => (_event, date) => {
    if (Platform.OS === 'android') setActiveTimePicker(null);
    if (!date) return;
    const value = formatTime(date);
    if (which === 'from') {
      setPickupFrom(value);
      setPickupTime(buildPickupTime(pickupDays, value, pickupTo));
    } else {
      setPickupTo(value);
      setPickupTime(buildPickupTime(pickupDays, pickupFrom, value));
    }
  };
  const togglePickupDay = (day) => {
    setPickupDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      setPickupTime(buildPickupTime(next, pickupFrom, pickupTo));
      return next;
    });
  };

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const isAdmin = user?.role === 'SellersAdmin';
  const storeIds = new Set(stores.map(st => st.id));
  const tenantReviews = reviews.filter(r => stores.some(st => st.name === r.store_name));

  const fetchStores = useCallback(async () => {
    const res = await axios.get(`${API_URL}/stores`, authHeaders);
    setStores(res.data);
  }, [token]);

  const fetchSellerBags = useCallback(async () => {
    const res = await axios.get(`${API_URL}/bags?all=true`, authHeaders);
    setSellerBags(res.data);
  }, [token]);

  const fetchSellerFoodItems = useCallback(async () => {
    const res = await axios.get(`${API_URL}/food-items?all=true`, authHeaders);
    setSellerFoodItems(res.data);
  }, [token]);

  const fetchStats = useCallback(async () => {
    const res = await axios.get(`${API_URL}/seller/stats`, authHeaders);
    setStats(res.data);
  }, [token]);

  const fetchOrders = useCallback(async () => {
    const res = await axios.get(`${API_URL}/seller/orders`, authHeaders);
    setOrders(res.data);
  }, [token]);

  const fetchStaff = useCallback(async () => {
    if (!isAdmin) return;
    const res = await axios.get(`${API_URL}/seller/staff`, authHeaders);
    setStaffList(res.data);
  }, [token, isAdmin]);

  const fetchReviews = useCallback(async () => {
    const res = await axios.get(`${API_URL}/reviews`, authHeaders);
    setReviews(res.data);
  }, [token]);

  const fetchChats = useCallback(async () => {
    if (!isAdmin) return;
    const res = await axios.get(`${API_URL}/seller/chats`, authHeaders);
    setChatsList(res.data);
  }, [token, isAdmin]);

  const loadTab = useCallback(async (tab) => {
    setLoadingTab(true);
    try {
      await fetchStats();
      if (['stores', 'bags', 'food'].includes(tab)) {
        await Promise.all([fetchStores(), fetchSellerBags(), fetchSellerFoodItems()]);
      }
      if (tab === 'orders') await fetchOrders();
      if (tab === 'staff' && isAdmin) await fetchStaff();
      if (tab === 'reviews') await Promise.all([fetchReviews(), fetchStores()]);
      if (tab === 'chat' && isAdmin) await fetchChats();
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        Alert.alert('Session Expired', 'Please login again.');
        logout();
      }
    } finally {
      setLoadingTab(false);
    }
  }, [fetchStores, fetchSellerBags, fetchSellerFoodItems, fetchStats, fetchOrders, fetchStaff, fetchReviews, fetchChats, isAdmin, logout]);

  useEffect(() => { loadTab(sellerTab); }, [sellerTab]);

  const connectSellerWs = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const wsUrl = API_URL.replace('/api', '').replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'register', token }));
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'message' && activeChat &&
          data.message?.store_id === activeChat.store_id &&
          data.message?.customer_id === activeChat.customer_id) {
          setChatHistory(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch (_) {}
    };
    wsRef.current = ws;
  };

  const openSellerChat = async (chat) => {
    setActiveChat(chat);
    setShowChatModal(true);
    connectSellerWs();
    try {
      const res = await axios.get(
        `${API_URL}/chat/history?store_id=${chat.store_id}&customer_id=${chat.customer_id}`,
        authHeaders
      );
      setChatHistory(res.data);
      await axios.post(`${API_URL}/chat/read`, { store_id: chat.store_id, customer_id: chat.customer_id }, authHeaders);
      fetchChats();
    } catch (e) {
      Alert.alert('Error', 'Could not load chat');
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !activeChat || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'message',
      storeId: activeChat.store_id,
      customerId: activeChat.customer_id,
      text: chatInput.trim()
    }));
    setChatInput('');
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollToEnd({ animated: true });
  }, [chatHistory]);

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow location to pin your store.');
    const loc = await Location.getCurrentPositionAsync({});
    setStoreLat(loc.coords.latitude);
    setStoreLng(loc.coords.longitude);
  };

  const handleCreateStore = async () => {
    if (!storeName.trim() || !storeAddress.trim()) return Alert.alert('Required', 'Store name and address are required.');
    try {
      const payload = { name: storeName.trim(), address: storeAddress.trim(), lat: storeLat, lng: storeLng, image: storeImage };
      if (editingStoreId) {
        await axios.put(`${API_URL}/stores/${editingStoreId}`, payload, authHeaders);
        Alert.alert('Success', 'Store updated.');
      } else {
        await axios.post(`${API_URL}/stores`, payload, authHeaders);
        Alert.alert('Success', 'Store created.');
      }
      setShowStoreModal(false);
      setStoreName(''); setStoreAddress(''); setStoreImage(null);
      setEditingStoreId(null);
      loadTab('stores');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    }
  };

  const handleDeleteStore = (id) => {
    Alert.alert('Delete Store', 'Delete this store and associated items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await axios.delete(`${API_URL}/stores/${id}`, authHeaders);
        loadTab('stores');
      }}
    ]);
  };

  const handleCreateBag = async () => {
    if (!bagStoreId || !bagPrice || !bagQuantity || !pickupTime) return Alert.alert('Required', 'Fill store, price, quantity, and pickup time.');
    try {
      const payload = {
        store_id: bagStoreId, price: parseFloat(bagPrice),
        original_price: bagOriginalPrice ? parseFloat(bagOriginalPrice) : null,
        description: bagDescription, images: bagImages,
        quantity: parseInt(bagQuantity, 10), pickup_time: pickupTime
      };
      if (editingBagId) await axios.put(`${API_URL}/bags/${editingBagId}`, payload, authHeaders);
      else await axios.post(`${API_URL}/bags`, payload, authHeaders);
      setShowBagModal(false);
      loadTab('bags');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    }
  };

  const handleDeleteBag = (id) => {
    Alert.alert('Delete', 'Remove this bag?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await axios.delete(`${API_URL}/bags/${id}`, authHeaders); loadTab('bags'); }}
    ]);
  };

  const handleCreateFoodItem = async () => {
    if (!foodStoreId || !foodName || !foodPrice || !foodQuantity) return Alert.alert('Required', 'Fill store, name, price, and quantity.');
    try {
      const payload = {
        store_id: foodStoreId, name: foodName, description: foodDescription,
        price: parseFloat(foodPrice), original_price: foodOriginalPrice ? parseFloat(foodOriginalPrice) : null,
        images: foodImages, quantity: parseInt(foodQuantity, 10), category: foodCategory
      };
      if (editingFoodId) await axios.put(`${API_URL}/food-items/${editingFoodId}`, payload, authHeaders);
      else await axios.post(`${API_URL}/food-items`, payload, authHeaders);
      setShowFoodModal(false);
      loadTab('food');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    }
  };

  const handleDeleteFoodItem = (id) => {
    Alert.alert('Delete', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await axios.delete(`${API_URL}/food-items/${id}`, authHeaders); loadTab('food'); }}
    ]);
  };

  const handleCreateStaff = async () => {
    if (!newStaffName || !newStaffEmail || !newStaffPassword) return Alert.alert('Required', 'Fill all staff fields.');
    try {
      await axios.post(`${API_URL}/seller/staff`, { name: newStaffName, email: newStaffEmail, password: newStaffPassword }, authHeaders);
      setShowStaffModal(false);
      setNewStaffName(''); setNewStaffEmail(''); setNewStaffPassword('');
      loadTab('staff');
      Alert.alert('Success', 'Staff member added.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to add staff');
    }
  };

  const pickImages = async (setter, current) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.2, base64: true });
    if (!result.canceled) setter([...current, ...result.assets.map(a => `data:image/jpeg;base64,${a.base64}`)]);
  };

  const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);

  const renderKpi = (label, value) => (
    <View style={s.kpiCard}>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );

  const renderEmpty = (icon, message) => (
    <View style={s.empty}>
      <Ionicons name={icon} size={48} color="#D1D5DB" />
      <Text style={s.emptyText}>{message}</Text>
    </View>
  );

  const renderListContent = () => {
    if (loadingTab) {
      return <View style={s.loadingWrap}><ActivityIndicator size="large" color={ORANGE} /></View>;
    }

    if (sellerTab === 'orders') {
      return (
        <FlatList
          data={orders}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('receipt-outline', 'No orders yet.')}
          renderItem={({ item: o }) => (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{o.item_name}</Text>
                  <Text style={s.cardSub}>{o.store_name} · {o.customer_name}</Text>
                  <Text style={s.cardSub}>{o.customer_email}</Text>
                </View>
                <Text style={s.price}>{currencySymbol}{(o.price * o.quantity).toFixed(2)}</Text>
              </View>
              <Text style={s.meta}>Qty {o.quantity} · {o.payment_method} · {o.pickup_time}</Text>
              <Text style={s.meta}>{new Date(o.created_at).toLocaleString()}</Text>
            </View>
          )}
        />
      );
    }

    if (sellerTab === 'staff' && isAdmin) {
      return (
        <FlatList
          data={staffList}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('people-outline', 'No staff yet. Add team members.')}
          ListHeaderComponent={
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setShowStaffModal(true)}>
              <Ionicons name="person-add-outline" size={18} color={ORANGE} />
              <Text style={s.secondaryBtnText}>Add Staff Member</Text>
            </TouchableOpacity>
          }
          renderItem={({ item: st }) => (
            <View style={s.card}>
              <Text style={s.cardTitle}>{st.name}</Text>
              <Text style={s.cardSub}>{st.email}</Text>
            </View>
          )}
        />
      );
    }

    if (sellerTab === 'reviews') {
      return (
        <FlatList
          data={tenantReviews}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('star-outline', 'No customer reviews yet.')}
          renderItem={({ item: r }) => (
            <View style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>{r.customer_name}</Text>
                <Text style={s.rating}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
              </View>
              <Text style={s.cardSub}>{r.store_name}</Text>
              {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
            </View>
          )}
        />
      );
    }

    if (sellerTab === 'chat' && isAdmin) {
      return (
        <FlatList
          data={chatsList}
          keyExtractor={i => `${i.store_id}_${i.customer_id}`}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('chatbubbles-outline', 'No customer chats yet.')}
          renderItem={({ item: c }) => (
            <TouchableOpacity style={s.card} onPress={() => openSellerChat(c)}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{c.customer_name}</Text>
                  <Text style={s.cardSub}>{c.store_name}</Text>
                  <Text style={s.chatPreview} numberOfLines={1}>{c.last_message}</Text>
                </View>
                {c.unread_count > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{c.unread_count}</Text></View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      );
    }

    if (sellerTab === 'stores') {
      return (
        <FlatList
          data={stores}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('storefront-outline', 'No stores yet. Add your first location.')}
          renderItem={({ item: store }) => (
            <View style={s.card}>
              <View style={s.cardRow}>
                {store.image ? (
                  <Image source={{ uri: store.image }} style={s.thumb} />
                ) : (
                  <View style={s.thumbPlaceholder}><Ionicons name="storefront-outline" size={24} color={ORANGE} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{store.name}</Text>
                  <Text style={s.cardSub}>{store.address}</Text>
                </View>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => {
                  setStoreName(store.name); setStoreAddress(store.address);
                  setStoreImage(store.image); setStoreLat(store.lat || 51.5074);
                  setStoreLng(store.lng || -0.1278); setEditingStoreId(store.id); setShowStoreModal(true);
                }}>
                  <Text style={s.actionEdit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionDelete]} onPress={() => handleDeleteStore(store.id)}>
                  <Text style={s.actionDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      );
    }

    if (sellerTab === 'bags') {
      return (
        <FlatList
          data={sellerBags}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('bag-handle-outline', 'No surprise bags yet.')}
          renderItem={({ item: bag }) => (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{bag.store_name}</Text>
                  <Text style={s.cardSub}>Pickup: {bag.pickup_time}</Text>
                </View>
                <Text style={s.price}>{currencySymbol}{bag.price.toFixed(2)}</Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => {
                  let parsedImgs = [];
                  try { parsedImgs = bag.images ? (typeof bag.images === 'string' ? JSON.parse(bag.images) : bag.images) : []; } catch (_) {}
                  setBagStoreId(bag.store_id); setBagPrice(String(bag.price));
                  setBagOriginalPrice(bag.original_price ? String(bag.original_price) : '');
                  setBagQuantity(String(bag.quantity)); setPickupTime(bag.pickup_time);
                  setBagDescription(bag.description || ''); setBagImages(parsedImgs);
                  const d = parsePickupTimeDetails(bag.pickup_time);
                  setPickupDays(d.days); setPickupFrom(d.from); setPickupTo(d.to);
                  setActiveTimePicker(null); setEditingBagId(bag.id); setShowBagModal(true);
                }}><Text style={s.actionEdit}>Edit</Text></TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionDelete]} onPress={() => handleDeleteBag(bag.id)}>
                  <Text style={s.actionDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      );
    }

    if (sellerTab === 'food') {
      return (
        <FlatList
          data={sellerFoodItems}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={s.listPad}
          ListEmptyComponent={renderEmpty('cart-outline', 'No products yet.')}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{item.name}</Text>
                  <Text style={s.cardSub}>{item.store_name} · {item.category}</Text>
                </View>
                <Text style={s.price}>{currencySymbol}{parseFloat(item.price).toFixed(2)}</Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => {
                  let parsedImgs = [];
                  try { parsedImgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : []; } catch (_) {}
                  setFoodStoreId(item.store_id); setFoodName(item.name);
                  setFoodDescription(item.description || ''); setFoodPrice(String(item.price));
                  setFoodOriginalPrice(item.original_price ? String(item.original_price) : '');
                  setFoodQuantity(String(item.quantity)); setFoodCategory(item.category || 'Other');
                  setFoodImages(parsedImgs); setEditingFoodId(item.id); setShowFoodModal(true);
                }}><Text style={s.actionEdit}>Edit</Text></TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionDelete]} onPress={() => handleDeleteFoodItem(item.id)}>
                  <Text style={s.actionDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      );
    }

    return null;
  };

  const showFab = ['stores', 'bags', 'food'].includes(sellerTab);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          {user?.logo ? (
            <Image source={{ uri: user.logo }} style={s.logo} />
          ) : (
            <View style={s.logoPlaceholder}><Ionicons name="storefront" size={22} color={ORANGE} /></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.brandName} numberOfLines={1}>{user?.name || 'Your Brand'}</Text>
            <Text style={s.userEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.menuBtn} onPress={() => setMenuOpen(v => !v)}>
          <Ionicons name={menuOpen ? 'close' : 'ellipsis-vertical'} size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <View style={s.menuPanel}>
          <Text style={s.menuLabel}>Currency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {CURRENCIES.map(c => (
              <TouchableOpacity key={c.code} onPress={() => changeCurrency(c.code)} style={[s.currencyPill, currencyCode === c.code && s.currencyPillActive]}>
                <Text style={[s.currencyText, currencyCode === c.code && s.currencyTextActive]}>{c.symbol} {c.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.logoutBtn} onPress={() => { setMenuOpen(false); logout(); }}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* KPIs */}
      <View style={s.kpiRow}>
        {renderKpi('Revenue', `${currencySymbol}${stats.totalRevenue.toFixed(2)}`)}
        {renderKpi('Bags Sold', String(stats.bagsSold))}
        {renderKpi('Stores', String(stores.length))}
      </View>

      {/* Nav */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.navScroll} contentContainerStyle={s.navContent}>
        {visibleNav.map(item => (
          <TouchableOpacity key={item.key} style={[s.navItem, sellerTab === item.key && s.navItemActive]} onPress={() => setSellerTab(item.key)}>
            <Ionicons name={item.icon} size={18} color={sellerTab === item.key ? ORANGE : '#6B7280'} />
            <Text style={[s.navLabel, sellerTab === item.key && s.navLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>{renderListContent()}</View>

      {showFab && (
        <TouchableOpacity style={s.fab} onPress={() => {
          if (sellerTab === 'stores') {
            setEditingStoreId(null); setStoreName(''); setStoreAddress(''); setStoreImage(null);
            setStoreLat(51.5074); setStoreLng(-0.1278); setShowStoreModal(true);
          } else if (sellerTab === 'bags') {
            setEditingBagId(null); setBagStoreId(null); setBagPrice(''); setBagOriginalPrice('');
            setBagQuantity(''); setPickupTime(''); setBagDescription(''); setBagImages([]); setActiveTimePicker(null); setShowBagModal(true);
          } else {
            setEditingFoodId(null); setFoodStoreId(null); setFoodName(''); setFoodDescription('');
            setFoodPrice(''); setFoodOriginalPrice(''); setFoodQuantity(''); setFoodCategory('Other');
            setFoodImages([]); setShowFoodModal(true);
          }
        }}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Store Modal */}
      <Modal visible={showStoreModal} animationType="slide" transparent onRequestClose={() => setShowStoreModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editingStoreId ? 'Edit Store' : 'Add Store'}</Text>
              <TouchableOpacity onPress={() => setShowStoreModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={s.label}>Store Name *</Text>
              <TextInput style={s.input} placeholder="e.g. Green Grocer" value={storeName} onChangeText={setStoreName} />
              <Text style={s.label}>Address *</Text>
              <TextInput style={s.input} placeholder="Full street address" value={storeAddress} onChangeText={setStoreAddress} />
              <Text style={s.label}>Location *</Text>
              <TouchableOpacity style={s.locationBtn} onPress={useCurrentLocation}>
                <Ionicons name="locate-outline" size={18} color={ORANGE} />
                <Text style={s.locationBtnText}>Use my current location</Text>
              </TouchableOpacity>
              <SellerMapPicker lat={storeLat} lng={storeLng} onChange={(la, ln) => { setStoreLat(la); setStoreLng(ln); }} />
              <Text style={s.mapHint}>Drag the pin to set the exact pickup location</Text>
              <Text style={s.label}>Store Image</Text>
              {storeImage ? (
                <View style={s.imagePreview}>
                  <Image source={{ uri: storeImage }} style={s.previewImg} />
                  <TouchableOpacity style={s.removeImg} onPress={() => setStoreImage(null)}><Ionicons name="close" size={16} color="#fff" /></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.uploadBox} onPress={async () => {
                  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.2, base64: true });
                  if (!r.canceled) setStoreImage(`data:image/jpeg;base64,${r.assets[0].base64}`);
                }}>
                  <Ionicons name="camera-outline" size={24} color="#64748B" />
                  <Text style={s.uploadText}>Upload store photo</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.primaryBtn} onPress={handleCreateStore}>
                <Text style={s.primaryBtnText}>{editingStoreId ? 'Save Store' : 'Create Store'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bag Modal - abbreviated structure, same fields */}
      <Modal visible={showBagModal} animationType="slide" transparent onRequestClose={() => setShowBagModal(false)}>
        <View style={s.modalBg}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editingBagId ? 'Edit Bag' : 'Add Surprise Bag'}</Text>
              <TouchableOpacity onPress={() => setShowBagModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={s.label}>Store *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {stores.map(store => (
                  <TouchableOpacity key={store.id} onPress={() => setBagStoreId(store.id)} style={[s.chip, bagStoreId === store.id && s.chipActive]}>
                    <Text style={[s.chipText, bagStoreId === store.id && s.chipTextActive]}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Original ({currencySymbol})</Text>
                  <TextInput style={s.input} value={bagOriginalPrice} onChangeText={setBagOriginalPrice} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Sale ({currencySymbol}) *</Text>
                  <TextInput style={s.input} value={bagPrice} onChangeText={setBagPrice} keyboardType="numeric" />
                </View>
              </View>
              <Text style={s.label}>Quantity *</Text>
              <TextInput style={s.input} value={bagQuantity} onChangeText={setBagQuantity} keyboardType="numeric" />
              <Text style={s.label}>Pickup days</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {ALL_DAYS.map(day => (
                  <TouchableOpacity key={day} onPress={() => togglePickupDay(day)} style={[s.chip, pickupDays.includes(day) && s.chipActive]}>
                    <Text style={[s.chipText, pickupDays.includes(day) && s.chipTextActive]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>From</Text>
                  <TouchableOpacity style={s.timeField} onPress={() => setActiveTimePicker(activeTimePicker === 'from' ? null : 'from')}>
                    <Text style={s.timeFieldText}>{pickupFrom}</Text>
                    <Ionicons name="time-outline" size={18} color={activeTimePicker === 'from' ? ORANGE : '#64748B'} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>To</Text>
                  <TouchableOpacity style={s.timeField} onPress={() => setActiveTimePicker(activeTimePicker === 'to' ? null : 'to')}>
                    <Text style={s.timeFieldText}>{pickupTo}</Text>
                    <Ionicons name="time-outline" size={18} color={activeTimePicker === 'to' ? ORANGE : '#64748B'} />
                  </TouchableOpacity>
                </View>
              </View>
              {activeTimePicker && (
                <View style={{ marginBottom: 14 }}>
                  <DateTimePicker
                    value={timeToDate(activeTimePicker === 'from' ? pickupFrom : pickupTo)}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onTimePicked(activeTimePicker)}
                    onDismiss={() => setActiveTimePicker(null)}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={s.timeDoneBtn} onPress={() => setActiveTimePicker(null)}>
                      <Text style={s.timeDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {pickupTime ? <Text style={s.pickupPreview}>{pickupTime}</Text> : null}
              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, { height: 70 }]} value={bagDescription} onChangeText={setBagDescription} multiline />
              <TouchableOpacity style={s.uploadBox} onPress={() => pickImages(setBagImages, bagImages)}>
                <Ionicons name="images-outline" size={24} color="#64748B" /><Text style={s.uploadText}>Add images</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={() => { handleCreateBag(); setShowBagModal(false); }}>
                <Text style={s.primaryBtnText}>{editingBagId ? 'Update Bag' : 'Create Bag'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Food Modal */}
      <Modal visible={showFoodModal} animationType="slide" transparent onRequestClose={() => setShowFoodModal(false)}>
        <View style={s.modalBg}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editingFoodId ? 'Edit Food' : 'Add Food Item'}</Text>
              <TouchableOpacity onPress={() => setShowFoodModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={s.label}>Store *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {stores.map(store => (
                  <TouchableOpacity key={store.id} onPress={() => setFoodStoreId(store.id)} style={[s.chip, foodStoreId === store.id && s.chipActive]}>
                    <Text style={[s.chipText, foodStoreId === store.id && s.chipTextActive]}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.label}>Name *</Text>
              <TextInput style={s.input} value={foodName} onChangeText={setFoodName} />
              <Text style={s.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {PRODUCT_CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setFoodCategory(cat)} style={[s.chip, foodCategory === cat && s.chipActive]}>
                    <Text style={[s.chipText, foodCategory === cat && s.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Text style={s.label}>Original ({currencySymbol})</Text><TextInput style={s.input} value={foodOriginalPrice} onChangeText={setFoodOriginalPrice} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Text style={s.label}>Sale ({currencySymbol}) *</Text><TextInput style={s.input} value={foodPrice} onChangeText={setFoodPrice} keyboardType="numeric" /></View>
              </View>
              <Text style={s.label}>Quantity *</Text>
              <TextInput style={s.input} value={foodQuantity} onChangeText={setFoodQuantity} keyboardType="numeric" />
              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, { height: 70 }]} value={foodDescription} onChangeText={setFoodDescription} multiline />
              <TouchableOpacity style={s.uploadBox} onPress={() => pickImages(setFoodImages, foodImages)}>
                <Ionicons name="images-outline" size={24} color="#64748B" /><Text style={s.uploadText}>Add images</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={() => { handleCreateFoodItem(); setShowFoodModal(false); }}>
                <Text style={s.primaryBtnText}>{editingFoodId ? 'Update Item' : 'Create Item'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Staff Modal */}
      <Modal visible={showStaffModal} animationType="slide" transparent onRequestClose={() => setShowStaffModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Add Staff</Text>
              <TouchableOpacity onPress={() => setShowStaffModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <Text style={s.label}>Full Name *</Text>
            <TextInput style={s.input} value={newStaffName} onChangeText={setNewStaffName} />
            <Text style={s.label}>Email *</Text>
            <TextInput style={s.input} value={newStaffEmail} onChangeText={setNewStaffEmail} autoCapitalize="none" keyboardType="email-address" />
            <Text style={s.label}>Password *</Text>
            <TextInput style={s.input} value={newStaffPassword} onChangeText={setNewStaffPassword} secureTextEntry />
            <TouchableOpacity style={s.primaryBtn} onPress={handleCreateStaff}>
              <Text style={s.primaryBtnText}>Create Staff</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChatModal} animationType="slide" onRequestClose={() => setShowChatModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.chatHead}>
            <TouchableOpacity onPress={() => setShowChatModal(false)}><Ionicons name="arrow-back" size={24} color="#111" /></TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.cardTitle}>{activeChat?.customer_name}</Text>
              <Text style={s.cardSub}>{activeChat?.store_name}</Text>
            </View>
          </View>
          <ScrollView ref={chatEndRef} style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {chatHistory.map(m => (
              <View key={m.id} style={[s.bubble, m.sender_role === 'Seller' ? s.bubbleSeller : s.bubbleCustomer]}>
                <Text style={{ color: m.sender_role === 'Seller' ? '#fff' : '#111' }}>{m.message}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={s.chatInputRow}>
            <TextInput style={s.chatInput} value={chatInput} onChangeText={setChatInput} placeholder="Type a message..." />
            <TouchableOpacity style={s.sendBtn} onPress={sendChatMessage}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 10 },
  logoPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: ORANGE_LIGHT, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  userEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  menuBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  menuPanel: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  menuLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase' },
  currencyPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8, backgroundColor: '#fff' },
  currencyPillActive: { borderColor: ORANGE, backgroundColor: ORANGE_LIGHT },
  currencyText: { fontWeight: '700', fontSize: 12, color: '#6B7280' },
  currencyTextActive: { color: ORANGE },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 92, 0, 0.12)' },
  kpiValue: { fontSize: 17, fontWeight: '800', color: ORANGE },
  kpiLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4, fontWeight: '600' },
  navScroll: { maxHeight: 52, marginBottom: 4 },
  navContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  navItemActive: { backgroundColor: ORANGE_LIGHT, borderColor: ORANGE },
  navLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  navLabelActive: { color: ORANGE_DARK },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  listPad: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', padding: 48 },
  emptyText: { color: '#9CA3AF', marginTop: 12, fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontWeight: '700', fontSize: 15, color: '#111827' },
  cardSub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  price: { color: ORANGE, fontWeight: '800', fontSize: 17 },
  meta: { color: '#9CA3AF', fontSize: 11, marginTop: 6 },
  rating: { color: ORANGE, fontSize: 14 },
  reviewComment: { color: '#374151', fontSize: 13, marginTop: 8, lineHeight: 18 },
  chatPreview: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  badge: { backgroundColor: ORANGE, borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: ORANGE_LIGHT, justifyContent: 'center', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: ORANGE_LIGHT, alignItems: 'center' },
  actionEdit: { color: ORANGE_DARK, fontWeight: '700', fontSize: 13 },
  actionDelete: { backgroundColor: '#FEF2F2' },
  actionDeleteText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  label: { color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15, color: '#111827' },
  primaryBtn: { backgroundColor: ORANGE, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: ORANGE, backgroundColor: ORANGE_LIGHT, marginBottom: 12 },
  secondaryBtnText: { color: ORANGE_DARK, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: ORANGE },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  pickupPreview: { color: ORANGE_DARK, fontWeight: '700', fontSize: 12, marginBottom: 12, backgroundColor: ORANGE_LIGHT, padding: 8, borderRadius: 8 },
  timeField: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeFieldText: { fontSize: 15, color: '#111827' },
  timeDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: ORANGE, borderRadius: 8 },
  timeDoneBtnText: { color: '#fff', fontWeight: '700' },
  uploadBox: { padding: 20, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', marginBottom: 14, backgroundColor: '#F9FAFB' },
  uploadText: { color: '#64748B', fontWeight: '600', marginTop: 6, fontSize: 13 },
  map: { height: 200, borderRadius: 12, marginBottom: 8 },
  mapFallback: { height: 200, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  mapFallbackText: { color: '#475569', fontWeight: '700', marginTop: 8, fontSize: 12 },
  mapFallbackSub: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  mapHint: { color: '#9CA3AF', fontSize: 11, marginBottom: 14, textAlign: 'center' },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: ORANGE_LIGHT, borderRadius: 10 },
  locationBtnText: { color: ORANGE_DARK, fontWeight: '700', fontSize: 13 },
  imagePreview: { position: 'relative', height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  previewImg: { width: '100%', height: '100%' },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(220,38,38,0.9)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  chatHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  bubbleSeller: { alignSelf: 'flex-end', backgroundColor: ORANGE },
  bubbleCustomer: { alignSelf: 'flex-start', backgroundColor: '#F3F4F6' },
  chatInputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
});
