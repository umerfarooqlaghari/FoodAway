import React from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

const stats = [
  { figure: '1/3', label: 'of all food produced globally is lost or wasted each year', source: 'FAO, 2019' },
  { figure: '8–10%', label: 'of global greenhouse gas emissions are linked to food waste', source: 'UNEP, 2021' },
  { figure: '£14bn', label: 'worth of food is thrown away by UK households annually', source: 'WRAP, 2023' },
  { figure: '88M tonnes', label: 'of food is wasted across the EU each year', source: 'Eurostat, 2022' },
];

const sources = [
  { org: 'FAO (Food and Agriculture Organization of the United Nations)', url: 'https://www.fao.org/food-loss-and-food-waste/en/', desc: 'Global data on food loss and waste across supply chains.' },
  { org: 'UNEP (United Nations Environment Programme)', url: 'https://www.unep.org/resources/report/unep-food-waste-index-report-2021', desc: 'Food Waste Index Report 2021 — global household and retail waste estimates.' },
  { org: 'WRAP (Waste & Resources Action Programme)', url: 'https://wrap.org.uk/resources/report/food-surplus-and-waste-uk-key-facts', desc: 'UK-specific food surplus and waste data for households and supply chains.' },
  { org: 'Eurostat', url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php/Food_waste_statistics', desc: 'EU-wide food waste statistics covering households, food service, and retail.' },
  { org: 'ReFED', url: 'https://refed.org/', desc: 'US-focused research on reducing food waste across the food system.' },
  { org: 'Project Drawdown', url: 'https://drawdown.org/solutions/reduced-food-waste', desc: 'Research on climate impact of food waste reduction as a climate solution.' },
];

export default function FoodWasteSources({ onBack }) {
  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Food Waste Sources</PageTitle>
      <PageSubtitle>The data and research behind Grabengo's mission to fight food waste globally.</PageSubtitle>

      <Section title="The Scale of the Problem">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          {stats.map(({ figure, label, source }) => (
            <div key={figure} style={{ background: 'rgba(255, 92, 0,0.07)', border: '1px solid rgba(255, 92, 0,0.18)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: '#FF5C00' }}>{figure}</span>
              <p style={{ color: '#d1d5db', fontSize: '0.88rem', lineHeight: 1.5 }}>{label}</p>
              <span style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 'auto' }}>{source}</span>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      <Section title="Our Methodology">
        <p>
          Grabengo uses data from leading international organisations to communicate the impact of food
          waste. All statistics cited on our platform, marketing materials, and communications are sourced
          from peer-reviewed research or established governmental and intergovernmental bodies.
        </p>
        <br />
        <p>
          We are committed to accuracy and transparency. If you believe any statistic is outdated or
          inaccurate, please contact us at{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5C00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>.
        </p>
      </Section>

      <Divider />

      <Section title="Primary Data Sources">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
          {sources.map(({ org, url, desc }) => (
            <div key={org} style={{ borderLeft: '3px solid rgba(255, 92, 0,0.4)', paddingLeft: '1.25rem' }}>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#FF5C00', textDecoration: 'none', fontWeight: '600', fontSize: '0.95rem' }}>
                {org} ↗
              </a>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginTop: '0.25rem' }}>{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      <Section title="Impact of Grabengo">
        <p>
          Every surprise bag rescued through Grabengo helps divert food from landfill. On average, rescuing
          one surprise bag prevents approximately 2.5 kg of CO₂ equivalent emissions — equivalent to
          charging a smartphone over 300 times.
        </p>
        <br />
        <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>
          Internal estimates based on EU average food production emission factors (WRAP, 2023) and average
          surprise bag weight of 1.2–2kg of food.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Last updated: June 2026</p>
    </PageWrapper>
  );
}
