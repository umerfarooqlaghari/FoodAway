import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Alert, ScrollView, Image, Modal, Platform, Linking, Animated, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

// Configure notification behavior for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
let MapView, Marker, Callout;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps;
    Marker = Maps.Marker;
    Callout = Maps.Callout;
  } catch (e) {
    console.warn("Could not require react-native-maps:", e);
  }
}

if (!MapView) {
  MapView = ({ children, style, initialRegion }) => {
    return (
      <View style={[{ backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }, style]}>
        <Ionicons name="map-outline" size={24} color="#64748B" style={{ marginBottom: 4 }} />
        <Text style={{ color: '#475569', fontSize: 12, fontWeight: '700' }}>Interactive Map Preview</Text>
        <Text style={{ color: '#94A3B8', fontSize: 10, marginTop: 2 }}>Lat: {initialRegion?.latitude?.toFixed(4)}, Lng: {initialRegion?.longitude?.toFixed(4)}</Text>
        {children}
      </View>
    );
  };
  Marker = ({ children }) => children || null;
  Callout = ({ children }) => children || null;
}
import { getDistance } from 'geolib';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Circle, Path, Text as SvgText } from 'react-native-svg';

const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0f172a'
  }
};
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// --- Receipt HTML Generator ---
const generateReceiptHTML = (receiptData, currencySymbol) => {
  const { orderIds, storeName, tenantName, items, total, pickupTime, customerName, dateTime, paymentMethod } = receiptData;
  const brandLabel = tenantName || storeName || 'Grabengo';

  const orderRef = Array.isArray(orderIds)
    ? orderIds.map(id => `GTG-${String(id).padStart(5, '0')}`).join(' · ')
    : `GTG-${String(orderIds).padStart(5, '0')}`;

  const teeth = Array.from({ length: 20 }).map(() => `<div class="tooth"></div>`).join('');

  const itemRows = (items || []).map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
        <div style="font-size:13px;font-weight:600;color:#111827;">${item.name || 'Item'}</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${item.type === 'bag' ? 'Surprise Bag' : 'Food Item'}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:center;color:#9CA3AF;font-size:12px;">×${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:700;font-size:13px;color:#111827;">${currencySymbol}${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const pickupHTML = pickupTime && pickupTime !== 'N/A' ? `
    <div style="background:#F0FDF4;border-radius:12px;padding:14px 16px;margin:16px 0;border:1px solid #BBF7D0;">
      <div style="font-size:10px;font-weight:800;color:#15803D;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Pickup Window</div>
      <div style="font-size:15px;font-weight:800;color:#111827;">${pickupTime}</div>
    </div>
  ` : '';

  const customerHTML = customerName ? `<div class="meta-row"><span class="meta-label">Customer</span><span class="meta-value">${customerName}</span></div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;background:#F1F5F9;padding:32px 16px;}
  .page{max-width:400px;margin:0 auto;}
  .receipt{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.14);}
  .hdr{background:linear-gradient(135deg,#EA580C,#F97316);padding:36px 28px 32px;text-align:center;}
  .check{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:26px;color:white;}
  .brand{font-size:30px;font-weight:900;color:#fff;letter-spacing:-1px;}
  .confirmed{font-size:10px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1.8px;margin-top:5px;}
  .ref-pill{background:rgba(255,255,255,0.2);border-radius:12px;padding:8px 18px;display:inline-block;margin-top:14px;}
  .ref-text{color:#fff;font-size:14px;font-weight:800;letter-spacing:0.5px;}
  .jagged{display:flex;background:#F1F5F9;padding:0 3px;height:14px;overflow:hidden;}
  .tooth{flex:1;height:22px;background:#fff;border-radius:50%;margin:0 1px;margin-top:-11px;}
  .body{padding:10px 28px 28px;}
  .meta-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;}
  .meta-label{font-size:12px;color:#9CA3AF;font-weight:500;}
  .meta-value{font-size:12px;color:#374151;font-weight:600;}
  .divider-dash{border:none;border-top:1.5px dashed #E5E7EB;margin:16px 0;}
  .divider-solid{border:none;border-top:1.5px solid #E5E7EB;margin:8px 0;}
  .from-lbl{font-size:10px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;}
  .store{font-size:17px;font-weight:800;color:#111827;margin-bottom:16px;}
  .items-table{width:100%;border-collapse:collapse;}
  .total-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;}
  .total-lbl{font-size:16px;font-weight:800;color:#111827;}
  .total-amt{font-size:26px;font-weight:900;color:#10B981;}
  .cash-pill{display:inline-flex;align-items:center;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:3px 10px;}
  .cash-txt{font-size:12px;color:#15803D;font-weight:700;}
  .banner{background:linear-gradient(135deg,#1E293B,#0F172A);border-radius:16px;padding:22px 24px;text-align:center;margin-top:22px;}
  .banner-t{color:#fff;font-size:15px;font-weight:800;margin-bottom:5px;}
  .banner-s{color:rgba(255,255,255,0.55);font-size:12px;}
  .footer-area{background:#F8FAFC;padding:20px 28px;text-align:center;border-top:1px solid #F1F5F9;}
  .footer-txt{font-size:11px;color:#9CA3AF;line-height:1.7;}
  .leaf{color:#10B981;font-size:13px;}
</style>
</head>
<body>
<div class="page">
  <div class="receipt">
    <div class="hdr">
      <div class="check">✓</div>
      <div class="brand">${brandLabel}</div>
      <div class="confirmed">Booking Confirmed</div>
      <div class="ref-pill"><span class="ref-text">${orderRef}</span></div>
    </div>
    <div class="jagged">${teeth}</div>
    <div class="body">
      <div class="meta-row"><span class="meta-label">Date &amp; Time</span><span class="meta-value">${dateTime}</span></div>
      ${customerHTML}
      <div class="meta-row"><span class="meta-label">Payment</span><span class="cash-pill"><span class="cash-txt">Cash at Pickup</span></span></div>
      <hr class="divider-dash">
      <div class="from-lbl">From</div>
      <div class="store">${storeName}</div>
      <table class="items-table">
        <tbody>${itemRows}</tbody>
      </table>
      <hr class="divider-solid">
      <div class="total-row"><span class="total-lbl">Total</span><span class="total-amt">${currencySymbol}${(typeof total === 'number' ? total : 0).toFixed(2)}</span></div>
      <hr class="divider-dash">
      ${pickupHTML}
      <div class="banner">
        <div class="banner-t">📱 Show this receipt at the branch</div>
        <div class="banner-s">Present to collect your rescued food</div>
      </div>
    </div>
    <div class="footer-area">
      <div class="footer-txt"><span class="leaf">🌿</span> Thank you for rescuing food &amp; reducing waste<br>Grabengo © 2025 · Rescue Food · Save Money · Help the Planet</div>
    </div>
  </div>
</div>
</body>
</html>`;
};

// Resolve API base URL:
// - EXPO_PUBLIC_API_URL from .env or eas.json (production)
// - Fallback in dev: derive host from Metro bundler
const getDevApiUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const ip = hostUri.split(':')[0];
  if (ip && ip !== 'localhost') return `http://${ip}:3000/api`;
  if (Platform.OS === 'ios' && !Constants.isDevice) return 'http://localhost:3000/api';
  if (Platform.OS === 'android' && !Constants.isDevice) return 'http://10.0.2.2:3000/api';
  return ip ? `http://${ip}:3000/api` : 'http://localhost:3000/api';
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || getDevApiUrl();

// Play satisfying coin sound and trigger vibration feedback
const playSoundAndHaptic = async (type) => {
  try {
    const player = createAudioPlayer(require('./assets/sounds/coin.mp3'));
    player.play();
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        player.release();
      }
    });

    if (Platform.OS !== 'web') {
      if (type === 'light') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === 'medium') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  } catch (e) {
    console.log("Audio/Haptic error:", e.message);
  }
};

// Trigger local OS notification (acts as push alert when app is backgrounded)
const triggerLocalPushNotification = async (title, body, data = {}) => {
  try {
    if (Platform.OS === 'web') return;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.log("Push notification error:", e.message);
  }
};

// Schedule an OS local notification for store pickup (30 minutes before window starts)
// For test/demo purposes, if the window has already started or is in less than 30 minutes, it will trigger in 10 seconds.
const schedulePickupReminder = async (storeName, pickupTimeStr) => {
  try {
    if (Platform.OS === 'web') return;
    
    // Parse time like "18:00" from strings like "Today, 18:00 - 19:30"
    const match = pickupTimeStr?.match(/(\d{1,2}):(\d{2})/);
    if (!match) return;
    
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    const targetDate = new Date();
    targetDate.setHours(hours, minutes, 0, 0);
    
    if (pickupTimeStr.toLowerCase().includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const reminderTime = new Date(targetDate.getTime() - 30 * 60 * 1000);
    const now = new Date();
    
    let trigger = reminderTime;
    let isDemoDelay = false;
    // If the reminder time has already passed, set it for 10 seconds from now so it's instantly testable
    if (reminderTime.getTime() <= now.getTime()) {
      trigger = new Date(now.getTime() + 10 * 1000); // 10 seconds
      isDemoDelay = true;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🕒 Pickup Reminder - ${storeName}`,
        body: `Your surplus food bag is ready for pickup in 30 minutes (${pickupTimeStr})!`,
        sound: true,
      },
      trigger,
    });
    
    console.log(`Scheduled pickup reminder for ${storeName} at ${trigger.toLocaleTimeString()} (${isDemoDelay ? 'Demo Mode: 10s delay' : 'Real Schedule'})`);
  } catch (e) {
    console.log("Error scheduling pickup reminder:", e.message);
  }
};

const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'web') return null;
  let token;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }
  
  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token:', token);
  } catch (e) {
    console.log('Error getting expo push token:', e.message);
  }

  return token;
};

// Create Contexts
const AuthContext = createContext();
const CartContext = createContext();
const ChatContext = createContext();

const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'PKR', symbol: 'Rs' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'SAR', symbol: 'SAR ' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'INR', symbol: 'Rs' },
];

function formatMoney(amount, symbol = '£') {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `${symbol}${safe.toFixed(2)}`;
}

function currencySymbolFor(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || '£';
}

function ChatProvider({ children }) {
  const { token, user, currencySymbol } = useContext(AuthContext);
  const [chatVisible, setChatVisible] = useState(false);
  const [activeChatStore, setActiveChatStore] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [toastNotification, setToastNotification] = useState(null);
  const [unreadStores, setUnreadStores] = useState({});
  const [isStoreTyping, setIsStoreTyping] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState(null);
  const wsRef = useRef(null);
  const activeChatStoreRef = useRef(null);
  const chatVisibleRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isTypingRef = useRef(false);

  useEffect(() => {
    activeChatStoreRef.current = activeChatStore;
  }, [activeChatStore]);

  useEffect(() => {
    chatVisibleRef.current = chatVisible;
  }, [chatVisible]);

  const markChatAsRead = async (storeId) => {
    if (!token) return;
    try {
      await axios.post(`${API_URL}/chat/read`, { store_id: storeId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadStores(prev => {
        const next = { ...prev };
        delete next[storeId];
        return next;
      });
    } catch (err) {
      console.log("Error marking chat as read:", err.message);
    }
  };

  const connectWebSocket = () => {
    if (!token) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('Connecting');
    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Mobile WS connected');
      setConnectionStatus('Connected');
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({ type: 'register', token }));
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'message') {
          const msg = payload.message;
          const activeStore = activeChatStoreRef.current;
          const isModalVisible = chatVisibleRef.current;

          if (activeStore && msg.store_id === activeStore.id && isModalVisible) {
            setChatMessages((prev) => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            markChatAsRead(activeStore.id);
            playSoundAndHaptic('light');
          } else {
            setUnreadStores((prev) => ({ ...prev, [msg.store_id]: true }));
            playSoundAndHaptic('light');
            setToastNotification({
              type: 'chat',
              storeId: msg.store_id,
              storeName: msg.store_name || "Store Support",
              message: msg.message
            });
            triggerLocalPushNotification(
              msg.store_name || "Store Support",
              msg.message,
              { type: 'chat', storeId: msg.store_id, storeName: msg.store_name }
            );
          }
        } else if (payload.type === 'new_bag') {
          if (payload.isFlashDeal) {
            playSoundAndHaptic('success');
            const discountPct = payload.bag ? Math.round(((payload.bag.original_price - payload.bag.price) / payload.bag.original_price) * 100) : 70;
            const priceLabel = payload.bag ? `${currencySymbol || '£'}${payload.bag.price.toFixed(2)}` : 'surplus price';
            const pickupTime = payload.bag?.pickup_time || 'Today';
            setToastNotification({
              type: 'flash_deal',
              storeId: payload.storeId,
              storeName: payload.storeName,
              message: `🔥 FLASH DEAL! Save ${discountPct}% off for ${priceLabel}. Pickup: ${pickupTime}`
            });
            triggerLocalPushNotification(
              `🔥 Flash Deal at ${payload.storeName}!`,
              `Rescue a surplus bag for just ${priceLabel} (${discountPct}% OFF)! Pickup: ${pickupTime}`,
              { type: 'bag', storeId: payload.storeId }
            );
          } else {
            playSoundAndHaptic('medium');
            const pickupTime = payload.bag?.pickup_time || 'Today';
            setToastNotification({
              type: 'new_bag',
              storeId: payload.storeId,
              storeName: payload.storeName,
              message: `New Surprise Bag available! Pickup: ${pickupTime}`
            });
            triggerLocalPushNotification(
              `New Bag at ${payload.storeName}!`,
              `A new surplus surprise bag is ready for pickup (${pickupTime}). Check it out now!`,
              { type: 'bag', storeId: payload.storeId }
            );
          }
        } else if (payload.type === 'new_order_confirmation') {
          playSoundAndHaptic('success');
          const wsOrder = payload.order;
          const wsReceiptData = {
            orderIds: [wsOrder.id],
            storeName: wsOrder.store_name,
            items: [{ name: wsOrder.item_name, quantity: wsOrder.quantity, price: wsOrder.price, type: 'bag' }],
            total: wsOrder.price * wsOrder.quantity,
            pickupTime: wsOrder.pickup_time,
            customerName: null,
            dateTime: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            paymentMethod: 'Cash at Pickup',
          };
          setToastNotification({
            type: 'order_success',
            storeName: wsOrder.store_name,
            message: `Rescued ${wsOrder.quantity}x ${wsOrder.item_name}. Tap to download receipt.`,
            receiptData: wsReceiptData,
          });
          triggerLocalPushNotification(
            `Order Confirmed!`,
            `You successfully rescued surplus food from ${wsOrder.store_name}!`,
            { type: 'order', orderId: wsOrder.id }
          );
          if (wsOrder.pickup_time) {
            schedulePickupReminder(wsOrder.store_name, wsOrder.pickup_time);
          }
        } else if (payload.type === 'inactivity_reminder') {
          playSoundAndHaptic('success');
          setToastNotification({
            type: 'inactivity_reminder',
            storeName: 'Grabengo Rewards',
            message: payload.message
          });
          triggerLocalPushNotification(
            "We miss you! 🍩",
            payload.message,
            { type: 'promo' }
          );
        } else if (payload.type === 'typing') {
          const activeStore = activeChatStoreRef.current;
          if (activeStore && payload.storeId === activeStore.id && payload.senderRole === 'Seller') {
            setIsStoreTyping(payload.isTyping);
          }
        }
      } catch (err) {
        console.log('WS message parsing error:', err.message);
      }
    };

    ws.onclose = (e) => {
      console.log('Mobile WS closed. Code:', e.code, 'Reason:', e.reason);
      setConnectionStatus('Disconnected');
      wsRef.current = null;
      setIsStoreTyping(false);

      if (token) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      }
    };

    ws.onerror = (e) => {
      console.log('Mobile WS error:', e.message);
    };

    wsRef.current = ws;
  };

  const sendTypingStatus = (typing) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeChatStoreRef.current) return;
    if (isTypingRef.current === typing) return;
    isTypingRef.current = typing;
    
    wsRef.current.send(JSON.stringify({
      type: 'typing',
      storeId: activeChatStoreRef.current.id,
      isTyping: typing
    }));
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim() || !activeChatStore || !wsRef.current) return;

    const msgPayload = {
      type: 'message',
      storeId: activeChatStore.id,
      text: chatInput.trim()
    };

    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msgPayload));
      setChatInput('');
      sendTypingStatus(false);
    } else {
      Alert.alert("Connection Lost", "Chat is currently offline. Trying to reconnect...");
      connectWebSocket();
    }
  };

  const openChatWithStore = async (store) => {
    setActiveChatStore(store);
    setChatMessages([]);
    setChatVisible(true);
    markChatAsRead(store.id);
    connectWebSocket();

    try {
      const res = await axios.get(`${API_URL}/chat/history?store_id=${store.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatMessages(res.data);
    } catch (e) {
      console.log("Error loading chat history:", e.message);
    }
  };



  useEffect(() => {
    if (token && user?.role === 'Customers') {
      connectWebSocket();
      
      // Request local push notification permissions
      if (Platform.OS !== 'web') {
        Notifications.getPermissionsAsync().then(({ status: existingStatus }) => {
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            Notifications.requestPermissionsAsync().then(({ status }) => {
              finalStatus = status;
            });
          }
        }).catch(err => console.log("Permission request error:", err.message));
      }
    }
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, user]);

  return (
    <ChatContext.Provider value={{
      chatVisible, setChatVisible,
      activeChatStore, setActiveChatStore,
      chatMessages, setChatMessages,
      chatInput, setChatInput,
      connectionStatus,
      toastNotification, setToastNotification,
      unreadStores, setUnreadStores,
      isStoreTyping,
      openChatWithStore,
      handleSendChatMessage,
      sendTypingStatus,
      markChatAsRead,
      receiptModalVisible, setReceiptModalVisible,
      receiptModalData, setReceiptModalData,
      openReceipt: (data) => { setReceiptModalData(data); setReceiptModalVisible(true); }
    }}>
      {children}
    </ChatContext.Provider>
  );
}

function GlobalToast() {
  const { toastNotification, setToastNotification, openChatWithStore, openReceipt } = useContext(ChatContext);
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (toastNotification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 6
      }).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  const hideToast = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true
    }).start(() => {
      setToastNotification(null);
    });
  };

  if (!toastNotification) return null;

  const handlePress = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {}

    if (toastNotification.type === 'chat') {
      openChatWithStore({ id: toastNotification.storeId, name: toastNotification.storeName });
    } else if (toastNotification.type === 'order_success' && toastNotification.receiptData) {
      openReceipt(toastNotification.receiptData);
    }
    hideToast();
  };

  let gradientColors = ['#1E293B', '#0F172A'];
  let iconName = 'chatbubble-ellipses';
  let badgeColor = '#EA580C';
  let typeLabel = 'Support Message';

  if (toastNotification.type === 'new_bag') {
    gradientColors = ['#059669', '#065F46'];
    iconName = 'gift';
    badgeColor = '#34D399';
    typeLabel = 'Surplus Alert';
  } else if (toastNotification.type === 'order_success') {
    gradientColors = ['#D97706', '#92400E'];
    iconName = 'checkmark-circle';
    badgeColor = '#FBBF24';
    typeLabel = 'Order Confirmed';
  } else if (toastNotification.type === 'inactivity_reminder') {
    gradientColors = ['#EC4899', '#BE185D'];
    iconName = 'sparkles';
    badgeColor = '#F472B6';
    typeLabel = 'Special Offer';
  } else if (toastNotification.type === 'flash_deal') {
    gradientColors = ['#EF4444', '#F97316'];
    iconName = 'flame';
    badgeColor = '#FCD34D';
    typeLabel = 'Flash Deal (70%+ OFF)';
  }

  return (
    <Animated.View 
      style={[
        styles.toastContainer, 
        { transform: [{ translateY: slideAnim }] }
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={handlePress}
        style={{ width: '90%', borderRadius: 24, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 16 }}
      >
        <LinearGradient 
          colors={gradientColors} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, minHeight: 85 }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 14,
            borderWidth: 1.5,
            borderColor: badgeColor
          }}>
            <Ionicons name={iconName} size={24} color={badgeColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: badgeColor, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {typeLabel}
              </Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)' }} numberOfLines={1}>
                {toastNotification.storeName}
              </Text>
            </View>
            <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 14, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
              {toastNotification.message}
            </Text>
            {toastNotification.type === 'order_success' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                <Ionicons name="download-outline" size={12} color={badgeColor} />
                <Text style={{ fontSize: 11, color: badgeColor, fontWeight: '800' }}>Tap to download receipt</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" style={{ marginLeft: 8 }} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function GlobalChatModal() {
  const { 
    chatVisible, setChatVisible,
    activeChatStore,
    chatMessages,
    chatInput, setChatInput,
    connectionStatus,
    isStoreTyping,
    handleSendChatMessage,
    sendTypingStatus
  } = useContext(ChatContext);
  
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  useEffect(() => {
    if (flatListRef.current && chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages, chatVisible]);

  if (!chatVisible) return null;

  return (
    <Modal visible={chatVisible} animationType="slide" onRequestClose={() => setChatVisible(false)}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', height: 60 }}>
          <TouchableOpacity onPress={() => setChatVisible(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
              {activeChatStore?.name || 'Chat'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={{ 
                width: 6, 
                height: 6, 
                borderRadius: 3, 
                backgroundColor: connectionStatus === 'Connected' ? '#10B981' : connectionStatus === 'Connecting' ? '#F59E0B' : '#EF4444', 
                marginRight: 6 
              }} />
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>
                {connectionStatus === 'Connected' ? 'Online' : connectionStatus === 'Connecting' ? 'Connecting...' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Message History list */}
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.sender_role === 'Customer';
            return (
              <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <View style={{ 
                  backgroundColor: isMe ? '#EA580C' : '#F3F4F6',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 18,
                  borderBottomRightRadius: isMe ? 2 : 18,
                  borderBottomLeftRadius: isMe ? 18 : 2
                }}>
                  <Text style={{ color: isMe ? '#FFFFFF' : '#111827', fontSize: 15, lineHeight: 20 }}>
                    {item.message}
                  </Text>
                </View>
                <Text style={{ color: '#9CA3AF', fontSize: 10, alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 4, paddingHorizontal: 4 }}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />

        {/* Typing indicator message */}
        {isStoreTyping && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
              Store is typing...
            </Text>
          </View>
        )}

        {/* Typing Area */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          paddingHorizontal: 16, 
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 1, 
          borderTopColor: '#F3F4F6',
          backgroundColor: '#FFFFFF'
        }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: '#111827',
              maxHeight: 100
            }}
            placeholder="Type your message..."
            placeholderTextColor="#9CA3AF"
            value={chatInput}
            onChangeText={(text) => {
              setChatInput(text);
              sendTypingStatus(text.length > 0);
            }}
            multiline
          />
          <TouchableOpacity 
            onPress={handleSendChatMessage} 
            disabled={!chatInput.trim()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: chatInput.trim() ? '#EA580C' : '#E5E7EB',
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 12
            }}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Global Receipt Modal ---
function GlobalReceiptModal() {
  const { receiptModalVisible, setReceiptModalVisible, receiptModalData } = useContext(ChatContext);
  const { currencySymbol } = useContext(AuthContext);
  const [generating, setGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    if (!receiptModalData) return;
    setGenerating(true);
    try {
      const html = generateReceiptHTML(receiptModalData, currencySymbol);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Grabengo Receipt', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Receipt Saved', 'Your receipt has been saved to your device.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (!receiptModalData) return null;

  const { orderIds, storeName, items, total, pickupTime, customerName, dateTime } = receiptModalData;
  const orderRef = Array.isArray(orderIds)
    ? orderIds.map(id => `GTG-${String(id).padStart(5, '0')}`).join(', ')
    : `GTG-${String(orderIds).padStart(5, '0')}`;

  return (
    <Modal visible={receiptModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReceiptModalVisible(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827' }}>Your Receipt</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Show this at the branch</Text>
          </View>
          <TouchableOpacity onPress={() => setReceiptModalVisible(false)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="close" size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* Receipt Card */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 28, elevation: 12 }}>

            {/* Gradient Header */}
            <LinearGradient colors={['#EA580C', '#F97316']} style={{ paddingVertical: 36, paddingHorizontal: 28, alignItems: 'center' }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' }}>
                <Ionicons name="checkmark" size={30} color="white" />
              </View>
              <Text style={{ fontSize: 26, fontWeight: '900', color: 'white', letterSpacing: -0.5 }}>Grabengo</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Booking Confirmed</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>{orderRef}</Text>
              </View>
            </LinearGradient>

            {/* Torn edge */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', paddingHorizontal: 4 }}>
              {Array.from({ length: 18 }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 22, backgroundColor: '#FFFFFF', borderRadius: 11, marginHorizontal: 1, marginTop: -11 }} />
              ))}
            </View>

            {/* Body */}
            <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28 }}>
              {/* Meta info */}
              <View style={{ gap: 7, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>Date & Time</Text>
                  <Text style={{ fontSize: 12, color: '#374151', fontWeight: '600' }}>{dateTime}</Text>
                </View>
                {customerName ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>Customer</Text>
                    <Text style={{ fontSize: 12, color: '#374151', fontWeight: '600' }}>{customerName}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>Payment</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: '#BBF7D0' }}>
                    <Ionicons name="cash-outline" size={12} color="#15803D" />
                    <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '700' }}>Cash at Pickup</Text>
                  </View>
                </View>
              </View>

              {/* Dashed divider */}
              <View style={{ borderTopWidth: 1.5, borderTopColor: '#E5E7EB', borderStyle: 'dashed', marginBottom: 18 }} />

              {/* Store */}
              <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>From</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 18 }}>{storeName}</Text>

              {/* Items */}
              {(items || []).map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.type === 'bag' ? 'Surprise Bag' : 'Food Item'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>×{item.quantity}</Text>
                  </View>
                </View>
              ))}

              {/* Total */}
              <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 2, borderTopColor: '#111827', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>Total</Text>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#10B981' }}>{currencySymbol}{(typeof total === 'number' ? total : 0).toFixed(2)}</Text>
              </View>

              {/* Pickup */}
              {pickupTime && pickupTime !== 'N/A' ? (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginTop: 18, borderWidth: 1, borderColor: '#BBF7D0', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={16} color="#15803D" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pickup Window</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 }}>{pickupTime}</Text>
                  </View>
                </View>
              ) : null}

              {/* Show at branch banner */}
              <LinearGradient colors={['#1E293B', '#0F172A']} style={{ borderRadius: 18, padding: 22, marginTop: 22, alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(234,88,12,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: '#EA580C' }}>
                  <Ionicons name="phone-portrait-outline" size={22} color="#F97316" />
                </View>
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 5 }}>Show this receipt at the branch</Text>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center' }}>Present to collect your rescued food order</Text>
              </LinearGradient>
            </View>

            {/* Bottom torn edge */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', paddingHorizontal: 4 }}>
              {Array.from({ length: 18 }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 22, backgroundColor: '#FFFFFF', borderRadius: 11, marginHorizontal: 1, marginBottom: -11 }} />
              ))}
            </View>

            {/* Footer */}
            <View style={{ backgroundColor: '#F8FAFC', paddingVertical: 20, paddingHorizontal: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 }}>
                🌿 Thank you for rescuing food & reducing waste{'\n'}Grabengo © 2025
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action buttons */}
        <View style={{ padding: 20, paddingBottom: 28, gap: 10 }}>
          <TouchableOpacity
            onPress={handleDownloadPDF}
            disabled={generating}
            style={{ backgroundColor: generating ? '#9CA3AF' : '#EA580C', borderRadius: 16, paddingVertical: 17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
          >
            {generating ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="white" />
                <Text style={{ color: 'white', fontSize: 17, fontWeight: '800' }}>Download PDF Receipt</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setReceiptModalVisible(false)}
            style={{ borderRadius: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}
          >
            <Text style={{ color: '#374151', fontSize: 16, fontWeight: '700' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const Stack = createNativeStackNavigator();

// --- Landing Screen ---
const LANDING_ORANGE = '#FF5A00';

function SupermarketPreviewIllustration({ width = 280, height = 210 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 480 360">
      <Rect width="480" height="360" rx="24" fill="#FFF7ED" />
      <Rect x="40" y="48" width="400" height="264" rx="16" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="2" />
      <Rect x="40" y="48" width="400" height="56" rx="16" fill={LANDING_ORANGE} />
      <Rect x="40" y="88" width="400" height="16" fill={LANDING_ORANGE} />
      <SvgText x="240" y="84" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="700">SUPERMARKET</SvgText>
      {[72, 196, 320].map((x) => (
        <React.Fragment key={x}>
          <Rect x={x} y="128" width="88" height="72" rx="8" fill="#FFF7ED" stroke={LANDING_ORANGE} strokeWidth="1.5" />
          <Rect x={x + 8} y="136" width="72" height="12" rx="3" fill={LANDING_ORANGE} opacity="0.85" />
          <Rect x={x + 8} y="154" width="56" height="8" rx="2" fill="#FDBA74" />
          <Rect x={x + 8} y="168" width="64" height="8" rx="2" fill="#FDBA74" />
          <Rect x={x + 8} y="182" width="48" height="8" rx="2" fill="#FDBA74" />
        </React.Fragment>
      ))}
      <Rect x="72" y="224" width="336" height="56" rx="10" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1.5" />
      {[88, 148, 208, 268, 328].map((x, i) => (
        <Rect key={x} x={x} y="240" width="48" height="24" rx="4" fill={LANDING_ORANGE} opacity={0.2 + i * 0.15} />
      ))}
      <SvgText x="240" y="258" textAnchor="middle" fill="#9A3412" fontSize="11" fontWeight="600">FMCG · HOUSEHOLD · GROCERY</SvgText>
      <Circle cx="400" cy="280" r="28" fill={LANDING_ORANGE} />
      <Path d="M382 280 L396 280 L396 268 L408 280 L396 292 L396 280" fill="#FFFFFF" />
      <Rect x="56" y="296" width="120" height="28" rx="14" fill={LANDING_ORANGE} />
      <SvgText x="116" y="315" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">PREMIUM DISCOUNTS</SvgText>
    </Svg>
  );
}

function LandingScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const scrollRef = React.useRef(null);
  const screenWidth = Dimensions.get('window').width;
  const illustrationWidth = screenWidth - 48;
  const illustrationHeight = illustrationWidth * (360 / 480);

  useEffect(() => {
    let scrollPos = 0;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        scrollPos += 2;
        scrollRef.current.scrollTo({ x: scrollPos, animated: false });
        if (scrollPos > 1000) scrollPos = 0;
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const renderHeader = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 }}>Take It All Away</Text>
      <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8 }}>
        <View style={{ width: 24, height: 3, backgroundColor: '#FFFFFF', marginBottom: 5, borderRadius: 2 }} />
        <View style={{ width: 24, height: 3, backgroundColor: '#FFFFFF', marginBottom: 5, borderRadius: 2 }} />
        <View style={{ width: 24, height: 3, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
      </TouchableOpacity>
    </View>
  );

  const renderMenuOverlay = () => menuVisible ? (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }}>
      <TouchableOpacity style={{ position: 'absolute', top: 60, right: 30 }} onPress={() => setMenuVisible(false)}>
        <Text style={{ fontSize: 40, color: '#111827', fontWeight: '300' }}>×</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 32, fontWeight: '800', color: '#EA580C', marginBottom: 60 }}>Grabengo Menu</Text>
      <TouchableOpacity
        style={{ backgroundColor: '#111827', paddingVertical: 18, paddingHorizontal: 60, borderRadius: 30, marginBottom: 20, width: 250, alignItems: 'center' }}
        onPress={() => { setMenuVisible(false); navigation.navigate('Login'); }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ backgroundColor: '#F3F4F6', paddingVertical: 18, paddingHorizontal: 60, borderRadius: 30, width: 250, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}
        onPress={() => { setMenuVisible(false); navigation.navigate('Register'); }}>
        <Text style={{ color: '#111827', fontSize: 20, fontWeight: '700' }}>Register</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  if (showComingSoon) {
    return (
      <View style={{ flex: 1, backgroundColor: '#EA580C' }}>
        <SafeAreaView style={{ flex: 1 }}>
          {renderHeader()}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FFF7ED', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
              <View style={{ height: 5, backgroundColor: LANDING_ORANGE }} />
              <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}>
                <TouchableOpacity
                  onPress={() => setShowComingSoon(false)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 20 }}>
                  <Ionicons name="chevron-back" size={16} color={LANDING_ORANGE} />
                  <Text style={{ color: LANDING_ORANGE, fontWeight: '700', fontSize: 13 }}>Back</Text>
                </TouchableOpacity>
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, marginBottom: 14 }}>
                  <Text style={{ color: LANDING_ORANGE, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 }}>COMING SOON</Text>
                </View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#111827', lineHeight: 38, letterSpacing: -0.5 }}>
                  Supermarkets on Grabengo
                </Text>
                <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 23, marginTop: 14 }}>
                  We are expanding beyond surplus meals to bring leading supermarkets onto the platform. Premium discounts on fast-moving consumer goods, household essentials, and fresh groceries.
                </Text>
                
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 14, padding: 14 }}>
                    <Text style={{ color: LANDING_ORANGE, fontWeight: '800', fontSize: 16 }}>Up to 50%</Text>
                    <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 12, marginTop: 4 }}>off surplus stock</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 14, padding: 14 }}>
                    <Text style={{ color: LANDING_ORANGE, fontWeight: '800', fontSize: 16 }}>One app</Text>
                    <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 12, marginTop: 4 }}>food + FMCG rescue</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'center', marginTop: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 20, padding: 12 }}>
                  <SupermarketPreviewIllustration width={illustrationWidth - 48} height={(illustrationWidth - 48) * (360 / 480)} />
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
        {renderMenuOverlay()}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#EA580C' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {renderHeader()}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Hero Section */}
          <View style={{ paddingHorizontal: 24, marginTop: 20, minHeight: 320 }}>
            <View style={{ position: 'absolute', right: -120, top: -20, zIndex: -1 }}>
              <Image
                source={require('./assets/images/grabengo_landing.png')}
                style={{ width: 400, height: 500, resizeMode: 'contain' }}
              />
            </View>
            <View style={{ paddingTop: 40 }}>
              <Text style={{ fontSize: 42, fontWeight: '800', color: '#FFFFFF', lineHeight: 50, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>
                Delicious Treats
              </Text>
              <Text style={{ fontSize: 42, fontWeight: '800', color: '#FFFFFF', lineHeight: 50, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>
                Waiting For You
              </Text>
              <Text style={{ fontSize: 16, color: '#FDE68A', marginTop: 16, lineHeight: 24, paddingRight: 60, textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>
                Rescue surplus pastries, donuts, and meals from top local spots before they go to waste.
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 30, gap: 12 }}>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
                  <Text style={{ color: '#D97706', fontWeight: '800', fontSize: 16 }}>Explore</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Brands Carousel */}
          <View style={{ marginTop: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 16, paddingLeft: 24 }}>Top Brands</Text>
            <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 24 }}>
              <View style={{ width: 140, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', marginRight: 16 }}>
                <Image source={require('./assets/images/logo_dunkin.png')} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', justifyContent: 'flex-end', padding: 12 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>Dunkin Donuts</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>1.2 km away</Text>
                </LinearGradient>
              </View>
              <View style={{ width: 140, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', marginRight: 16 }}>
                <Image source={require('./assets/images/logo_mcdonalds.png')} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', justifyContent: 'flex-end', padding: 12 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>McDonalds</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>0.8 km away</Text>
                </LinearGradient>
              </View>
              <View style={{ width: 140, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', marginRight: 16 }}>
                <Image source={require('./assets/images/logo_kfc.png')} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', justifyContent: 'flex-end', padding: 12 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>KFC</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>2.1 km away</Text>
                </LinearGradient>
              </View>
              <View style={{ width: 140, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', marginRight: 16 }}>
                <Image source={require('./assets/images/logo_pita.png')} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', justifyContent: 'flex-end', padding: 12 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>Pita Pit</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>1.5 km away</Text>
                </LinearGradient>
              </View>
            </ScrollView>
          </View>

          {/* What's coming teaser — peeks from right edge */}
          <View style={{ marginTop: 20, width: screenWidth, overflow: 'hidden' }}>
            <TouchableOpacity
              onPress={() => setShowComingSoon(true)}
              activeOpacity={0.85}
              style={{
                alignSelf: 'flex-end',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginRight: -32,
                paddingVertical: 8,
                paddingLeft: 12,
                paddingRight: 36,
                backgroundColor: 'rgba(255,255,255,0.96)',
                borderTopLeftRadius: 18,
                borderBottomLeftRadius: 18,
                borderWidth: 1,
                borderRightWidth: 0,
                borderColor: 'rgba(255,90,0,0.25)',
                shadowColor: '#000',
                shadowOffset: { width: -2, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3,
              }}>
              <Text style={{ color: LANDING_ORANGE, fontWeight: '700', fontSize: 12 }}>What&apos;s coming</Text>
              <Ionicons name="chevron-forward" size={13} color={LANDING_ORANGE} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      {renderMenuOverlay()}
    </View>
  );
}

// --- Auth Screens ---
const parsePickupTimeDetails = (pickupTimeStr) => {
  if (!pickupTimeStr) return { days: [], from: '18:00', to: '20:00' };
  const timeRegex = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/;
  const match = pickupTimeStr.match(timeRegex);
  const from = match ? match[1] : '18:00';
  const to = match ? match[2] : '20:00';
  const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const days = [];
  ALL_DAYS.forEach(day => {
    if (pickupTimeStr.includes(day)) {
      days.push(day);
    }
  });
  return { days, from, to };
};

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      login(response.data.token, response.data.user);
    } catch (error) {
      Alert.alert("Login Failed", error.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.authContainer}>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>Login to rescue surplus food.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          editable={!loading}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, paddingRight: 14, marginBottom: 16 }}>
          <TextInput
            style={{ flex: 1, color: '#111827', padding: 16, fontSize: 16 }}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', marginBottom: 20 }} disabled={loading}>
          <Text style={{ color: '#FF5A00', fontWeight: '700', fontSize: 14 }}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.primaryButton, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 20 }} disabled={loading}>
          <Text style={{ color: '#3b82f6', textAlign: 'center' }}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function RegisterScreen({ navigation }) {
  const [accountType, setAccountType] = useState('customer');
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [logo, setLogo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.2,
      base64: true,
    });
    if (!result.canceled) {
      setLogo(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleRegister = async () => {
    if (!phone.trim()) {
      Alert.alert("Required", "Please enter your phone number.");
      return;
    }
    if (accountType === 'customer' && !name.trim()) {
      Alert.alert("Required", "Please enter your full name.");
      return;
    }
    if (accountType === 'seller' && !brandName.trim()) {
      Alert.alert("Required", "Please enter your brand name.");
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      if (accountType === 'customer') {
        await axios.post(`${API_URL}/auth/register`, {
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          role: 'Customers',
        });
      } else {
        await axios.post(`${API_URL}/auth/register`, {
          brand_name: brandName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          role: 'SellersAdmin',
          logo: logo || undefined,
        });
      }
      Alert.alert("Success", accountType === 'seller'
        ? "Seller account created! Please login to manage your stores."
        : "Registered successfully! Please login.");
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert("Registration Failed", error.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.authContainer}>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join the movement against food waste.</Text>

          <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10, alignSelf: 'flex-start' }}>Sign up as</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, width: '100%' }}>
            <TouchableOpacity
              onPress={() => setAccountType('customer')}
              disabled={loading}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: accountType === 'customer' ? '#FF5A00' : '#E5E7EB',
                backgroundColor: accountType === 'customer' ? '#FFF7ED' : '#F9FAFB',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: accountType === 'customer' ? '#FF5A00' : '#64748B' }}>Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAccountType('seller')}
              disabled={loading}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: accountType === 'seller' ? '#FF5A00' : '#E5E7EB',
                backgroundColor: accountType === 'seller' ? '#FFF7ED' : '#F9FAFB',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: accountType === 'seller' ? '#FF5A00' : '#64748B' }}>Seller</Text>
            </TouchableOpacity>
          </View>

          {accountType === 'customer' ? (
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} editable={!loading} />
          ) : (
            <>
              <TextInput style={styles.input} placeholder="Brand Name" placeholderTextColor="#94a3b8" value={brandName} onChangeText={setBrandName} editable={!loading} />
              <TouchableOpacity
                onPress={pickLogo}
                disabled={loading}
                style={{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CA3AF' }}
              >
                {logo ? (
                  <Image source={{ uri: logo }} style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 8 }} />
                ) : (
                  <Ionicons name="image-outline" size={28} color="#64748B" style={{ marginBottom: 6 }} />
                )}
                <Text style={{ color: '#64748B', fontWeight: '600' }}>{logo ? 'Change Brand Logo' : 'Add Brand Logo (optional)'}</Text>
              </TouchableOpacity>
            </>
          )}

          <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!loading} />
          <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#94a3b8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!loading} />
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, paddingRight: 14, marginBottom: 16 }}>
            <TextInput
              style={{ flex: 1, color: '#111827', padding: 16, fontSize: 16 }}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.primaryButton, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>{accountType === 'seller' ? 'Register as Seller' : 'Register'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20, marginBottom: 24 }} disabled={loading}>
            <Text style={{ color: '#3b82f6', textAlign: 'center' }}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email) return Alert.alert("Error", "Please enter your email address.");
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setStep(2);
      Alert.alert("Success", "OTP code sent to your email!");
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp || !newPassword) return Alert.alert("Error", "Please enter the OTP and your new password.");
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { email, otp, newPassword });
      Alert.alert("Success", "Password reset successfully! Please log in.");
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.authContainer}>
        {step === 1 ? (
          <>
            <Text style={styles.headerTitle}>Reset Password</Text>
            <Text style={styles.headerSubtitle}>Enter your email to receive a 6-digit OTP verification code.</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Send OTP Code</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
              <Text style={{ color: '#3b82f6', textAlign: 'center' }}>Back to Login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Verify OTP</Text>
            <Text style={styles.headerSubtitle}>Enter the verification code and set your new password.</Text>

            <TextInput
              style={[styles.input, { letterSpacing: 2, fontWeight: '700', textAlign: 'center' }]}
              placeholder="6-Digit OTP"
              placeholderTextColor="#94a3b8"
              value={otp}
              onChangeText={setOtp}
              keyboardType="numeric"
              maxLength={6}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, paddingRight: 14, marginBottom: 16 }}>
              <TextInput
                style={{ flex: 1, color: '#111827', padding: 16, fontSize: 16 }}
                placeholder="New Password"
                placeholderTextColor="#94a3b8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Reset Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: 20 }}>
              <Text style={{ color: '#3b82f6', textAlign: 'center' }}>Back to Step 1</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function tenantInitials(name) {
  return String(name || 'G')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function TenantBrandLogo({ tenant, size = 56 }) {
  const [failed, setFailed] = useState(false);
  if (tenant.logo && !failed) {
    return (
      <Image
        source={{ uri: tenant.logo }}
        style={{ width: size, height: size, borderRadius: 14, resizeMode: 'contain', backgroundColor: '#FFF7ED' }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#EA580C', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.32 }}>{tenantInitials(tenant.name)}</Text>
    </View>
  );
}

function ExploreTenantsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState(null);

  const fetchTenants = async () => {
    setLoading(true);
    setLoadError(null);
    let lat;
    let lng;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setCoords({ lat, lng });
      }
    } catch (_) {}

    try {
      const params = new URLSearchParams();
      if (lat != null && lng != null) {
        params.set('lat', String(lat));
        params.set('lng', String(lng));
        params.set('sort', 'nearest');
      }
      const qs = params.toString();
      const url = `${API_URL}/public/tenants${qs ? `?${qs}` : ''}`;
      const res = await axios.get(url);
      if (!Array.isArray(res.data)) {
        throw new Error(`Unexpected response from ${API_URL}`);
      }
      setTenants(res.data);
    } catch (e) {
      const message = e.response?.data?.error
        || e.message
        || 'Could not load brands. Check that the backend is running.';
      setLoadError(message);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const filtered = tenants.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) || (t.subdomain || '').toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }} edges={['top']}>
      <StatusBar style="dark" />
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#111827' }}>Explore Brands</Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
          Choose a brand to browse their stores and offers{coords ? ' · sorted by nearest' : ''}.
        </Text>
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search KFC, Naheed, Galaxy..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, fontSize: 15, color: '#111827' }}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom + 20, 40) }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 40 }}>{loadError ? '⚠️' : '🏪'}</Text>
              <Text style={{ color: '#111827', marginTop: 8, fontWeight: '700', textAlign: 'center' }}>
                {loadError ? 'Could not load brands' : 'No brands found'}
              </Text>
              <Text style={{ color: '#6B7280', marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                {loadError
                  ? `${loadError}\n\nAPI: ${API_URL}`
                  : searchQuery.trim()
                    ? 'Try a different search term.'
                    : 'No active stores are listed yet.'}
              </Text>
              {loadError ? (
                <TouchableOpacity
                  onPress={fetchTenants}
                  style={{ marginTop: 16, backgroundColor: '#EA580C', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.replace('Discover', { tenant: item })}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <TenantBrandLogo tenant={item} size={56} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#EA580C', fontWeight: '600', marginTop: 2 }}>{item.subdomain}.grabengo.store</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  {item.store_count} store{item.store_count !== 1 ? 's' : ''}
                  {item.distance_km != null ? ` · ${item.distance_km < 1 ? `${Math.round(item.distance_km * 1000)} m` : `${item.distance_km.toFixed(1)} km`}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function SplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('ExploreTenants');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#EA580C', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="light" />
      <Image source={require('./assets/images/grabengo_landing.png')} style={{ width: 250, height: 250, resizeMode: 'contain', marginBottom: 30 }} />
      <Text style={{ fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 }}>Grabengo</Text>
      <Text style={{ fontSize: 16, color: '#FDE68A', marginTop: 10, letterSpacing: 1 }}>Grab & Go</Text>
      <ActivityIndicator color="#FFFFFF" size="large" style={{ marginTop: 40 }} />
    </View>
  );
}

// --- Shared Bottom Nav ---
const SharedBottomNav = ({ navigation, activeTab, cartTotalCount, onMapPress, onReviewsPress, navParams }) => {
  const discoverParams = navParams || {};
  return (
    <View style={styles.bottomNavContainer}>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => activeTab !== 'Home' && navigation.navigate('Discover', discoverParams)}>
          <View style={{ backgroundColor: activeTab === 'Home' ? '#EA580C' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Home' ? "home" : "home-outline"} size={activeTab === 'Home' ? 20 : 24} color={activeTab === 'Home' ? "white" : "#9CA3AF"} />
          </View>
          <Text style={{ color: activeTab === 'Home' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Home' ? '700' : '600' }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={onMapPress || (() => navigation.navigate('Discover', { ...discoverParams, openMap: true }))}>
          <View style={{ backgroundColor: activeTab === 'Map' ? '#EA580C' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Map' ? "map" : "map-outline"} size={activeTab === 'Map' ? 20 : 24} color={activeTab === 'Map' ? "white" : "#9CA3AF"} />
          </View>
          <Text style={{ color: activeTab === 'Map' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Map' ? '700' : '600' }}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => activeTab !== 'Cart' && navigation.navigate('Cart', discoverParams)}>
          <View style={{ backgroundColor: activeTab === 'Cart' ? '#EA580C' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Cart' ? "cart" : "cart-outline"} size={activeTab === 'Cart' ? 20 : 24} color={activeTab === 'Cart' ? "white" : "#9CA3AF"} />
            {cartTotalCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{cartTotalCount}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: activeTab === 'Cart' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Cart' ? '700' : '600' }}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => activeTab !== 'Bookings' && navigation.navigate('Bookings')}>
          <View style={{ backgroundColor: activeTab === 'Bookings' ? '#EA580C' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Bookings' ? "receipt" : "receipt-outline"} size={activeTab === 'Bookings' ? 20 : 24} color={activeTab === 'Bookings' ? "white" : "#9CA3AF"} />
          </View>
          <Text style={{ color: activeTab === 'Bookings' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Bookings' ? '700' : '600' }}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={onReviewsPress || (() => navigation.navigate('Discover', { openReviews: true }))}>
          <View style={{ backgroundColor: activeTab === 'Reviews' ? '#EA580C' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Reviews' ? "star" : "star-outline"} size={activeTab === 'Reviews' ? 20 : 24} color={activeTab === 'Reviews' ? "white" : "#9CA3AF"} />
          </View>
          <Text style={{ color: activeTab === 'Reviews' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Reviews' ? '700' : '600' }}>Reviews</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const PRESET_TAGS = ["Friendly Staff", "Great Value", "Fresh Quality", "Clean Store", "Generous Portion", "Highly Recommend"];

// --- App Screens ---
function DiscoverScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const selectedTenant = route.params?.tenant;
  const tenantQuery = selectedTenant?.id ? `?tenant_id=${selectedTenant.id}` : '';
  const [bags, setBags] = useState([]);
  const [stores, setStores] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [activeTab, setActiveTab] = useState('bags'); // 'bags' | 'food'
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [addressName, setAddressName] = useState('Locating...');
  const [mapVisible, setMapVisible] = useState(false);
  const [reviewsVisible, setReviewsVisible] = useState(false);
  const [reviewsList, setReviewsList] = useState([]);
  const [addReviewVisible, setAddReviewVisible] = useState(false);
  const [reviewStoreId, setReviewStoreId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [appReviewVisible, setAppReviewVisible] = useState(false);
  const [appReviewRating, setAppReviewRating] = useState(5);
  const [appReviewComment, setAppReviewComment] = useState('');
  const [submittingAppReview, setSubmittingAppReview] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const toggleFavoriteStore = async (storeId) => {
    // Optimistic state updates
    const updateStoreFav = (list, idField) =>
      list.map(item => {
        const targetStoreId = idField === 'id' ? item.id : item.store_id;
        if (targetStoreId === storeId) {
          return { ...item, is_favorited: item.is_favorited === 1 ? 0 : 1 };
        }
        return item;
      });

    setBags(prev => updateStoreFav(prev, 'store_id'));
    setFoodItems(prev => updateStoreFav(prev, 'store_id'));
    setStores(prev => updateStoreFav(prev, 'id'));

    try {
      await axios.post(`${API_URL}/favorites/toggle`, { store_id: storeId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.log("Error toggling favorite:", e.message);
      // Fallback/refetch on failure
      fetchBags();
      fetchFoodItems();
      fetchStores();
    }
  };
  
  // Consume ChatContext
  const { openChatWithStore, unreadStores } = useContext(ChatContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const { token, logout, user, updateUser, currencySymbol } = useContext(AuthContext);
  const { addToCart, cartTotalCount } = useContext(CartContext);

  // Edit profile state
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  
  const handleSubmitAppReview = async () => {
    setSubmittingAppReview(true);
    try {
      await axios.post(`${API_URL}/app-reviews`, { rating: appReviewRating, comment: appReviewComment }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert("Thank you!", "Your app review has been submitted to the SuperAdmin.");
      setAppReviewVisible(false);
      setAppReviewComment('');
      setAppReviewRating(5);
    } catch (e) {
      Alert.alert("Error", "Failed to submit review.");
    } finally {
      setSubmittingAppReview(false);
    }
  };

  const fetchBags = async () => {
    try {
      const response = await axios.get(`${API_URL}/bags${tenantQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBags(response.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert("Session Expired", "Please login again.");
        logout();
      } else {
        console.log("Error fetching bags:", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFoodItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/food-items${tenantQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFoodItems(response.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert("Session Expired", "Please login again.");
        logout();
      } else {
        console.log("Error fetching food items:", error.message);
      }
    }
  };

  const fetchStores = async () => {
    try {
      const response = await axios.get(`${API_URL}/stores${tenantQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStores(response.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert("Session Expired", "Please login again.");
        logout();
      } else {
        console.log("Error fetching stores:", error.message);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return Alert.alert("Error", "Name cannot be empty.");
    setSavingProfile(true);
    try {
      const payload = { name: editName };
      if (editAvatar) payload.logo = editAvatar;
      const response = await axios.put(`${API_URL}/users/${user.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.user) {
        updateUser(response.data.user);
      }
      setEditProfileVisible(false);
      Alert.alert("Success", "Profile updated!");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const pickAvatar = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setEditAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  useEffect(() => {
    if (!selectedTenant) {
      navigation.replace('ExploreTenants');
      return;
    }
    fetchBags();
    fetchFoodItems();
    fetchStores();
    fetchReviews();
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddressName('Location Denied');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      try {
        let address = await Location.reverseGeocodeAsync(location.coords);
        if (address && address.length > 0) {
          setAddressName(`${address[0].city || address[0].region || 'Current Area'}, ${address[0].country}`);
        } else {
          setAddressName('Current Location');
        }
      } catch (e) {
        setAddressName('Current Location');
      }
    })();
  }, [selectedTenant?.id]);

  useEffect(() => {
    if (route.params?.openMap) {
      setMapVisible(true);
      navigation.setParams({ openMap: undefined });
    } else if (route.params?.openReviews) {
      setReviewsVisible(true);
      navigation.setParams({ openReviews: undefined });
    } else if (route.params?.openChatWithStore) {
      const storeParam = route.params.openChatWithStore;
      openChatWithStore(storeParam);
      navigation.setParams({ openChatWithStore: undefined });
    }
  }, [route.params]);

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API_URL}/public/reviews?limit=50`);
      setReviewsList(res.data);
    } catch (error) {
      console.log("Error fetching reviews", error.message);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewStoreId || !reviewRating) return Alert.alert("Error", "Please select a store and rating");
    setSubmittingReview(true);
    try {
      await axios.post(`${API_URL}/reviews`, { store_id: reviewStoreId, rating: reviewRating, comment: reviewComment, tags: reviewTags }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert("Success", "Review submitted!");
      setAddReviewVisible(false);
      setReviewComment('');
      setReviewRating(5);
      setReviewTags([]);
      fetchReviews();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderItem = ({ item }) => {
    let distanceText = "Near you";
    if (userLocation && item.lat && item.lng) {
      const distMeters = getDistance(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: item.lat, longitude: item.lng }
      );
      distanceText = `${(distMeters / 1000).toFixed(1)} km`;
    }

    const handleNavigate = () => {
      setMapVisible(true);
    };

    const imageUrl = item.images && JSON.parse(item.images).length > 0
      ? JSON.parse(item.images)[0]
      : 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&auto=format&fit=crop';

    return (
      <TouchableOpacity 
        activeOpacity={0.95}
        onPress={() => {
          const store = stores.find(s => s.id === item.store_id);
          if (store) navigation.navigate('StoreDetails', { store, userLocation });
        }}
        style={styles.gridCard}
      >
        <View style={styles.gridImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.gridImage} />
          {/* Distance badge */}
          <View style={styles.gridTimeBadge}>
            <Ionicons name="location-outline" size={10} color="#EA580C" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#111827', marginLeft: 3 }}>{distanceText}</Text>
          </View>
          {/* Favorite heart button */}
          <TouchableOpacity 
            style={{ 
              position: 'absolute', 
              top: 8, 
              right: 42, 
              backgroundColor: 'rgba(255,255,255,0.9)', 
              width: 28, 
              height: 28, 
              borderRadius: 14, 
              justifyContent: 'center', 
              alignItems: 'center',
              zIndex: 10
            }} 
            onPress={() => toggleFavoriteStore(item.store_id)}
          >
            <Ionicons name={item.is_favorited === 1 ? "heart" : "heart-outline"} size={14} color={item.is_favorited === 1 ? "#EF4444" : "#6B7280"} />
          </TouchableOpacity>
          {/* Cart button */}
          <TouchableOpacity style={styles.gridFavoriteBtn} onPress={() => addToCart(item, 'bag')}>
            <Ionicons name="cart-outline" size={15} color="#EA580C" />
          </TouchableOpacity>
        </View>
        {/* Bag type badge */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="bag-outline" size={10} color="#EA580C" />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#EA580C' }}>SURPRISE BAG</Text>
        </View>
        <Text numberOfLines={1} style={styles.gridTitle}>{item.store_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={{ fontSize: 12, color: '#111827', fontWeight: '600', marginLeft: 3 }}>4.8 <Text style={{ color: '#9CA3AF', fontWeight: '400' }}>(120)</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <View style={styles.gridPriceTag}>
            <Text style={styles.gridPriceText}>{currencySymbol}{item.price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity onPress={handleNavigate} style={styles.gridNavBtn}>
            <Ionicons name="navigate-outline" size={15} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };


  const renderFoodItem = ({ item }) => {
    let distanceText = "Near you";
    if (userLocation && item.lat && item.lng) {
      const distMeters = getDistance(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: item.lat, longitude: item.lng }
      );
      distanceText = `${(distMeters / 1000).toFixed(1)} km`;
    }

    const imageUrl = item.images && JSON.parse(item.images).length > 0
      ? JSON.parse(item.images)[0]
      : 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=400&auto=format&fit=crop';

    const categoryColors = {
      'Bakery': '#FEF3C7', 'Meals': '#D1FAE5', 'Drinks': '#DBEAFE',
      'Snacks': '#FCE7F3', 'Desserts': '#EDE9FE', 'Other': '#F3F4F6'
    };
    const catColor = categoryColors[item.category] || '#F3F4F6';

    const handleNavigate = () => {
      setMapVisible(true);
    };

    return (
      <TouchableOpacity 
        activeOpacity={0.95}
        onPress={() => {
          const store = stores.find(s => s.id === item.store_id);
          if (store) navigation.navigate('StoreDetails', { store, userLocation });
        }}
        style={styles.gridCard}
      >
        <View style={styles.gridImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.gridImage} />
          <View style={styles.gridTimeBadge}>
            <Ionicons name="location-outline" size={10} color="#EA580C" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#111827', marginLeft: 3 }}>{distanceText}</Text>
          </View>
          {/* Favorite heart button */}
          <TouchableOpacity 
            style={{ 
              position: 'absolute', 
              top: 8, 
              right: 42, 
              backgroundColor: 'rgba(255,255,255,0.9)', 
              width: 28, 
              height: 28, 
              borderRadius: 14, 
              justifyContent: 'center', 
              alignItems: 'center',
              zIndex: 10
            }} 
            onPress={() => toggleFavoriteStore(item.store_id)}
          >
            <Ionicons name={item.is_favorited === 1 ? "heart" : "heart-outline"} size={14} color={item.is_favorited === 1 ? "#EF4444" : "#6B7280"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridFavoriteBtn} onPress={() => addToCart(item, 'food')}>
            <Ionicons name="cart-outline" size={15} color="#EA580C" />
          </TouchableOpacity>
        </View>
        {/* Category badge */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: catColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#374151' }}>{item.category?.toUpperCase()}</Text>
        </View>
        <Text numberOfLines={1} style={styles.gridTitle}>{item.name}</Text>
        <Text numberOfLines={1} style={[styles.gridRating, { color: '#6B7280' }]}>{item.store_name}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <View>
            <View style={[styles.gridPriceTag, { backgroundColor: '#9CA3AF' }]}>
              <Text style={styles.gridPriceText}>{currencySymbol}{item.price.toFixed(2)}</Text>
            </View>
            {item.original_price && (
              <Text style={{ fontSize: 10, color: '#9CA3AF', textDecorationLine: 'line-through', marginTop: 2 }}>{currencySymbol}{item.original_price.toFixed(2)}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 11, color: '#6B7280' }}>{item.quantity} left</Text>
            <TouchableOpacity onPress={handleNavigate} style={styles.gridNavBtn}>
              <Ionicons name="navigate-outline" size={15} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredBags = bags.filter(bag => {
    const matchesStore = selectedStoreId ? bag.store_id === selectedStoreId : true;
    const matchesFavorite = favoritesOnly ? bag.is_favorited === 1 : true;
    const matchesSearch = searchQuery
      ? bag.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bag.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesStore && matchesFavorite && matchesSearch;
  });

  const filteredFoodItems = foodItems.filter(item => {
    const matchesStore = selectedStoreId ? item.store_id === selectedStoreId : true;
    const matchesFavorite = favoritesOnly ? item.is_favorited === 1 : true;
    const matchesSearch = searchQuery
      ? item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesStore && matchesFavorite && matchesSearch;
  });

  const filteredStores = stores.filter(store => {
    const matchesFavorite = favoritesOnly ? store.is_favorited === 1 : true;
    const matchesSearch = searchQuery
      ? store.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.address?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesFavorite && matchesSearch;
  });

  const activeItems = activeTab === 'bags' ? filteredBags : filteredFoodItems;
  const activeCount = activeItems.length;

  const avatarUri = user?.logo || `https://i.pravatar.cc/100?img=${user?.id || 12}`;

  const ListHeader = () => (
    <View style={{ paddingHorizontal: 20 }}>

      {/* Categories */}
      <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
        <TouchableOpacity
          onPress={() => { setSelectedStoreId(null); setFavoritesOnly(false); }}
          style={{ 
            backgroundColor: (selectedStoreId === null && !favoritesOnly) ? '#EA580C' : '#F3F4F6', 
            paddingHorizontal: 20, 
            paddingVertical: 10, 
            borderRadius: 24, 
            borderWidth: 1, 
            borderColor: (selectedStoreId === null && !favoritesOnly) ? '#EA580C' : '#E5E7EB'
          }}
        >
          <Text style={{ color: (selectedStoreId === null && !favoritesOnly) ? 'white' : '#4B5563', fontWeight: 'bold' }}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setFavoritesOnly(!favoritesOnly); setSelectedStoreId(null); }}
          style={{ 
            backgroundColor: favoritesOnly ? '#EF4444' : '#F3F4F6', 
            paddingHorizontal: 20, 
            paddingVertical: 10, 
            borderRadius: 24, 
            borderWidth: 1, 
            borderColor: favoritesOnly ? '#EF4444' : '#E5E7EB',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Ionicons name={favoritesOnly ? "heart" : "heart-outline"} size={14} color={favoritesOnly ? "white" : "#4B5563"} />
          <Text style={{ color: favoritesOnly ? 'white' : '#4B5563', fontWeight: 'bold' }}>Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ 
            backgroundColor: '#F3F4F6', 
            paddingHorizontal: 20, 
            paddingVertical: 10, 
            borderRadius: 24, 
            borderWidth: 1, 
            borderColor: '#E5E7EB' 
          }}
        >
          <Text style={{ color: '#4B5563', fontWeight: 'bold' }}>Meals</Text>
        </TouchableOpacity>
      </View>

      {/* Ongoing Offers Banner */}
      <View style={{ marginTop: 24, backgroundColor: '#EA580C', borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
        <View style={{ flex: 1, zIndex: 1 }}>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: '800', lineHeight: 30 }}>Explore Stores{'\n'}Nearby You</Text>
          <TouchableOpacity onPress={() => setMapVisible(true)} style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignSelf: 'flex-start', marginTop: 16 }}>
            <Text style={{ color: '#2C5E2E', fontWeight: 'bold' }}>Explore Map</Text>
          </TouchableOpacity>
        </View>
        <View style={{ position: 'absolute', right: -60, top: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)' }} />
      </View>

      {/* All Stores Section (FoodPanda-style) */}
      <View style={{ marginTop: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>All Stores</Text>
          <Text style={{ fontSize: 13, color: '#EA580C', fontWeight: '600' }}>{filteredStores.length} available</Text>
        </View>
        {filteredStores.length === 0 ? (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>{searchQuery ? '🔍' : '🏪'}</Text>
            <Text style={{ color: '#6B7280', marginTop: 8, fontWeight: '500', textAlign: 'center' }}>
              {searchQuery ? `No stores match "${searchQuery}"` : 'No stores yet. Check back soon!'}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            {filteredStores.map(store => {
              const isSelected = selectedStoreId === store.id;
              const storeBags = bags.filter(b => b.store_id === store.id);
              return (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => navigation.navigate('StoreDetails', { store, userLocation })}
                  style={{
                    width: 150,
                    marginRight: 14,
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    elevation: 4,
                    borderWidth: 2,
                    borderColor: isSelected ? '#EA580C' : 'transparent',
                  }}
                >
                  <View style={{ position: 'relative' }}>
                    {store.image ? (
                      <Image source={{ uri: store.image }} style={{ width: '100%', height: 100, resizeMode: 'cover' }} />
                    ) : (
                      <View style={{ width: '100%', height: 100, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 40 }}>🏪</Text>
                      </View>
                    )}
                    <TouchableOpacity 
                      style={{ 
                        position: 'absolute', 
                        top: 8, 
                        right: 8, 
                        backgroundColor: 'rgba(255,255,255,0.9)', 
                        width: 28, 
                        height: 28, 
                        borderRadius: 14, 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        zIndex: 10
                      }} 
                      onPress={() => toggleFavoriteStore(store.id)}
                    >
                      <Ionicons name={store.is_favorited === 1 ? "heart" : "heart-outline"} size={14} color={store.is_favorited === 1 ? "#EF4444" : "#6B7280"} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ padding: 10 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: '#111827' }}>{store.name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{store.address}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <View style={{ backgroundColor: '#EA580C', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                          {storeBags.length} bag{storeBags.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => openChatWithStore(store)}
                        style={{ padding: 4, borderRadius: 12, backgroundColor: '#EFF6FF', position: 'relative' }}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1D4ED8" />
                        {unreadStores && unreadStores[store.id] && (
                          <View style={{ 
                            position: 'absolute', 
                            top: -2, 
                            right: -2, 
                            width: 8, 
                            height: 8, 
                            borderRadius: 4, 
                            backgroundColor: '#EF4444' 
                          }} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Bags / Food Title + Tab */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, marginBottom: 16, alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: '800', color: '#111827', flex: 1 }}>
          {selectedStoreId
            ? `${stores.find(s => s.id === selectedStoreId)?.name || 'Store'} ${activeTab === 'bags' ? 'Bags' : 'Food'}`
            : activeTab === 'bags' ? 'All Surprise Bags' : 'Open Food'}
        </Text>
        <Text style={{ fontSize: 13, color: '#EA580C', fontWeight: '700', flexShrink: 0 }}>{activeCount} available</Text>
      </View>

      {activeCount === 0 && !loading && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 48 }}>{activeTab === 'bags' ? '🛍️' : '🍽️'}</Text>
          <Text style={{ color: '#374151', fontSize: 16, fontWeight: '700', marginTop: 12 }}>
            {activeTab === 'bags' ? 'No Bags Available' : 'No Food Listings'}
          </Text>
          <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 6, textAlign: 'center' }}>
            {selectedStoreId ? 'Nothing here from this store yet.' : 'Check back later!'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Stable top bar: location + search ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#FAFAFA' }}>
          {selectedTenant && (
            <TouchableOpacity
              onPress={() => navigation.replace('ExploreTenants')}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#FFF7ED', borderRadius: 16, padding: 12 }}
            >
              {selectedTenant.logo ? (
                <Image source={{ uri: selectedTenant.logo }} style={{ width: 40, height: 40, borderRadius: 10, marginRight: 12 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>🏪</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#EA580C', fontWeight: '700', textTransform: 'uppercase' }}>Shopping from</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>{selectedTenant.name}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#EA580C', fontWeight: '700' }}>Change</Text>
            </TouchableOpacity>
          )}
          {/* Location row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="location" size={22} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '600' }}>Current Location</Text>
                <Text style={{ color: '#111827', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{addressName}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => {
              setEditName(user?.name || '');
              setEditAvatar(user?.logo || null);
              setEditProfileVisible(true);
            }}>
              <Image source={{ uri: avatarUri }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#EA580C' }} />
            </TouchableOpacity>
          </View>

          {/* Search bar — lives OUTSIDE FlatList so it never re-mounts */}
          <View style={{ backgroundColor: '#F3F4F6', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search stores, bags, or items..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, fontSize: 16, color: '#111827' }}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#EA580C" />
          </View>
        ) : (
          <>
            {/* Tab Toggle */}
            <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 4, backgroundColor: '#F3F4F6', borderRadius: 28, padding: 4 }}>
              <TouchableOpacity
                onPress={() => setActiveTab('bags')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center', backgroundColor: activeTab === 'bags' ? '#EA580C' : 'transparent' }}
              >
                <Text style={{ fontWeight: '700', fontSize: 14, color: activeTab === 'bags' ? 'white' : '#6B7280' }}>🎁 Surprise Bags</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('food')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center', backgroundColor: activeTab === 'food' ? '#EA580C' : 'transparent' }}
              >
                <Text style={{ fontWeight: '700', fontSize: 14, color: activeTab === 'food' ? 'white' : '#6B7280' }}>🍽️ Open Food</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeItems}
              keyExtractor={(item) => item.id.toString()}
              renderItem={activeTab === 'bags' ? renderItem : renderFoodItem}
              numColumns={2}
              key={activeTab}
              ListHeaderComponent={ListHeader}
              contentContainerStyle={{ paddingBottom: 120 }}
              columnWrapperStyle={{ paddingHorizontal: 16, justifyContent: 'space-between' }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshing={loading}
              onRefresh={() => { fetchBags(); fetchFoodItems(); fetchStores(); }}
            />
          </>
        )}
      </SafeAreaView>

      {/* Bottom Nav (Glassmorphism) */}
      <SharedBottomNav 
        navigation={navigation} 
        activeTab="Home" 
        cartTotalCount={cartTotalCount}
        navParams={selectedTenant ? { tenant: selectedTenant } : undefined}
        onMapPress={() => setMapVisible(true)} 
        onReviewsPress={() => setReviewsVisible(true)} 
      />

      {/* Map Modal */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={userLocation ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            } : undefined}
            showsUserLocation={true}
          >
            {stores.filter(s => s.lat && s.lng).map(store => (
              <Marker
                key={store.id}
                coordinate={{ latitude: store.lat, longitude: store.lng }}
                title={store.name}
                description={store.address}
              >
                <Callout tooltip>
                  <View style={{ backgroundColor: 'white', padding: 10, borderRadius: 8, borderColor: '#ccc', borderWidth: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{store.name}</Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>{store.address}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          <TouchableOpacity
            style={{ position: 'absolute', top: Math.max(insets.top, 20), right: 20, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}
            onPress={() => setMapVisible(false)}
          >
            <Text style={{ color: '#111827', fontWeight: 'bold' }}>Close Map</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Reviews Modal */}
      <Modal visible={reviewsVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: 'white', 
            paddingHorizontal: 24, 
            paddingTop: 24, 
            paddingBottom: Math.max(insets.bottom, 24), 
            borderTopLeftRadius: 28, 
            borderTopRightRadius: 28, 
            height: '85%' 
          }}>
            {!addReviewVisible ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Store Reviews</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => setAddReviewVisible(true)} style={{ backgroundColor: '#EA580C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>+ Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setReviewsVisible(false)}>
                      <Ionicons name="close" size={24} color="#111827" />
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {reviewsList.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#6B7280', marginTop: 20 }}>No reviews yet.</Text>
                  ) : reviewsList.map((review) => (
                    <View key={review.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Text style={{ color: '#374151', fontWeight: 'bold' }}>{review.customer_name ? review.customer_name.charAt(0).toUpperCase() : 'U'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontWeight: '700', color: '#111827' }}>{review.customer_name}</Text>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>for {review.store_name}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          {[...Array(5)].map((_, idx) => (
                            <Ionicons key={idx} name={idx < review.rating ? "star" : "star-outline"} size={14} color="#F59E0B" />
                          ))}
                        </View>
                      </View>
                      {review.comment ? (
                        <Text style={{ color: '#4B5563', lineHeight: 20, marginBottom: 4 }}>{review.comment}</Text>
                      ) : null}
                      {/* Render Tags */}
                      {(() => {
                        let parsedTags = [];
                        try {
                          parsedTags = typeof review.tags === 'string' ? JSON.parse(review.tags) : (review.tags || []);
                        } catch (e) {
                          parsedTags = [];
                        }
                        if (parsedTags && parsedTags.length > 0) {
                          return (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {parsedTags.map(tag => (
                                <View key={tag} style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFEDD5' }}>
                                  <Text style={{ color: '#C2410C', fontSize: 10, fontWeight: '700' }}>{tag}</Text>
                                </View>
                              ))}
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Write a Review</Text>
                  <TouchableOpacity onPress={() => setAddReviewVisible(false)}>
                    <Ionicons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Select Store</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {stores.map(store => (
                      <TouchableOpacity 
                        key={store.id} 
                        onPress={() => setReviewStoreId(store.id)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: reviewStoreId === store.id ? '#EA580C' : '#F3F4F6' }}
                      >
                        <Text style={{ color: reviewStoreId === store.id ? 'white' : '#4B5563', fontSize: 12, fontWeight: '600' }}>{store.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Rating</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 20, gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                        <Ionicons name={star <= reviewRating ? "star" : "star-outline"} size={32} color="#F59E0B" />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>What did you love? (Select Tags)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {PRESET_TAGS.map(tag => {
                      const isSelected = reviewTags.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => {
                            if (isSelected) {
                              setReviewTags(reviewTags.filter(t => t !== tag));
                            } else {
                              setReviewTags([...reviewTags, tag]);
                            }
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 16,
                            backgroundColor: isSelected ? '#EA580C' : '#F3F4F6',
                          }}
                        >
                          <Text style={{ color: isSelected ? 'white' : '#4B5563', fontSize: 12, fontWeight: '600' }}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Comment (optional)</Text>
                  <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top', marginBottom: 20 }]}
                    placeholder="How was the food and service?"
                    multiline
                    value={reviewComment}
                    onChangeText={setReviewComment}
                  />

                  <TouchableOpacity 
                    style={[styles.primaryButton, { opacity: (!reviewStoreId || submittingReview) ? 0.6 : 1 }]} 
                    disabled={!reviewStoreId || submittingReview}
                    onPress={handleSubmitReview}
                  >
                    {submittingReview ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Submit Review</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal 
        visible={editProfileVisible} 
        animationType="slide" 
        transparent={true}
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setEditProfileVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={{ 
              backgroundColor: 'white', 
              paddingHorizontal: 24, 
              paddingTop: 24, 
              paddingBottom: Math.max(insets.bottom, 24), 
              borderTopLeftRadius: 28, 
              borderTopRightRadius: 28, 
              height: '78%' 
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>My Profile</Text>
                <TouchableOpacity 
                  onPress={() => setEditProfileVisible(false)}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Avatar section */}
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
                    <Image source={{ uri: editAvatar || avatarUri }} style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#EA580C' }} />
                    <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#EA580C', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' }}>
                      <Ionicons name="camera" size={16} color="white" />
                    </View>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>Tap to change photo</Text>
                </View>

                {/* Account Details */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Email</Text>
                <TextInput
                  style={[styles.input, { opacity: 0.6 }]}
                  value={user?.email}
                  editable={false}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  value={editName}
                  onChangeText={setEditName}
                />

                <TouchableOpacity 
                  style={[styles.primaryButton, { marginTop: 16 }]} 
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
                </TouchableOpacity>

                
                <TouchableOpacity 
                  style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#F3F4F6', borderRadius: 30 }}
                  onPress={() => {
                    setEditProfileVisible(false);
                    setTimeout(() => setAppReviewVisible(true), 500);
                  }}
                >
                  <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>Rate the App</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#FEE2E2', borderRadius: 30 }}

                  onPress={() => {
                    setEditProfileVisible(false);
                    logout();
                  }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 16 }}>Log Out</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>


      {/* App Review Modal */}
      <Modal visible={appReviewVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', padding: 24, paddingBottom: Math.max(insets.bottom, 24), borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Rate Grabengo App</Text>
              <TouchableOpacity onPress={() => setAppReviewVisible(false)}><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setAppReviewRating(star)}>
                  <Ionicons name={star <= appReviewRating ? "star" : "star-outline"} size={40} color="#FBBF24" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="What do you think of our app?" multiline value={appReviewComment} onChangeText={setAppReviewComment} />
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleSubmitAppReview} disabled={submittingAppReview}>
              {submittingAppReview ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Submit Review</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// --- Store Details Screen ---
function StoreDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { store, userLocation } = route.params;
  const { token, user, currencySymbol } = useContext(AuthContext);
  const { addToCart, cartTotalCount } = useContext(CartContext);
  const { openChatWithStore } = useContext(ChatContext);

  const [bags, setBags] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bags'); // 'bags' | 'menu' | 'reviews'
  const [isFavorited, setIsFavorited] = useState(store.is_favorited === 1);

  // Local Review Submission States
  const [localAddReviewVisible, setLocalAddReviewVisible] = useState(false);
  const [localReviewRating, setLocalReviewRating] = useState(5);
  const [localReviewComment, setLocalReviewComment] = useState('');
  const [localReviewTags, setLocalReviewTags] = useState([]);
  const [submittingLocalReview, setSubmittingLocalReview] = useState(false);

  const PREDEFINED_TAGS = ['Friendly Staff', 'Great Value', 'Fresh Quality', 'Clean Store', 'Generous Portion', 'Quick Pickup'];

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [bagsRes, foodRes, reviewsRes] = await Promise.all([
        axios.get(`${API_URL}/bags?all=true`, { headers }),
        axios.get(`${API_URL}/food-items?all=true&store_id=${store.id}`, { headers }),
        axios.get(`${API_URL}/public/reviews?store_id=${store.id}&limit=50`)
      ]);
      setBags(bagsRes.data.filter(b => b.store_id === store.id));
      setFoodItems(foodRes.data);
      setReviews(reviewsRes.data);
    } catch (err) {
      console.log("Error fetching store details data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [store.id]);

  const toggleFavorite = async () => {
    const nextState = !isFavorited;
    setIsFavorited(nextState);
    try {
      await axios.post(`${API_URL}/favorites/toggle`, { store_id: store.id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.log("Error toggling favorite:", e.message);
      setIsFavorited(!nextState); // Rollback
    }
  };

  const submitLocalReview = async () => {
    if (submittingLocalReview) return;
    if (!localReviewComment.trim()) {
      Alert.alert("Comment Required", "Please write a short comment about your experience.");
      return;
    }
    setSubmittingLocalReview(true);
    try {
      await axios.post(`${API_URL}/reviews`, {
        store_id: store.id,
        rating: localReviewRating,
        comment: localReviewComment,
        tags: JSON.stringify(localReviewTags)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      Alert.alert("Success", "Thank you! Your review has been posted.");
      setLocalAddReviewVisible(false);
      setLocalReviewComment('');
      setLocalReviewRating(5);
      setLocalReviewTags([]);
      fetchData(); // Refresh reviews list
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmittingLocalReview(false);
    }
  };

  const handleToggleTag = (tag) => {
    if (localReviewTags.includes(tag)) {
      setLocalReviewTags(localReviewTags.filter(t => t !== tag));
    } else {
      setLocalReviewTags([...localReviewTags, tag]);
    }
  };

  let distanceText = "Near you";
  if (userLocation && store.lat && store.lng) {
    const distMeters = getDistance(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: store.lat, longitude: store.lng }
    );
    distanceText = `${(distMeters / 1000).toFixed(1)} km`;
  }

  const coverUrl = store.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600&auto=format&fit=crop';

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <StatusBar style="light" />

      {/* Floating Header Actions */}
      <View style={{ 
        position: 'absolute', 
        top: Math.max(insets.top, 12), 
        left: 20, 
        right: 20, 
        zIndex: 100, 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{ 
            width: 42, 
            height: 42, 
            borderRadius: 21, 
            backgroundColor: 'rgba(15, 23, 42, 0.6)', 
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.25)',
            justifyContent: 'center', 
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4
          }}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Cart')} 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 21, 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.25)',
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4,
              position: 'relative'
            }}
          >
            <Ionicons name="cart" size={20} color="white" />
            {cartTotalCount > 0 && (
              <View style={{ 
                position: 'absolute', 
                top: -4, 
                right: -4, 
                backgroundColor: '#EF4444', 
                borderRadius: 9, 
                minWidth: 18, 
                height: 18, 
                justifyContent: 'center', 
                alignItems: 'center', 
                paddingHorizontal: 4,
                borderWidth: 1.5,
                borderColor: '#FFFFFF'
              }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{cartTotalCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => openChatWithStore(store)} 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 21, 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.25)',
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={toggleFavorite} 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 21, 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.25)',
              justifyContent: 'center', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4
            }}
          >
            <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={20} color={isFavorited ? "#EF4444" : "white"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Visual Cover Photo with Gradient Overlay */}
        <View style={{ height: 260, position: 'relative' }}>
          <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(15,23,42,0.85)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </View>

        {/* Info Card Overlap */}
        <View style={{ 
          marginTop: -32, 
          borderTopLeftRadius: 32, 
          borderTopRightRadius: 32, 
          backgroundColor: '#FFFFFF', 
          paddingTop: 28,
          paddingHorizontal: 24,
          paddingBottom: 24,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -12 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 8
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#EA580C', letterSpacing: 0.5 }}>MERCHANT PARTNER</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="leaf" size={14} color="#10B981" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Eco Hero</Text>
            </View>
          </View>

          <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>{store.name}</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Ionicons name="location" size={16} color="#64748B" />
            <Text style={{ fontSize: 14, color: '#64748B', marginLeft: 6, fontWeight: '500', flex: 1 }} numberOfLines={1}>
              {store.address || 'Local Street'}
            </Text>
          </View>

          {/* Divider Line */}
          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 18 }} />

          {/* Symmetrical Quick Info Grid */}
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
            {/* Rating Box */}
            <View style={{ 
              flex: 1, 
              backgroundColor: '#FFFFFF', 
              borderRadius: 20, 
              paddingVertical: 14,
              paddingHorizontal: 6,
              alignItems: 'center', 
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.02,
              shadowRadius: 8,
              elevation: 2
            }}>
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                backgroundColor: '#EA580C', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#EA580C',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 1
              }}>
                <Ionicons name="star" size={14} color="white" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>
                {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#64748B', marginTop: 2 }}>({reviews.length} ratings)</Text>
            </View>

            {/* Distance Box */}
            <View style={{ 
              flex: 1, 
              backgroundColor: '#FFFFFF', 
              borderRadius: 20, 
              paddingVertical: 14,
              paddingHorizontal: 6,
              alignItems: 'center', 
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.02,
              shadowRadius: 8,
              elevation: 2
            }}>
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                backgroundColor: '#EA580C', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#EA580C',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 1
              }}>
                <Ionicons name="navigate" size={13} color="white" />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>
                {distanceText}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#64748B', marginTop: 2 }}>Distance</Text>
            </View>

            {/* Time Box */}
            <View style={{ 
              flex: 1, 
              backgroundColor: '#FFFFFF', 
              borderRadius: 20, 
              paddingVertical: 14,
              paddingHorizontal: 6,
              alignItems: 'center', 
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.02,
              shadowRadius: 8,
              elevation: 2
            }}>
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                backgroundColor: '#EA580C', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#EA580C',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 1
              }}>
                <Ionicons name="time" size={15} color="white" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>
                17:30 - 19:00
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#64748B', marginTop: 2 }}>Pickup Window</Text>
            </View>
          </View>
        </View>

        {/* Custom Segmented Capsule Tabs Control */}
        <View style={{ 
          flexDirection: 'row', 
          marginHorizontal: 20, 
          marginVertical: 16, 
          backgroundColor: '#F1F5F9', 
          padding: 4, 
          borderRadius: 16 
        }}>
          {['bags', 'menu', 'reviews'].map(tab => {
            const isActive = activeTab === tab;
            let iconName = '';
            let labelText = '';
            
            if (tab === 'bags') {
              iconName = isActive ? 'gift' : 'gift-outline';
              labelText = 'Bags';
            } else if (tab === 'menu') {
              iconName = isActive ? 'fast-food' : 'fast-food-outline';
              labelText = 'Menu';
            } else {
              iconName = isActive ? 'star' : 'star-outline';
              labelText = 'Reviews';
            }

            return (
              <TouchableOpacity 
                key={tab} 
                onPress={() => setActiveTab(tab)}
                style={{ 
                  flex: 1, 
                  paddingVertical: 10, 
                  alignItems: 'center', 
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  borderRadius: 12,
                  shadowColor: isActive ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isActive ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: isActive ? 2 : 0,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Ionicons name={iconName} size={15} color={isActive ? '#EA580C' : '#64748B'} />
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: isActive ? '800' : '600', 
                  color: isActive ? '#EA580C' : '#64748B' 
                }}>
                  {labelText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading Spinner */}
        {loading ? (
          <View style={{ padding: 60, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#EA580C" />
          </View>
        ) : (
          <View style={{ paddingBottom: 10 }}>
            {/* SURPRISE BAGS LIST */}
            {activeTab === 'bags' && (
              <View>
                {bags.length === 0 ? (
                  <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>🎁</Text>
                    <Text style={{ color: '#64748B', fontWeight: '600', textAlign: 'center' }}>No surprise bags available right now.</Text>
                  </View>
                ) : (
                  bags.map(bag => (
                    <View key={bag.id} style={{ 
                      marginHorizontal: 20, 
                      marginTop: 16, 
                      backgroundColor: '#FFFFFF', 
                      borderRadius: 24, 
                      padding: 16, 
                      borderWidth: 1, 
                      borderColor: '#E2E8F0', 
                      shadowColor: '#0F172A', 
                      shadowOffset: { width: 0, height: 6 }, 
                      shadowOpacity: 0.04, 
                      shadowRadius: 12, 
                      elevation: 3
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Left: Thumbnail Graphic */}
                        <View style={{ 
                          width: 72, 
                          height: 72, 
                          borderRadius: 16, 
                          marginRight: 14,
                          position: 'relative',
                          overflow: 'hidden',
                          shadowColor: '#EA580C',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          elevation: 3
                        }}>
                          <LinearGradient
                            colors={['#FF7E40', '#EA580C']}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                          />
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="gift" size={32} color="white" />
                          </View>
                        </View>

                        {/* Middle & Right Top Section */}
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>Surprise Bag</Text>
                              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                                {bag.description || 'Assortment of fresh surplus bakery treats, daily specials, or meals.'}
                              </Text>
                            </View>
                            
                            {/* Price Column */}
                            <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: '#EA580C' }}>{currencySymbol}{bag.price.toFixed(2)}</Text>
                              {bag.original_price && (
                                <Text style={{ fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through', marginTop: 2, fontWeight: '600' }}>
                                  {currencySymbol}{bag.original_price.toFixed(2)}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Divider */}
                      <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

                      {/* Bottom row: badges and CTA Add button (No overlaps!) */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ backgroundColor: bag.quantity > 2 ? '#E0F2FE' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, color: bag.quantity > 2 ? '#0369A1' : '#B91C1C', fontWeight: '800' }}>
                              {bag.quantity} remaining
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Ionicons name="time-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>{bag.pickup_time || '18:00 - 19:30'}</Text>
                          </View>
                        </View>

                        <TouchableOpacity 
                          onPress={() => addToCart(bag, 'bag')}
                          style={{ 
                            backgroundColor: '#EA580C', 
                            paddingHorizontal: 16, 
                            paddingVertical: 8, 
                            borderRadius: 20,
                            shadowColor: '#EA580C',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 2
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* FOOD ITEMS MENU LIST */}
            {activeTab === 'menu' && (
              <View>
                {foodItems.length === 0 ? (
                  <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>🍽️</Text>
                    <Text style={{ color: '#64748B', fontWeight: '600', textAlign: 'center' }}>No menu items listed right now.</Text>
                  </View>
                ) : (
                  foodItems.map(item => {
                    let gradColors = ['#F59E0B', '#D97706']; // Bakery (Gold/Amber)
                    let catIcon = 'pizza';
                    if (item.category === 'Drinks') {
                      gradColors = ['#3B82F6', '#1D4ED8']; // Drinks (Blue)
                      catIcon = 'cafe';
                    } else if (item.category === 'Meals') {
                      gradColors = ['#10B981', '#059669']; // Meals (Emerald)
                      catIcon = 'restaurant';
                    }

                    return (
                      <View key={item.id} style={{ 
                        marginHorizontal: 20, 
                        marginTop: 16, 
                        backgroundColor: '#FFFFFF', 
                        borderRadius: 24, 
                        padding: 16, 
                        borderWidth: 1, 
                        borderColor: '#E2E8F0', 
                        shadowColor: '#0F172A', 
                        shadowOffset: { width: 0, height: 6 }, 
                        shadowOpacity: 0.04, 
                        shadowRadius: 12, 
                        elevation: 3
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {/* Left: Thumbnail Graphic */}
                          <View style={{ 
                            width: 72, 
                            height: 72, 
                            borderRadius: 16, 
                            marginRight: 14,
                            position: 'relative',
                            overflow: 'hidden',
                            shadowColor: gradColors[1],
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            elevation: 3
                          }}>
                            <LinearGradient
                              colors={gradColors}
                              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            />
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name={catIcon} size={32} color="white" />
                            </View>
                          </View>

                          {/* Middle & Right Top Section */}
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E40AF', letterSpacing: 0.5 }}>{item.category?.toUpperCase()}</Text>
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>{item.name}</Text>
                                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                                  {item.description || 'Delicious freshly prepared surplus menu item.'}
                                </Text>
                              </View>
                              
                              {/* Price Column */}
                              <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#EA580C' }}>{currencySymbol}{item.price.toFixed(2)}</Text>
                                {item.original_price && (
                                  <Text style={{ fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through', marginTop: 2, fontWeight: '600' }}>
                                    {currencySymbol}{item.original_price.toFixed(2)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

                        {/* Bottom row: badges and CTA Add button (No overlaps!) */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: item.quantity > 2 ? '#E0F2FE' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                              <Text style={{ fontSize: 11, color: item.quantity > 2 ? '#0369A1' : '#B91C1C', fontWeight: '800' }}>
                                {item.quantity} remaining
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity 
                            onPress={() => addToCart(item, 'food')}
                            style={{ 
                              backgroundColor: '#EA580C', 
                              paddingHorizontal: 16, 
                              paddingVertical: 8, 
                              borderRadius: 20,
                              shadowColor: '#EA580C',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.2,
                              shadowRadius: 8,
                              elevation: 2
                            }}
                          >
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>+ Add</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* CUSTOMER REVIEWS PORTAL */}
            {activeTab === 'reviews' && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                {/* Rating Distribution Panel */}
                <View style={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: 24, 
                  padding: 20, 
                  marginTop: 10,
                  borderWidth: 1, 
                  borderColor: '#E2E8F0', 
                  shadowColor: '#0F172A', 
                  shadowOffset: { width: 0, height: 4 }, 
                  shadowOpacity: 0.02, 
                  shadowRadius: 8, 
                  elevation: 2
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ alignItems: 'center', paddingRight: 24, borderRightWidth: 1, borderRightColor: '#E2E8F0', minWidth: 100 }}>
                      <Text style={{ fontSize: 44, fontWeight: '900', color: '#0F172A' }}>
                        {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
                      </Text>
                      <View style={{ flexDirection: 'row', marginVertical: 4 }}>
                        {[...Array(5)].map((_, idx) => {
                          const avg = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 4.8;
                          return (
                            <Ionicons key={idx} name={idx < Math.round(avg) ? "star" : "star-outline"} size={14} color="#F59E0B" />
                          );
                        })}
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>{reviews.length} reviews</Text>
                    </View>

                    <View style={{ flex: 1, paddingLeft: 20, gap: 4 }}>
                      {[5, 4, 3, 2, 1].map(stars => {
                        const count = reviews.filter(r => r.rating === stars).length;
                        const percent = reviews.length > 0 ? (count / reviews.length) * 100 : (stars === 5 ? 80 : stars === 4 ? 15 : 5);
                        return (
                          <View key={stars} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', width: 12 }}>{stars}</Text>
                            <Ionicons name="star" size={9} color="#D97706" style={{ marginHorizontal: 4 }} />
                            <View style={{ flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                              <View style={{ width: `${percent}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 }} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Highlights Summary */}
                  {(() => {
                    let allTags = [];
                    reviews.forEach(r => {
                      let parsed = [];
                      try { parsed = typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []); } catch(e) {}
                      allTags.push(...parsed);
                    });
                    
                    const counts = {};
                    allTags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
                    const sortedTags = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0, 4);

                    return (
                      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>Highlights from Customers</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {sortedTags.length > 0 ? sortedTags.map(tag => (
                            <View key={tag} style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="checkmark-circle" size={12} color="#15803D" style={{ marginRight: 4 }} />
                              <Text style={{ color: '#166534', fontSize: 11, fontWeight: '700' }}>{tag} ({counts[tag]})</Text>
                            </View>
                          )) : (
                            ['Friendly Staff', 'Great Value', 'Fresh Quality'].map(tag => (
                              <View key={tag} style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>{tag}</Text>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </View>

                {/* Write review trigger button */}
                <TouchableOpacity 
                  onPress={() => setLocalAddReviewVisible(true)}
                  style={{
                    backgroundColor: '#EA580C',
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: 'center',
                    marginTop: 16,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                    shadowColor: '#EA580C',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 3
                  }}
                >
                  <Ionicons name="create-outline" size={18} color="white" />
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>Write a Customer Review</Text>
                </TouchableOpacity>

                {/* Reviews timeline list */}
                <View style={{ marginTop: 24 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>Customer Comments</Text>
                  {reviews.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#94A3B8', marginVertical: 30, fontSize: 13 }}>No reviews yet. Be the first to leave one!</Text>
                  ) : (
                    reviews.map(review => (
                      <View key={review.id} style={{ 
                        backgroundColor: '#FFFFFF', 
                        borderRadius: 20, 
                        padding: 16, 
                        marginBottom: 12, 
                        borderWidth: 1, 
                        borderColor: '#E2E8F0',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.01,
                        shadowRadius: 4,
                        elevation: 1
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ 
                              width: 36, 
                              height: 36, 
                              borderRadius: 18, 
                              backgroundColor: '#F1F5F9', 
                              justifyContent: 'center', 
                              alignItems: 'center', 
                              marginRight: 10,
                              borderWidth: 1,
                              borderColor: '#E2E8F0'
                            }}>
                              <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13 }}>
                                {review.customer_name ? review.customer_name.charAt(0).toUpperCase() : 'U'}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 14 }}>{review.customer_name || 'Umer Farooq'}</Text>
                              <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{new Date(review.created_at || Date.now()).toLocaleDateString()}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 2 }}>
                            {[...Array(5)].map((_, idx) => (
                              <Ionicons key={idx} name={idx < review.rating ? "star" : "star-outline"} size={13} color="#F59E0B" />
                            ))}
                          </View>
                        </View>

                        {review.comment ? (
                          <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>{review.comment}</Text>
                        ) : null}

                        {review.tags && (() => {
                          let parsedTags = [];
                          try { parsedTags = typeof review.tags === 'string' ? JSON.parse(review.tags) : (review.tags || []); } catch (e) { parsedTags = []; }
                          if (parsedTags && parsedTags.length > 0) {
                            return (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                {parsedTags.map(tag => (
                                  <View key={tag} style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFEDD5' }}>
                                    <Text style={{ color: '#EA580C', fontSize: 10, fontWeight: '700' }}>{tag}</Text>
                                  </View>
                                ))}
                              </View>
                            );
                          }
                          return null;
                        })()}
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Dynamic Directions & Map Card */}
        <View style={{ marginHorizontal: 20, marginTop: 24, marginBottom: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>Location & Info</Text>
          <View style={{ 
            borderRadius: 24, 
            overflow: 'hidden', 
            borderWidth: 1, 
            borderColor: '#E2E8F0', 
            backgroundColor: '#FFFFFF', 
            shadowColor: '#0F172A', 
            shadowOffset: { width: 0, height: 6 }, 
            shadowOpacity: 0.04, 
            shadowRadius: 12, 
            elevation: 3 
          }}>
            <MapView
              style={{ height: 160, width: '100%' }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              initialRegion={{
                latitude: store.lat || 51.5074,
                longitude: store.lng || -0.1278,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005
              }}
            >
              <Marker coordinate={{ latitude: store.lat || 51.5074, longitude: store.lng || -0.1278 }} title={store.name} />
            </MapView>
            <TouchableOpacity 
              onPress={() => {
                const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
                const url = `${scheme}${store.lat},${store.lng}?q=${encodeURIComponent(store.name)}`;
                Linking.openURL(url);
              }}
              style={{ 
                padding: 16, 
                backgroundColor: '#FFFFFF', 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9'
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Open in System Maps</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }} numberOfLines={1}>{store.address}</Text>
              </View>
              <View style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 18, 
                backgroundColor: '#F1F5F9', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}>
                <Ionicons name="navigate" size={16} color="#EA580C" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Local Modal for Writing Review */}
      <Modal visible={localAddReviewVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: '#FFFFFF', 
            borderTopLeftRadius: 32, 
            borderTopRightRadius: 32, 
            padding: 24, 
            paddingBottom: Math.max(insets.bottom, 24), 
            height: '75%' 
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Submit Review</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Share your feedback for {store.name}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setLocalAddReviewVisible(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Star Rating Select */}
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>Overall Rating</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {[1, 2, 3, 4, 5].map((val) => (
                  <TouchableOpacity key={val} onPress={() => setLocalReviewRating(val)}>
                    <Ionicons 
                      name={val <= localReviewRating ? "star" : "star-outline"} 
                      size={36} 
                      color="#F59E0B" 
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Review Highlights Tags Selection */}
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>Review Highlights</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 12 }}>Tap to toggle highlights that describe this pickup</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {PREDEFINED_TAGS.map(tag => {
                  const isSelected = localReviewTags.includes(tag);
                  return (
                    <TouchableOpacity 
                      key={tag}
                      onPress={() => handleToggleTag(tag)}
                      style={{ 
                        backgroundColor: isSelected ? '#EA580C' : '#F1F5F9', 
                        paddingHorizontal: 14, 
                        paddingVertical: 8, 
                        borderRadius: 20, 
                        borderWidth: 1, 
                        borderColor: isSelected ? '#EA580C' : '#E2E8F0' 
                      }}
                    >
                      <Text style={{ 
                        color: isSelected ? '#FFFFFF' : '#64748B', 
                        fontSize: 12, 
                        fontWeight: '700' 
                      }}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Review Comment Input */}
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>Your Feedback</Text>
              <TextInput
                style={{ 
                  backgroundColor: '#F8FAFC', 
                  borderRadius: 16, 
                  borderWidth: 1, 
                  borderColor: '#E2E8F0', 
                  padding: 16, 
                  minHeight: 100, 
                  fontSize: 14, 
                  color: '#0F172A',
                  textAlignVertical: 'top',
                  marginBottom: 24
                }}
                placeholder="Describe the items, staff, or value of your rescue..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={localReviewComment}
                onChangeText={setLocalReviewComment}
              />

              {/* Submit Button */}
              <TouchableOpacity 
                onPress={submitLocalReview}
                disabled={submittingLocalReview}
                style={{ 
                  backgroundColor: '#EA580C', 
                  borderRadius: 24, 
                  paddingVertical: 14, 
                  alignItems: 'center', 
                  shadowColor: '#EA580C',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                  opacity: submittingLocalReview ? 0.6 : 1
                }}
              >
                {submittingLocalReview ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 }}>Submit Review</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Cart Screen ---
function CartScreen({ navigation, route }) {
  const { cartItems, updateQuantity, removeFromCart, cartTotalPrice, cartTotalCount, clearCart } = useContext(CartContext);
  const { token, currencySymbol, user } = useContext(AuthContext);
  const { openReceipt } = useContext(ChatContext);
  const [checkingOut, setCheckingOut] = useState(false);
  const insets = useSafeAreaInsets();

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setCheckingOut(true);
    const cartSnapshot = cartItems.map(item => ({
      name: item.type === 'bag' ? (item.store_name + ' Surprise Bag') : item.name,
      quantity: item.cart_quantity,
      price: item.price,
      type: item.type,
    }));
    const storeName = cartItems[0]?.store_name || 'Store';
    const totalPrice = cartTotalPrice;
    try {
      const payload = {
        items: cartItems.map(item => ({
          id: item.id,
          type: item.type,
          quantity: item.cart_quantity,
          price: item.price
        })),
        paymentMethod: 'Cash at Pickup'
      };
      const response = await axios.post(`${API_URL}/orders`, payload, { headers: { Authorization: `Bearer ${token}` } });
      const receiptGroups = response.data?.receipt_groups || [];
      const tenantParam = route.params?.tenant || (cartItems[0]?.tenant_id ? {
        id: cartItems[0].tenant_id,
        name: cartItems[0].tenant_name || storeName,
      } : null);
      clearCart();
      navigation.navigate('Discover', tenantParam ? { tenant: tenantParam } : undefined);

      if (receiptGroups.length > 0) {
        receiptGroups.forEach((group) => {
          const groupItems = group.orders.map((o) => ({
            name: o.item_name || (o.type === 'bag' ? `${o.store_name} Surprise Bag` : o.item_name),
            quantity: o.quantity,
            price: o.price,
            type: o.type,
          }));
          const groupTotal = group.orders.reduce((s, o) => s + Number(o.price) * (o.quantity || 1), 0);
          openReceipt({
            orderIds: group.orders.map((o) => o.id),
            storeName: group.orders[0]?.store_name || storeName,
            tenantName: group.tenant_name || storeName,
            items: groupItems,
            total: groupTotal,
            pickupTime: group.orders[0]?.pickup_time || null,
            customerName: user?.name || null,
            dateTime: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            paymentMethod: 'Cash at Pickup',
          });
        });
      } else {
        const orderIds = response.data?.order_ids || [];
        openReceipt({
          orderIds,
          storeName,
          tenantName: storeName,
          items: cartSnapshot,
          total: totalPrice,
          pickupTime: null,
          customerName: user?.name || null,
          dateTime: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          paymentMethod: 'Cash at Pickup',
        });
      }
    } catch (e) {
      Alert.alert("Checkout Failed", e.response?.data?.error || e.message);
    } finally {
      setCheckingOut(false);
    }
  };

  const renderItem = ({ item }) => {
    const imageUrl = item.images && JSON.parse(item.images).length > 0
      ? JSON.parse(item.images)[0]
      : 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&auto=format&fit=crop';
      
    return (
      <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
        <Image source={{ uri: imageUrl }} style={{ width: 80, height: 80, borderRadius: 12 }} />
        <View style={{ flex: 1, marginLeft: 12, justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 }}>{item.type === 'bag' ? item.store_name : item.name}</Text>
              <TouchableOpacity onPress={() => removeFromCart(item.id, item.type)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.type === 'bag' ? 'Surprise Bag' : item.category}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>{currencySymbol}{(item.price * item.cart_quantity).toFixed(2)}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20 }}>
              <TouchableOpacity onPress={() => updateQuantity(item.id, item.type, -1)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#4B5563' }}>-</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' }}>{item.cart_quantity}</Text>
              <TouchableOpacity onPress={() => updateQuantity(item.id, item.type, 1)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#4B5563' }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, backgroundColor: '#FFFFFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginLeft: 16 }}>Your Cart</Text>
      </View>

      {cartItems.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 }}>Your cart is empty</Text>
          <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>Looks like you haven't added any items yet.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24, backgroundColor: '#EA580C', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Start Browsing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={item => `${item.type}_${item.id}`}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 20 }}
          />
          
          <View style={{ 
            backgroundColor: '#FFFFFF', 
            paddingHorizontal: 24, 
            paddingTop: 24, 
            paddingBottom: Math.max(insets.bottom + 12, 100), 
            borderTopLeftRadius: 32, 
            borderTopRightRadius: 32, 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: -4 }, 
            shadowOpacity: 0.05, 
            shadowRadius: 12, 
            elevation: 10 
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 16, color: '#6B7280' }}>Items ({cartTotalCount})</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{currencySymbol}{cartTotalPrice.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Total</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#10B981' }}>{currencySymbol}{cartTotalPrice.toFixed(2)}</Text>
            </View>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Payment Method</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#BBF7D0', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="cash" size={22} color="#15803D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Cash at Pickup</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Pay when you collect your order</Text>
                </View>
                <View style={{ backgroundColor: '#15803D', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>ONLY</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleCheckout} disabled={checkingOut} style={[styles.primaryButton, { backgroundColor: checkingOut ? '#9CA3AF' : '#EA580C', paddingVertical: 18 }]}>
              {checkingOut ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Book Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
      <SharedBottomNav navigation={navigation} activeTab="Cart" cartTotalCount={cartTotalCount} />
    </SafeAreaView>
  );
}

// --- Bookings Screen ---
function BookingsScreen({ navigation }) {
  const { token, currencySymbol, user } = useContext(AuthContext);
  const { cartTotalCount } = useContext(CartContext);
  const { openChatWithStore, unreadStores, openReceipt } = useContext(ChatContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/orders/me`, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(res.data);
    } catch (e) {
      console.log("Error fetching orders:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderOrderItem = ({ item }) => {
    const imageUrl = item.store_image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&auto=format&fit=crop';
    const date = new Date(item.created_at).toLocaleDateString();
    return (
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>{date}</Text>
          <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 10, color: '#0369A1', fontWeight: '700' }}>{item.payment_method?.toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Image source={{ uri: imageUrl }} style={{ width: 60, height: 60, borderRadius: 12 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{item.store_name}</Text>
            <Text style={{ fontSize: 14, color: '#4B5563', marginTop: 2 }}>{item.quantity}x {item.item_name}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{item.type === 'bag' ? 'Surprise Bag' : 'Food Item'}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              const receiptData = {
                orderIds: [item.id],
                storeName: item.store_name,
                items: [{ name: item.item_name, quantity: item.quantity, price: item.price, type: item.type }],
                total: item.price * item.quantity,
                pickupTime: null,
                customerName: user?.name || null,
                dateTime: new Date(item.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                paymentMethod: item.payment_method || 'Cash at Pickup',
              };
              openReceipt(receiptData);
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA', gap: 6 }}
          >
            <Ionicons name="receipt-outline" size={15} color="#EA580C" />
            <Text style={{ color: '#EA580C', fontSize: 12, fontWeight: '700' }}>Download Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => openChatWithStore({ id: item.store_id, name: item.store_name })}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, position: 'relative', gap: 6 }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={15} color="#1D4ED8" />
            <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: '700' }}>Chat with Store</Text>
            {unreadStores && unreadStores[item.store_id] && (
              <View style={{ 
                position: 'absolute', 
                top: -3, 
                right: -3, 
                width: 8, 
                height: 8, 
                borderRadius: 4, 
                backgroundColor: '#EF4444' 
              }} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, backgroundColor: '#FFFFFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginLeft: 16 }}>Your Bookings</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#EA580C" /></View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="receipt-outline" size={80} color="#D1D5DB" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 }}>No bookings yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <SharedBottomNav navigation={navigation} activeTab="Bookings" cartTotalCount={cartTotalCount} />
    </SafeAreaView>
  );
}

// --- Seller Screens ---
const SELLER_BRAND = '#FF5A00';
const SELLER_NAV_ITEMS = (isAdmin) => [
  { key: 'stores', icon: 'storefront-outline', label: 'Stores' },
  { key: 'bags', icon: 'bag-handle-outline', label: 'Surprise Bags' },
  { key: 'food', icon: 'restaurant-outline', label: 'Open Food' },
  { key: 'orders', icon: 'receipt-outline', label: 'Orders' },
  { key: 'reviews', icon: 'star-outline', label: 'Reviews' },
  { key: 'chats', icon: 'chatbubbles-outline', label: 'Chat Support' },
  ...(isAdmin ? [{ key: 'staff', icon: 'people-outline', label: 'Staff' }] : []),
];

function SellerStatCard({ label, value }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' }}>
      <Text style={{ color: SELLER_BRAND, fontWeight: '800', fontSize: 18 }}>{value}</Text>
      <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function SellerEmptyState({ icon, title, subtitle }) {
  return (
    <View style={{ alignItems: 'center', padding: 48 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
        <Ionicons name={icon} size={34} color={SELLER_BRAND} />
      </View>
      <Text style={{ color: '#374151', fontWeight: '700', fontSize: 16 }}>{title}</Text>
      {subtitle ? <Text style={{ color: '#9CA3AF', marginTop: 6, fontSize: 14, textAlign: 'center' }}>{subtitle}</Text> : null}
    </View>
  );
}

function SellerDashboardScreen() {
  const { token, logout, user } = useContext(AuthContext);
  const [stores, setStores] = useState([]);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLat, setStoreLat] = useState(51.5074);
  const [storeLng, setStoreLng] = useState(-0.1278);

  const [bagStoreId, setBagStoreId] = useState(null);
  const [bagPrice, setBagPrice] = useState('');
  const [bagOriginalPrice, setBagOriginalPrice] = useState('');
  const [bagQuantity, setBagQuantity] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [bagDescription, setBagDescription] = useState('');
  const [bagImages, setBagImages] = useState([]);

  const [sellerBags, setSellerBags] = useState([]);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [editingBagId, setEditingBagId] = useState(null);
  const [storeImage, setStoreImage] = useState(null);

  // Food item state
  const [foodStoreId, setFoodStoreId] = useState(null);
  const [foodName, setFoodName] = useState('');
  const [foodDescription, setFoodDescription] = useState('');
  const [foodPrice, setFoodPrice] = useState('');
  const [foodOriginalPrice, setFoodOriginalPrice] = useState('');
  const [foodQuantity, setFoodQuantity] = useState('');
  const [foodCategory, setFoodCategory] = useState('Other');
  const [foodImages, setFoodImages] = useState([]);
  const [sellerFoodItems, setSellerFoodItems] = useState([]);
  const [editingFoodId, setEditingFoodId] = useState(null);

  const [stats, setStats] = useState({ totalRevenue: 0, bagsSold: 0, dailySales: [] });
  const [sellerOrders, setSellerOrders] = useState([]);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [sellerChats, setSellerChats] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [activeSellerChat, setActiveSellerChat] = useState(null);
  const [sellerChatMessages, setSellerChatMessages] = useState([]);
  const [sellerChatInput, setSellerChatInput] = useState('');
  const [showSellerChatModal, setShowSellerChatModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const sellerWsRef = useRef(null);
  const activeSellerChatRef = useRef(null);
  const sellerChatListRef = useRef(null);
  const storeMapRef = useRef(null);

  // Tab & menu state
  const [sellerTab, setSellerTab] = useState('stores');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showBagModal, setShowBagModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);

  const FOOD_CATEGORIES = ['Bakery', 'Meals', 'Drinks', 'Snacks', 'Desserts', 'Coffee & Tea', 'Sandwiches', 'Pizza', 'Other'];

  // Currency
  const { currencyCode, currencySymbol, changeCurrency, CURRENCIES } = useContext(AuthContext);

  // Structured pickup
  const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [pickupDays, setPickupDays] = useState([]);
  const [pickupFrom, setPickupFrom] = useState('18:00');
  const [pickupTo, setPickupTo] = useState('20:00');
  const buildPickupTime = (days, from, to) => days.length === 0 ? `${from} - ${to}` : `${days.join(', ')} ${from} - ${to}`;
  const togglePickupDay = (day) => {
    setPickupDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      setPickupTime(buildPickupTime(next, pickupFrom, pickupTo));
      return next;
    });
  };

  const fetchStores = async () => {
    try {
      const response = await axios.get(`${API_URL}/stores`, { headers: { Authorization: `Bearer ${token}` } });
      setStores(response.data);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        Alert.alert("Session Expired", "Please login again.");
        logout();
      } else {
        console.log("Error fetching stores:", e.message);
      }
    }
  };

  const fetchSellerBags = async () => {
    try {
      const response = await axios.get(`${API_URL}/bags?all=true`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerBags(response.data);
    } catch (e) {
      console.log("Error fetching seller bags:", e.message);
    }
  };

  const fetchSellerFoodItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/food-items?all=true`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerFoodItems(response.data);
    } catch (e) {
      console.log("Error fetching food items:", e.message);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const data = response.data || {};
      setStats({
        totalRevenue: Number(data.totalRevenue) || 0,
        bagsSold: Number(data.bagsSold) || 0,
        dailySales: data.dailySales || [],
      });
    } catch (e) {
      console.log("Error fetching stats:", e.message);
    }
  };

  const fetchSellerOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller/orders`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerOrders(response.data || []);
    } catch (e) {
      console.log("Error fetching seller orders:", e.message);
    }
  };

  const fetchSellerReviews = async () => {
    try {
      const response = await axios.get(`${API_URL}/reviews`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerReviews(response.data || []);
    } catch (e) {
      console.log("Error fetching reviews:", e.message);
    }
  };

  const fetchSellerChats = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller/chats`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerChats(response.data || []);
    } catch (e) {
      console.log("Error fetching seller chats:", e.message);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller/staff`, { headers: { Authorization: `Bearer ${token}` } });
      setStaffList(response.data || []);
    } catch (e) {
      console.log("Error fetching staff:", e.message);
    }
  };

  const refreshSellerTab = () => {
    fetchStats();
    if (sellerTab === 'stores') fetchStores();
    if (sellerTab === 'bags') fetchSellerBags();
    if (sellerTab === 'food') fetchSellerFoodItems();
    if (sellerTab === 'orders') fetchSellerOrders();
    if (sellerTab === 'reviews') fetchSellerReviews();
    if (sellerTab === 'chats') fetchSellerChats();
    if (sellerTab === 'staff') fetchStaff();
  };

  useEffect(() => {
    activeSellerChatRef.current = activeSellerChat;
  }, [activeSellerChat]);

  const connectSellerWs = () => {
    if (!token || (sellerWsRef.current && sellerWsRef.current.readyState === WebSocket.OPEN)) return;
    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'register', token }));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          const active = activeSellerChatRef.current;
          if (active && data.message.store_id === active.store_id && data.message.customer_id === active.customer_id) {
            setSellerChatMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          }
          fetchSellerChats();
        }
      } catch (_) {}
    };
    sellerWsRef.current = ws;
  };

  const openSellerChat = async (chat) => {
    setActiveSellerChat(chat);
    setShowSellerChatModal(true);
    setSellerChatMessages([]);
    connectSellerWs();
    try {
      await axios.post(`${API_URL}/chat/read`, { store_id: chat.store_id, customer_id: chat.customer_id }, { headers: { Authorization: `Bearer ${token}` } });
      const res = await axios.get(`${API_URL}/chat/history?store_id=${chat.store_id}&customer_id=${chat.customer_id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerChatMessages(res.data || []);
      fetchSellerChats();
    } catch (e) {
      Alert.alert('Error', 'Could not load chat history');
    }
  };

  const sendSellerChatMessage = () => {
    if (!sellerChatInput.trim() || !activeSellerChat) return;
    connectSellerWs();
    if (sellerWsRef.current?.readyState === WebSocket.OPEN) {
      sellerWsRef.current.send(JSON.stringify({
        type: 'message',
        storeId: activeSellerChat.store_id,
        customerId: activeSellerChat.customer_id,
        text: sellerChatInput.trim()
      }));
      setSellerChatInput('');
    } else {
      Alert.alert('Offline', 'Chat connection is not ready. Please try again.');
      connectSellerWs();
    }
  };

  const handleCreateStaff = async () => {
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      return Alert.alert('Required', 'Please fill in all staff fields.');
    }
    try {
      await axios.post(`${API_URL}/seller/staff`, { name: newStaffName.trim(), email: newStaffEmail.trim(), password: newStaffPassword }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Success', 'Staff member created');
      setNewStaffName(''); setNewStaffEmail(''); setNewStaffPassword('');
      setShowStaffModal(false);
      fetchStaff();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not create staff');
    }
  };

  const setStoreMapLocation = (lat, lng) => {
    setStoreLat(lat);
    setStoreLng(lng);
    storeMapRef.current?.animateToRegion?.({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 500);
  };

  const useCurrentStoreLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission needed', 'Location access is required to pin your store on the map.');
      const loc = await Location.getCurrentPositionAsync({});
      setStoreMapLocation(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      Alert.alert('Error', 'Could not get current location');
    }
  };

  useEffect(() => {
    fetchStores();
    fetchSellerBags();
    fetchSellerFoodItems();
    fetchStats();
    connectSellerWs();
    return () => { if (sellerWsRef.current) sellerWsRef.current.close(); };
  }, []);

  useEffect(() => {
    refreshSellerTab();
  }, [sellerTab]);

  useEffect(() => {
    if (!showSellerChatModal || !activeSellerChat) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/history?store_id=${activeSellerChat.store_id}&customer_id=${activeSellerChat.customer_id}`, { headers: { Authorization: `Bearer ${token}` } });
        setSellerChatMessages(res.data || []);
      } catch (_) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [showSellerChatModal, activeSellerChat, token]);

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.2,
      base64: true
    });

    if (!result.canceled) {
      const newImages = result.assets.map(a => `data:image/jpeg;base64,${a.base64}`);
      setBagImages([...bagImages, ...newImages]);
    }
  };

  const handleCreateStore = async () => {
    if (!storeName || !storeAddress) return Alert.alert("Error", "Please fill all store fields.");
    try {
      if (editingStoreId) {
        await axios.put(`${API_URL}/stores/${editingStoreId}`, { name: storeName, address: storeAddress, lat: storeLat, lng: storeLng, image: storeImage }, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Store updated successfully!");
        setEditingStoreId(null);
      } else {
        await axios.post(`${API_URL}/stores`, { name: storeName, address: storeAddress, lat: storeLat, lng: storeLng, image: storeImage }, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Store created successfully!");
      }
      setStoreName(''); setStoreAddress(''); setStoreImage(null); setStoreLat(51.5074); setStoreLng(-0.1278);
      setShowStoreModal(false);
      fetchStores();
      fetchStats();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const handleDeleteStore = (id) => {
    Alert.alert("Delete Store", "Are you sure? This deletes associated bags.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${API_URL}/stores/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchStores(); fetchSellerBags();
          } catch (e) { Alert.alert("Error", "Could not delete store"); }
        }
      }
    ]);
  };

  const handleCreateBag = async () => {
    if (!bagStoreId || !bagPrice || !bagQuantity || !pickupTime) return Alert.alert("Error", "Please fill required bag fields.");
    try {
      const payload = {
        store_id: bagStoreId,
        price: parseFloat(bagPrice),
        original_price: bagOriginalPrice ? parseFloat(bagOriginalPrice) : null,
        description: bagDescription,
        images: bagImages,
        quantity: parseInt(bagQuantity),
        pickup_time: pickupTime
      };

      if (editingBagId) {
        await axios.put(`${API_URL}/bags/${editingBagId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Surprise Bag updated successfully!");
        setEditingBagId(null);
      } else {
        await axios.post(`${API_URL}/bags`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Surprise Bag created successfully!");
      }

      setBagStoreId(null); setBagPrice(''); setBagOriginalPrice(''); setBagDescription(''); setBagImages([]); setBagQuantity(''); setPickupTime('');
      fetchSellerBags();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const handleDeleteBag = (id) => {
    Alert.alert("Delete Bag", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${API_URL}/bags/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchSellerBags();
          } catch (e) { Alert.alert("Error", "Could not delete bag"); }
        }
      }
    ]);
  };

  const handleCreateFoodItem = async () => {
    if (!foodStoreId || !foodName || !foodPrice || !foodQuantity) {
      return Alert.alert("Error", "Please fill in store, name, price and quantity.");
    }
    try {
      const payload = {
        store_id: foodStoreId,
        name: foodName,
        description: foodDescription,
        price: parseFloat(foodPrice),
        original_price: foodOriginalPrice ? parseFloat(foodOriginalPrice) : null,
        images: foodImages,
        quantity: parseInt(foodQuantity),
        category: foodCategory,
      };
      if (editingFoodId) {
        await axios.put(`${API_URL}/food-items/${editingFoodId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Food item updated!");
        setEditingFoodId(null);
      } else {
        await axios.post(`${API_URL}/food-items`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Food item created!");
      }
      setFoodStoreId(null); setFoodName(''); setFoodDescription(''); setFoodPrice(''); setFoodOriginalPrice(''); setFoodQuantity(''); setFoodCategory('Other'); setFoodImages([]);
      fetchSellerFoodItems();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const handleDeleteFoodItem = (id) => {
    Alert.alert("Delete Food Item", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${API_URL}/food-items/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchSellerFoodItems();
          } catch (e) { Alert.alert("Error", "Could not delete food item"); }
        }
      }
    ]);
  };

  const pickFoodImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.2,
      base64: true
    });
    if (!result.canceled) {
      setFoodImages([...foodImages, ...result.assets.map(a => `data:image/jpeg;base64,${a.base64}`)]);
    }
  };

  const navItems = SELLER_NAV_ITEMS(user?.role === 'SellersAdmin');
  const inventoryTab = ['stores', 'bags', 'food'].includes(sellerTab);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
            {user?.logo ? (
              <Image source={{ uri: user.logo }} style={{ width: 44, height: 44, borderRadius: 12 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="storefront" size={22} color={SELLER_BRAND} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{user?.name || 'Seller Portal'}</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{user?.email}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 1 }}>{user?.role === 'SellersAdmin' ? 'Seller Admin' : 'Seller Staff'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="menu" size={22} color={SELLER_BRAND} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Side drawer navigation */}
      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '82%', maxWidth: 320, backgroundColor: '#FFFFFF', paddingTop: 56, paddingHorizontal: 16 }}>
            <View style={{ paddingHorizontal: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Seller Menu</Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>{user?.email}</Text>
            </View>
            {navItems.map(item => (
              <TouchableOpacity
                key={item.key}
                onPress={() => { setSellerTab(item.key); setMenuOpen(false); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
                  backgroundColor: sellerTab === item.key ? '#FFF7ED' : 'transparent',
                }}>
                <Ionicons name={item.icon} size={20} color={sellerTab === item.key ? SELLER_BRAND : '#6B7280'} />
                <Text style={{ fontSize: 15, fontWeight: sellerTab === item.key ? '700' : '500', color: sellerTab === item.key ? SELLER_BRAND : '#374151', flex: 1 }}>{item.label}</Text>
                {sellerTab === item.key && <Ionicons name="chevron-forward" size={16} color={SELLER_BRAND} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => { setMenuOpen(false); logout(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#DC2626' }}>Logout</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Quick nav chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {navItems.map(item => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setSellerTab(item.key)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: sellerTab === item.key ? SELLER_BRAND : '#FFFFFF',
              borderWidth: 1, borderColor: sellerTab === item.key ? SELLER_BRAND : '#E5E7EB',
            }}>
            <Ionicons name={item.icon} size={16} color={sellerTab === item.key ? '#FFFFFF' : '#6B7280'} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: sellerTab === item.key ? '#FFFFFF' : '#6B7280' }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* KPI Strip */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
        <SellerStatCard label="Revenue" value={formatMoney(stats.totalRevenue, currencySymbol)} />
        <SellerStatCard label="Bags Sold" value={String(stats.bagsSold)} />
        <SellerStatCard label="Stores" value={String(stores.length)} />
      </View>

      {/* Currency Picker Row */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CURRENCIES.map(c => (
            <TouchableOpacity key={c.code} onPress={() => changeCurrency(c.code)}
              style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginRight: 6, borderWidth: 1, borderColor: currencyCode === c.code ? '#EA580C' : '#E5E7EB', backgroundColor: currencyCode === c.code ? '#FFF7ED' : '#F9FAFB' }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: currencyCode === c.code ? '#EA580C' : '#6B7280' }}>
                {c.symbol.trim()} {c.code}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── STORES TAB ── */}
      {sellerTab === 'stores' && (
        <FlatList
          data={stores}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="storefront-outline" title="No stores yet" subtitle="Tap + to add your first store location" />}
          renderItem={({ item: store }) => (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {store.image ? (
                  <Image source={{ uri: store.image }} style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0 }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <Ionicons name="storefront-outline" size={24} color={SELLER_BRAND} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{store.name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{store.address}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => { setStoreName(store.name); setStoreAddress(store.address); setStoreImage(store.image); setStoreLat(store.lat || 51.5074); setStoreLng(store.lng || -0.1278); setEditingStoreId(store.id); setShowStoreModal(true); }}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FFF7ED', borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ color: SELLER_BRAND, fontWeight: '700', fontSize: 13 }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteStore(store.id)}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FEE2E2', borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ── SURPRISE BAGS TAB ── */}
      {sellerTab === 'bags' && (
        <FlatList
          data={sellerBags}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="bag-handle-outline" title="No surprise bags yet" subtitle="Create your first surprise bag listing" />}
          renderItem={({ item: bag }) => (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{bag.store_name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>Pickup: {bag.pickup_time}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {bag.original_price ? (
                    <Text style={{ textDecorationLine: 'line-through', color: '#9CA3AF', fontSize: 12 }}>{formatMoney(bag.original_price, currencySymbol)}</Text>
                  ) : null}
                  <Text style={{ color: '#EA580C', fontWeight: '800', fontSize: 18 }}>{formatMoney(bag.price, currencySymbol)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#EA580C', fontWeight: '700', fontSize: 12 }}>{bag.quantity} left</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      let parsedImgs = [];
                      try {
                        parsedImgs = bag.images ? (typeof bag.images === 'string' ? JSON.parse(bag.images) : bag.images) : [];
                      } catch(e) {}
                      setBagStoreId(bag.store_id);
                      setBagPrice(bag.price.toString());
                      setBagOriginalPrice(bag.original_price?.toString() || '');
                      setBagQuantity(bag.quantity.toString());
                      setPickupTime(bag.pickup_time);
                      setBagDescription(bag.description || '');
                      setBagImages(parsedImgs);
                      const details = parsePickupTimeDetails(bag.pickup_time);
                      setPickupDays(details.days);
                      setPickupFrom(details.from);
                      setPickupTo(details.to);
                      setEditingBagId(bag.id);
                      setShowBagModal(true);
                    }}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#EEF2FF', borderRadius: 8 }}>
                    <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteBag(bag.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* ── OPEN FOOD TAB ── */}
      {sellerTab === 'food' && (
        <FlatList
          data={sellerFoodItems}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="restaurant-outline" title="No food items yet" subtitle="Add open food items to sell surplus stock" />}
          renderItem={({ item }) => (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{item.name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{item.store_name} · {item.category}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.original_price ? (
                    <Text style={{ textDecorationLine: 'line-through', color: '#9CA3AF', fontSize: 12 }}>{formatMoney(item.original_price, currencySymbol)}</Text>
                  ) : null}
                  <Text style={{ color: '#059669', fontWeight: '800', fontSize: 18 }}>{formatMoney(item.price, currencySymbol)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: '#059669', fontWeight: '700', fontSize: 11 }}>{item.quantity} left</Text>
                  </View>
                  <View style={{ backgroundColor: item.is_available ? '#D1FAE5' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: item.is_available ? '#065F46' : '#991B1B', fontWeight: '700', fontSize: 11 }}>{item.is_available ? 'Available' : 'Unavailable'}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      let parsedImgs = [];
                      try {
                        parsedImgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                      } catch(e) {}
                      setFoodStoreId(item.store_id);
                      setFoodName(item.name);
                      setFoodDescription(item.description || '');
                      setFoodPrice(item.price.toString());
                      setFoodOriginalPrice(item.original_price?.toString() || '');
                      setFoodQuantity(item.quantity.toString());
                      setFoodCategory(item.category || 'Other');
                      setFoodImages(parsedImgs);
                      setEditingFoodId(item.id);
                      setShowFoodModal(true);
                    }}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#ECFDF5', borderRadius: 8 }}>
                    <Text style={{ color: '#059669', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteFoodItem(item.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {sellerTab === 'orders' && (
        <FlatList
          data={sellerOrders}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="receipt-outline" title="No orders yet" subtitle="Customer orders will appear here" />}
          renderItem={({ item: order }) => (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: '#111827' }}>{order.item_name || 'Order Item'}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{order.store_name} · Ref #{order.id}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>{order.customer_name || order.customer_email || 'Customer'}</Text>
                </View>
                <Text style={{ color: SELLER_BRAND, fontWeight: '800', fontSize: 17 }}>{formatMoney(Number(order.price) * (order.quantity || 1), currencySymbol)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>Qty: {order.quantity || 1} · {order.payment_method || 'Cash at Pickup'}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{order.pickup_time || 'Pickup window TBC'}</Text>
              </View>
            </View>
          )}
        />
      )}

      {sellerTab === 'reviews' && (
        <FlatList
          data={sellerReviews}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="star-outline" title="No reviews yet" subtitle="Customer reviews will show here" />}
          renderItem={({ item: review }) => (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{review.customer_name || 'Customer'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="star" size={14} color={SELLER_BRAND} />
                  <Text style={{ color: SELLER_BRAND, fontWeight: '800' }}>{review.rating}</Text>
                </View>
              </View>
              <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{review.store_name}</Text>
              {review.comment ? <Text style={{ color: '#374151', fontSize: 14, marginTop: 8, lineHeight: 20 }}>{review.comment}</Text> : null}
            </View>
          )}
        />
      )}

      {sellerTab === 'chats' && (
        <FlatList
          data={sellerChats}
          keyExtractor={item => `${item.store_id}_${item.customer_id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="chatbubbles-outline" title="No conversations yet" subtitle="Customer chat messages will appear here" />}
          renderItem={({ item: chat }) => (
            <TouchableOpacity onPress={() => openSellerChat(chat)} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{chat.customer_name || chat.customer_email}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{chat.store_name}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 6 }} numberOfLines={2}>{chat.last_message || 'No messages yet'}</Text>
                </View>
                {chat.unread_count > 0 && (
                  <View style={{ backgroundColor: SELLER_BRAND, borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>{chat.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {sellerTab === 'staff' && user?.role === 'SellersAdmin' && (
        <FlatList
          data={staffList}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<SellerEmptyState icon="people-outline" title="No staff yet" subtitle="Add team members to help manage your stores" />}
          ListHeaderComponent={
            <TouchableOpacity onPress={() => setShowStaffModal(true)} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND, marginBottom: 16 }]}>
              <Text style={styles.primaryButtonText}>Add Staff Member</Text>
            </TouchableOpacity>
          }
          renderItem={({ item: staff }) => (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="person-outline" size={22} color={SELLER_BRAND} />
                </View>
                <View>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{staff.name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{staff.email}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* FAB Add Button */}
      {inventoryTab && (
      <TouchableOpacity
        onPress={() => {
          if (sellerTab === 'stores') { setEditingStoreId(null); setStoreName(''); setStoreAddress(''); setStoreImage(null); setStoreLat(51.5074); setStoreLng(-0.1278); setShowStoreModal(true); }
          else if (sellerTab === 'bags') { setEditingBagId(null); setBagStoreId(null); setBagPrice(''); setBagOriginalPrice(''); setBagQuantity(''); setPickupTime(''); setBagDescription(''); setBagImages([]); setShowBagModal(true); }
          else { setEditingFoodId(null); setFoodStoreId(null); setFoodName(''); setFoodDescription(''); setFoodPrice(''); setFoodOriginalPrice(''); setFoodQuantity(''); setFoodCategory('Other'); setFoodImages([]); setShowFoodModal(true); }
        }}
        style={{
          position: 'absolute', bottom: 30, right: 20,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: SELLER_BRAND,
          justifyContent: 'center', alignItems: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8
        }}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
      )}

      {/* ── STORE MODAL ── */}
      <Modal visible={showStoreModal} animationType="slide" transparent onRequestClose={() => setShowStoreModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{editingStoreId ? 'Edit Store' : 'Add New Store'}</Text>
              <TouchableOpacity onPress={() => setShowStoreModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Store Name *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="e.g. Green Grocer" placeholderTextColor="#9CA3AF" value={storeName} onChangeText={setStoreName} />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Address *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="e.g. 10 Oxford Street" placeholderTextColor="#9CA3AF" value={storeAddress} onChangeText={setStoreAddress} />

              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Store Location *</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>
                Pan the map, then tap where your store is — or drag the pin
              </Text>
              <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' }}>
                <MapView
                  ref={storeMapRef}
                  key={editingStoreId ? `store-map-${editingStoreId}` : 'store-map-new'}
                  style={{ height: 180, width: '100%' }}
                  initialRegion={{
                    latitude: storeLat,
                    longitude: storeLng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  onPress={(e) => {
                    setStoreMapLocation(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
                  }}
                >
                  <Marker
                    coordinate={{ latitude: storeLat, longitude: storeLng }}
                    draggable
                    onDragEnd={(e) => {
                      setStoreMapLocation(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
                    }}
                  />
                </MapView>
              </View>
              <TouchableOpacity onPress={useCurrentStoreLocation} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: '#FFF7ED', borderRadius: 10, marginBottom: 8 }}>
                <Ionicons name="locate-outline" size={18} color={SELLER_BRAND} />
                <Text style={{ color: SELLER_BRAND, fontWeight: '700', fontSize: 13 }}>Use Current Location</Text>
              </TouchableOpacity>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 14, textAlign: 'center' }}>
                {storeLat.toFixed(5)}, {storeLng.toFixed(5)}
              </Text>

              {storeImage ? (
                <View style={{ position: 'relative', width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                  <Image source={{ uri: storeImage }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <TouchableOpacity onPress={() => setStoreImage(null)} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={async () => { let r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.2, base64: true }); if (!r.canceled) setStoreImage(`data:image/jpeg;base64,${r.assets[0].base64}`); }} style={{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CA3AF' }}>
                  <Ionicons name="camera-outline" size={24} color="#6B7280" style={{ marginBottom: 4 }} />
                  <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 13 }}>Upload Store Image (Optional)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleCreateStore} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND }]}>
                <Text style={styles.primaryButtonText}>{editingStoreId ? 'Update Store' : 'Create Store'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── BAG MODAL ── */}
      <Modal visible={showBagModal} animationType="slide" transparent onRequestClose={() => setShowBagModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{editingBagId ? 'Edit Bag' : 'Add Surprise Bag'}</Text>
              <TouchableOpacity onPress={() => setShowBagModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Select Store *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {stores.map(store => (
                  <TouchableOpacity key={store.id} onPress={() => setBagStoreId(store.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: bagStoreId === store.id ? '#EA580C' : '#F3F4F6' }}>
                    <Text style={{ color: bagStoreId === store.id ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 13 }}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                 <View style={{ flex: 1 }}>
                   <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Original Price ({currencySymbol})</Text>
                   <TextInput style={styles.input} placeholder="10.00" placeholderTextColor="#9CA3AF" value={bagOriginalPrice} onChangeText={setBagOriginalPrice} keyboardType="numeric" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Sale Price ({currencySymbol}) *</Text>
                   <TextInput style={styles.input} placeholder="3.99" placeholderTextColor="#9CA3AF" value={bagPrice} onChangeText={setBagPrice} keyboardType="numeric" />
                 </View>
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Quantity *</Text>
                <TextInput style={styles.input} placeholder="5" placeholderTextColor="#9CA3AF" value={bagQuantity} onChangeText={setBagQuantity} keyboardType="numeric" />
              </View>
              {/* Pickup Day + Time Pickers */}
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 8, fontSize: 13 }}>Pickup Days (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {ALL_DAYS.map(day => (
                  <TouchableOpacity key={day} onPress={() => togglePickupDay(day)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, borderWidth: 1, borderColor: pickupDays.includes(day) ? '#EA580C' : '#D1D5DB', backgroundColor: pickupDays.includes(day) ? '#EA580C' : '#F9FAFB' }}>
                    <Text style={{ color: pickupDays.includes(day) ? '#FFFFFF' : '#6B7280', fontWeight: '700', fontSize: 12 }}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>From</Text>
                  <TextInput style={styles.input} placeholder="18:00" placeholderTextColor="#9CA3AF" value={pickupFrom}
                    onChangeText={v => { setPickupFrom(v); setPickupTime(buildPickupTime(pickupDays, v, pickupTo)); }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>To</Text>
                  <TextInput style={styles.input} placeholder="20:00" placeholderTextColor="#9CA3AF" value={pickupTo}
                    onChangeText={v => { setPickupTo(v); setPickupTime(buildPickupTime(pickupDays, pickupFrom, v)); }} />
                </View>
              </View>
              {pickupTime ? (
                <View style={{ backgroundColor: '#FFF7ED', borderRadius: 8, padding: 8, marginBottom: 14 }}>
                  <Text style={{ color: SELLER_BRAND, fontWeight: '700', fontSize: 12 }}>{pickupTime}</Text>
                </View>
              ) : <View style={{ marginBottom: 14 }} />}
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Description</Text>
              <TextInput style={[styles.input, { height: 70, marginBottom: 14 }]} placeholder="What might be inside..." placeholderTextColor="#9CA3AF" value={bagDescription} onChangeText={setBagDescription} multiline />
              <TouchableOpacity onPress={pickImages} style={{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CA3AF' }}>
                 <Ionicons name="images-outline" size={24} color="#6B7280" style={{ marginBottom: 4 }} />
                 <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 13 }}>Upload Images</Text>
               </TouchableOpacity>
               {bagImages.length > 0 ? (
                 <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                   {bagImages.map((img, idx) => (
                     <View key={idx} style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
                       <Image source={{ uri: img }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       <TouchableOpacity onPress={() => setBagImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                         <Ionicons name="close" size={12} color="white" />
                       </TouchableOpacity>
                     </View>
                   ))}
                 </View>
               ) : null}
              <TouchableOpacity onPress={() => { handleCreateBag(); setShowBagModal(false); }} style={[styles.primaryButton, { backgroundColor: '#EA580C' }]}>
                <Text style={styles.primaryButtonText}>{editingBagId ? 'Update Bag' : 'Create Bag'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── FOOD MODAL ── */}
      <Modal visible={showFoodModal} animationType="slide" transparent onRequestClose={() => setShowFoodModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{editingFoodId ? 'Edit Food Item' : 'Add Food Item'}</Text>
              <TouchableOpacity onPress={() => setShowFoodModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Select Store *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {stores.map(store => (
                  <TouchableOpacity key={store.id} onPress={() => setFoodStoreId(store.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: foodStoreId === store.id ? SELLER_BRAND : '#F3F4F6' }}>
                    <Text style={{ color: foodStoreId === store.id ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 13 }}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Item Name *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="e.g. Sourdough Loaf" placeholderTextColor="#9CA3AF" value={foodName} onChangeText={setFoodName} />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {FOOD_CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setFoodCategory(cat)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8, backgroundColor: foodCategory === cat ? SELLER_BRAND : '#F3F4F6' }}>
                    <Text style={{ color: foodCategory === cat ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 12 }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                 <View style={{ flex: 1 }}>
                   <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Original Price ({currencySymbol})</Text>
                   <TextInput style={styles.input} placeholder="8.00" placeholderTextColor="#9CA3AF" value={foodOriginalPrice} onChangeText={setFoodOriginalPrice} keyboardType="numeric" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Sale Price ({currencySymbol}) *</Text>
                   <TextInput style={styles.input} placeholder="3.50" placeholderTextColor="#9CA3AF" value={foodPrice} onChangeText={setFoodPrice} keyboardType="numeric" />
                 </View>
              </View>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Quantity *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="10" placeholderTextColor="#9CA3AF" value={foodQuantity} onChangeText={setFoodQuantity} keyboardType="numeric" />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Description</Text>
              <TextInput style={[styles.input, { height: 70, marginBottom: 14 }]} placeholder="Optional description..." placeholderTextColor="#9CA3AF" value={foodDescription} onChangeText={setFoodDescription} multiline />
              <TouchableOpacity onPress={pickFoodImages} style={{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#FED7AA' }}>
                 <Ionicons name="images-outline" size={24} color={SELLER_BRAND} style={{ marginBottom: 4 }} />
                 <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 13 }}>Upload Images (Optional)</Text>
               </TouchableOpacity>
               {foodImages.length > 0 ? (
                 <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                   {foodImages.map((img, idx) => (
                     <View key={idx} style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
                       <Image source={{ uri: img }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       <TouchableOpacity onPress={() => setFoodImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                         <Ionicons name="close" size={12} color="white" />
                       </TouchableOpacity>
                     </View>
                   ))}
                 </View>
               ) : null}
              <TouchableOpacity onPress={() => { handleCreateFoodItem(); setShowFoodModal(false); }} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND }]}>
                <Text style={styles.primaryButtonText}>{editingFoodId ? 'Update Item' : 'Create Item'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── SELLER CHAT MODAL ── */}
      <Modal visible={showSellerChatModal} animationType="slide" onRequestClose={() => setShowSellerChatModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <TouchableOpacity onPress={() => setShowSellerChatModal(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{activeSellerChat?.customer_name || activeSellerChat?.customer_email || 'Customer'}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{activeSellerChat?.store_name}</Text>
            </View>
          </View>
          <FlatList
            ref={sellerChatListRef}
            data={sellerChatMessages}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 12 }}
            onContentSizeChange={() => sellerChatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.sender_role === 'Seller';
              return (
                <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <View style={{
                    backgroundColor: isMe ? SELLER_BRAND : '#F3F4F6',
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18,
                    borderBottomRightRadius: isMe ? 2 : 18, borderBottomLeftRadius: isMe ? 18 : 2,
                  }}>
                    <Text style={{ color: isMe ? '#FFFFFF' : '#111827', fontSize: 15, lineHeight: 20 }}>{item.message}</Text>
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 10, alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 4, paddingHorizontal: 4 }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            <TextInput
              style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111827', maxHeight: 100 }}
              placeholder="Reply to customer..."
              placeholderTextColor="#9CA3AF"
              value={sellerChatInput}
              onChangeText={setSellerChatInput}
              multiline
            />
            <TouchableOpacity onPress={sendSellerChatMessage} style={{ marginLeft: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: SELLER_BRAND, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── STAFF MODAL ── */}
      <Modal visible={showStaffModal} animationType="slide" transparent onRequestClose={() => setShowStaffModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Add Staff Member</Text>
              <TouchableOpacity onPress={() => setShowStaffModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Full Name *</Text>
            <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="Jane Smith" placeholderTextColor="#9CA3AF" value={newStaffName} onChangeText={setNewStaffName} />
            <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Email *</Text>
            <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="jane@example.com" placeholderTextColor="#9CA3AF" value={newStaffEmail} onChangeText={setNewStaffEmail} keyboardType="email-address" autoCapitalize="none" />
            <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Password *</Text>
            <TextInput style={[styles.input, { marginBottom: 20 }]} placeholder="Minimum 6 characters" placeholderTextColor="#9CA3AF" value={newStaffPassword} onChangeText={setNewStaffPassword} secureTextEntry />
            <TouchableOpacity onPress={handleCreateStaff} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND }]}>
              <Text style={styles.primaryButtonText}>Create Staff Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Main App Component ---
export default function App() {
  const [state, setState] = useState({
    isLoading: true,
    isSignout: false,
    userToken: null,
    user: null,
  });

  const [cartItems, setCartItems] = useState([]);

  // Global Currency State
  const [currencyCode, setCurrencyCode] = useState('GBP');
  
  useEffect(() => {
    AsyncStorage.getItem('currencyCode').then(val => {
      if (val) setCurrencyCode(val);
    });
  }, []);

  const changeCurrency = async (code) => {
    setCurrencyCode(code);
    await AsyncStorage.setItem('currencyCode', code);
  };

  const CURRENCIES_LIST = CURRENCIES;
  const currencySymbol = currencySymbolFor(currencyCode);

  // Cart Functions
  const addToCart = (item, type) => {
    if (cartItems.length > 0 && item.tenant_id && cartItems[0].tenant_id && cartItems[0].tenant_id !== item.tenant_id) {
      Alert.alert(
        "Different Brand",
        "Your cart contains items from another brand. Clear your cart to shop from this brand.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Clear Cart & Add", onPress: () => {
            setCartItems([{ ...item, type, cart_quantity: 1 }]);
            Alert.alert("Success", "Item added to cart");
          }}
        ]
      );
      return;
    }

    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === type);
      if (existing) {
        if (existing.cart_quantity >= item.quantity) {
          Alert.alert("Limit Reached", "You cannot add more of this item.");
          return prev;
        }
        Alert.alert("Success", "Item quantity increased");
        return prev.map(i => i.id === item.id && i.type === type ? { ...i, cart_quantity: i.cart_quantity + 1 } : i);
      }
      Alert.alert("Success", "Item added to cart");
      return [...prev, { ...item, type, cart_quantity: 1 }];
    });
  };

  const updateQuantity = (id, type, delta) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.id === id && item.type === type) {
          const newQty = item.cart_quantity + delta;
          if (newQty > item.quantity) {
            Alert.alert("Max Quantity", "Cannot add more than available stock.");
            return item;
          }
          if (newQty <= 0) return null; // will be filtered out
          return { ...item, cart_quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (id, type) => {
    setCartItems(prev => prev.filter(i => !(i.id === id && i.type === type)));
  };

  const clearCart = () => setCartItems([]);

  const cartContext = React.useMemo(() => ({
    cartItems, addToCart, updateQuantity, removeFromCart, clearCart,
    cartTotalCount: cartItems.reduce((acc, item) => acc + item.cart_quantity, 0),
    cartTotalPrice: cartItems.reduce((acc, item) => acc + (item.price * item.cart_quantity), 0)
  }), [cartItems]);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let userToken;
      let user;
      try {
        userToken = await AsyncStorage.getItem('userToken');
        user = JSON.parse(await AsyncStorage.getItem('user'));
        if (userToken) {
          try {
            const res = await axios.get(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${userToken}` },
            });
            user = res.data;
            await AsyncStorage.setItem('user', JSON.stringify(user));
          } catch (_) {
            // Keep cached user if refresh fails
          }
        }
      } catch (e) {
        // Restoring token failed
      }
      setState({ ...state, isLoading: false, userToken, user });
    };

    bootstrapAsync();
  }, []);

  useEffect(() => {
    if (state.userToken) {
      registerForPushNotificationsAsync().then(pushToken => {
        if (pushToken) {
          axios.post(`${API_URL}/users/push-token`, { pushToken }, {
            headers: { Authorization: `Bearer ${state.userToken}` }
          }).catch(err => console.log('Error registering push token on backend:', err.message));
        }
      });
    }
  }, [state.userToken]);

  const authContext = React.useMemo(
    () => ({
      login: async (token, user) => {
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        setState({ ...state, isLoading: false, userToken: token, user });
      },
      logout: async () => {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('user');
        setState({ ...state, isLoading: false, userToken: null, user: null });
      },
      updateUser: async (updatedUser) => {
        // Merge with existing user to preserve fields like email
        const merged = { ...state.user, ...updatedUser };
        await AsyncStorage.setItem('user', JSON.stringify(merged));
        setState(prev => ({ ...prev, user: merged }));
      },
      token: state.userToken,
      user: state.user,
      currencyCode,
      currencySymbol,
      changeCurrency,
      CURRENCIES: CURRENCIES_LIST
    }),
    [state, currencyCode, currencySymbol, changeCurrency]
  );

  if (state.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={authContext}>
        <CartContext.Provider value={cartContext}>
          <ChatProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
                {state.userToken == null ? (
                // Auth Stack
                <>
                  <Stack.Screen name="Landing" component={LandingScreen} />
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="Register" component={RegisterScreen} />
                  <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                </>
              ) : state.user?.role === 'SellersAdmin' || state.user?.role === 'SellersStaff' ? (
                // Seller Stack
                <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
              ) : (
                // App Stack
                <>
                  <Stack.Screen name="Splash" component={SplashScreen} />
                  <Stack.Screen name="ExploreTenants" component={ExploreTenantsScreen} />
                  <Stack.Screen name="Discover" component={DiscoverScreen} />
                  <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
                  <Stack.Screen name="Cart" component={CartScreen} />
                  <Stack.Screen name="Bookings" component={BookingsScreen} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
          <GlobalToast />
          <GlobalChatModal />
          <GlobalReceiptModal />
        </ChatProvider>
      </CartContext.Provider>
    </AuthContext.Provider>
  </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerSubtitle: { fontSize: 15, color: '#6B7280', fontWeight: '500', marginTop: 10, marginBottom: 10 },
  authContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  input: {
    backgroundColor: '#F3F4F6',
    color: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#FF5A00',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FF5A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  logoutButton: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEE2E2', borderRadius: 20 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  storeName: { fontSize: 20, fontWeight: '700', color: '#111827', flex: 1 },
  priceTag: { backgroundColor: '#FF5A00', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  priceText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  address: { color: '#6B7280', fontSize: 14, marginBottom: 16, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pickupTime: { color: '#374151', fontSize: 14, fontWeight: '600' },
  quantity: { color: '#EF4444', fontSize: 14, fontWeight: '700' },

  // Landing Screen Cards
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    padding: 20,
    width: 180,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  glassCardImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginTop: -60,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  glassCardTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6, textAlign: 'center' },
  glassCardDesc: { fontSize: 12, color: '#4B5563', textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  glassCardFooter: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: 'auto' },
  glassCardPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  glassCardAdd: { backgroundColor: '#FFFFFF', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // New Grid System styles
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  iconText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
  gridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '47%',
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  gridImageContainer: { width: '100%', height: 110, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  gridImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gridTimeBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  gridFavoriteBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  gridTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  gridRating: { fontSize: 12, color: '#111827', fontWeight: '600', marginBottom: 8 },
  gridPriceTag: { backgroundColor: '#EA580C', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  gridPriceText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  gridNavBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },

  bottomNavContainer: { position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 40,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
  }
});
