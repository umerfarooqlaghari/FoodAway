import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  SearchIcon, XIcon, ArrowLeftIcon, CartIcon,
  BagIcon, FoodIcon, StoreIcon, GridIcon,
  ClipboardIcon, CheckCircleIcon,
  ClockIcon, TrashIcon
} from './Icons';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const CURRENCY = '£';

function downloadReceipt(orders, contactInfo) {
  const total = orders.reduce((s, o) => s + (o.price * (o.quantity || 1)), 0);
  const date = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const refNos = orders.map(o => `#${o.id}`).join(', ');

  const rows = orders.map(o => `
    <tr>
      <td>${o.item_name || (o.type === 'bag' ? 'Surprise Bag' : 'Food Item')}</td>
      <td>${o.store_name || ''}</td>
      <td style="text-align:center">${o.quantity || 1}</td>
      <td style="text-align:right">£${Number(o.price).toFixed(2)}</td>
      <td style="text-align:right">£${(o.price * (o.quantity || 1)).toFixed(2)}</td>
      <td>${o.pickup_time || 'During opening hours'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FoodAway Receipt ${refNos}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; padding: 40px 20px; color: #1a1a1a; }
    .page { max-width: 620px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #FF5A00, #f7931e); padding: 32px 36px; text-align: center; }
    .header-icon { font-size: 40px; margin-bottom: 10px; }
    .header h1 { color: #fff; font-size: 26px; font-weight: 800; margin: 0 0 4px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
    .body { padding: 28px 36px; }
    .ref-box { background: #fff8f5; border: 1px solid #ffe0cc; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: center; }
    .ref-box .label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .ref-box .value { font-size: 15px; font-weight: 700; color: #FF5A00; }
    .contact { margin-bottom: 22px; }
    .contact h3 { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .contact p { font-size: 14px; color: #333; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    thead tr { background: #fff8f5; }
    th { padding: 10px 10px; text-align: left; font-size: 11px; color: #FF5A00; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #ffe0cc; }
    td { padding: 10px 10px; border-bottom: 1px solid #f5f5f5; color: #444; vertical-align: top; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; background: #fff8f5; border-radius: 10px; margin-bottom: 20px; }
    .total-row .label { font-size: 15px; color: #555; }
    .total-row .amount { font-size: 22px; font-weight: 800; color: #FF5A00; }
    .notice { background: #f5f5f5; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #666; line-height: 1.6; margin-bottom: 20px; }
    .notice strong { color: #333; }
    .footer { background: #1a1a1a; padding: 18px 36px; text-align: center; }
    .footer p { color: #666; font-size: 12px; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; }
      .print-btn { display: none !important; }
    }
    .print-btn { display: block; margin: 24px auto 0; padding: 12px 32px; background: #FF5A00; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .print-btn:hover { background: #e04f00; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-icon">🛍️</div>
      <h1>Order Confirmed!</h1>
      <p>FoodAway — Thank you for your order</p>
    </div>
    <div class="body">
      <div class="ref-box">
        <div><div class="label">Order Reference</div><div class="value">${refNos}</div></div>
        <div style="text-align:right"><div class="label">Date</div><div class="value" style="color:#333;font-size:13px">${date}</div></div>
      </div>
      ${contactInfo ? `
      <div class="contact">
        <h3>Customer Details</h3>
        <p><strong>${contactInfo.name}</strong><br>${contactInfo.email} · ${contactInfo.phone}</p>
      </div>` : ''}
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Store</th><th style="text-align:center">Qty</th>
            <th style="text-align:right">Price</th><th style="text-align:right">Total</th><th>Pickup</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total-row">
        <span class="label">Total Amount (Cash at Pickup)</span>
        <span class="amount">£${total.toFixed(2)}</span>
      </div>
      <div class="notice">
        <strong>Important:</strong> Please present this receipt at the store when collecting your order.
        Payment is <strong>cash only at pickup</strong> within the specified pickup window.
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FoodAway — Reducing food waste, one meal at a time.</p>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function getFirstImage(images) {
  if (!images) return null;
  try {
    const arr = typeof images === 'string' ? JSON.parse(images) : images;
    if (Array.isArray(arr) && arr.length > 0) return arr[0];
  } catch {}
  if (typeof images === 'string' && images.startsWith('http')) return images;
  return null;
}

function getCartQty(cart, id, type) {
  const entry = cart.find(c => c.item.id === id && c.type === type);
  return entry ? entry.quantity : 0;
}

function PlaceholderImg({ type }) {
  return (
    <div className="pos-card-img-placeholder">
      {type === 'bag' ? <BagIcon size={40} color="#FF5A00" /> : <FoodIcon size={40} color="#3b82f6" />}
    </div>
  );
}

function ItemCard({ item, type, cart, onAdd, onQtyChange }) {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = getFirstImage(item.images);
  const qty = getCartQty(cart, item.id, type);
  const discount = item.original_price && item.original_price > item.price
    ? Math.round((1 - item.price / item.original_price) * 100)
    : null;

  return (
    <div className="pos-card">
      <div className="pos-card-img">
        {imgSrc && !imgErr
          ? <img src={imgSrc} alt={item.name || 'Item'} onError={() => setImgErr(true)} />
          : <PlaceholderImg type={type} />
        }
        {discount && (
          <span className="pos-discount-tag">-{discount}%</span>
        )}
        <span className={`pos-type-badge ${type === 'bag' ? 'pos-type-bag' : 'pos-type-food'}`}>
          {type === 'bag'
            ? <><BagIcon size={11} color="#fff" /> Surprise Bag</>
            : <><FoodIcon size={11} color="#fff" /> {item.category || 'Food'}</>
          }
        </span>
      </div>
      <div className="pos-card-body">
        <p className="pos-card-store">{item.store_name}</p>
        <h3 className="pos-card-name">
          {type === 'bag' ? (item.description || 'Surprise Bag') : item.name}
        </h3>
        {type === 'bag' && item.pickup_time && (
          <p className="pos-card-meta">
            <ClockIcon size={12} color="#aaa" /> {item.pickup_time}
          </p>
        )}
        <div className="pos-card-footer">
          <div className="pos-card-prices">
            <span className="pos-card-price">{CURRENCY}{Number(item.price).toFixed(2)}</span>
            {item.original_price && item.original_price > item.price && (
              <span className="pos-card-orig">{CURRENCY}{Number(item.original_price).toFixed(2)}</span>
            )}
          </div>
          {qty === 0 ? (
            <button className="pos-add-btn" onClick={() => onAdd(item, type)}>
              Add to Cart
            </button>
          ) : (
            <div className="pos-qty-ctrl">
              <button onClick={() => onQtyChange(item.id, type, qty - 1)}>−</button>
              <span>{qty}</span>
              <button onClick={() => onQtyChange(item.id, type, qty + 1)}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerPage({ onBack }) {
  const [bags, setBags] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStore, setActiveStore] = useState('all');
  const [stores, setStores] = useState([]);

  const [cart, setCart] = useState([]);
  const [panelTab, setPanelTab] = useState('cart');

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [confirmedOrders, setConfirmedOrders] = useState(null);

  const [myOrders, setMyOrders] = useState([]);
  const [lookupForm, setLookupForm] = useState({ email: '', phone: '' });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupDone, setLookupDone] = useState(false);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bagsRes, foodsRes] = await Promise.all([
        axios.get(`${API}/public/bags`),
        axios.get(`${API}/public/food-items`),
      ]);
      setBags(bagsRes.data || []);
      setFoods(foodsRes.data || []);
      const seen = new Set();
      const uniqueStores = [];
      [...(bagsRes.data || []), ...(foodsRes.data || [])].forEach(i => {
        if (!seen.has(i.store_id)) {
          seen.add(i.store_id);
          uniqueStores.push({ id: i.store_id, name: i.store_name });
        }
      });
      setStores(uniqueStores);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addToCart = (item, type) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.item.id === item.id && c.type === type);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 };
        return u;
      }
      return [...prev, { item, type, quantity: 1 }];
    });
  };

  const updateQty = (id, type, qty) => {
    if (qty <= 0) setCart(prev => prev.filter(c => !(c.item.id === id && c.type === type)));
    else setCart(prev => prev.map(c => c.item.id === id && c.type === type ? { ...c, quantity: qty } : c));
  };

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartSubtotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setCheckoutError('Please fill in all fields.');
      return;
    }
    setPlacing(true);
    try {
      const res = await axios.post(`${API}/public/checkout`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        items: cart.map(c => ({ id: c.item.id, type: c.type, quantity: c.quantity }))
      });
      setConfirmedOrders(res.data.orders);
      setMyOrders(res.data.orders);
      setCart([]);
      setCheckoutOpen(false);
      setPanelTab('orders');
      setLookupDone(true);
    } catch (err) {
      setCheckoutError(err?.response?.data?.error || 'Checkout failed. Please try again.');
    }
    setPlacing(false);
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupError('');
    setLookupLoading(true);
    setLookupDone(false);
    try {
      const res = await axios.get(`${API}/public/orders?email=${encodeURIComponent(lookupForm.email)}&phone=${encodeURIComponent(lookupForm.phone)}`);
      setMyOrders(res.data || []);
      setLookupDone(true);
    } catch {
      setLookupError('Could not find orders. Please check your details.');
    }
    setLookupLoading(false);
  };

  const filteredBags = bags.filter(b => {
    if (activeStore === 'foods') return false;
    if (activeStore !== 'all' && activeStore !== 'bags' && String(b.store_id) !== String(activeStore)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (b.store_name || '').toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredFoods = foods.filter(f => {
    if (activeStore === 'bags') return false;
    if (activeStore !== 'all' && activeStore !== 'foods' && String(f.store_id) !== String(activeStore)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (f.name || '').toLowerCase().includes(q) || (f.store_name || '').toLowerCase().includes(q) || (f.category || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalItemCount = filteredBags.length + filteredFoods.length;

  return (
    <div className="pos-root">

      {/* ── Header ─────────────────────────────────── */}
      <header className="pos-header">
        <button className="pos-back-btn" onClick={onBack}>
          <ArrowLeftIcon size={14} /> Back
        </button>
        <div className="pos-logo">
          <img src="/FoodAway-V1-transparent.png" alt="FoodAway" className="pos-logo-img" />
        </div>
        <div className="pos-search-wrap">
          <span className="pos-search-icon"><SearchIcon size={15} color="#aaa" /></span>
          <input
            className="pos-search"
            type="text"
            placeholder="Search products here..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="pos-search-clear" onClick={() => setSearch('')}>
              <XIcon size={13} color="#aaa" />
            </button>
          )}
        </div>
        <button className="pos-mobile-cart-btn" onClick={() => setMobileCartOpen(true)}>
          <CartIcon size={20} color="#fff" />
          {cartCount > 0 && <span className="pos-mobile-cart-badge">{cartCount}</span>}
        </button>
      </header>

      {/* ── Category Chips ─────────────────────────── */}
      <div className="pos-categories">
        <button className={`pos-cat-chip ${activeStore === 'all' ? 'active' : ''}`} onClick={() => setActiveStore('all')}>
          <span className="pos-cat-icon"><GridIcon size={20} color={activeStore === 'all' ? '#FF5A00' : '#888'} /></span>
          <span className="pos-cat-label">All</span>
          <span className="pos-cat-count">{bags.length + foods.length} Items</span>
        </button>
        <button className={`pos-cat-chip ${activeStore === 'bags' ? 'active' : ''}`} onClick={() => setActiveStore('bags')}>
          <span className="pos-cat-icon"><BagIcon size={20} color={activeStore === 'bags' ? '#FF5A00' : '#888'} /></span>
          <span className="pos-cat-label">Surprise Bags</span>
          <span className="pos-cat-count">{bags.length} Items</span>
        </button>
        <button className={`pos-cat-chip ${activeStore === 'foods' ? 'active' : ''}`} onClick={() => setActiveStore('foods')}>
          <span className="pos-cat-icon"><FoodIcon size={20} color={activeStore === 'foods' ? '#FF5A00' : '#888'} /></span>
          <span className="pos-cat-label">Food Items</span>
          <span className="pos-cat-count">{foods.length} Items</span>
        </button>
        {stores.map(s => (
          <button
            key={s.id}
            className={`pos-cat-chip ${String(activeStore) === String(s.id) ? 'active' : ''}`}
            onClick={() => setActiveStore(String(s.id))}
          >
            <span className="pos-cat-icon"><StoreIcon size={20} color={String(activeStore) === String(s.id) ? '#FF5A00' : '#888'} /></span>
            <span className="pos-cat-label">{s.name}</span>
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className="pos-body">

        {/* Product Grid */}
        <div className="pos-grid-area">
          {loading ? (
            <div className="pos-loading">
              <div className="pos-spinner" />
              <p>Loading fresh deals...</p>
            </div>
          ) : totalItemCount === 0 ? (
            <div className="pos-empty">
              <img src="/FoodAway-V1-transparent.png" alt="" style={{ height: 56, opacity: 0.2 }} />
              <h3>No items found</h3>
              <p>{search ? `No results for "${search}"` : 'Check back soon for fresh deals!'}</p>
              {search && <button className="pos-outline-btn" onClick={() => setSearch('')}>Clear search</button>}
            </div>
          ) : (
            <div className="pos-grid">
              {filteredBags.map(bag => (
                <ItemCard key={`bag-${bag.id}`} item={bag} type="bag"
                  cart={cart} onAdd={addToCart} onQtyChange={updateQty} />
              ))}
              {filteredFoods.map(food => (
                <ItemCard key={`food-${food.id}`} item={food} type="food"
                  cart={cart} onAdd={addToCart} onQtyChange={updateQty} />
              ))}
            </div>
          )}
        </div>

        {/* ── Order Panel ────────────────────────────── */}
        {mobileCartOpen && (
          <div className="pos-panel-overlay" onClick={() => setMobileCartOpen(false)} />
        )}
        <aside className={`pos-order-panel ${mobileCartOpen ? 'pos-panel-open' : ''}`}>
          <div className="pos-panel-inner">

            <div className="pos-panel-header">
              <div className="pos-panel-tabs">
                <button className={`pos-ptab ${panelTab === 'cart' ? 'active' : ''}`} onClick={() => setPanelTab('cart')}>
                  <CartIcon size={14} color={panelTab === 'cart' ? '#FF5A00' : '#888'} />
                  Cart {cartCount > 0 && <span className="pos-ptab-badge">{cartCount}</span>}
                </button>
                <button className={`pos-ptab ${panelTab === 'orders' ? 'active' : ''}`} onClick={() => setPanelTab('orders')}>
                  <ClipboardIcon size={14} color={panelTab === 'orders' ? '#FF5A00' : '#888'} />
                  My Orders
                </button>
              </div>
              <button className="pos-panel-close" onClick={() => setMobileCartOpen(false)}>
                <XIcon size={14} />
              </button>
            </div>

            {/* Cart Tab */}
            {panelTab === 'cart' && (
              <>
                <div className="pos-cart-items">
                  {cart.length === 0 ? (
                    <div className="pos-cart-empty">
                      <CartIcon size={36} color="#ddd" />
                      <p>Your cart is empty</p>
                      <span className="pos-cart-empty-sub">Add items from the menu</span>
                    </div>
                  ) : (
                    cart.map(entry => {
                      const src = getFirstImage(entry.item.images);
                      return (
                        <div key={`${entry.type}-${entry.item.id}`} className="pos-cart-row">
                          <div className="pos-cart-row-thumb">
                            {src
                              ? <img src={src} alt="" onError={e => e.target.style.display = 'none'} />
                              : (entry.type === 'bag' ? <BagIcon size={20} color="#FF5A00" /> : <FoodIcon size={20} color="#3b82f6" />)
                            }
                          </div>
                          <div className="pos-cart-row-info">
                            <p className="pos-cart-row-name">
                              {entry.type === 'bag' ? (entry.item.description || 'Surprise Bag') : entry.item.name}
                            </p>
                            <p className="pos-cart-row-store">{entry.item.store_name}</p>
                            <div className="pos-cart-row-bottom">
                              <span className="pos-cart-row-price">
                                {CURRENCY}{(entry.item.price * entry.quantity).toFixed(2)}
                              </span>
                              <div className="pos-cart-inline-qty">
                                <button onClick={() => updateQty(entry.item.id, entry.type, entry.quantity - 1)}>−</button>
                                <span>{entry.quantity}</span>
                                <button onClick={() => updateQty(entry.item.id, entry.type, entry.quantity + 1)}>+</button>
                              </div>
                            </div>
                          </div>
                          <button className="pos-cart-remove" onClick={() => updateQty(entry.item.id, entry.type, 0)} title="Remove">
                            <TrashIcon size={13} color="#ccc" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="pos-panel-footer">
                    <div className="pos-total-row">
                      <span>Sub Total</span>
                      <span>{CURRENCY}{cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="pos-divider" />
                    <div className="pos-total-row pos-total-bold">
                      <span>Total Amount</span>
                      <strong>{CURRENCY}{cartSubtotal.toFixed(2)}</strong>
                    </div>
                    <p className="pos-cash-note">Cash payment at pickup</p>
                    <button className="pos-place-order-btn" onClick={() => { setCheckoutOpen(true); setCheckoutError(''); }}>
                      Place Order
                    </button>
                    <button className="pos-clear-btn" onClick={() => setCart([])}>Clear Cart</button>
                  </div>
                )}
              </>
            )}

            {/* My Orders Tab */}
            {panelTab === 'orders' && (
              <div className="pos-orders-body">
                {confirmedOrders && (
                  <div className="pos-confirmed-banner">
                    <div className="pos-confirmed-top">
                      <CheckCircleIcon size={16} color="#166534" />
                      <span>Order confirmed! A confirmation email has been sent.</span>
                    </div>
                    <button
                      className="pos-receipt-btn"
                      onClick={() => downloadReceipt(confirmedOrders, form)}
                    >
                      Download Receipt
                    </button>
                  </div>
                )}

                {!lookupDone ? (
                  <form className="pos-lookup-form" onSubmit={handleLookup}>
                    <p className="pos-lookup-title">View Your Orders</p>
                    <p className="pos-lookup-sub">Enter the email and phone number you used when ordering.</p>
                    <input className="pos-input" type="email" placeholder="Email address"
                      value={lookupForm.email} onChange={e => setLookupForm(p => ({ ...p, email: e.target.value }))} required />
                    <input className="pos-input" type="tel" placeholder="Phone number"
                      value={lookupForm.phone} onChange={e => setLookupForm(p => ({ ...p, phone: e.target.value }))} required />
                    {lookupError && <p className="pos-error">{lookupError}</p>}
                    <button className="pos-place-order-btn" type="submit" disabled={lookupLoading}>
                      {lookupLoading ? 'Looking up...' : 'Find My Orders'}
                    </button>
                  </form>
                ) : myOrders.length === 0 ? (
                  <div className="pos-cart-empty">
                    <ClipboardIcon size={32} color="#ddd" />
                    <p>No orders found</p>
                    <button className="pos-outline-btn" style={{ marginTop: 10 }} onClick={() => { setLookupDone(false); setConfirmedOrders(null); }}>
                      Try again
                    </button>
                  </div>
                ) : (
                  <div className="pos-orders-list">
                    <div className="pos-orders-list-header">
                      <span>{myOrders.length} order{myOrders.length !== 1 ? 's' : ''}</span>
                      <button className="pos-outline-btn-sm" onClick={() => { setLookupDone(false); setMyOrders([]); setConfirmedOrders(null); }}>
                        <ArrowLeftIcon size={11} /> Back
                      </button>
                    </div>
                    {myOrders.map((o, i) => (
                      <div key={o.id || i} className="pos-order-entry">
                        <div className="pos-order-entry-top">
                          <span className="pos-order-entry-icon">
                            {o.type === 'bag' ? <BagIcon size={18} color="#FF5A00" /> : <FoodIcon size={18} color="#3b82f6" />}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p className="pos-order-entry-name">{o.item_name || 'Item'}</p>
                            <p className="pos-order-entry-store">{o.store_name}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p className="pos-order-entry-price">{CURRENCY}{(o.price * (o.quantity || 1)).toFixed(2)}</p>
                            <p className="pos-order-entry-qty">×{o.quantity || 1}</p>
                          </div>
                        </div>
                        {o.pickup_time && (
                          <p className="pos-order-entry-pickup">
                            <ClockIcon size={11} color="#888" /> {o.pickup_time}
                          </p>
                        )}
                        <p className="pos-order-entry-date">
                          {o.created_at ? new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                          {o.id ? ` · Ref #${o.id}` : ''}
                        </p>
                        <button
                          className="pos-receipt-btn-sm"
                          onClick={() => downloadReceipt([o], lookupDone && !confirmedOrders ? lookupForm : null)}
                        >
                          Download Receipt
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Checkout Modal ─────────────────────────── */}
      {checkoutOpen && (
        <div className="pos-modal-bg" onClick={e => e.target === e.currentTarget && setCheckoutOpen(false)}>
          <div className="pos-modal">
            <div className="pos-modal-head">
              <div>
                <h2>Almost there!</h2>
                <p>No account needed — just your contact details.</p>
              </div>
              <button className="pos-modal-x" onClick={() => setCheckoutOpen(false)}>
                <XIcon size={16} />
              </button>
            </div>

            <div className="pos-modal-summary">
              <p className="pos-modal-summary-title">Order Summary</p>
              {cart.map(c => (
                <div key={`${c.type}-${c.item.id}`} className="pos-modal-summary-row">
                  <span>{c.type === 'bag' ? (c.item.description || 'Surprise Bag') : c.item.name} ×{c.quantity}</span>
                  <span>{CURRENCY}{(c.item.price * c.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="pos-modal-summary-total">
                <span>Total (cash at pickup)</span>
                <strong>{CURRENCY}{cartSubtotal.toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleCheckout} className="pos-modal-form">
              <label className="pos-label">Full Name</label>
              <input className="pos-input" type="text" placeholder="Your name"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <label className="pos-label">Email Address</label>
              <input className="pos-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              <label className="pos-label">Phone Number</label>
              <input className="pos-input" type="tel" placeholder="+44 7700 000000"
                value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
              <p className="pos-modal-note">A confirmation email will be sent to you. Payment is cash at pickup.</p>
              {checkoutError && <p className="pos-error">{checkoutError}</p>}
              <div className="pos-modal-actions">
                <button type="button" className="pos-outline-btn" onClick={() => setCheckoutOpen(false)}>Back</button>
                <button type="submit" className="pos-place-order-btn pos-flex1" disabled={placing}>
                  {placing ? 'Placing order...' : `Confirm Order · ${CURRENCY}${cartSubtotal.toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
