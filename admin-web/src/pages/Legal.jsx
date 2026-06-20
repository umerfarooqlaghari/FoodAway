import React from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

export default function Legal({ onBack }) {
  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Legal Information</PageTitle>
      <PageSubtitle>Important legal disclosures and corporate information for Grabengo.</PageSubtitle>

      <Section title="Company Details">
        <p><strong style={{ color: '#fff' }}>Company Name:</strong> Grabengo</p>
        <p><strong style={{ color: '#fff' }}>Registered Address:</strong> Karachi, Pakistan</p>
        <p><strong style={{ color: '#fff' }}>Business Registration:</strong> Registered under applicable local law</p>
        <p><strong style={{ color: '#fff' }}>VAT Number:</strong> Available upon request</p>
        <p><strong style={{ color: '#fff' }}>Contact:</strong>{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>
        </p>
      </Section>

      <Divider />

      <Section title="Governing Law">
        <p>
          These terms, and any dispute or claim arising out of or in connection with them or their subject
          matter or formation, shall be governed by and construed in accordance with applicable law.
          Any disputes shall be subject to the exclusive jurisdiction of the competent courts.
        </p>
      </Section>

      <Divider />

      <Section title="Intellectual Property">
        <p>
          All content, trademarks, logos, and intellectual property on the Grabengo platform are owned by
          Grabengo or its licensors. Unauthorised use, reproduction, or distribution is strictly
          prohibited without prior written consent.
        </p>
      </Section>

      <Divider />

      <Section title="Liability Disclaimer">
        <p>
          Grabengo operates as a marketplace platform connecting consumers with food businesses. We do not
          produce, prepare, or sell food directly. Grabengo shall not be held liable for the quality,
          safety, or suitability of any food products listed by partner businesses on our platform.
        </p>
        <br />
        <p>
          We endeavour to ensure all information on the platform is accurate and up-to-date, but we make
          no warranties, express or implied, as to the completeness or accuracy of such information.
        </p>
      </Section>

      <Divider />

      <Section title="Changes to Legal Terms">
        <p>
          Grabengo reserves the right to update or modify these legal terms at any time. Continued use of
          the platform following any changes constitutes acceptance of the revised terms. We encourage
          users to review this page periodically.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
