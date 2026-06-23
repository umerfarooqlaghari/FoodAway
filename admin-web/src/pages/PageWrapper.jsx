import React from 'react';
import { grabengoFavicon } from '../brandAssets';

export default function PageWrapper({ onBack, children }) {
  return (
    <div className="legal-page">
      <nav className="legal-page-nav">
        <div className="legal-page-brand" onClick={onBack} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onBack?.()}>
          <img src={grabengoFavicon} alt="Grabengo" />
          <span>Grabengo</span>
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
