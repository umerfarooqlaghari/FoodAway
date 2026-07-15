import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Alert, ScrollView, Image, Modal, Platform, Linking, Animated, TouchableWithoutFeedback, Switch } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    // Standalone Android builds crash natively if the Google Maps SDK initializes
    // without an API key in the manifest — only mount the real map when it's safe.
    const Constants = require('expo-constants').default;
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    const hasMapsKey = !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
    if (Platform.OS === 'ios' || isExpoGo || hasMapsKey) {
      const Maps = require('react-native-maps');
      MapView = Maps.default || Maps;
      Marker = Maps.Marker;
      Callout = Maps.Callout;
    }
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
import { NavigationContainer, DefaultTheme, useFocusEffect } from '@react-navigation/native';
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

// --- Subdomain Helpers ---
const slugifySubdomain = (input) => {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
};

const shortSubdomainFromName = (input) => {
  const slug = slugifySubdomain(input);
  if (!slug) return 'store';
  const first = slug.split('-')[0];
  if (first.length >= 2) return first;
  return slug;
};

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
  .hdr{background:linear-gradient(135deg,#E27A53,#C4623E);padding:36px 28px 32px;text-align:center;}
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
axios.defaults.headers.common['X-Grabengo-Client'] = 'mobile';

const {
  PRODUCT_CATEGORIES,
  BROWSE_PRODUCT_FILTERS,
  CATEGORY_COLORS,
  categoriesMatch,
} = require('./shared/productCategories');

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
        } else if (payload.type === 'order_status_update') {
          const statusOrder = payload.order;
          const isRejectedOrCancelled = statusOrder.status === 'rejected' || statusOrder.status === 'cancelled';
          playSoundAndHaptic(isRejectedOrCancelled ? 'medium' : 'success');
          setToastNotification({
            type: 'order_status_update',
            storeName: statusOrder.store_name,
            message: statusOrder.message,
          });
          triggerLocalPushNotification(
            statusOrder.title,
            statusOrder.message,
            { type: 'order_status', orderId: statusOrder.id }
          );
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

function GlobalProfileModal() {
  const { user, logout, updateUser, token, profileModalVisible, closeProfile } = useContext(AuthContext);
  return (
    <CustomerProfileSheet visible={!!profileModalVisible} onClose={closeProfile} user={user} logout={logout} updateUser={updateUser} token={token} />
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
  let badgeColor = '#E27A53';
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
  } else if (toastNotification.type === 'order_status_update') {
    gradientColors = ['#1D4ED8', '#1E3A8A'];
    iconName = 'information-circle';
    badgeColor = '#93C5FD';
    typeLabel = 'Order Update';
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
        <ScrollView
          ref={flatListRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          {chatMessages.map((item) => {
            const isMe = item.sender_role === 'Customer';
            return (
              <View key={item.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <View style={{
                  backgroundColor: isMe ? '#E27A53' : '#F3F4F6',
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
          })}
        </ScrollView>

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
              backgroundColor: chatInput.trim() ? '#E27A53' : '#E5E7EB',
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

  const { orderIds, storeName, items, total, pickupTime, customerName, dateTime, fulfillmentType, deliveryAddress, deliveryPhone, partnerDelivery } = receiptModalData;
  const isDeliveryReceipt = fulfillmentType === 'delivery';
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
            <LinearGradient colors={['#E27A53', '#C4623E']} style={{ paddingVertical: 36, paddingHorizontal: 28, alignItems: 'center' }}>
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
                    <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '700' }}>{isDeliveryReceipt ? 'Cash on Delivery' : 'Cash at Pickup'}</Text>
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
              {!isDeliveryReceipt && pickupTime && pickupTime !== 'N/A' ? (
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

              {/* Delivery */}
              {isDeliveryReceipt ? (
                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginTop: 18, borderWidth: 1, borderColor: '#BFDBFE' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: deliveryAddress ? 8 : 0 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="bicycle-outline" size={16} color="#1D4ED8" />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivery Order</Text>
                  </View>
                  {deliveryAddress ? <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{deliveryAddress}</Text> : null}
                  {deliveryPhone ? <Text style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{deliveryPhone}</Text> : null}
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 8, lineHeight: 15 }}>
                    {partnerDelivery
                      ? 'Delivered by a Grabengo Partner. Give the rider your 4-digit PIN from Bookings and pay the order total plus the delivery fee in cash.'
                      : 'Delivered by the store directly, not Grabengo. The store may call to confirm your order. Delivery charges, if any, are excluded from the total above.'}
                  </Text>
                </View>
              ) : null}

              {/* Show at branch banner */}
              <LinearGradient colors={['#1E293B', '#0F172A']} style={{ borderRadius: 18, padding: 22, marginTop: 22, alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(234,88,12,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: '#E27A53' }}>
                  <Ionicons name={isDeliveryReceipt ? "call-outline" : "phone-portrait-outline"} size={22} color="#E27A53" />
                </View>
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 5 }}>
                  {isDeliveryReceipt ? "The store will call to confirm" : "Show this receipt at the branch"}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center' }}>
                  {isDeliveryReceipt ? "Keep your phone nearby" : "Present to collect your rescued food order"}
                </Text>
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
            style={{ backgroundColor: generating ? '#9CA3AF' : '#E27A53', borderRadius: 16, paddingVertical: 17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#E27A53', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
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
const LANDING_ORANGE = '#E27A53';

function SupermarketPreviewIllustration({ width = 280, height = 210 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 480 360">
      <Rect width="480" height="360" rx="24" fill="#FFFFFF" />
      <Rect x="40" y="48" width="400" height="264" rx="16" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="2" />
      <Rect x="40" y="48" width="400" height="56" rx="16" fill={LANDING_ORANGE} />
      <Rect x="40" y="88" width="400" height="16" fill={LANDING_ORANGE} />
      <SvgText x="240" y="84" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="700">SUPERMARKET</SvgText>
      {[72, 196, 320].map((x) => (
        <React.Fragment key={x}>
          <Rect x={x} y="128" width="88" height="72" rx="8" fill="#FFFFFF" stroke={LANDING_ORANGE} strokeWidth="1.5" />
          <Rect x={x + 8} y="136" width="72" height="12" rx="3" fill={LANDING_ORANGE} opacity="0.85" />
          <Rect x={x + 8} y="154" width="56" height="8" rx="2" fill="#FDBA74" />
          <Rect x={x + 8} y="168" width="64" height="8" rx="2" fill="#FDBA74" />
          <Rect x={x + 8} y="182" width="48" height="8" rx="2" fill="#FDBA74" />
        </React.Fragment>
      ))}
      <Rect x="72" y="224" width="336" height="56" rx="10" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="1.5" />
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
  const [carouselTenants, setCarouselTenants] = useState([]);
  const scrollRef = React.useRef(null);
  const screenWidth = Dimensions.get('window').width;
  const illustrationWidth = screenWidth - 48;
  const illustrationHeight = illustrationWidth * (360 / 480);

  // Fetch active tenants for the brand carousel
  useEffect(() => {
    axios.get(`${API_URL}/public/tenants`)
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setCarouselTenants(res.data);
        }
      })
      .catch(() => {}); // silently ignore — static fallback stays visible
  }, []);

  // Auto-scroll the brands carousel
  useEffect(() => {
    const CARD_STEP = 156; // 140px card + 16px margin
    const singleSetWidth = Math.max(carouselTenants.length, 4) * CARD_STEP;
    let scrollPos = 0;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        scrollPos += 2;
        scrollRef.current.scrollTo({ x: scrollPos, animated: false });
        // Reset when we've scrolled one full copy of the list (seamless loop)
        if (scrollPos >= singleSetWidth) scrollPos = 0;
      }
    }, 50);
    return () => clearInterval(interval);
  }, [carouselTenants]);

  const renderHeader = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 }}>Grabengo</Text>
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
      <Text style={{ fontSize: 32, fontWeight: '800', color: '#E27A53', marginBottom: 60 }}>Grabengo Menu</Text>
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
            <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
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

          {/* Brands Carousel — live from active tenants */}
          <View style={{ marginTop: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 16, paddingLeft: 24 }}>Top Brands</Text>
            <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 24 }} scrollEnabled={false}>
              {/* Render list twice for seamless looping */}
              {(carouselTenants.length > 0 ? [...carouselTenants, ...carouselTenants] : []).map((tenant, idx) => (
                <View key={`${tenant.id}-${idx}`} style={{ width: 140, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1A1208', marginRight: 16, justifyContent: 'center', alignItems: 'center' }}>
                  {tenant.logo ? (
                    <Image source={{ uri: tenant.logo }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                  ) : (
                    <View style={{ width: '100%', height: '100%', backgroundColor: '#2D1F0E', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: LANDING_ORANGE, fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>
                        {tenantInitials(tenant.name)}
                      </Text>
                    </View>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', justifyContent: 'flex-end', padding: 12 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }} numberOfLines={1}>{tenant.name}</Text>
                    <Text style={{ color: '#D1D5DB', fontSize: 11 }}>
                      {tenant.store_count > 1 ? `${tenant.store_count} locations` : '1 location'}
                    </Text>
                  </LinearGradient>
                </View>
              ))}
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
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatSaleEnd = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
};

// Live "ending soon" countdown for Grabengo Deals — hh:mm:ss under an hour, else a date.
const formatDealCountdown = (value) => {
  if (!value) return null;
  const end = new Date(value).getTime();
  if (Number.isNaN(end)) return null;
  const msLeft = end - Date.now();
  if (msLeft <= 0) return 'Ended';
  const totalSeconds = Math.floor(msLeft / 1000);
  if (totalSeconds < 3600) {
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss} left`;
  }
  return `Ends ${formatSaleEnd(value)}`;
};

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
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 8, marginLeft: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
        <Ionicons name="arrow-back" size={20} color="#111827" />
      </TouchableOpacity>
      <View style={styles.authContainer}>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>Login as a customer or seller.</Text>

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
          <Text style={{ color: '#E27A53', fontWeight: '700', fontSize: 14 }}>Forgot Password?</Text>
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
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 8, marginLeft: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
        <Ionicons name="arrow-back" size={20} color="#111827" />
      </TouchableOpacity>
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
                borderColor: accountType === 'customer' ? '#E27A53' : '#E5E7EB',
                backgroundColor: accountType === 'customer' ? '#FFFFFF' : '#F9FAFB',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: accountType === 'customer' ? '#E27A53' : '#64748B' }}>Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAccountType('seller')}
              disabled={loading}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: accountType === 'seller' ? '#E27A53' : '#E5E7EB',
                backgroundColor: accountType === 'seller' ? '#FFFFFF' : '#F9FAFB',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: accountType === 'seller' ? '#E27A53' : '#64748B' }}>Seller</Text>
            </TouchableOpacity>
          </View>

          {accountType === 'customer' ? (
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} editable={!loading} />
          ) : (
            <>
              <TextInput style={styles.input} placeholder="Brand Name (e.g. KFC, Starbucks)" placeholderTextColor="#94a3b8" value={brandName} onChangeText={setBrandName} editable={!loading} />
              {brandName.trim().length > 0 && (
                <View style={{ marginBottom: 14, marginTop: -6, paddingHorizontal: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>
                    Your store link will be similar to:{' '}
                    <Text style={{ color: '#E27A53', fontWeight: '700' }}>
                      {`${shortSubdomainFromName(brandName)}.grabengo.store`}
                    </Text>
                  </Text>
                </View>
              )}
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
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 8, marginLeft: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
        <Ionicons name="arrow-back" size={20} color="#111827" />
      </TouchableOpacity>
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
        style={{ width: size, height: size, borderRadius: 14, resizeMode: 'contain', backgroundColor: '#FFFFFF' }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#E27A53', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.32 }}>{tenantInitials(tenant.name)}</Text>
    </View>
  );
}

function CustomerProfileSheet({ visible, onClose, user, logout, updateUser, token }) {
  const insets = useSafeAreaInsets();
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setEditName(user?.name || '');
      setEditEmail(user?.email || '');
      setEditPhone(user?.phone || '');
    }
  }, [visible, user?.name, user?.email, user?.phone]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!editName.trim()) return Alert.alert('Required', 'Please enter your name.');
    if (!editEmail.trim()) return Alert.alert('Required', 'Please enter your email.');
    if (!editPhone.trim()) return Alert.alert('Required', 'Please enter your phone number.');
    setSaving(true);
    try {
      await axios.put(`${API_URL}/users/${user.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await updateUser({ name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim() });
      Alert.alert('Saved', 'Profile updated.');
      onClose();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>My Profile</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
            />
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, marginTop: 16 }}>Email</Text>
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Your email"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, marginTop: 16 }}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Your phone number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#FEE2E2', borderRadius: 30 }}
              onPress={() => { onClose(); logout(); }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 16 }}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

function ExploreTenantsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, token, openProfile } = useContext(AuthContext);
  const { cartTotalCount } = useContext(CartContext);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState('Using your location');
  const [maxDistance, setMaxDistance] = useState(null);
  const [customDistanceMode, setCustomDistanceMode] = useState(false);
  const [customDistanceValue, setCustomDistanceValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchStores = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (place) {
            setLocationLabel([place.city, place.region].filter(Boolean).join(', ') || 'Near you');
          }
        } catch (_) {
          setLocationLabel('Near you');
        }
      } else {
        setCoords(null);
        setLocationLabel('Location off — enable for distance filters');
      }
    } catch (_) {
      setCoords(null);
      setLocationLabel('Location unavailable');
    }

    try {
      const res = await axios.get(`${API_URL}/stores`, { headers: { Authorization: `Bearer ${token}` } });
      if (!Array.isArray(res.data)) throw new Error(`Unexpected response from ${API_URL}`);
      setStores(res.data);
    } catch (e) {
      const message = e.response?.data?.error || e.message || 'Could not load stores. Check that the backend is running.';
      setLoadError(message);
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const storesWithDistance = stores.map((s) => {
    if (coords && s.lat && s.lng) {
      const meters = getDistance({ latitude: coords.lat, longitude: coords.lng }, { latitude: s.lat, longitude: s.lng });
      return { ...s, distance_km: meters / 1000 };
    }
    return { ...s, distance_km: null };
  });

  const filtered = storesWithDistance
    .filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (s.name || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q);
    })
    .filter((s) => {
      if (maxDistance == null || s.distance_km == null) return true;
      return s.distance_km <= maxDistance;
    })
    .filter((s) => {
      if (selectedCategory === 'All') return true;
      return s.category === selectedCategory;
    })
    .sort((a, b) => {
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
      return (a.name || '').localeCompare(b.name || '');
    });

  const avatarUri = user?.logo || `https://i.pravatar.cc/100?img=${user?.id || 12}`;
  const HOME_CATEGORY_TABS = [
    { key: 'All', label: 'All', icon: 'apps-outline' },
    ...STORE_CATEGORIES,
  ];
  const applyCustomDistance = () => {
    const n = parseFloat(customDistanceValue);
    if (!isNaN(n) && n > 0) {
      setMaxDistance(n);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginRight: 10 }}>
                <Image source={require('./assets/images/grabengo-logo.png')} style={{ width: 96, height: 28 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={1}>Hi, {user?.name?.split(' ')[0] || 'there'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={openProfile} style={{ marginRight: 10 }}>
              <Image source={{ uri: avatarUri }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#E27A53' }} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="menu" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Location row */}
          <TouchableOpacity onPress={fetchStores} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12 }}>
            <Ionicons name="location" size={20} color="#E27A53" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#E27A53', textTransform: 'uppercase' }}>Your location</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{locationLabel}</Text>
            </View>
            <Ionicons name="refresh" size={18} color="#E27A53" />
          </TouchableOpacity>

          {/* Search */}
          <View style={{ backgroundColor: '#F3F4F6', borderRadius: 30, paddingHorizontal: 18, paddingVertical: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search stores..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, fontSize: 15, color: '#111827' }}
            />
          </View>

          {/* Distance filters */}
          {coords && (
            <View style={{ marginTop: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => { setMaxDistance(null); setCustomDistanceMode(false); }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: maxDistance == null ? '#111827' : '#FFFFFF',
                    borderWidth: 1, borderColor: maxDistance == null ? '#111827' : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 12, color: maxDistance == null ? '#fff' : '#6B7280' }}>Any distance</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setMaxDistance(5); setCustomDistanceMode(false); }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: maxDistance === 5 ? '#111827' : '#FFFFFF',
                    borderWidth: 1, borderColor: maxDistance === 5 ? '#111827' : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 12, color: maxDistance === 5 ? '#fff' : '#6B7280' }}>Within 5 km</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setMaxDistance(10); setCustomDistanceMode(false); }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: maxDistance === 10 ? '#111827' : '#FFFFFF',
                    borderWidth: 1, borderColor: maxDistance === 10 ? '#111827' : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 12, color: maxDistance === 10 ? '#fff' : '#6B7280' }}>Within 10 km</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCustomDistanceMode(!customDistanceMode)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: customDistanceMode ? '#111827' : '#FFFFFF',
                    borderWidth: 1, borderColor: customDistanceMode ? '#111827' : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 12, color: customDistanceMode ? '#fff' : '#6B7280' }}>Custom</Text>
                </TouchableOpacity>
              </ScrollView>
              {customDistanceMode && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <TextInput
                    placeholder="Distance in km"
                    placeholderTextColor="#9CA3AF"
                    value={customDistanceValue}
                    onChangeText={setCustomDistanceValue}
                    keyboardType="numeric"
                    style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' }}
                  />
                  <TouchableOpacity onPress={applyCustomDistance} style={{ backgroundColor: '#E27A53', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Category tabs */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setSelectedCategory('All')}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
                backgroundColor: selectedCategory === 'All' ? '#E27A53' : '#FFFFFF',
                borderWidth: 1, borderColor: selectedCategory === 'All' ? '#E27A53' : '#E5E7EB',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: selectedCategory === 'All' ? '#fff' : '#111827' }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedCategory('Restaurants')}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
                backgroundColor: selectedCategory === 'Restaurants' ? '#E27A53' : '#FFFFFF',
                borderWidth: 1, borderColor: selectedCategory === 'Restaurants' ? '#E27A53' : '#E5E7EB',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: selectedCategory === 'Restaurants' ? '#fff' : '#111827' }}>Restaurants</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedCategory('Bakeries')}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
                backgroundColor: selectedCategory === 'Bakeries' ? '#E27A53' : '#FFFFFF',
                borderWidth: 1, borderColor: selectedCategory === 'Bakeries' ? '#E27A53' : '#E5E7EB',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: selectedCategory === 'Bakeries' ? '#fff' : '#111827' }}>Bakeries</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedCategory('Cafes')}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
                backgroundColor: selectedCategory === 'Cafes' ? '#E27A53' : '#FFFFFF',
                borderWidth: 1, borderColor: selectedCategory === 'Cafes' ? '#E27A53' : '#E5E7EB',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: selectedCategory === 'Cafes' ? '#fff' : '#111827' }}>Cafes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedCategory('Grocery Store')}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
                backgroundColor: selectedCategory === 'Grocery Store' ? '#E27A53' : '#FFFFFF',
                borderWidth: 1, borderColor: selectedCategory === 'Grocery Store' ? '#E27A53' : '#E5E7EB',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: selectedCategory === 'Grocery Store' ? '#fff' : '#111827' }}>Grocery Store</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>
            {selectedCategory === 'All' ? 'All Stores' : selectedCategory}
          </Text>
          <Text style={{ fontSize: 13, color: '#E27A53', fontWeight: '600' }}>{filtered.length} found</Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#E27A53" />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 40 }}>{loadError ? '⚠️' : '🏪'}</Text>
                <Text style={{ color: '#111827', marginTop: 8, fontWeight: '700', textAlign: 'center' }}>
                  {loadError ? 'Could not load stores' : 'No stores found'}
                </Text>
                <Text style={{ color: '#6B7280', marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                  {loadError ? `${loadError}\n\nAPI: ${API_URL}` : searchQuery.trim() ? 'Try a different search.' : selectedCategory !== 'All' ? `No ${selectedCategory.toLowerCase()} nearby yet.` : 'No active stores listed yet.'}
                </Text>
                {loadError ? (
                  <TouchableOpacity onPress={fetchStores} style={{ marginTop: 16, backgroundColor: '#E27A53', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              filtered.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('StoreDetails', {
                    store: item,
                    userLocation: coords ? { latitude: coords.lat, longitude: coords.lng } : null,
                  })}
                  style={{
                    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12,
                    flexDirection: 'row', alignItems: 'center',
                    borderWidth: 1, borderColor: '#F3F4F6',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
                  }}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={{ width: 56, height: 56, borderRadius: 14 }} />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: '#E27A53', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{(item.name || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{item.name}</Text>
                    {item.category ? (
                      <Text style={{ fontSize: 11, color: '#E27A53', fontWeight: '700', marginTop: 2 }}>{item.category}</Text>
                    ) : null}
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                      {item.address}
                      {item.distance_km != null ? ` · ${item.distance_km < 1 ? `${Math.round(item.distance_km * 1000)} m` : `${item.distance_km.toFixed(1)} km`}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <SharedBottomNav navigation={navigation} activeTab="Explore" cartTotalCount={cartTotalCount} />

      {/* Side menu */}
      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setMenuOpen(false)} />
          <View style={{ width: '78%', backgroundColor: '#FFFFFF', paddingTop: Math.max(insets.top, 20), paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 24 }}>Menu</Text>
            {[
              { icon: 'home-outline', label: 'Home', action: () => { setMenuOpen(false); navigation.navigate('ExploreTenants'); } },
              { icon: 'receipt-outline', label: 'My orders', action: () => { setMenuOpen(false); navigation.navigate('Bookings'); } },
              { icon: 'cart-outline', label: 'Cart', action: () => { setMenuOpen(false); navigation.navigate('Cart'); } },
              { icon: 'person-outline', label: 'Profile', action: () => { setMenuOpen(false); openProfile(); } },
            ].map((item) => (
              <TouchableOpacity key={item.label} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 14 }}>
                <Ionicons name={item.icon} size={22} color="#374151" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => { setMenuOpen(false); logout(); }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginTop: 12, gap: 14 }}
            >
              <Ionicons name="log-out-outline" size={22} color="#DC2626" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#DC2626' }}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('ExploreTenants');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="dark" />
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 22 }}>
        <Image source={require('./assets/images/grabengo-logo.png')} style={{ width: 220, height: 64 }} resizeMode="contain" />
      </View>
      <ActivityIndicator color="#E64A33" size="large" style={{ marginTop: 32 }} />
    </View>
  );
}

// --- Shared Bottom Nav ---
const SharedBottomNav = ({ navigation, activeTab, cartTotalCount }) => {
  const { openProfile } = useContext(AuthContext);
  const isHome = activeTab === 'Home' || activeTab === 'Explore';
  return (
    <View style={styles.bottomNavContainer}>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => !isHome && navigation.navigate('ExploreTenants')}>
          <View style={{ backgroundColor: isHome ? '#E27A53' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={isHome ? "home" : "home-outline"} size={isHome ? 20 : 24} color={isHome ? "white" : "#9CA3AF"} />
          </View>
          <Text style={{ color: isHome ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: isHome ? '700' : '600' }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => activeTab !== 'Bookings' && navigation.navigate('Bookings')}>
          <View style={{ backgroundColor: activeTab === 'Bookings' ? '#E27A53' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Bookings' ? "receipt" : "receipt-outline"} size={activeTab === 'Bookings' ? 20 : 24} color={activeTab === 'Bookings' ? "white" : "#9CA3AF"} />
          </View>
          <Text style={{ color: activeTab === 'Bookings' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Bookings' ? '700' : '600' }}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={openProfile}>
          <View style={{ backgroundColor: 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="person-outline" size={24} color="#9CA3AF" />
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '600' }}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => activeTab !== 'Cart' && navigation.navigate('Cart')}>
          <View style={{ backgroundColor: activeTab === 'Cart' ? '#E27A53' : 'transparent', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name={activeTab === 'Cart' ? "cart" : "cart-outline"} size={activeTab === 'Cart' ? 20 : 24} color={activeTab === 'Cart' ? "white" : "#9CA3AF"} />
            {cartTotalCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{cartTotalCount}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: activeTab === 'Cart' ? '#111827' : '#9CA3AF', fontSize: 12, fontWeight: activeTab === 'Cart' ? '700' : '600' }}>Cart</Text>
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
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
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
            <Ionicons name="location-outline" size={10} color="#E27A53" />
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
            <Ionicons name="cart-outline" size={15} color="#E27A53" />
          </TouchableOpacity>
        </View>
        {/* Bag type badge */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="bag-outline" size={10} color="#E27A53" />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#E27A53' }}>SURPRISE BAG</Text>
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

    const catColor = CATEGORY_COLORS[item.category] || '#F3F4F6';

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
            <Ionicons name="location-outline" size={10} color="#E27A53" />
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
            <Ionicons name="cart-outline" size={15} color="#E27A53" />
          </TouchableOpacity>
        </View>
        {/* Category badge */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: catColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#374151' }}>{item.category?.toUpperCase()}</Text>
        </View>
        <Text numberOfLines={1} style={styles.gridTitle}>{item.name}</Text>
        <Text numberOfLines={1} style={[styles.gridRating, { color: '#6B7280' }]}>{item.store_name}</Text>
        {item.sale_ends_at && new Date(item.sale_ends_at) > new Date() && (
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
            <Ionicons name="flash-outline" size={10} color="#E27A53" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#E27A53', marginLeft: 3 }}>Sale ends {formatSaleEnd(item.sale_ends_at)}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <View>
            <View style={styles.gridPriceTag}>
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
    const matchesCategory = categoriesMatch(productCategoryFilter, item.category);
    const matchesSearch = searchQuery
      ? item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesStore && matchesFavorite && matchesCategory && matchesSearch;
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
            backgroundColor: (selectedStoreId === null && !favoritesOnly) ? '#E27A53' : '#F3F4F6', 
            paddingHorizontal: 20, 
            paddingVertical: 10, 
            borderRadius: 24, 
            borderWidth: 1, 
            borderColor: (selectedStoreId === null && !favoritesOnly) ? '#E27A53' : '#E5E7EB'
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
      <View style={{ marginTop: 24, backgroundColor: '#E27A53', borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
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
          <Text style={{ fontSize: 13, color: '#E27A53', fontWeight: '600' }}>{filteredStores.length} available</Text>
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
                    borderColor: isSelected ? '#E27A53' : 'transparent',
                  }}
                >
                  <View style={{ position: 'relative' }}>
                    {store.image ? (
                      <Image source={{ uri: store.image }} style={{ width: '100%', height: 100, resizeMode: 'cover' }} />
                    ) : (
                      <View style={{ width: '100%', height: 100, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
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
                      <View style={{ backgroundColor: '#E27A53', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
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
            ? `${stores.find(s => s.id === selectedStoreId)?.name || 'Store'} ${activeTab === 'bags' ? 'Bags' : 'Products'}`
            : activeTab === 'bags' ? 'All Surprise Bags' : 'All Products'}
        </Text>
        <Text style={{ fontSize: 13, color: '#E27A53', fontWeight: '700', flexShrink: 0 }}>{activeCount} available</Text>
      </View>

      {activeCount === 0 && !loading && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 48 }}>{activeTab === 'bags' ? '🛍️' : '🛒'}</Text>
          <Text style={{ color: '#374151', fontSize: 16, fontWeight: '700', marginTop: 12 }}>
            {activeTab === 'bags' ? 'No Bags Available' : 'No Products Listed'}
          </Text>
          <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 6, textAlign: 'center' }}>
            {selectedStoreId ? 'Nothing here from this store yet.' : 'Check back later!'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Stable top bar: location + search ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ExploreTenants')}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
            >
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
            {selectedTenant?.name ? (
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', flex: 1 }} numberOfLines={1}>{selectedTenant.name}</Text>
            ) : null}
          </View>
          {/* Location row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="location" size={22} color="#E27A53" />
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
              <Image source={{ uri: avatarUri }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#E27A53' }} />
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
            <ActivityIndicator size="large" color="#E27A53" />
          </View>
        ) : (
          <>
            {/* Tab Toggle */}
            <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 4, backgroundColor: '#F3F4F6', borderRadius: 28, padding: 4 }}>
              <TouchableOpacity
                onPress={() => { setActiveTab('bags'); setProductCategoryFilter('All'); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center', backgroundColor: activeTab === 'bags' ? '#E27A53' : 'transparent' }}
              >
                <Text style={{ fontWeight: '700', fontSize: 14, color: activeTab === 'bags' ? 'white' : '#6B7280' }}>🎁 Surprise Bags</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('food')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center', backgroundColor: activeTab === 'food' ? '#E27A53' : 'transparent' }}
              >
                <Text style={{ fontWeight: '700', fontSize: 14, color: activeTab === 'food' ? 'white' : '#6B7280' }}>🛒 Products</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'food' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {BROWSE_PRODUCT_FILTERS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setProductCategoryFilter(cat)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: productCategoryFilter === cat ? '#111827' : '#FFFFFF',
                      borderWidth: 1, borderColor: productCategoryFilter === cat ? '#111827' : '#E5E7EB',
                    }}
                  >
                    <Text style={{ fontWeight: '600', fontSize: 12, color: productCategoryFilter === cat ? '#fff' : '#6B7280' }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <FlatList
              removeClippedSubviews={false}
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

      {/* Map Modal — enhanced with directions + nearest store */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {(() => {
            // Find the nearest store to the user
            const visibleStores = stores.filter(s => s.lat && s.lng);
            let nearestStore = null;
            let nearestDist = Infinity;
            if (userLocation) {
              visibleStores.forEach(s => {
                const d = Math.hypot(s.lat - userLocation.latitude, s.lng - userLocation.longitude);
                if (d < nearestDist) { nearestDist = d; nearestStore = s; }
              });
            }

            const openDirections = (store) => {
              if (!store?.lat || !store?.lng) return;
              const label = encodeURIComponent(store.name);
              const url = Platform.OS === 'ios'
                ? `maps://maps.apple.com/?daddr=${store.lat},${store.lng}&dirflg=d`
                : `google.navigation:q=${store.lat},${store.lng}`;
              Linking.canOpenURL(url).then(supported => {
                if (supported) {
                  Linking.openURL(url);
                } else {
                  // Fallback: Google Maps web
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}&destination_place_id=${label}`);
                }
              });
            };

            return (
              <>
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={userLocation ? {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  } : { latitude: 51.5074, longitude: -0.1278, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                  showsCompass={true}
                >
                  {visibleStores.map(store => {
                    const isNearest = nearestStore?.id === store.id;
                    return (
                      <Marker
                        key={store.id}
                        coordinate={{ latitude: store.lat, longitude: store.lng }}
                        pinColor={isNearest ? '#E27A53' : '#D4651A'}
                      >
                        <Callout tooltip onPress={() => openDirections(store)}>
                          <View style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 14,
                            padding: 14,
                            width: 220,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            elevation: 6,
                            borderWidth: isNearest ? 1.5 : 0,
                            borderColor: isNearest ? '#E27A53' : 'transparent',
                          }}>
                            {isNearest && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#E27A53', marginRight: 5 }} />
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#E27A53', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nearest to you</Text>
                              </View>
                            )}
                            <Text style={{ fontWeight: '800', fontSize: 14, color: '#111827', marginBottom: 3 }} numberOfLines={1}>{store.name}</Text>
                            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }} numberOfLines={2}>{store.address}</Text>
                            <View style={{
                              backgroundColor: '#E27A53',
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}>
                              <Ionicons name="navigate" size={13} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Get Directions</Text>
                            </View>
                          </View>
                        </Callout>
                      </Marker>
                    );
                  })}
                </MapView>

                {/* Header bar */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  paddingTop: Math.max(insets.top, 16),
                  paddingHorizontal: 16, paddingBottom: 12,
                  backgroundColor: 'rgba(255,255,255,0.96)',
                  flexDirection: 'row', alignItems: 'center',
                  borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
                }}>
                  <TouchableOpacity
                    onPress={() => setMapVisible(false)}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}
                  >
                    <Ionicons name="close" size={20} color="#111827" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>
                      Stores near you
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                      {visibleStores.length} location{visibleStores.length !== 1 ? 's' : ''} · tap a pin for directions
                    </Text>
                  </View>
                </View>

                {/* Navigate to nearest CTA */}
                {nearestStore && (
                  <TouchableOpacity
                    onPress={() => openDirections(nearestStore)}
                    style={{
                      position: 'absolute',
                      bottom: Math.max(insets.bottom, 24) + 8,
                      left: 20, right: 20,
                      backgroundColor: '#E27A53',
                      borderRadius: 16,
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      shadowColor: '#E27A53',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      elevation: 8,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="navigate" size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nearest store</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{nearestStore.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
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
                    <TouchableOpacity onPress={() => setAddReviewVisible(true)} style={{ backgroundColor: '#E27A53', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
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
                                <View key={tag} style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFEDD5' }}>
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
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: reviewStoreId === store.id ? '#E27A53' : '#F3F4F6' }}
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
                            backgroundColor: isSelected ? '#E27A53' : '#F3F4F6',
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
                    <Image source={{ uri: editAvatar || avatarUri }} style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#E27A53' }} />
                    <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E27A53', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' }}>
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
  const [menuItems, setMenuItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'reviews'
  const [isFavorited, setIsFavorited] = useState(store.is_favorited === 1);
  const [dealsTick, setDealsTick] = useState(0); // forces countdown re-render every second

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
      const [bagsRes, menuRes, reviewsRes] = await Promise.all([
        axios.get(`${API_URL}/bags?all=true`, { headers }),
        axios.get(`${API_URL}/stores/${store.id}/menu`, { headers }),
        axios.get(`${API_URL}/public/reviews?store_id=${store.id}&limit=50`)
      ]);
      setBags(bagsRes.data.filter(b => b.store_id === store.id));
      setMenuItems(menuRes.data.menuItems || []);
      setDeals(menuRes.data.deals || []);
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

  // Re-render every second so deal countdowns tick and expired deals drop off the list.
  useEffect(() => {
    const interval = setInterval(() => setDealsTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const liveDeals = deals.filter(d => !d.sale_ends_at || new Date(d.sale_ends_at).getTime() > Date.now());

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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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
            onPress={() => {
              if (!store.lat || !store.lng) {
                Alert.alert('Location unavailable', 'This store has no map location set.');
                return;
              }
              const label = encodeURIComponent(store.name || 'Store');
              const url = Platform.OS === 'ios'
                ? `maps:0,0?q=${label}@${store.lat},${store.lng}`
                : `geo:${store.lat},${store.lng}?q=${store.lat},${store.lng}(${label})`;
              Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`));
            }}
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
            <Ionicons name="map-outline" size={20} color="white" />
          </TouchableOpacity>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
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
            <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#E27A53', letterSpacing: 0.5 }}>MERCHANT PARTNER</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {store.delivery_enabled ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Ionicons name="bicycle-outline" size={13} color="#1D4ED8" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8' }}>Delivery Available</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="leaf" size={14} color="#10B981" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Eco Hero</Text>
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>{store.name}</Text>
          {store.delivery_enabled && store.delivery_fee_note ? (
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>🛵 {store.delivery_fee_note}</Text>
          ) : null}
          
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
                backgroundColor: '#E27A53', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#E27A53',
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
                backgroundColor: '#E27A53', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#E27A53',
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
                backgroundColor: '#E27A53', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#E27A53',
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
          {['menu', 'reviews'].map(tab => {
            const isActive = activeTab === tab;
            let iconName = '';
            let labelText = '';

            if (tab === 'menu') {
              iconName = isActive ? 'restaurant' : 'restaurant-outline';
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
                <Ionicons name={iconName} size={15} color={isActive ? '#E27A53' : '#64748B'} />
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: isActive ? '800' : '600', 
                  color: isActive ? '#E27A53' : '#64748B' 
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
            <ActivityIndicator size="small" color="#E27A53" />
          </View>
        ) : (
          <View style={{ paddingBottom: 10 }}>
            {/* MENU: Surprise Bags + Products, merged with section headers */}
            {activeTab === 'menu' && (
              <View>
                {bags.length === 0 && menuItems.length === 0 && liveDeals.length === 0 && (
                  <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>🍽️</Text>
                    <Text style={{ color: '#64748B', fontWeight: '600', textAlign: 'center' }}>Nothing listed by this store right now.</Text>
                  </View>
                )}

                {bags.length > 0 && (
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginHorizontal: 20, marginTop: 4, marginBottom: 4 }}>🎁 Surprise Bags</Text>
                )}
                {bags.length > 0 && (
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
                          shadowColor: '#E27A53',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          elevation: 3
                        }}>
                          <LinearGradient
                            colors={['#FF7E40', '#E27A53']}
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
                              <Text style={{ fontSize: 18, fontWeight: '900', color: '#E27A53' }}>{currencySymbol}{bag.price.toFixed(2)}</Text>
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
                          <View style={{ backgroundColor: '#FBE2DC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, color: '#E64A33', fontWeight: '800' }}>
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
                            backgroundColor: '#E27A53', 
                            paddingHorizontal: 16, 
                            paddingVertical: 8, 
                            borderRadius: 20,
                            shadowColor: '#E27A53',
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

                {liveDeals.length > 0 && (
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginHorizontal: 20, marginTop: 20, marginBottom: 4 }}>⚡ Grabengo Deals</Text>
                )}
                {liveDeals.length > 0 && (
                  liveDeals.map(item => (
                    <View key={`deal-${item.id}-${dealsTick}`} style={{
                      marginHorizontal: 20,
                      marginTop: 16,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 24,
                      padding: 16,
                      borderWidth: 1.5,
                      borderColor: '#FBE2DC',
                      shadowColor: '#E27A53',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      elevation: 3
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: 72, height: 72, borderRadius: 16, marginRight: 14,
                          position: 'relative', overflow: 'hidden',
                          shadowColor: '#E27A53', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3
                        }}>
                          <LinearGradient colors={['#FF7E40', '#E27A53']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="flash" size={32} color="white" />
                          </View>
                        </View>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E40AF', letterSpacing: 0.5 }}>{item.category?.toUpperCase()}</Text>
                              </View>
                              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>{item.name}</Text>
                              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                                {item.description || 'Discounted item, limited quantity.'}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: '#E27A53' }}>{currencySymbol}{item.price.toFixed(2)}</Text>
                              {item.original_price && (
                                <Text style={{ fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through', marginTop: 2, fontWeight: '600' }}>
                                  {currencySymbol}{item.original_price.toFixed(2)}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ backgroundColor: '#FBE2DC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, color: '#E64A33', fontWeight: '800' }}>
                              {item.quantity} left
                            </Text>
                          </View>
                          {item.sale_ends_at && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                              <Ionicons name="time-outline" size={11} color="#E27A53" />
                              <Text style={{ fontSize: 11, color: '#E27A53', fontWeight: '800', marginLeft: 3 }}>
                                {formatDealCountdown(item.sale_ends_at)}
                              </Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          onPress={() => addToCart(item, 'food')}
                          style={{
                            backgroundColor: '#E27A53', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                            shadowColor: '#E27A53', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                {menuItems.length > 0 && (
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginHorizontal: 20, marginTop: 20, marginBottom: 4 }}>🍽️ Full Menu</Text>
                )}
                {menuItems.length > 0 && (
                  menuItems.map(item => {
                    let gradColors = ['#F59E0B', '#D97706'];
                    let catIcon = 'cart';
                    if (item.category === 'Drinks' || item.category === 'Coffee & Tea') {
                      gradColors = ['#3B82F6', '#1D4ED8'];
                      catIcon = 'cafe';
                    } else if (item.category === 'Meals' || item.category === 'Fresh Food') {
                      gradColors = ['#10B981', '#059669'];
                      catIcon = 'restaurant';
                    } else if (item.category === 'Groceries' || item.category === 'Household' || item.category === 'Household & Cleaning' || item.category === 'Canned & Packaged') {
                      gradColors = ['#6366F1', '#4F46E5'];
                      catIcon = 'basket';
                    } else if (item.category === 'Personal Care' || item.category === 'Baby & Kids') {
                      gradColors = ['#EC4899', '#DB2777'];
                      catIcon = 'sparkles';
                    } else if (item.category === 'Frozen') {
                      gradColors = ['#0EA5E9', '#0284C7'];
                      catIcon = 'snow';
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
                                  {item.description || 'Freshly prepared menu item.'}
                                </Text>
                              </View>

                              {/* Price Column */}
                              <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#E27A53' }}>{currencySymbol}{item.price.toFixed(2)}</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

                        {/* Bottom row: CTA Add button */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => addToCart({ ...item, quantity: 9999 }, 'menu')}
                            style={{
                              backgroundColor: '#E27A53',
                              paddingHorizontal: 16,
                              paddingVertical: 8,
                              borderRadius: 20,
                              shadowColor: '#E27A53',
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
                    backgroundColor: '#E27A53',
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: 'center',
                    marginTop: 16,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                    shadowColor: '#E27A53',
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
                                  <View key={tag} style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFEDD5' }}>
                                    <Text style={{ color: '#E27A53', fontSize: 10, fontWeight: '700' }}>{tag}</Text>
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
            {/* Get Directions row */}
            <TouchableOpacity
              onPress={() => {
                const navUrl = Platform.OS === 'ios'
                  ? `maps://maps.apple.com/?daddr=${store.lat},${store.lng}&dirflg=d`
                  : `google.navigation:q=${store.lat},${store.lng}`;
                Linking.canOpenURL(navUrl).then(ok => {
                  if (ok) {
                    Linking.openURL(navUrl);
                  } else {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`);
                  }
                });
              }}
              style={{
                padding: 16,
                backgroundColor: '#FFFFFF',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Get Directions</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }} numberOfLines={1}>{store.address}</Text>
              </View>
              <View style={{
                backgroundColor: '#E27A53',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}>
                <Ionicons name="navigate" size={14} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Navigate</Text>
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
                        backgroundColor: isSelected ? '#E27A53' : '#F1F5F9', 
                        paddingHorizontal: 14, 
                        paddingVertical: 8, 
                        borderRadius: 20, 
                        borderWidth: 1, 
                        borderColor: isSelected ? '#E27A53' : '#E2E8F0' 
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
                  backgroundColor: '#E27A53', 
                  borderRadius: 24, 
                  paddingVertical: 14, 
                  alignItems: 'center', 
                  shadowColor: '#E27A53',
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
      <SharedBottomNav navigation={navigation} activeTab="StoreDetails" cartTotalCount={cartTotalCount} />
    </View>
  );
}

// --- Delivery Address Screen ---
function DeliveryAddressScreen({ navigation, route }) {
  const { user, token } = useContext(AuthContext);
  const { deliveryInfo, setDeliveryInfo } = useContext(CartContext);
  const insets = useSafeAreaInsets();
  const feeNotes = route.params?.feeNotes || [];
  const storeNames = route.params?.storeNames || [];
  const partnerDelivery = !!route.params?.partnerDelivery;
  const feeEstimate = route.params?.feeEstimate ?? null;

  const [address, setAddress] = useState(deliveryInfo.address || user?.delivery_address || '');
  const [phone, setPhone] = useState(deliveryInfo.phone || user?.phone || '');
  const [pin, setPin] = useState(deliveryInfo.lat != null ? { lat: deliveryInfo.lat, lng: deliveryInfo.lng } : null);
  const [pinning, setPinning] = useState(false);
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [saving, setSaving] = useState(false);

  const captureLocation = async () => {
    setPinning(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Allow location access so the rider can find your exact spot.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPin({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (_) {
      Alert.alert('Location unavailable', 'Could not get your location. Check GPS and try again.');
    } finally {
      setPinning(false);
    }
  };

  const handleContinue = async () => {
    if (!address.trim() || !phone.trim()) {
      Alert.alert("Required", "Please enter your delivery address and phone number.");
      return;
    }
    if (!pin) {
      Alert.alert("Pin your location", "Tap 'Pin my location' so the rider can navigate to you.");
      return;
    }
    setSaving(true);
    try {
      if (saveForFuture) {
        await axios.put(`${API_URL}/users/${user.id}`, { phone: phone.trim(), delivery_address: address.trim() }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setDeliveryInfo({ fulfillmentType: 'delivery', address: address.trim(), phone: phone.trim(), lat: pin.lat, lng: pin.lng });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Could not save delivery details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, backgroundColor: '#FFFFFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginLeft: 16 }}>Delivery Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {partnerDelivery ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FED7AA', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="bicycle" size={18} color="#E27A53" />
              <Text style={{ fontWeight: '800', fontSize: 13, color: '#E27A53' }}>Delivered by a Grabengo Partner</Text>
            </View>
            <Text style={{ fontSize: 12.5, color: '#374151', lineHeight: 18 }}>
              A Grabengo delivery partner will pick up your order and bring it to you. The delivery fee is based on distance{feeEstimate != null ? ` — estimated Rs${feeEstimate} for your pinned location` : ''} and is paid in cash along with your order. You'll get a 4-digit PIN to give the rider on arrival.
            </Text>
          </View>
        ) : (
        <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="information-circle" size={18} color="#1D4ED8" />
            <Text style={{ fontWeight: '800', fontSize: 13, color: '#1D4ED8' }}>Delivered by the store, not Grabengo</Text>
          </View>
          <Text style={{ fontSize: 12.5, color: '#374151', lineHeight: 18 }}>
            {(storeNames.length ? storeNames.join(', ') : 'The store')} will deliver this order themselves. Extra delivery charges may apply depending on the store — these are set and collected by the store directly, not included in your app total. The store may call you to confirm your order and any delivery cost.
          </Text>
          {feeNotes.length > 0 && (
            <View style={{ marginTop: 10, gap: 4 }}>
              {feeNotes.map((note, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Ionicons name="pricetag-outline" size={13} color="#1D4ED8" style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: '#1D4ED8', fontWeight: '600', flex: 1 }}>{note}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        )}

        <Text style={{ color: '#374151', fontWeight: '700', marginBottom: 6, fontSize: 13 }}>Pin Your Location *</Text>
        <TouchableOpacity
          onPress={captureLocation}
          disabled={pinning}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pin ? '#F0FDF4' : '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: pin ? '#86EFAC' : '#E27A53' }}
        >
          {pinning ? (
            <ActivityIndicator color="#E27A53" />
          ) : (
            <Ionicons name={pin ? 'checkmark-circle' : 'locate'} size={22} color={pin ? '#16A34A' : '#E27A53'} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: pin ? '#166534' : '#E27A53' }}>
              {pin ? 'Location pinned' : 'Pin my location'}
            </Text>
            <Text style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
              {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} — tap to re-pin` : 'The rider uses this exact spot to navigate to you'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={{ color: '#374151', fontWeight: '700', marginBottom: 6, fontSize: 13 }}>Delivery Address *</Text>
        <TextInput
          style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15, color: '#111827', height: 90, textAlignVertical: 'top' }}
          placeholder="House/flat number, street, area, city"
          placeholderTextColor="#9CA3AF"
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <Text style={{ color: '#374151', fontWeight: '700', marginBottom: 6, fontSize: 13 }}>Phone Number *</Text>
        <TextInput
          style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15, color: '#111827' }}
          placeholder="e.g. 03001234567"
          placeholderTextColor="#9CA3AF"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          onPress={() => setSaveForFuture(!saveForFuture)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24, paddingVertical: 4 }}
        >
          <Ionicons name={saveForFuture ? "checkbox" : "square-outline"} size={22} color={saveForFuture ? "#E27A53" : "#9CA3AF"} />
          <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>Save these details for future orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={saving}
          style={{ backgroundColor: saving ? '#9CA3AF' : '#E27A53', borderRadius: 16, paddingVertical: 17, alignItems: 'center' }}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>Confirm Delivery Details</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Cart Screen ---
function CartScreen({ navigation, route }) {
  const { cartItems, updateQuantity, removeFromCart, cartTotalPrice, cartTotalCount, clearCart, deliveryInfo, setDeliveryInfo } = useContext(CartContext);
  const { token, currencySymbol, user } = useContext(AuthContext);
  const { openReceipt } = useContext(ChatContext);
  const [checkingOut, setCheckingOut] = useState(false);
  const insets = useSafeAreaInsets();

  const isDelivery = deliveryInfo.fulfillmentType === 'delivery';
  const deliveryEligible = cartItems.length > 0 && cartItems.every(item => item.delivery_enabled);
  const feeNotes = [...new Set(cartItems.map(i => i.delivery_fee_note).filter(Boolean))];
  const storeNames = [...new Set(cartItems.map(i => i.store_name).filter(Boolean))];
  const partnerDelivery = deliveryEligible && cartItems.every(item => item.delivery_mode === 'partner');

  // Mirrors the backend fee formula (base Rs50 covers 5 road-km, Rs10/km beyond, x1.3 road factor).
  const estimateDeliveryFee = () => {
    if (!partnerDelivery || deliveryInfo.lat == null) return null;
    let maxFee = 0;
    const seen = new Set();
    for (const item of cartItems) {
      if (item.lat == null || seen.has(item.store_id)) continue;
      seen.add(item.store_id);
      const straightKm = getDistance(
        { latitude: deliveryInfo.lat, longitude: deliveryInfo.lng },
        { latitude: item.lat, longitude: item.lng }
      ) / 1000;
      const roadKm = straightKm * 1.3;
      const raw = roadKm <= 5 ? 50 : 50 + (roadKm - 5) * 10;
      maxFee += Math.max(50, Math.round(raw / 10) * 10);
    }
    return maxFee || null;
  };
  const deliveryFeeEstimate = estimateDeliveryFee();

  // If cart contents change such that delivery is no longer possible, fall back to pickup
  useEffect(() => {
    if (isDelivery && !deliveryEligible) {
      setDeliveryInfo(prev => ({ ...prev, fulfillmentType: 'pickup' }));
    }
  }, [isDelivery, deliveryEligible]);

  const goToDeliveryAddress = () => {
    navigation.navigate('DeliveryAddress', { feeNotes, storeNames, partnerDelivery, feeEstimate: deliveryFeeEstimate });
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (isDelivery && (!deliveryInfo.address?.trim() || !deliveryInfo.phone?.trim() || deliveryInfo.lat == null)) {
      Alert.alert("Delivery details needed", "Please add your delivery address, phone number and pin your location.", [
        { text: "Cancel", style: "cancel" },
        { text: "Add Details", onPress: goToDeliveryAddress },
      ]);
      return;
    }
    setCheckingOut(true);
    const cartSnapshot = cartItems.map(item => ({
      name: item.type === 'bag' ? (item.store_name + ' Surprise Bag') : item.name,
      quantity: item.cart_quantity,
      price: item.price,
      type: item.type,
    }));
    const storeName = cartItems[0]?.store_name || 'Store';
    const totalPrice = cartTotalPrice;
    const paymentMethodLabel = isDelivery ? 'Cash on Delivery' : 'Cash at Pickup';
    try {
      const payload = {
        items: cartItems.map(item => ({
          id: item.id,
          type: item.type,
          quantity: item.cart_quantity,
          price: item.price
        })),
        paymentMethod: paymentMethodLabel,
        fulfillmentType: isDelivery ? 'delivery' : 'pickup',
        ...(isDelivery ? { deliveryAddress: deliveryInfo.address.trim(), deliveryPhone: deliveryInfo.phone.trim(), deliveryLat: deliveryInfo.lat, deliveryLng: deliveryInfo.lng } : {}),
      };
      const response = await axios.post(`${API_URL}/orders`, payload, { headers: { Authorization: `Bearer ${token}` } });
      const receiptGroups = response.data?.receipt_groups || [];

      const finishUp = () => {
        clearCart();
        navigation.navigate('ExploreTenants');

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
              fulfillmentType: group.orders[0]?.fulfillment_type || (isDelivery ? 'delivery' : 'pickup'),
              deliveryAddress: group.orders[0]?.delivery_address || null,
              deliveryPhone: group.orders[0]?.delivery_phone || null,
              customerName: user?.name || null,
              dateTime: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              paymentMethod: paymentMethodLabel,
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
            fulfillmentType: isDelivery ? 'delivery' : 'pickup',
            deliveryAddress: isDelivery ? deliveryInfo.address : null,
            deliveryPhone: isDelivery ? deliveryInfo.phone : null,
            customerName: user?.name || null,
            dateTime: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            paymentMethod: paymentMethodLabel,
          });
        }
      };

      if (isDelivery) {
        Alert.alert(
          "Order Placed! 🛵",
          partnerDelivery
            ? `Once ${storeName} confirms, a Grabengo partner will pick up your order and deliver it to you. Your 4-digit delivery PIN is in Bookings — give it to the rider on arrival and pay the total plus the delivery fee in cash.`
            : `${storeName} will call you shortly to confirm your order and any delivery charges. Delivery cost is not included in the app total — pay it directly to the store.`,
          [{ text: "Got it", onPress: finishUp }]
        );
      } else {
        finishUp();
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
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.type === 'bag' ? 'Surprise Bag' : (item.category || 'Product')}</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24, backgroundColor: '#E27A53', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Start Browsing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ padding: 20, flexGrow: 1 }}>
              {cartItems.map((item) => (
                <View key={`${item.type}_${item.id}`}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>

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
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>How would you like to get this order?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setDeliveryInfo(prev => ({ ...prev, fulfillmentType: 'pickup' }))}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: !isDelivery ? '#E27A53' : '#E5E7EB', backgroundColor: !isDelivery ? '#FFFFFF' : '#F9FAFB' }}
                >
                  <Ionicons name="storefront-outline" size={16} color={!isDelivery ? '#E27A53' : '#6B7280'} />
                  <Text style={{ fontWeight: '700', fontSize: 13, color: !isDelivery ? '#E27A53' : '#6B7280' }}>Pickup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deliveryEligible && goToDeliveryAddress()}
                  disabled={!deliveryEligible}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: isDelivery ? '#E27A53' : '#E5E7EB', backgroundColor: isDelivery ? '#FFFFFF' : (deliveryEligible ? '#F9FAFB' : '#F3F4F6'), opacity: deliveryEligible ? 1 : 0.5 }}
                >
                  <Ionicons name="bicycle-outline" size={16} color={isDelivery ? '#E27A53' : '#6B7280'} />
                  <Text style={{ fontWeight: '700', fontSize: 13, color: isDelivery ? '#E27A53' : '#6B7280' }}>Delivery</Text>
                </TouchableOpacity>
              </View>
              {!deliveryEligible && (
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                  Delivery isn't offered by every store in your cart, so pickup is the only option right now.
                </Text>
              )}
            </View>

            {isDelivery && (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FED7AA' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#E27A53', textTransform: 'uppercase', letterSpacing: 0.5 }}>Deliver To</Text>
                    <Text style={{ fontSize: 13, color: '#111827', fontWeight: '600', marginTop: 4 }} numberOfLines={2}>{deliveryInfo.address || 'No address added'}</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{deliveryInfo.phone}</Text>
                  </View>
                  <TouchableOpacity onPress={goToDeliveryAddress}>
                    <Text style={{ color: '#E27A53', fontWeight: '700', fontSize: 12 }}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, lineHeight: 15 }}>
                  {partnerDelivery
                    ? `Delivered by a Grabengo Partner.${deliveryFeeEstimate != null ? ` Estimated delivery fee: Rs${deliveryFeeEstimate} —` : ''} pay cash to the rider along with your order total. You'll get a PIN to confirm delivery.`
                    : 'Delivered by the store, not Grabengo. Delivery charges (if any) are excluded from the total below — pay the store directly. They may call to confirm.'}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Payment Method</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#BBF7D0', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="cash" size={22} color="#15803D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>{isDelivery ? 'Cash on Delivery' : 'Cash at Pickup'}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{isDelivery ? 'Delivery cost excluded — pay the store directly' : 'Pay when you collect your order'}</Text>
                </View>
                <View style={{ backgroundColor: '#15803D', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>ONLY</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleCheckout} disabled={checkingOut} style={[styles.primaryButton, { backgroundColor: checkingOut ? '#9CA3AF' : '#E27A53', paddingVertical: 18 }]}>
              {checkingOut ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Book Now</Text>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
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

  useFocusEffect(
    React.useCallback(() => {
      fetchOrders();
    }, [])
  );

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
    const isDelivery = item.fulfillment_type === 'delivery';
    const CUSTOMER_STATUS_BADGES = {
      pending: isDelivery ? { label: 'AWAITING CONFIRMATION', bg: '#FEF3C7', color: '#92400E' } : null,
      confirmed: { label: 'CONFIRMED', bg: '#DBEAFE', color: '#1D4ED8' },
      rejected: { label: 'DELIVERY DECLINED', bg: '#FEE2E2', color: '#DC2626' },
      cancelled: { label: 'CANCELLED', bg: '#F3F4F6', color: '#6B7280' },
    };
    const statusBadge = CUSTOMER_STATUS_BADGES[item.status];
    return (
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>{date}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDelivery ? '#DBEAFE' : '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
              <Ionicons name={isDelivery ? "bicycle-outline" : "storefront-outline"} size={11} color={isDelivery ? '#1D4ED8' : '#374151'} />
              <Text style={{ fontSize: 10, color: isDelivery ? '#1D4ED8' : '#374151', fontWeight: '700' }}>{isDelivery ? 'DELIVERY' : 'PICKUP'}</Text>
            </View>
            {statusBadge && (
              <View style={{ backgroundColor: statusBadge.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, color: statusBadge.color, fontWeight: '700' }}>{statusBadge.label}</Text>
              </View>
            )}
            <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ fontSize: 10, color: '#0369A1', fontWeight: '700' }}>{item.payment_method?.toUpperCase()}</Text>
            </View>
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
        {isDelivery && (
          <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: '#1D4ED8', fontWeight: '700' }}>{item.delivery_address}</Text>
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{item.delivery_status ? 'Delivered by a Grabengo Partner · fee paid in cash to the rider' : 'Delivered by the store · delivery cost excluded from total above'}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              const receiptData = {
                orderIds: [item.id],
                storeName: item.store_name,
                items: [{ name: item.item_name, quantity: item.quantity, price: item.price, type: item.type }],
                total: item.price * item.quantity,
                pickupTime: null,
                fulfillmentType: item.fulfillment_type,
                deliveryAddress: item.delivery_address,
                deliveryPhone: item.delivery_phone,
                partnerDelivery: !!item.delivery_status,
                customerName: user?.name || null,
                dateTime: new Date(item.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                paymentMethod: item.payment_method || 'Cash at Pickup',
              };
              openReceipt(receiptData);
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA', gap: 6 }}
          >
            <Ionicons name="receipt-outline" size={15} color="#E27A53" />
            <Text style={{ color: '#E27A53', fontSize: 12, fontWeight: '700' }}>Download Receipt</Text>
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
        {item.delivery_status && !['cancelled'].includes(item.delivery_status) ? (
          <View style={{ marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FED7AA' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#E27A53', textTransform: 'uppercase' }}>Grabengo Partner Delivery</Text>
              {item.delivery_fee != null && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280' }}>Fee: {currencySymbol}{Number(item.delivery_fee).toFixed(0)}</Text>
              )}
            </View>
            <Text style={{ fontSize: 12.5, color: '#374151', marginTop: 4, lineHeight: 17 }}>
              {item.delivery_status === 'awaiting_confirmation' ? 'Waiting for the store to confirm your order.'
                : item.delivery_status === 'pending' ? 'Store confirmed — finding you a rider…'
                : item.delivery_status === 'assigned' ? `${item.partner_name || 'Your rider'} is heading to the store.`
                : item.delivery_status === 'picked_up' ? `${item.partner_name || 'Your rider'} is on the way to you!`
                : item.delivery_status === 'delivered' ? 'Delivered — enjoy your food!'
                : item.delivery_status === 'failed' ? 'Delivery could not be completed. The store will contact you.'
                : ''}
            </Text>
            {item.delivery_pin && ['awaiting_confirmation', 'pending', 'assigned', 'picked_up'].includes(item.delivery_status) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <View style={{ backgroundColor: '#E27A53', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 4 }}>{item.delivery_pin}</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#6B7280', flex: 1 }}>Give this PIN to the rider when your order arrives.</Text>
              </View>
            ) : null}
            {item.partner_phone && ['assigned', 'picked_up'].includes(item.delivery_status) ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.partner_phone}`)} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: '#E27A53', fontWeight: '700' }}>Call rider: {item.partner_phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ExploreTenants')}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}
        >
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', flex: 1 }}>Your Bookings</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#E27A53" /></View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="receipt-outline" size={80} color="#D1D5DB" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 }}>No bookings yet</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {orders.map((item) => (
            <View key={item.id.toString()}>
              {renderOrderItem({ item })}
            </View>
          ))}
        </ScrollView>
      )}
      <SharedBottomNav navigation={navigation} activeTab="Bookings" cartTotalCount={cartTotalCount} />
    </SafeAreaView>
  );
}

// --- Seller Screens ---
const SELLER_BRAND = '#E27A53';
const STORE_CATEGORIES = [
  { key: 'Restaurants', label: 'Restaurants', icon: '🍽️' },
  { key: 'Bakeries', label: 'Bakeries', icon: '🥐' },
  { key: 'Cafes', label: 'Cafes', icon: '☕' },
  { key: 'Grocery Store', label: 'Grocery Store', icon: '🛒' },
];
const SELLER_NAV_ITEMS = (isAdmin) => [
  { key: 'stores', icon: 'storefront-outline', label: 'Stores' },
  { key: 'menu', icon: 'restaurant-outline', label: 'Menu' },
  { key: 'bags', icon: 'bag-handle-outline', label: 'Surprise Bags' },
  { key: 'food', icon: 'flash-outline', label: 'Grabengo Deals' },
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
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
        <Ionicons name={icon} size={34} color={SELLER_BRAND} />
      </View>
      <Text style={{ color: '#374151', fontWeight: '700', fontSize: 16 }}>{title}</Text>
      {subtitle ? <Text style={{ color: '#9CA3AF', marginTop: 6, fontSize: 14, textAlign: 'center' }}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Grabengo Partner (rider) dashboard ──
function PartnerDashboardScreen() {
  const { user, token, logout } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [onDuty, setOnDuty] = useState(false);
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshingNow, setRefreshingNow] = useState(false);
  const [pinModal, setPinModal] = useState(null); // delivery id awaiting PIN entry
  const [pinInput, setPinInput] = useState('');

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const activeDelivery = mine.find(d => ['assigned', 'picked_up'].includes(d.status));

  const refresh = async (quiet = true) => {
    if (!quiet) setRefreshingNow(true);
    try {
      const [availRes, mineRes] = await Promise.all([
        axios.get(`${API_URL}/partner/deliveries/available`, authHeaders),
        axios.get(`${API_URL}/partner/deliveries/mine`, authHeaders),
      ]);
      setAvailable(Array.isArray(availRes.data) ? availRes.data : []);
      setMine(mineRes.data?.deliveries || []);
      setEarnings(mineRes.data?.earnings || 0);
    } catch (_) {} finally {
      setLoading(false);
      setRefreshingNow(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, []);

  const toggleDuty = async (next) => {
    setOnDuty(next);
    try {
      let lat = null, lng = null;
      if (next) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude; lng = loc.coords.longitude;
        }
      }
      await axios.patch(`${API_URL}/partner/duty`, { on_duty: next, lat, lng }, authHeaders);
    } catch (_) {
      setOnDuty(!next);
      Alert.alert('Error', 'Could not update duty status. Try again.');
    }
  };

  const acceptJob = async (d) => {
    try {
      await axios.post(`${API_URL}/partner/deliveries/${d.id}/accept`, {}, authHeaders);
      refresh();
    } catch (e) {
      Alert.alert('Not available', e.response?.data?.error || 'Could not accept this delivery.');
      refresh();
    }
  };

  const markPickedUp = async (d) => {
    try {
      await axios.patch(`${API_URL}/partner/deliveries/${d.id}/status`, { action: 'picked_up' }, authHeaders);
      refresh();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not update.');
    }
  };

  const submitDeliveredPin = async () => {
    try {
      await axios.patch(`${API_URL}/partner/deliveries/${pinModal}/status`, { action: 'delivered', pin: pinInput.trim() }, authHeaders);
      setPinModal(null); setPinInput('');
      Alert.alert('Delivered ✓', 'Great job! The delivery fee has been added to your earnings.');
      refresh();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not complete delivery.');
    }
  };

  const markFailed = (d) => {
    Alert.alert('Delivery failed?', 'Why could this delivery not be completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Customer unreachable', onPress: () => sendFailed(d, 'Customer unreachable') },
      { text: 'Wrong address', onPress: () => sendFailed(d, 'Wrong address') },
      { text: 'Customer refused', onPress: () => sendFailed(d, 'Customer refused order') },
    ]);
  };
  const sendFailed = async (d, reason) => {
    try {
      await axios.patch(`${API_URL}/partner/deliveries/${d.id}/status`, { action: 'failed', reason }, authHeaders);
      refresh();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not update.');
    }
  };

  const openMaps = (lat, lng) => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);

  const JobCard = ({ d, isActive }) => (
    <View style={[styles.card, { marginBottom: 12, borderWidth: isActive ? 2 : 0, borderColor: '#E27A53' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: '#111827' }}>{d.store_name}</Text>
          <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }} numberOfLines={2}>{d.store_address}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: '900', fontSize: 16, color: '#E27A53' }}>Rs{Number(d.fee).toFixed(0)}</Text>
          <Text style={{ fontSize: 10, color: '#9CA3AF' }}>your fee</Text>
        </View>
      </View>
      <View style={{ marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' }}>Deliver to</Text>
        <Text style={{ fontSize: 13, color: '#111827', fontWeight: '600', marginTop: 2 }} numberOfLines={2}>{d.address}</Text>
        <Text style={{ fontSize: 11.5, color: '#6B7280', marginTop: 4 }}>~{Number(d.distance_km).toFixed(1)} km · Collect Rs{Number(d.cod_amount).toFixed(0)} cash (order + fee)</Text>
        {d.prep_minutes ? <Text style={{ fontSize: 11.5, color: '#B45309', marginTop: 2 }}>Ready in ~{d.prep_minutes} min</Text> : null}
      </View>
      {d.items?.length ? (
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }} numberOfLines={2}>
          {d.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}
        </Text>
      ) : null}
      {!isActive ? (
        <TouchableOpacity onPress={() => acceptJob(d)} style={[styles.primaryButton, { backgroundColor: '#E27A53', marginTop: 12, paddingVertical: 13 }]}>
          <Text style={styles.primaryButtonText}>Accept Delivery</Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity onPress={() => openMaps(d.store_lat, d.store_lng)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, backgroundColor: '#EFF6FF', borderRadius: 10 }}>
              <Ionicons name="storefront-outline" size={14} color="#1D4ED8" />
              <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 12 }}>To Store</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openMaps(d.lat, d.lng)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, backgroundColor: '#EFF6FF', borderRadius: 10 }}>
              <Ionicons name="navigate-outline" size={14} color="#1D4ED8" />
              <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 12 }}>To Customer</Text>
            </TouchableOpacity>
            {d.customer_phone ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${d.customer_phone}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, backgroundColor: '#F0FDF4', borderRadius: 10 }}>
                <Ionicons name="call-outline" size={14} color="#15803D" />
                <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 12 }}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {d.status === 'assigned' ? (
              <TouchableOpacity onPress={() => markPickedUp(d)} style={[styles.primaryButton, { flex: 1, backgroundColor: '#E27A53', paddingVertical: 13 }]}>
                <Text style={styles.primaryButtonText}>Picked Up</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => { setPinModal(d.id); setPinInput(''); }} style={[styles.primaryButton, { flex: 1, backgroundColor: '#16A34A', paddingVertical: 13 }]}>
                <Text style={styles.primaryButtonText}>Delivered — Enter PIN</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => markFailed(d)} style={{ paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#FEE2E2', borderRadius: 30 }}>
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Problem</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{user?.name || 'Partner'}</Text>
          <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>Grabengo Delivery Partner</Text>
        </View>
        <View style={{ alignItems: 'center', marginRight: 12 }}>
          <Switch value={onDuty} onValueChange={toggleDuty} trackColor={{ false: '#E5E7EB', true: '#BBF7D0' }} thumbColor={onDuty ? '#16A34A' : '#F3F4F6'} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: onDuty ? '#16A34A' : '#9CA3AF', marginTop: 2 }}>{onDuty ? 'ON DUTY' : 'OFF DUTY'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#E27A53" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 20 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 14 }]}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#E27A53' }}>Rs{Number(earnings).toFixed(0)}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Total earnings</Text>
            </View>
            <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 14 }]}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827' }}>{mine.filter(d => d.status === 'delivered').length}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Deliveries done</Text>
            </View>
          </View>

          {activeDelivery ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10 }}>Current Delivery</Text>
              <JobCard d={activeDelivery} isActive />
            </>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>Available Jobs</Text>
            <TouchableOpacity onPress={() => refresh(false)}>
              {refreshingNow ? <ActivityIndicator size="small" color="#E27A53" /> : <Ionicons name="refresh" size={20} color="#E27A53" />}
            </TouchableOpacity>
          </View>
          {!onDuty ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
              <Ionicons name="moon-outline" size={32} color="#9CA3AF" />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginTop: 8, textAlign: 'center' }}>You're off duty. Go on duty to see and accept delivery jobs.</Text>
            </View>
          ) : available.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
              <Ionicons name="bicycle-outline" size={32} color="#9CA3AF" />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginTop: 8 }}>No jobs nearby right now</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>New jobs appear here automatically</Text>
            </View>
          ) : (
            available.map(d => <JobCard key={d.id} d={d} isActive={false} />)
          )}

          {mine.filter(d => !['assigned', 'picked_up'].includes(d.status)).length > 0 ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 16, marginBottom: 10 }}>History</Text>
              {mine.filter(d => !['assigned', 'picked_up'].includes(d.status)).map(d => (
                <View key={d.id} style={[styles.card, { marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: '#111827' }} numberOfLines={1}>{d.store_name}</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString()} · ~{Number(d.distance_km).toFixed(1)} km</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: d.status === 'delivered' ? '#16A34A' : '#DC2626' }}>
                      {d.status === 'delivered' ? `+Rs${Number(d.fee).toFixed(0)}` : d.status}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* PIN entry modal */}
      <Modal visible={pinModal != null} transparent animationType="fade" onRequestClose={() => setPinModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' }}>Enter Delivery PIN</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6 }}>Ask the customer for the 4-digit code in their booking.</Text>
            <TextInput
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={{ backgroundColor: '#FFFDF9', borderWidth: 2, borderColor: '#E27A53', borderRadius: 14, padding: 14, fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: 12, marginTop: 16, color: '#111827' }}
            />
            <TouchableOpacity onPress={submitDeliveredPin} disabled={pinInput.length !== 4} style={[styles.primaryButton, { backgroundColor: pinInput.length === 4 ? '#16A34A' : '#9CA3AF', marginTop: 16 }]}>
              <Text style={styles.primaryButtonText}>Confirm Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPinModal(null)} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: '#6B7280', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SellerDashboardScreen() {
  const { token, logout, user } = useContext(AuthContext);
  const [stores, setStores] = useState([]);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLat, setStoreLat] = useState(51.5074);
  const [storeLng, setStoreLng] = useState(-0.1278);
  const [storeDeliveryEnabled, setStoreDeliveryEnabled] = useState(false);
  const [storeDeliveryMode, setStoreDeliveryMode] = useState('self');
  const [storeDeliveryFeeNote, setStoreDeliveryFeeNote] = useState('');
  const [storeCategory, setStoreCategory] = useState(null);

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

  // Deal state (a deal = a menu item listed at a discount for a limited quantity/time)
  const [foodStoreId, setFoodStoreId] = useState(null);
  const [foodMenuItemId, setFoodMenuItemId] = useState(null);
  const [foodPrice, setFoodPrice] = useState(''); // sale price
  const [foodQuantity, setFoodQuantity] = useState('');
  const [foodStartsAt, setFoodStartsAt] = useState(null); // Date | null (null = starts immediately)
  const [foodStartPicker, setFoodStartPicker] = useState(null);
  const [foodSaleEndsAt, setFoodSaleEndsAt] = useState(null); // Date | null
  const [foodSalePicker, setFoodSalePicker] = useState(null); // 'date' | 'time' (Android steps) | 'datetime' (iOS) | null
  const [sellerFoodItems, setSellerFoodItems] = useState([]);
  const [editingFoodId, setEditingFoodId] = useState(null);

  // Menu item state (persistent, always-orderable vendor catalog)
  const [sellerMenuItems, setSellerMenuItems] = useState([]);
  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [menuItemStoreId, setMenuItemStoreId] = useState(null);
  const [menuItemName, setMenuItemName] = useState('');
  const [menuItemDescription, setMenuItemDescription] = useState('');
  const [menuItemCategory, setMenuItemCategory] = useState('Other');
  const [menuItemCustomCategory, setMenuItemCustomCategory] = useState('');
  const [menuItemPrice, setMenuItemPrice] = useState('');
  const [menuItemImage, setMenuItemImage] = useState(null);
  const [editingMenuItemId, setEditingMenuItemId] = useState(null);

  const defaultSaleEnd = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  };
  const onSaleEndPicked = (_event, date) => {
    if (!date) return;
    if (Platform.OS === 'android' && foodSalePicker === 'date') {
      // Date chosen; keep previous (or default) time and ask for the time next
      const next = new Date(date);
      const base = foodSaleEndsAt || defaultSaleEnd();
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setFoodSaleEndsAt(next);
      setFoodSalePicker('time');
      return;
    }
    if (Platform.OS === 'android') setFoodSalePicker(null);
    setFoodSaleEndsAt(prev => {
      const next = new Date(prev || date);
      if (foodSalePicker === 'time') next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      else return new Date(date);
      return next;
    });
  };

  const onSaleStartPicked = (_event, date) => {
    if (!date) return;
    if (Platform.OS === 'android' && foodStartPicker === 'date') {
      const next = new Date(date);
      const base = foodStartsAt || new Date();
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setFoodStartsAt(next);
      setFoodStartPicker('time');
      return;
    }
    if (Platform.OS === 'android') setFoodStartPicker(null);
    setFoodStartsAt(prev => {
      const next = new Date(prev || date);
      if (foodStartPicker === 'time') next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      else return new Date(date);
      return next;
    });
  };

  const [stats, setStats] = useState({ totalRevenue: 0, bagsSold: 0, productsSold: 0, dailySales: [] });
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

  const FOOD_CATEGORIES = PRODUCT_CATEGORIES;

  // Currency
  const { currencyCode, currencySymbol, changeCurrency, CURRENCIES } = useContext(AuthContext);

  // Structured pickup
  const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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

  const fetchSellerMenuItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller/menu-items`, { headers: { Authorization: `Bearer ${token}` } });
      setSellerMenuItems(response.data);
    } catch (e) {
      console.log("Error fetching menu items:", e.message);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const data = response.data || {};
      setStats({
        totalRevenue: Number(data.totalRevenue) || 0,
        bagsSold: Number(data.bagsSold) || 0,
        productsSold: Number(data.productsSold) || 0,
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

  const runOrderAction = async (orderId, action) => {
    try {
      await axios.patch(`${API_URL}/seller/orders/${orderId}/status`, { action }, { headers: { Authorization: `Bearer ${token}` } });
      fetchSellerOrders();
      fetchStats();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Could not update this order.");
    }
  };

  const ORDER_ACTION_CONFIRMATIONS = {
    reject: { title: "Reject Delivery?", message: "The customer will be notified that this delivery was declined. Stock will be restored." },
    convert_to_pickup: { title: "Convert to Pickup?", message: "The customer will be notified they now need to pick up this order themselves." },
    cancel: { title: "Cancel Order?", message: "The customer will be notified. Stock will be restored to your inventory." },
  };

  const handleOrderAction = (orderId, action) => {
    const confirmCopy = ORDER_ACTION_CONFIRMATIONS[action];
    if (confirmCopy) {
      Alert.alert(confirmCopy.title, confirmCopy.message, [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Continue", style: "destructive", onPress: () => runOrderAction(orderId, action) },
      ]);
    } else {
      runOrderAction(orderId, action);
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
    if (sellerTab === 'food' || sellerTab === 'menu') fetchSellerMenuItems();
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
    fetchSellerMenuItems();
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
    if (!storeCategory) return Alert.alert("Category Required", "Please select what kind of store this is.");
    try {
      if (editingStoreId) {
        await axios.put(`${API_URL}/stores/${editingStoreId}`, { name: storeName, address: storeAddress, lat: storeLat, lng: storeLng, image: storeImage, delivery_enabled: storeDeliveryEnabled, delivery_mode: storeDeliveryEnabled ? storeDeliveryMode : null, delivery_fee_note: storeDeliveryFeeNote.trim() || null, category: storeCategory }, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Store updated successfully!");
        setEditingStoreId(null);
      } else {
        await axios.post(`${API_URL}/stores`, { name: storeName, address: storeAddress, lat: storeLat, lng: storeLng, image: storeImage, delivery_enabled: storeDeliveryEnabled, delivery_mode: storeDeliveryEnabled ? storeDeliveryMode : null, delivery_fee_note: storeDeliveryFeeNote.trim() || null, category: storeCategory }, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Store created successfully!");
      }
      setStoreName(''); setStoreAddress(''); setStoreImage(null); setStoreLat(51.5074); setStoreLng(-0.1278); setStoreDeliveryEnabled(false); setStoreDeliveryMode('self'); setStoreDeliveryFeeNote(''); setStoreCategory(null);
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

  const handleToggleStoreDelivery = async (store, nextValue) => {
    setStores(prev => prev.map(s => s.id === store.id ? { ...s, delivery_enabled: nextValue } : s));
    try {
      await axios.put(`${API_URL}/stores/${store.id}`, { delivery_enabled: nextValue }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      setStores(prev => prev.map(s => s.id === store.id ? { ...s, delivery_enabled: !nextValue } : s));
      Alert.alert("Error", e.response?.data?.error || "Could not update delivery setting");
    }
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

  const resetFoodForm = () => {
    setEditingFoodId(null); setFoodStoreId(null); setFoodMenuItemId(null); setFoodPrice(''); setFoodQuantity('');
    setFoodStartsAt(null); setFoodStartPicker(null); setFoodSaleEndsAt(null); setFoodSalePicker(null);
  };

  const handleCreateFoodItem = async () => {
    if (editingFoodId) {
      // Editing an existing deal: adjust price/quantity/timing only, the menu item it's tied to doesn't change.
      if (!foodPrice || !foodQuantity) return Alert.alert("Error", "Please fill in price and quantity.");
      try {
        await axios.put(`${API_URL}/food-items/${editingFoodId}`, {
          price: parseFloat(foodPrice),
          quantity: parseInt(foodQuantity),
          starts_at: foodStartsAt ? foodStartsAt.toISOString() : null,
          sale_ends_at: foodSaleEndsAt ? foodSaleEndsAt.toISOString() : null,
        }, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Deal updated!");
        resetFoodForm();
        fetchSellerFoodItems();
      } catch (e) {
        Alert.alert("Error", e.response?.data?.error || e.message);
      }
      return;
    }
    if (!foodStoreId || !foodMenuItemId || !foodPrice || !foodQuantity) {
      return Alert.alert("Error", "Please select a store, a menu item, and fill in sale price and quantity.");
    }
    try {
      await axios.post(`${API_URL}/food-items`, {
        menu_item_id: foodMenuItemId,
        price: parseFloat(foodPrice),
        quantity: parseInt(foodQuantity),
        starts_at: foodStartsAt ? foodStartsAt.toISOString() : null,
        sale_ends_at: foodSaleEndsAt ? foodSaleEndsAt.toISOString() : null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert("Success", "Deal created!");
      resetFoodForm();
      fetchSellerFoodItems();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const handleDeleteFoodItem = (id) => {
    Alert.alert("Delete Deal", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${API_URL}/food-items/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchSellerFoodItems();
          } catch (e) { Alert.alert("Error", "Could not delete deal"); }
        }
      }
    ]);
  };

  const handleEndSaleEarly = (id) => {
    Alert.alert("End Sale Now?", "This deal will stop showing to customers immediately.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Sale", style: "destructive", onPress: async () => {
          try {
            await axios.patch(`${API_URL}/food-items/${id}/end-sale`, {}, { headers: { Authorization: `Bearer ${token}` } });
            fetchSellerFoodItems();
          } catch (e) { Alert.alert("Error", "Could not end sale"); }
        }
      }
    ]);
  };

  // ── Menu items (persistent catalog) ──
  const resetMenuItemForm = () => {
    setEditingMenuItemId(null); setMenuItemStoreId(null); setMenuItemName(''); setMenuItemDescription('');
    setMenuItemCategory('Other'); setMenuItemCustomCategory(''); setMenuItemPrice(''); setMenuItemImage(null);
  };

  const handleSaveMenuItem = async () => {
    if (!menuItemStoreId || !menuItemName.trim() || !menuItemPrice) {
      return Alert.alert("Error", "Please fill in store, name and price.");
    }
    const category = menuItemCategory === 'Custom' ? (menuItemCustomCategory.trim() || 'Other') : menuItemCategory;
    try {
      const payload = {
        store_id: menuItemStoreId,
        name: menuItemName.trim(),
        description: menuItemDescription,
        category,
        price: parseFloat(menuItemPrice),
        image: menuItemImage,
      };
      if (editingMenuItemId) {
        await axios.put(`${API_URL}/seller/menu-items/${editingMenuItemId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Menu item updated!");
      } else {
        await axios.post(`${API_URL}/seller/menu-items`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Alert.alert("Success", "Menu item added!");
      }
      resetMenuItemForm();
      fetchSellerMenuItems();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const handleDeleteMenuItem = (id) => {
    Alert.alert("Delete Menu Item", "This removes it from your menu. Any past deals for it are unaffected.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${API_URL}/seller/menu-items/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchSellerMenuItems();
          } catch (e) { Alert.alert("Error", e.response?.data?.error || "Could not delete menu item"); }
        }
      }
    ]);
  };

  const handleToggleHideMenuItem = async (item) => {
    try {
      await axios.patch(`${API_URL}/seller/menu-items/${item.id}/hide`, { hidden: !item.is_hidden }, { headers: { Authorization: `Bearer ${token}` } });
      fetchSellerMenuItems();
    } catch (e) {
      Alert.alert("Error", "Could not update visibility");
    }
  };

  const pickMenuItemImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      base64: true
    });
    if (!result.canceled && result.assets?.[0]) {
      setMenuItemImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const navItems = SELLER_NAV_ITEMS(user?.role === 'SellersAdmin');
  const inventoryTab = ['stores', 'menu', 'bags', 'food'].includes(sellerTab);

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
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="storefront" size={22} color={SELLER_BRAND} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>{user?.name || 'Seller Portal'}</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{user?.email}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 1 }}>{user?.role === 'SellersAdmin' ? 'Seller Admin' : 'Seller Staff'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
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
                  backgroundColor: sellerTab === item.key ? '#FFFFFF' : 'transparent',
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
      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {navItems.map(item => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setSellerTab(item.key)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                backgroundColor: sellerTab === item.key ? SELLER_BRAND : '#FFFFFF',
                borderWidth: 1, borderColor: sellerTab === item.key ? SELLER_BRAND : '#E5E7EB',
              }}>
              <Ionicons name={item.icon} size={16} color={sellerTab === item.key ? '#FFFFFF' : '#6B7280'} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: sellerTab === item.key ? '#FFFFFF' : '#6B7280' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* KPI Strip */}
      <View style={{ gap: 10, paddingHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SellerStatCard label="Revenue" value={formatMoney(stats.totalRevenue, currencySymbol)} />
          <SellerStatCard label="Stores" value={String(stores.length)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SellerStatCard label="Bags Sold" value={String(stats.bagsSold)} />
          <SellerStatCard label="Products Sold" value={String(stats.productsSold)} />
        </View>
      </View>

      {/* Currency Picker Row */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CURRENCIES.map(c => (
            <TouchableOpacity key={c.code} onPress={() => changeCurrency(c.code)}
              style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginRight: 6, borderWidth: 1, borderColor: currencyCode === c.code ? '#E27A53' : '#E5E7EB', backgroundColor: currencyCode === c.code ? '#FFFFFF' : '#F9FAFB' }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: currencyCode === c.code ? '#E27A53' : '#6B7280' }}>
                {c.symbol.trim()} {c.code}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── STORES TAB ── */}
      {sellerTab === 'stores' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {stores.length === 0 ? (
            <SellerEmptyState icon="storefront-outline" title="No stores yet" subtitle="Tap + to add your first store location" />
          ) : (stores.map((store) => (
            <View key={store.id.toString()} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {store.image ? (
                  <Image source={{ uri: store.image }} style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0 }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <Ionicons name="storefront-outline" size={24} color={SELLER_BRAND} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{store.name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{store.address}</Text>
                  {store.category && (
                    <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: SELLER_BRAND }}>{store.category}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="bicycle-outline" size={18} color={store.delivery_enabled ? SELLER_BRAND : '#9CA3AF'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: store.delivery_enabled ? '#111827' : '#6B7280' }}>
                    Delivery {store.delivery_enabled ? 'On' : 'Off'}
                  </Text>
                </View>
                <Switch
                  value={!!store.delivery_enabled}
                  onValueChange={(next) => handleToggleStoreDelivery(store, next)}
                  trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                  thumbColor={store.delivery_enabled ? SELLER_BRAND : '#F3F4F6'}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => { setStoreName(store.name); setStoreAddress(store.address); setStoreImage(store.image); setStoreLat(store.lat || 51.5074); setStoreLng(store.lng || -0.1278); setStoreDeliveryEnabled(!!store.delivery_enabled); setStoreDeliveryMode(store.delivery_mode === 'partner' ? 'partner' : 'self'); setStoreDeliveryFeeNote(store.delivery_fee_note || ''); setStoreCategory(store.category || null); setEditingStoreId(store.id); setShowStoreModal(true); }}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FFFFFF', borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ color: SELLER_BRAND, fontWeight: '700', fontSize: 13 }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteStore(store.id)}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FEE2E2', borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )))}
        </ScrollView>
      )}

      {/* ── SURPRISE BAGS TAB ── */}
      {sellerTab === 'bags' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {sellerBags.length === 0 ? (
            <SellerEmptyState icon="bag-handle-outline" title="No surprise bags yet" subtitle="Create your first surprise bag listing" />
          ) : (sellerBags.map((bag) => (
            <View key={bag.id.toString()} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{bag.store_name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>Pickup: {bag.pickup_time}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {bag.original_price ? (
                    <Text style={{ textDecorationLine: 'line-through', color: '#9CA3AF', fontSize: 12 }}>{formatMoney(bag.original_price, currencySymbol)}</Text>
                  ) : null}
                  <Text style={{ color: '#E27A53', fontWeight: '800', fontSize: 18 }}>{formatMoney(bag.price, currencySymbol)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#E27A53', fontWeight: '700', fontSize: 12 }}>{bag.quantity} left</Text>
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
                      setActiveTimePicker(null);
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
          )))}
        </ScrollView>
      )}

      {/* ── OPEN FOOD (GRABENGO DEALS) TAB ── */}
      {sellerTab === 'food' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {sellerFoodItems.length === 0 ? (
            <SellerEmptyState icon="flash-outline" title="No deals yet" subtitle="Pick a menu item and list it at a discount for a limited time" />
          ) : (sellerFoodItems.map((item) => {
            const notStarted = item.starts_at && new Date(item.starts_at) > new Date();
            const ended = item.sale_ends_at && new Date(item.sale_ends_at) <= new Date();
            const isLive = item.is_available && item.quantity > 0 && !notStarted && !ended;
            return (
            <View key={item.id.toString()} style={[styles.card, { marginBottom: 12 }]}>
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ color: '#059669', fontWeight: '700', fontSize: 11 }}>{item.quantity} left</Text>
                </View>
                <View style={{ backgroundColor: isLive ? '#D1FAE5' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ color: isLive ? '#065F46' : '#991B1B', fontWeight: '700', fontSize: 11 }}>
                    {ended ? 'Ended' : notStarted ? 'Scheduled' : isLive ? 'Live' : 'Unavailable'}
                  </Text>
                </View>
                {item.starts_at && (
                  <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 11 }}>Starts {formatSaleEnd(item.starts_at)}</Text>
                  </View>
                )}
                {item.sale_ends_at && (
                  <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: '#E27A53', fontWeight: '600', fontSize: 11 }}>Ends {formatSaleEnd(item.sale_ends_at)}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setFoodStoreId(item.store_id);
                    setFoodMenuItemId(item.menu_item_id);
                    setFoodPrice(item.price.toString());
                    setFoodQuantity(item.quantity.toString());
                    setFoodStartsAt(item.starts_at ? new Date(item.starts_at) : null);
                    setFoodStartPicker(null);
                    setFoodSaleEndsAt(item.sale_ends_at ? new Date(item.sale_ends_at) : null);
                    setFoodSalePicker(null);
                    setEditingFoodId(item.id);
                    setShowFoodModal(true);
                  }}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#ECFDF5', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#059669', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
                {isLive && (
                  <TouchableOpacity
                    onPress={() => handleEndSaleEarly(item.id)}
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FFF7ED', borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#E27A53', fontWeight: '700', fontSize: 12 }}>End Sale</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleDeleteFoodItem(item.id)}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FEE2E2', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          }))}
        </ScrollView>
      )}

      {/* ── MENU TAB (persistent vendor catalog) ── */}
      {sellerTab === 'menu' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {sellerMenuItems.length === 0 ? (
            <SellerEmptyState icon="restaurant-outline" title="No menu items yet" subtitle="Add the items your store always has available" />
          ) : (sellerMenuItems.map((item) => (
            <View key={item.id.toString()} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{item.name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{item.store_name} · {item.category}</Text>
                </View>
                <Text style={{ color: SELLER_BRAND, fontWeight: '800', fontSize: 18 }}>{formatMoney(item.price, currencySymbol)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <View style={{ backgroundColor: item.is_hidden ? '#FEE2E2' : '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ color: item.is_hidden ? '#991B1B' : '#065F46', fontWeight: '700', fontSize: 11 }}>{item.is_hidden ? 'Hidden from customers' : 'Visible on menu'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMenuItemId(item.id);
                    setMenuItemStoreId(item.store_id);
                    setMenuItemName(item.name);
                    setMenuItemDescription(item.description || '');
                    const known = FOOD_CATEGORIES.includes(item.category);
                    setMenuItemCategory(known ? item.category : 'Custom');
                    setMenuItemCustomCategory(known ? '' : (item.category || ''));
                    setMenuItemPrice(item.price.toString());
                    setMenuItemImage(item.image || null);
                    setShowMenuItemModal(true);
                  }}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#ECFDF5', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#059669', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleToggleHideMenuItem(item)}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#374151', fontWeight: '700', fontSize: 12 }}>{item.is_hidden ? 'Unhide' : 'Hide'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteMenuItem(item.id)}
                  style={{ flex: 1, paddingVertical: 8, backgroundColor: '#FEE2E2', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )))}
        </ScrollView>
      )}

      {sellerTab === 'orders' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {sellerOrders.length === 0 ? (
            <SellerEmptyState icon="receipt-outline" title="No orders yet" subtitle="Customer orders will appear here" />
          ) : (sellerOrders.map((order) => {
            const isDelivery = order.fulfillment_type === 'delivery';
            const status = order.status || 'pending';
            const isSettled = ['paid', 'rejected', 'cancelled'].includes(status);
            const showTriad = isDelivery && status === 'pending';
            const showPaymentActions = !isSettled && !showTriad;
            const STATUS_BADGES = {
              confirmed: { label: 'CONFIRMED', bg: '#DBEAFE', color: '#1D4ED8' },
              paid: { label: 'PAID', bg: '#DCFCE7', color: '#15803D' },
              rejected: { label: 'REJECTED', bg: '#FEE2E2', color: '#DC2626' },
              cancelled: { label: 'CANCELLED', bg: '#F3F4F6', color: '#6B7280' },
            };
            const statusBadge = STATUS_BADGES[status];
            return (
            <View key={String(order.id)} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDelivery ? '#DBEAFE' : '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                      <Ionicons name={isDelivery ? "bicycle-outline" : "storefront-outline"} size={11} color={isDelivery ? '#1D4ED8' : '#374151'} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: isDelivery ? '#1D4ED8' : '#374151' }}>{isDelivery ? 'DELIVERY' : 'PICKUP'}</Text>
                    </View>
                    {statusBadge && (
                      <View style={{ backgroundColor: statusBadge.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: statusBadge.color }}>{statusBadge.label}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: '#111827' }}>{order.item_name || 'Order Item'}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{order.store_name} · Ref #{order.id}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>{order.customer_name || order.customer_email || 'Customer'}</Text>
                </View>
                <Text style={{ color: SELLER_BRAND, fontWeight: '800', fontSize: 17 }}>{formatMoney(Number(order.price) * (order.quantity || 1), currencySymbol)}</Text>
              </View>

              {isDelivery && (
                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Deliver To</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 2 }}>{order.delivery_address || 'No address provided'}</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>Qty: {order.quantity || 1} · {order.payment_method || 'Cash at Pickup'}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{isDelivery ? '' : (order.pickup_time || 'Pickup window TBC')}</Text>
              </View>

              {order.customer_phone ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, backgroundColor: '#F0FDF4', borderRadius: 10 }}
                >
                  <Ionicons name="call-outline" size={14} color="#15803D" />
                  <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 13 }}>{order.customer_phone}</Text>
                </TouchableOpacity>
              ) : null}
              {order.fulfillment_type === 'delivery' && order.delivery_lat != null ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 8, backgroundColor: '#EFF6FF', borderRadius: 10 }}
                >
                  <Ionicons name="navigate-outline" size={14} color="#1D4ED8" />
                  <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 13 }}>Open Customer Location in Maps</Text>
                </TouchableOpacity>
              ) : null}
              {order.delivery_id ? (
                <View style={{ marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FED7AA' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#E27A53', textTransform: 'uppercase' }}>Grabengo Partner Delivery</Text>
                  <Text style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>
                    {order.delivery_status === 'awaiting_confirmation' ? 'Confirm the order to notify nearby riders.'
                      : order.delivery_status === 'pending' ? 'Waiting for a rider to accept…'
                      : order.delivery_status === 'assigned' ? `Rider ${order.partner_name || ''} is on the way to pick up.`
                      : order.delivery_status === 'picked_up' ? `Rider ${order.partner_name || ''} has picked up the order.`
                      : order.delivery_status === 'delivered' ? 'Delivered to the customer.'
                      : order.delivery_status === 'failed' ? 'Delivery failed — contact the customer.'
                      : order.delivery_status === 'cancelled' ? 'Delivery cancelled.'
                      : ''}
                  </Text>
                  {order.partner_phone && ['assigned', 'picked_up'].includes(order.delivery_status) ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.partner_phone}`)} style={{ marginTop: 6 }}>
                      <Text style={{ fontSize: 12, color: '#E27A53', fontWeight: '700' }}>Call rider: {order.partner_phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {showTriad && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => handleOrderAction(order.id, 'confirm')} style={{ flex: 1, paddingVertical: 9, backgroundColor: '#DCFCE7', borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 11.5 }}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOrderAction(order.id, 'convert_to_pickup')} style={{ flex: 1, paddingVertical: 9, backgroundColor: '#DBEAFE', borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 11.5 }}>To Pickup</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOrderAction(order.id, 'reject')} style={{ flex: 1, paddingVertical: 9, backgroundColor: '#FEE2E2', borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 11.5 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showPaymentActions && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => handleOrderAction(order.id, 'mark_paid')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, backgroundColor: SELLER_BRAND, borderRadius: 10 }}>
                    <Ionicons name="cash-outline" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>Amount Received</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOrderAction(order.id, 'cancel')} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#FEE2E2', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12.5 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );}))}
        </ScrollView>
      )}

      {sellerTab === 'reviews' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {sellerReviews.length === 0 ? (
            <SellerEmptyState icon="star-outline" title="No reviews yet" subtitle="Customer reviews will show here" />
          ) : (sellerReviews.map((review) => (
            <View key={String(review.id)} style={[styles.card, { marginBottom: 12 }]}>
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
          )))}
        </ScrollView>
      )}

      {sellerTab === 'chats' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {sellerChats.length === 0 ? (
            <SellerEmptyState icon="chatbubbles-outline" title="No conversations yet" subtitle="Customer chat messages will appear here" />
          ) : (sellerChats.map((chat) => (
            <TouchableOpacity key={`${chat.store_id}_${chat.customer_id}`} onPress={() => openSellerChat(chat)} style={[styles.card, { marginBottom: 12 }]}>
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
          )))}
        </ScrollView>
      )}

      {sellerTab === 'staff' && user?.role === 'SellersAdmin' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <TouchableOpacity onPress={() => setShowStaffModal(true)} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND, marginBottom: 16 }]}>
            <Text style={styles.primaryButtonText}>Add Staff Member</Text>
          </TouchableOpacity>
          {staffList.length === 0 ? (
            <SellerEmptyState icon="people-outline" title="No staff yet" subtitle="Add team members to help manage your stores" />
          ) : (staffList.map((staff) => (
            <View key={String(staff.id)} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="person-outline" size={22} color={SELLER_BRAND} />
                </View>
                <View>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{staff.name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{staff.email}</Text>
                </View>
              </View>
            </View>
          )))}
        </ScrollView>
      )}

      {/* FAB Add Button */}
      {inventoryTab && (
      <TouchableOpacity
        onPress={() => {
          if (sellerTab === 'stores') { setEditingStoreId(null); setStoreName(''); setStoreAddress(''); setStoreImage(null); setStoreLat(51.5074); setStoreLng(-0.1278); setStoreDeliveryEnabled(false); setStoreDeliveryMode('self'); setStoreDeliveryFeeNote(''); setStoreCategory(null); setShowStoreModal(true); }
          else if (sellerTab === 'bags') { setEditingBagId(null); setBagStoreId(null); setBagPrice(''); setBagOriginalPrice(''); setBagQuantity(''); setPickupTime(''); setBagDescription(''); setBagImages([]); setActiveTimePicker(null); setShowBagModal(true); }
          else if (sellerTab === 'menu') { setEditingMenuItemId(null); setMenuItemStoreId(null); setMenuItemName(''); setMenuItemDescription(''); setMenuItemCategory('Other'); setMenuItemCustomCategory(''); setMenuItemPrice(''); setMenuItemImage(null); setShowMenuItemModal(true); }
          else { setEditingFoodId(null); setFoodStoreId(null); setFoodMenuItemId(null); setFoodPrice(''); setFoodQuantity(''); setFoodStartsAt(null); setFoodStartPicker(null); setFoodSaleEndsAt(null); setFoodSalePicker(null); setShowFoodModal(true); }
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

              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Store Category *</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>
                Helps customers find you by browsing categories
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {STORE_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setStoreCategory(cat.key)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
                      backgroundColor: storeCategory === cat.key ? SELLER_BRAND : '#F9FAFB',
                      borderWidth: 1, borderColor: storeCategory === cat.key ? SELLER_BRAND : '#E5E7EB',
                    }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: storeCategory === cat.key ? '#FFFFFF' : '#6B7280' }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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
              <TouchableOpacity onPress={useCurrentStoreLocation} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 10, marginBottom: 8 }}>
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

              <View style={{ backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="bicycle-outline" size={20} color={SELLER_BRAND} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14, color: '#111827' }}>Offer Delivery</Text>
                      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Customers can request delivery at checkout</Text>
                    </View>
                  </View>
                  <Switch
                    value={storeDeliveryEnabled}
                    onValueChange={setStoreDeliveryEnabled}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={storeDeliveryEnabled ? SELLER_BRAND : '#F3F4F6'}
                  />
                </View>
                {storeDeliveryEnabled && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 8, fontSize: 13 }}>Who delivers the orders?</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                      <TouchableOpacity
                        onPress={() => setStoreDeliveryMode('self')}
                        style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: storeDeliveryMode === 'self' ? SELLER_BRAND : '#E5E7EB', backgroundColor: storeDeliveryMode === 'self' ? '#FFFFFF' : '#FFFFFF' }}>
                        <Text style={{ fontWeight: '800', fontSize: 13, color: storeDeliveryMode === 'self' ? SELLER_BRAND : '#374151' }}>Self delivery</Text>
                        <Text style={{ fontSize: 10.5, color: '#6B7280', marginTop: 3, lineHeight: 14 }}>Your own riders deliver. You set and collect any charges.</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setStoreDeliveryMode('partner')}
                        style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: storeDeliveryMode === 'partner' ? SELLER_BRAND : '#E5E7EB', backgroundColor: storeDeliveryMode === 'partner' ? '#FFFFFF' : '#FFFFFF' }}>
                        <Text style={{ fontWeight: '800', fontSize: 13, color: storeDeliveryMode === 'partner' ? SELLER_BRAND : '#374151' }}>Grabengo Partner</Text>
                        <Text style={{ fontSize: 10.5, color: '#6B7280', marginTop: 3, lineHeight: 14 }}>A Grabengo rider picks up and delivers. Fee is charged to the customer by distance.</Text>
                      </TouchableOpacity>
                    </View>
                    {storeDeliveryMode === 'self' ? (
                    <>
                    <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Delivery Fee / Notes (optional)</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 0 }]}
                      placeholder="e.g. Rs 150 flat fee, or 'call to confirm charge'"
                      placeholderTextColor="#9CA3AF"
                      value={storeDeliveryFeeNote}
                      onChangeText={setStoreDeliveryFeeNote}
                    />
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Shown to customers before they choose delivery. You collect this charge directly — it's not processed by Grabengo.</Text>
                    </>
                    ) : (
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, lineHeight: 15 }}>When you confirm a delivery order, nearby Grabengo partners are notified. The rider collects the order total plus the distance-based delivery fee in cash from the customer. Deliveries are limited to 12 km from your store.</Text>
                    )}
                  </View>
                )}
              </View>

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
                  <TouchableOpacity key={store.id} onPress={() => setBagStoreId(store.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: bagStoreId === store.id ? '#E27A53' : '#F3F4F6' }}>
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
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, borderWidth: 1, borderColor: pickupDays.includes(day) ? '#E27A53' : '#D1D5DB', backgroundColor: pickupDays.includes(day) ? '#E27A53' : '#F9FAFB' }}>
                    <Text style={{ color: pickupDays.includes(day) ? '#FFFFFF' : '#6B7280', fontWeight: '700', fontSize: 12 }}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>From</Text>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setActiveTimePicker(activeTimePicker === 'from' ? null : 'from')}>
                    <Text style={{ fontSize: 15, color: '#111827' }}>{pickupFrom}</Text>
                    <Ionicons name="time-outline" size={18} color={activeTimePicker === 'from' ? SELLER_BRAND : '#64748B'} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>To</Text>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setActiveTimePicker(activeTimePicker === 'to' ? null : 'to')}>
                    <Text style={{ fontSize: 15, color: '#111827' }}>{pickupTo}</Text>
                    <Ionicons name="time-outline" size={18} color={activeTimePicker === 'to' ? SELLER_BRAND : '#64748B'} />
                  </TouchableOpacity>
                </View>
              </View>
              {activeTimePicker && (
                <View style={{ marginBottom: 6 }}>
                  <DateTimePicker
                    value={timeToDate(activeTimePicker === 'from' ? pickupFrom : pickupTo)}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onTimePicked(activeTimePicker)}
                    onDismiss={() => setActiveTimePicker(null)}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SELLER_BRAND, borderRadius: 8 }}
                      onPress={() => setActiveTimePicker(null)}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {pickupTime ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, marginBottom: 14 }}>
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
              <TouchableOpacity onPress={() => { handleCreateBag(); setShowBagModal(false); }} style={[styles.primaryButton, { backgroundColor: '#E27A53' }]}>
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
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{editingFoodId ? 'Edit Deal' : 'New Grabengo Deal'}</Text>
              <TouchableOpacity onPress={() => setShowFoodModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {!editingFoodId && (
                <>
                  <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Select Store *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    {stores.map(store => (
                      <TouchableOpacity key={store.id} onPress={() => { setFoodStoreId(store.id); setFoodMenuItemId(null); }} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: foodStoreId === store.id ? SELLER_BRAND : '#F3F4F6' }}>
                        <Text style={{ color: foodStoreId === store.id ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 13 }}>{store.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Select Menu Item *</Text>
                  {foodStoreId ? (
                    sellerMenuItems.filter(m => m.store_id === foodStoreId).length === 0 ? (
                      <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 14 }}>This store has no menu items yet — add one under the Menu tab first.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                        {sellerMenuItems.filter(m => m.store_id === foodStoreId).map(m => (
                          <TouchableOpacity key={m.id} onPress={() => setFoodMenuItemId(m.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: foodMenuItemId === m.id ? SELLER_BRAND : '#F3F4F6' }}>
                            <Text style={{ color: foodMenuItemId === m.id ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 13 }}>{m.name} ({currencySymbol}{m.price.toFixed(2)})</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )
                  ) : (
                    <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 14 }}>Select a store first.</Text>
                  )}
                </>
              )}
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Sale Price ({currencySymbol}) *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="3.50" placeholderTextColor="#9CA3AF" value={foodPrice} onChangeText={setFoodPrice} keyboardType="numeric" />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Quantity *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="10" placeholderTextColor="#9CA3AF" value={foodQuantity} onChangeText={setFoodQuantity} keyboardType="numeric" />

              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Starts at (optional — leave blank to start now)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => setFoodStartPicker(Platform.OS === 'ios' ? 'datetime' : 'date')}>
                  <Text style={{ fontSize: 15, color: foodStartsAt ? '#111827' : '#9CA3AF' }}>
                    {foodStartsAt ? formatSaleEnd(foodStartsAt) : 'Starts immediately'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={foodStartPicker ? SELLER_BRAND : '#64748B'} />
                </TouchableOpacity>
                {foodStartsAt && (
                  <TouchableOpacity onPress={() => { setFoodStartsAt(null); setFoodStartPicker(null); }}>
                    <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              {foodStartPicker && (
                <View style={{ marginBottom: 14 }}>
                  <DateTimePicker
                    value={foodStartsAt || new Date()}
                    mode={Platform.OS === 'ios' ? 'datetime' : foodStartPicker}
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onSaleStartPicked}
                    onDismiss={() => setFoodStartPicker(null)}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SELLER_BRAND, borderRadius: 8 }}
                      onPress={() => { if (!foodStartsAt) setFoodStartsAt(new Date()); setFoodStartPicker(null); }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>On sale until (optional)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => setFoodSalePicker(Platform.OS === 'ios' ? 'datetime' : 'date')}>
                  <Text style={{ fontSize: 15, color: foodSaleEndsAt ? '#111827' : '#9CA3AF' }}>
                    {foodSaleEndsAt ? formatSaleEnd(foodSaleEndsAt) : 'Set end date & time'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={foodSalePicker ? SELLER_BRAND : '#64748B'} />
                </TouchableOpacity>
                {foodSaleEndsAt && (
                  <TouchableOpacity onPress={() => { setFoodSaleEndsAt(null); setFoodSalePicker(null); }}>
                    <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              {foodSalePicker && (
                <View style={{ marginBottom: 14 }}>
                  <DateTimePicker
                    value={foodSaleEndsAt || defaultSaleEnd()}
                    mode={Platform.OS === 'ios' ? 'datetime' : foodSalePicker}
                    is24Hour
                    minimumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onSaleEndPicked}
                    onDismiss={() => setFoodSalePicker(null)}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SELLER_BRAND, borderRadius: 8 }}
                      onPress={() => { if (!foodSaleEndsAt) setFoodSaleEndsAt(defaultSaleEnd()); setFoodSalePicker(null); }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <TouchableOpacity onPress={() => { handleCreateFoodItem(); setShowFoodModal(false); }} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND, marginTop: 6 }]}>
                <Text style={styles.primaryButtonText}>{editingFoodId ? 'Update Deal' : 'Create Deal'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MENU ITEM MODAL ── */}
      <Modal visible={showMenuItemModal} animationType="slide" transparent onRequestClose={() => setShowMenuItemModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{editingMenuItemId ? 'Edit Menu Item' : 'Add Menu Item'}</Text>
              <TouchableOpacity onPress={() => setShowMenuItemModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Select Store *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {stores.map(store => (
                  <TouchableOpacity key={store.id} onPress={() => setMenuItemStoreId(store.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: menuItemStoreId === store.id ? SELLER_BRAND : '#F3F4F6' }}>
                    <Text style={{ color: menuItemStoreId === store.id ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 13 }}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Item Name *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="e.g. Chicken Wrap" placeholderTextColor="#9CA3AF" value={menuItemName} onChangeText={setMenuItemName} />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {[...FOOD_CATEGORIES, 'Custom'].map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setMenuItemCategory(cat)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8, backgroundColor: menuItemCategory === cat ? SELLER_BRAND : '#F3F4F6' }}>
                    <Text style={{ color: menuItemCategory === cat ? '#FFFFFF' : '#374151', fontWeight: '600', fontSize: 12 }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {menuItemCategory === 'Custom' && (
                <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="e.g. Middle Eastern" placeholderTextColor="#9CA3AF" value={menuItemCustomCategory} onChangeText={setMenuItemCustomCategory} />
              )}
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Price ({currencySymbol}) *</Text>
              <TextInput style={[styles.input, { marginBottom: 14 }]} placeholder="8.00" placeholderTextColor="#9CA3AF" value={menuItemPrice} onChangeText={setMenuItemPrice} keyboardType="numeric" />
              <Text style={{ color: '#6B7280', fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Description</Text>
              <TextInput style={[styles.input, { height: 70, marginBottom: 14 }]} placeholder="Optional description..." placeholderTextColor="#9CA3AF" value={menuItemDescription} onChangeText={setMenuItemDescription} multiline />
              <TouchableOpacity onPress={pickMenuItemImage} style={{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#FED7AA' }}>
                <Ionicons name="image-outline" size={24} color={SELLER_BRAND} style={{ marginBottom: 4 }} />
                <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 13 }}>{menuItemImage ? 'Change Photo' : 'Upload Photo (Optional)'}</Text>
              </TouchableOpacity>
              {menuItemImage ? (
                <View style={{ marginBottom: 20 }}>
                  <View style={{ position: 'relative', width: 70, height: 70, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Image source={{ uri: menuItemImage }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <TouchableOpacity onPress={() => setMenuItemImage(null)} style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="close" size={12} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              <TouchableOpacity onPress={() => { handleSaveMenuItem(); setShowMenuItemModal(false); }} style={[styles.primaryButton, { backgroundColor: SELLER_BRAND }]}>
                <Text style={styles.primaryButtonText}>{editingMenuItemId ? 'Update Item' : 'Add to Menu'}</Text>
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
          <ScrollView
            ref={sellerChatListRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 12 }}
            onContentSizeChange={() => sellerChatListRef.current?.scrollToEnd({ animated: true })}
          >
            {sellerChatMessages.map((item) => {
              const isMe = item.sender_role === 'Seller';
              return (
                <View key={String(item.id)} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
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
            })}
          </ScrollView>
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
  const DEFAULT_DELIVERY_INFO = { fulfillmentType: 'pickup', address: '', phone: '', lat: null, lng: null };
  const [deliveryInfo, setDeliveryInfo] = useState(DEFAULT_DELIVERY_INFO);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

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
            setDeliveryInfo(DEFAULT_DELIVERY_INFO);
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

  const clearCart = () => { setCartItems([]); setDeliveryInfo(DEFAULT_DELIVERY_INFO); };

  const cartContext = React.useMemo(() => ({
    cartItems, addToCart, updateQuantity, removeFromCart, clearCart,
    cartTotalCount: cartItems.reduce((acc, item) => acc + item.cart_quantity, 0),
    cartTotalPrice: cartItems.reduce((acc, item) => acc + (item.price * item.cart_quantity), 0),
    deliveryInfo, setDeliveryInfo,
  }), [cartItems, deliveryInfo]);

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
      CURRENCIES: CURRENCIES_LIST,
      profileModalVisible,
      openProfile: () => setProfileModalVisible(true),
      closeProfile: () => setProfileModalVisible(false),
    }),
    [state, currencyCode, currencySymbol, changeCurrency, profileModalVisible]
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
              ) : state.user?.role === 'Partner' ? (
                // Delivery Partner Stack
                <Stack.Screen name="PartnerDashboard" component={PartnerDashboardScreen} />
              ) : (
                // App Stack
                <>
                  <Stack.Screen name="ExploreTenants" component={ExploreTenantsScreen} />
                  <Stack.Screen name="Discover" component={DiscoverScreen} />
                  <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
                  <Stack.Screen name="Cart" component={CartScreen} />
                  <Stack.Screen name="DeliveryAddress" component={DeliveryAddressScreen} />
                  <Stack.Screen name="Bookings" component={BookingsScreen} />
                  <Stack.Screen name="Splash" component={SplashScreen} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
          <GlobalToast />
          <GlobalChatModal />
          <GlobalReceiptModal />
          <GlobalProfileModal />
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
    backgroundColor: '#E27A53',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#E27A53',
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
  priceTag: { backgroundColor: '#E27A53', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
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
  gridPriceTag: { backgroundColor: '#E64A33', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
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
    borderLeftColor: '#E27A53',
  }
});
