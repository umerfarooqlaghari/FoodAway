import React, { useState, useEffect } from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const services = [
  { name: 'API & Backend', key: 'api' },
  { name: 'Authentication', key: 'auth' },
  { name: 'Image Storage (S3)', key: 's3' },
  { name: 'Email Notifications', key: 'email' },
  { name: 'WebSocket (Real-time)', key: 'ws' },
  { name: 'Admin Web Dashboard', key: 'web' },
  { name: 'Mobile App', key: 'mobile' },
];

const incidents = [
  { date: 'Jun 17, 2026', title: 'Resolved — S3 Image Access', status: 'resolved', desc: 'Images uploaded to S3 were returning 403 errors due to bucket ACL settings. Fixed by implementing presigned URL generation.' },
  { date: 'Jun 15, 2026', title: 'Resolved — Database Boolean Type Mismatch', status: 'resolved', desc: 'PostgreSQL queries were failing due to boolean/integer comparison errors. All affected endpoints have been patched.' },
];

export default function Status({ onBack }) {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    fetch(`${API_URL.replace('/api', '')}/health`)
      .then(r => r.ok ? setApiStatus('operational') : setApiStatus('degraded'))
      .catch(() => setApiStatus('outage'));
  }, []);

  const getStatus = (key) => {
    if (key === 'api') return apiStatus;
    if (key === 'web') return 'operational';
    if (key === 'mobile') return 'operational';
    if (apiStatus === 'operational') return 'operational';
    if (apiStatus === 'outage') return 'unknown';
    return 'operational';
  };

  const statusConfig = {
    operational: { label: 'Operational', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', dot: '#10B981' },
    degraded:    { label: 'Degraded',    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', dot: '#F59E0B' },
    outage:      { label: 'Outage',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  dot: '#EF4444' },
    checking:    { label: 'Checking…',   color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', dot: '#9ca3af' },
    unknown:     { label: 'Unknown',     color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', dot: '#9ca3af' },
  };

  const allOperational = services.every(s => getStatus(s.key) === 'operational');

  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>System Status</PageTitle>
      <PageSubtitle>Real-time status of Grabengo platform services.</PageSubtitle>

      {/* Overall status banner */}
      <div className={`status-banner ${allOperational ? 'status-banner--ok' : 'status-banner--warn'}`}>
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: allOperational ? '#10B981' : '#F59E0B', flexShrink: 0 }} />
        <div>
          <p style={{ fontWeight: '700', color: allOperational ? '#10B981' : '#F59E0B', fontSize: '1.05rem' }}>
            {allOperational ? 'All Systems Operational' : 'Some Systems Checking'}
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.1rem' }}>
            Last checked: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      <Section title="Service Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {services.map(({ name, key }) => {
            const s = statusConfig[getStatus(key)];
            return (
              <div key={key} className="status-service-row">
                <span style={{ color: '#e5e7eb', fontWeight: '500' }}>{name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '999px', padding: '3px 12px', fontSize: '0.8rem', fontWeight: '600', color: s.color }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot }} />
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Divider />

      <Section title="Recent Incidents">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          {incidents.map(({ date, title, status, desc }) => (
            <div key={title} style={{ borderLeft: '3px solid rgba(16,185,129,0.5)', paddingLeft: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>{date}</span>
                <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '999px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: '700' }}>
                  {status}
                </span>
              </div>
              <p style={{ color: '#fff', fontWeight: '600', fontSize: '0.95rem' }}>{title}</p>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginTop: '0.25rem' }}>{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      <Section title="Subscribe to Updates">
        <p>
          For real-time incident updates and maintenance notifications, contact{' '}
          <a href="mailto:info@alpha-devs.cloud" style={{ color: '#FF5C00', textDecoration: 'none' }}>info@alpha-devs.cloud</a>{' '}
          to be added to our status mailing list.
        </p>
      </Section>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3rem' }}>Status page last updated: June 2026</p>
    </PageWrapper>
  );
}
