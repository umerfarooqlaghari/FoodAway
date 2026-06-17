import React from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

export default function TermsAndConditions({ onBack }) {
  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Terms & Conditions</PageTitle>
      <PageSubtitle>By using FoodAway, you agree to these terms. Please read them carefully before using our platform.</PageSubtitle>

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using the FoodAway platform, you agree to be bound by these Terms and Conditions.
          If you do not agree to any part of these terms, you may not use our services.
        </p>
      </Section>

      <Divider />

      <Section title="2. The Platform">
        <p>
          FoodAway is a digital marketplace that connects consumers with food businesses to reduce food
          waste by offering surplus food at reduced prices. FoodAway ApS acts solely as an intermediary
          and is not the seller of any food items listed on the platform.
        </p>
      </Section>

      <Divider />

      <Section title="3. User Accounts">
        <p>
          To access certain features, you must create an account. You are responsible for maintaining the
          confidentiality of your login credentials and for all activity that occurs under your account.
          You must notify us immediately of any unauthorised access.
        </p>
        <br />
        <p>
          You must provide accurate, current, and complete information when registering. We reserve the
          right to suspend or terminate accounts that violate these terms.
        </p>
      </Section>

      <Divider />

      <Section title="4. Orders and Payments">
        <p>
          All orders placed through FoodAway are subject to availability. Once an order is confirmed, it
          constitutes a binding agreement between you and the partner business. FoodAway is not responsible
          for non-fulfilment by partner businesses.
        </p>
        <br />
        <p>
          Payment is processed at the time of booking. Prices displayed include applicable taxes unless
          otherwise stated. We reserve the right to cancel orders in cases of fraud or suspected misuse.
        </p>
      </Section>

      <Divider />

      <Section title="5. Food Quality & Safety">
        <p>
          Partner businesses are solely responsible for the quality, safety, and accurate labelling of
          their food products. FoodAway does not inspect, guarantee, or assume liability for the quality
          of food offered by businesses on the platform.
        </p>
        <br />
        <p>
          Always check for allergen information directly with the business before collection. Customers
          with food allergies should exercise appropriate caution.
        </p>
      </Section>

      <Divider />

      <Section title="6. Cancellations & Refunds">
        <p>
          Due to the nature of surplus food, all purchases are generally non-refundable once confirmed.
          In cases where a business fails to fulfil an order, you may be entitled to a refund. Please
          contact our support team within 24 hours of the scheduled pickup time.
        </p>
      </Section>

      <Divider />

      <Section title="7. Prohibited Conduct">
        <p>You agree not to:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Use the platform for any unlawful purpose.</li>
          <li>Attempt to gain unauthorised access to our systems.</li>
          <li>Post false, misleading, or defamatory content.</li>
          <li>Resell food purchased through the platform for commercial gain.</li>
          <li>Impersonate any person or entity.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="8. Intellectual Property">
        <p>
          All content on the FoodAway platform — including text, images, logos, and software — is the
          property of FoodAway ApS or its licensors and is protected by applicable intellectual property
          laws. Unauthorised use is strictly prohibited.
        </p>
      </Section>

      <Divider />

      <Section title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, FoodAway ApS shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages arising from your use of the platform,
          including but not limited to loss of profits, data, or goodwill.
        </p>
      </Section>

      <Divider />

      <Section title="10. Modifications">
        <p>
          We reserve the right to modify these Terms at any time. Changes will be effective upon posting
          to the platform. Continued use of FoodAway following any changes constitutes acceptance of the
          revised Terms.
        </p>
      </Section>

      <Divider />

      <Section title="11. Contact">
        <p>
          For questions about these Terms, contact us at{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5A00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
