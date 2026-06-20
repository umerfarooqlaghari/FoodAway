import React from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

export default function PrivacyPolicy({ onBack }) {
  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Privacy Policy</PageTitle>
      <PageSubtitle>How we collect, use, and protect your personal data. Your privacy matters to us.</PageSubtitle>

      <Section title="Who We Are">
        <p>
          Grabengo ("we", "us", "our") operates the Grabengo platform — a food-rescue marketplace
          that connects consumers with businesses to reduce food waste. This Privacy Policy explains how
          we handle your personal data when you use our services.
        </p>
      </Section>

      <Divider />

      <Section title="Data We Collect">
        <p>We may collect and process the following categories of personal data:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li><strong style={{ color: '#fff' }}>Identity Data:</strong> Name, username, or similar identifiers.</li>
          <li><strong style={{ color: '#fff' }}>Contact Data:</strong> Email address, phone number, delivery address.</li>
          <li><strong style={{ color: '#fff' }}>Transaction Data:</strong> Details about purchases made on our platform.</li>
          <li><strong style={{ color: '#fff' }}>Usage Data:</strong> How you interact with our platform, pages visited, features used.</li>
          <li><strong style={{ color: '#fff' }}>Technical Data:</strong> IP address, browser type, device identifiers.</li>
          <li><strong style={{ color: '#fff' }}>Location Data:</strong> With your consent, approximate GPS location for nearby store discovery.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="How We Use Your Data">
        <p>We use your personal data to:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Provide, operate, and improve our services.</li>
          <li>Process transactions and send related confirmations.</li>
          <li>Communicate with you about orders, promotions, and updates.</li>
          <li>Detect and prevent fraud or misuse of our platform.</li>
          <li>Comply with legal obligations.</li>
          <li>Conduct analytics to improve user experience.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Legal Basis for Processing">
        <p>
          We rely on the following legal bases under GDPR:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li><strong style={{ color: '#fff' }}>Contract:</strong> To fulfil our obligations to you.</li>
          <li><strong style={{ color: '#fff' }}>Legitimate Interests:</strong> For fraud prevention and platform analytics.</li>
          <li><strong style={{ color: '#fff' }}>Consent:</strong> For location data and marketing communications.</li>
          <li><strong style={{ color: '#fff' }}>Legal Obligation:</strong> To comply with applicable law.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Data Sharing">
        <p>
          We do not sell your personal data. We may share it with:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Partner businesses for order fulfilment.</li>
          <li>Cloud service providers (e.g. AWS) for infrastructure.</li>
          <li>Payment processors for transaction handling.</li>
          <li>Legal and regulatory authorities where required by law.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Data Retention">
        <p>
          We retain your personal data only as long as necessary to fulfil the purposes outlined in this
          policy or as required by law. Transaction records are typically retained for 7 years for
          accounting purposes.
        </p>
      </Section>

      <Divider />

      <Section title="Your Rights">
        <p>Under applicable data protection law, you have the right to:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Access your personal data.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Request deletion of your data ("right to be forgotten").</li>
          <li>Object to or restrict processing.</li>
          <li>Data portability.</li>
          <li>Withdraw consent at any time.</li>
        </ul>
        <p style={{ marginTop: '0.75rem' }}>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>.
        </p>
      </Section>

      <Divider />

      <Section title="Cookies">
        <p>
          We use cookies and similar technologies to enhance your experience. See our{' '}
          <span style={{ color: '#FF5A00', cursor: 'pointer' }}>Cookie Policy</span> for full details.
        </p>
      </Section>

      <Divider />

      <Section title="Contact & Complaints">
        <p>
          If you have concerns about how we handle your data, please contact our Data Protection team at{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>.
          You also have the right to lodge a complaint with your local data protection authority.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
