import React from 'react';

export default function PageWrapper({ onBack, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: "'Outfit', sans-serif" }}>
      {/* Minimal nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 2rem', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={onBack}>
          <img src="/favicon.png" alt="Grabengo" style={{ height: '32px', objectFit: 'contain' }} />
          <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#fff' }}>Grabengo</span>
        </div>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(255,90,0,0.12)', border: '1px solid rgba(255,90,0,0.3)',
            color: '#FF5A00', padding: '0.45rem 1.1rem', borderRadius: '999px',
            fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,90,0,0.22)'; e.currentTarget.style.borderColor = '#FF5A00'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,90,0,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,90,0,0.3)'; }}
        >
          ← Back to Home
        </button>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        {children}
      </main>

      {/* Footer strip */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '1.5rem 2rem', textAlign: 'center',
        fontSize: '0.8rem', color: '#6b7280'
      }}>
        © {new Date().getFullYear()} Grabengo. All Rights Reserved.
      </footer>
    </div>
  );
}

export function PageTitle({ children }) {
  return (
    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem', lineHeight: 1.2 }}>
      {children}
    </h1>
  );
}

export function PageSubtitle({ children }) {
  return (
    <p style={{ color: '#9ca3af', fontSize: '1.05rem', marginBottom: '3rem', lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

export function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      {title && (
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#FF5A00', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>
          {title}
        </h2>
      )}
      <div style={{ color: '#d1d5db', lineHeight: 1.8, fontSize: '0.97rem' }}>
        {children}
      </div>
    </section>
  );
}

export function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '2.5rem 0' }} />;
}
