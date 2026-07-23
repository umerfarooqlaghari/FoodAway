import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { SearchIcon, StoreIcon, BrandsIcon, RestaurantIcon, SupermarketIcon, BakeryIcon, CafeIcon } from './Icons';
import { tenantStoreUrl } from '../host';
import { ROUTES } from '../routePaths';
import TenantBrandLogo from '../components/TenantBrandLogo';
import GrabengoLogoMark from '../components/GrabengoLogoMark';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const CATEGORIES = [
  { id: 'all', label: 'All Brands', Icon: BrandsIcon },
  { id: 'restaurant', label: 'Restaurants', Icon: RestaurantIcon },
  { id: 'supermarket', label: 'Supermarkets', Icon: SupermarketIcon },
  { id: 'bakery', label: 'Bakeries', Icon: BakeryIcon },
  { id: 'cafe', label: 'Cafés', Icon: CafeIcon },
];

function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function tenantCategory(tenant) {
  const text = `${tenant.name} ${tenant.subdomain}`.toLowerCase();
  if (/mart|super|grocery|naheed|imtiaz|marhaba/.test(text)) return 'supermarket';
  if (/baker|bakery|galaxy/.test(text)) return 'bakery';
  if (/cafe|coffee|dunkin|starbucks/.test(text)) return 'cafe';
  if (/kfc|restaurant|pizza|devs|alpha/.test(text)) return 'restaurant';
  return 'all';
}

function Stars({ rating = 4.8 }) {
  return (
    <span className="explore-stars" aria-label={`${rating} stars`}>
      {'★'.repeat(Math.floor(rating))}
      {rating % 1 >= 0.5 ? '½' : ''}
      <span className="explore-stars-num">{rating.toFixed(1)}</span>
    </span>
  );
}

function TenantCard({ tenant, size = 'default', onOpen }) {
  const logoSize = size === 'featured' ? 120 : 88;
  return (
    <article className={`explore-card explore-card--${size}`}>
      <button type="button" className="explore-card-hit" onClick={() => onOpen(tenant)}>
        <div className="explore-card-media">
          <TenantBrandLogo name={tenant.name} logo={tenant.logo} size={logoSize} variant="card" />
        </div>
        <div className="explore-card-body">
          <h3 className="explore-card-title">{tenant.name}</h3>
          <Stars />
          <p className="explore-card-meta">
            {tenant.store_count} store{tenant.store_count !== 1 ? 's' : ''}
            {tenant.distance_km != null && (
              <> · <strong>{formatDistance(tenant.distance_km)}</strong> away</>
            )}
          </p>
          <p className="explore-card-domain">{tenant.subdomain}.grabengo.store</p>
        </div>
        <span className="explore-card-cta" aria-hidden="true">+</span>
      </button>
    </article>
  );
}

export default function TenantExplorePage({ onBack }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [coords, setCoords] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const fetchTenants = useCallback(async (lat, lng) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (lat != null && lng != null) {
        params.set('lat', String(lat));
        params.set('lng', String(lng));
        params.set('sort', 'nearest');
      }
      const qs = params.toString();
      const res = await axios.get(`${API}/public/tenants?require_stores=1${qs ? `&${qs}` : ''}`);
      setTenants((res.data || []).filter((t) => (t.store_count || 0) > 0));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load brands. Please try again.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          fetchTenants(lat, lng);
        },
        () => fetchTenants(),
        { timeout: 8000, maximumAge: 300000 }
      );
    } else {
      fetchTenants();
    }
  }, [fetchTenants]);

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const cat = tenantCategory(t);
      if (category !== 'all' && cat !== category) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (t.name || '').toLowerCase().includes(q) || (t.subdomain || '').toLowerCase().includes(q);
    });
  }, [tenants, search, category]);

  const featured = filtered.slice(0, 2);
  const rest = filtered.slice(2);

  const openTenant = (tenant) => {
    window.location.assign(tenantStoreUrl(tenant.subdomain, '/shop'));
  };

  return (
    <div className="explore-page">
      {/* ── Nav ── */}
      <header className="explore-nav">
        <div className="explore-nav-inner">
          <button type="button" className="explore-nav-back" onClick={onBack}>
            ← Home
          </button>
          <Link to={ROUTES.home} className="explore-nav-brand">
            <GrabengoLogoMark size={22} textClassName="explore-nav-brand-text" />
          </Link>
          <nav className="explore-nav-links" aria-label="Main">
            <Link to={ROUTES.home}>Home</Link>
            <span className="explore-nav-active">Explore</span>
            <Link to={ROUTES.contact}>Contact</Link>
          </nav>
          <button
            type="button"
            className="explore-hamburger"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            <span className="ham-bar" />
            <span className="ham-bar" />
            <span className="ham-bar" />
          </button>
          <div className="explore-nav-search">
            <SearchIcon size={16} color="#888" />
            <input
              type="search"
              placeholder="Search brands, stores, food..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search brands"
            />
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="explore-mobile-nav" aria-label="Mobile">
            <Link to={ROUTES.home} onClick={() => setMobileNavOpen(false)}>Home</Link>
            <span className="explore-nav-active">Explore</span>
            <Link to={ROUTES.contact} onClick={() => setMobileNavOpen(false)}>Contact</Link>
          </nav>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="explore-hero">
        <div className="explore-hero-inner">
          <div className="explore-hero-copy">
            <span className="explore-hero-badge">Rescue food · Save money</span>
            <h1>Shop your favourite brands</h1>
            <p>
              Browse surprise bags and fresh deals from top restaurants and stores near you.
              {coords ? ' Sorted by distance.' : ''}
            </p>
            <button type="button" className="explore-hero-btn" onClick={() => document.getElementById('explore-grid')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore brands
            </button>
          </div>
          <div className="explore-hero-visual" aria-hidden="true">
            <div className="explore-hero-basket">
              <GrabengoLogoMark size={160} showText={false} onDarkBg />
            </div>
          </div>
        </div>
        <svg className="explore-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,45 L1440,80 L0,80 Z" fill="#FAFAFA" />
        </svg>
      </section>

      <main className="explore-main">
        {/* Category chips */}
        <div className="explore-categories">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            const Icon = cat.Icon;
            return (
            <button
              key={cat.id}
              type="button"
              className={`explore-cat ${active ? 'explore-cat--active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              <span className="explore-cat-icon">
                <Icon size={18} color={active ? '#fff' : '#FF5C00'} />
              </span>
              <span>{cat.label}</span>
            </button>
            );
          })}
        </div>

        {error && <div className="explore-error">{error}</div>}

        {loading ? (
          <div className="explore-loading">
            <div className="explore-spinner" />
            <p>Loading brands near you...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="explore-empty">
            <StoreIcon size={48} color="#ddd" />
            <h3>No brands found</h3>
            <p>{search ? `Nothing matches "${search}"` : 'Check back soon for new partners.'}</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="explore-section">
                <div className="explore-section-head">
                  <h2>Featured brands</h2>
                  <p>Top picks with active stores right now</p>
                </div>
                <div className="explore-featured-grid">
                  {featured.map((t) => (
                    <TenantCard key={t.id} tenant={t} size="featured" onOpen={openTenant} />
                  ))}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section className="explore-section" id="explore-grid">
                <div className="explore-section-head">
                  <h2>{coords ? 'Brands near you' : 'All brands'}</h2>
                  <p>{filtered.length} partner{filtered.length !== 1 ? 's' : ''} on Grabengo</p>
                </div>
                <div className="explore-grid">
                  {rest.map((t) => (
                    <TenantCard key={t.id} tenant={t} onOpen={openTenant} />
                  ))}
                </div>
              </section>
            )}

            {featured.length > 0 && rest.length === 0 && (
              <section className="explore-section" id="explore-grid">
                <div className="explore-section-head">
                  <h2>All brands</h2>
                </div>
                <div className="explore-grid">
                  {featured.map((t) => (
                    <TenantCard key={t.id} tenant={t} onOpen={openTenant} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="explore-footer">
        <svg className="explore-footer-wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,20 C480,60 960,0 1440,30 L1440,0 L0,0 Z" fill="#FAFAFA" />
        </svg>
        <div className="explore-footer-inner">
          <div className="explore-footer-brand">
            <GrabengoLogoMark size={24} textClassName="explore-footer-logo-text" />
            <p>Rescue surplus food from brands you love.</p>
          </div>
          <div className="explore-footer-col">
            <h4>Explore</h4>
            <Link to={ROUTES.explore}>All brands</Link>
            <Link to={ROUTES.home}>Home</Link>
          </div>
          <div className="explore-footer-col">
            <h4>Legal</h4>
            <Link to={ROUTES.privacy}>Privacy</Link>
            <Link to={ROUTES.terms}>Terms</Link>
            <Link to={ROUTES.contact}>Contact</Link>
          </div>
          <div className="explore-footer-col">
            <h4>Sellers</h4>
            <Link to={ROUTES.register}>Register your brand</Link>
          </div>
        </div>
        <p className="explore-footer-copy">© {new Date().getFullYear()} Grabengo. All rights reserved.</p>
      </footer>
    </div>
  );
}
