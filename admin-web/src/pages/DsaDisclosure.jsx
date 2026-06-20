import React from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

export default function DsaDisclosure({ onBack }) {
  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>DSA Disclosure</PageTitle>
      <PageSubtitle>Grabengo's transparency statement in accordance with the EU Digital Services Act (DSA).</PageSubtitle>

      <Section title="What Is the DSA?">
        <p>
          The Digital Services Act (EU) 2022/2065 is a regulation by the European Union that establishes
          rules for online platforms to ensure transparency, accountability, and user safety across digital
          services. Grabengo is committed to full compliance with the DSA.
        </p>
      </Section>

      <Divider />

      <Section title="Our Role as an Intermediary">
        <p>
          Grabengo operates as an online marketplace that facilitates transactions between food businesses
          ("sellers") and consumers ("buyers"). We do not directly sell or prepare food. We are an
          intermediary service provider under the definition of the DSA.
        </p>
      </Section>

      <Divider />

      <Section title="Content Moderation">
        <p>
          Grabengo has policies in place to prevent the listing of illegal, unsafe, or misleading food
          items. Listings are reviewed against our community guidelines. Users may report content that
          they believe violates applicable law or our policies.
        </p>
        <br />
        <p>
          To report illegal or harmful content, please contact:{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>
        </p>
      </Section>

      <Divider />

      <Section title="Transparency on Recommender Systems">
        <p>
          Grabengo uses algorithmic systems to surface nearby, relevant surprise bags and food items based
          on factors such as:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>User's geographic location.</li>
          <li>Store availability and quantity.</li>
          <li>Pickup time proximity.</li>
          <li>User's saved favourites.</li>
        </ul>
        <br />
        <p>
          We do not use profiling based on sensitive personal data for recommending content.
        </p>
      </Section>

      <Divider />

      <Section title="Advertising Transparency">
        <p>
          Any promoted or sponsored listings on Grabengo are clearly labelled. We do not use
          micro-targeted advertising based on sensitive categories of personal data (e.g. health,
          religion, or political opinion) as defined under DSA Article 26.
        </p>
      </Section>

      <Divider />

      <Section title="User Rights Under the DSA">
        <p>Users of Grabengo have the right to:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Know why content was removed or accounts suspended.</li>
          <li>Challenge content moderation decisions through our internal complaints process.</li>
          <li>Access an out-of-court dispute settlement body.</li>
          <li>Report illegal content directly to our team.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Point of Contact">
        <p>
          Grabengo designates the following as the single point of contact for DSA-related enquiries from
          EU authorities and users:
        </p>
        <br />
        <p><strong style={{ color: '#fff' }}>Email:</strong>{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>
        </p>
        <p><strong style={{ color: '#fff' }}>Languages supported:</strong> English</p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
