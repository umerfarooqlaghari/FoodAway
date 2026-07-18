import React, { useState } from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

export default function DoNotSell({ onBack }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Do Not Sell or Share My Data</PageTitle>
      <PageSubtitle>Exercise your rights under CCPA and similar privacy laws to opt out of data sharing.</PageSubtitle>

      <Section title="Your Rights">
        <p>
          Under the California Consumer Privacy Act (CCPA) and similar laws, you have the right to
          opt out of the sale or sharing of your personal information for cross-context behavioural
          advertising purposes.
        </p>
        <br />
        <p>
          Grabengo does not sell personal data in the traditional sense. However, we may share certain
          identifiers (such as device IDs or browsing behaviour) with advertising and analytics partners.
          You can opt out of this sharing using the form below.
        </p>
      </Section>

      <Divider />

      <Section title="What Data May Be Shared?">
        <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Device identifiers and IP address.</li>
          <li>Browsing behaviour and interaction data.</li>
          <li>Inferred interests for advertising purposes.</li>
        </ul>
        <br />
        <p>We do not share sensitive personal data such as financial information, health data, or government IDs.</p>
      </Section>

      <Divider />

      <Section title="Submit Your Opt-Out Request">
        {submitted ? (
          <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
            <p style={{ color: '#10B981', fontWeight: '700', fontSize: '1.1rem' }}>Opt-out request received</p>
            <p style={{ color: '#9ca3af', marginTop: '0.4rem', fontSize: '0.9rem' }}>
              We have received your request and will process it within 15 business days.
              You will receive a confirmation at the email provided.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600' }}>Full Name</label>
              <input
                type="text" required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Your full name"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#9ca3af', fontSize: '0.85rem', fontWeight: '600' }}>Email Address</label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ padding: '0.8rem 1.5rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #FF5C00, #E55200)', color: '#fff', fontFamily: 'inherit', fontWeight: '700', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Submitting…' : 'Submit Opt-Out Request'}
            </button>
          </form>
        )}
      </Section>

      <Divider />

      <Section title="Additional Options">
        <p>
          You may also submit your request by emailing{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5C00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>{' '}
          with the subject line "Do Not Sell My Data". We will respond within 15 business days.
        </p>
        <br />
        <p>
          Opting out of data sharing will not affect your ability to use Grabengo or the prices you
          receive. You may continue to use all features of the platform.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
