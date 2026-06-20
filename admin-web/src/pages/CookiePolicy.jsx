import React from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

const cookieTable = [
  { name: 'adminToken', type: 'Essential', duration: 'Session', purpose: 'Stores your admin authentication token for secure access.' },
  { name: 'adminUser', type: 'Essential', duration: 'Session', purpose: 'Stores your user profile data for display within the admin portal.' },
  { name: '_ga, _gid', type: 'Analytics', duration: '2 years / 24 hrs', purpose: 'Google Analytics — helps us understand how the platform is used.' },
  { name: 'mapbox_session', type: 'Functional', duration: 'Session', purpose: 'Used by Mapbox to render interactive store maps.' },
];

export default function CookiePolicy({ onBack }) {
  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Cookie Policy</PageTitle>
      <PageSubtitle>We use cookies to make Grabengo work better for you. Here's what we use and why.</PageSubtitle>

      <Section title="What Are Cookies?">
        <p>
          Cookies are small text files placed on your device when you visit a website. They help the site
          remember your preferences, keep you logged in, and gather analytics to improve our service.
        </p>
      </Section>

      <Divider />

      <Section title="Types of Cookies We Use">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          {[
            { type: 'Essential', color: '#10B981', desc: 'Required for core functionality such as authentication and security. Cannot be disabled.' },
            { type: 'Analytics', color: '#3B82F6', desc: 'Help us understand how visitors use the platform so we can improve it.' },
            { type: 'Functional', color: '#8B5CF6', desc: 'Enable enhanced features like maps and personalised content.' },
            { type: 'Marketing', color: '#F59E0B', desc: 'Used to deliver relevant advertisements. We minimise the use of these.' },
          ].map(({ type, color, desc }) => (
            <div key={type} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: '6px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: '700', whiteSpace: 'nowrap', marginTop: '2px' }}>
                {type}
              </span>
              <p style={{ color: '#d1d5db', fontSize: '0.95rem' }}>{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      <Section title="Cookies We Set">
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['Cookie Name', 'Type', 'Duration', 'Purpose'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cookieTable.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '0.75rem 1rem', color: '#fff', fontFamily: 'monospace', fontSize: '0.83rem' }}>{row.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#FF5A00' }}>{row.type}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#9ca3af' }}>{row.duration}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#d1d5db' }}>{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Divider />

      <Section title="Managing Cookies">
        <p>
          You can control and delete cookies through your browser settings. Note that disabling essential
          cookies may prevent you from using certain features of the platform such as logging in.
        </p>
        <br />
        <p>
          Most browsers allow you to refuse all cookies or to indicate when a cookie is being sent.
          Refer to your browser's help documentation for instructions.
        </p>
      </Section>

      <Divider />

      <Section title="Third-Party Cookies">
        <p>
          Some features of our platform — such as maps and analytics — are powered by third-party services
          that may also set cookies on your device. These are governed by the respective third parties'
          privacy and cookie policies.
        </p>
      </Section>

      <Divider />

      <Section title="Contact Us">
        <p>
          Questions about our cookie use? Email us at{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
