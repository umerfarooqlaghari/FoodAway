import React from 'react';
import GrabengoLogoMark from '../components/GrabengoLogoMark';

export default function PageWrapper({ onBack, children }) {
  return (
    <div className="legal-page">
      <nav className="legal-page-nav">
        <div className="legal-page-brand" onClick={onBack} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onBack?.()}>
          <GrabengoLogoMark size={28} textClassName="legal-page-brand-text" onDarkBg />
        </div>
        <button type="button" className="legal-page-back" onClick={onBack}>
          ← Back to Home
        </button>
      </nav>

      <main className="legal-page-main">
        {children}
      </main>

      <footer className="legal-page-footer">
        © {new Date().getFullYear()} Grabengo. All Rights Reserved.
      </footer>
    </div>
  );
}

export function PageTitle({ children }) {
  return <h1 className="legal-page-title">{children}</h1>;
}

export function PageSubtitle({ children }) {
  return <p className="legal-page-subtitle">{children}</p>;
}

export function Section({ title, children }) {
  return (
    <section className="legal-page-section">
      {title && <h2 className="legal-page-section-title">{title}</h2>}
      <div className="legal-page-section-body">{children}</div>
    </section>
  );
}

export function Divider() {
  return <hr className="legal-page-divider" />;
}
