import React, { useState } from 'react';
import PageWrapper, { PageTitle, PageSubtitle, Section, Divider } from './PageWrapper';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const subjects = [
  'General Enquiry',
  'Technical Support',
  'Billing & Payments',
  'Partnership Opportunity',
  'Report an Issue',
  'Press & Media',
  'Data & Privacy',
  'Other',
];

const inputStyle = {
  width: '100%', padding: '0.85rem 1rem',
  borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#fff',
  fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', outline: 'none',
  transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block', marginBottom: '0.45rem',
  color: '#9ca3af', fontSize: '0.82rem', fontWeight: '600',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function ContactUs({ onBack }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');
      setStatus('success');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  return (
    <PageWrapper onBack={onBack}>
      <PageTitle>Contact Us</PageTitle>
      <PageSubtitle>
        Have a question, issue, or idea? Fill in the form below and our team will get back to you as soon as possible.
      </PageSubtitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '3rem', alignItems: 'start' }}>

        {/* Form column */}
        <div>
          {status === 'success' ? (
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '16px', padding: '2.5rem', textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✉️</div>
              <h3 style={{ color: '#10B981', fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Message Sent!</h3>
              <p style={{ color: '#9ca3af', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Thank you for reaching out, <strong style={{ color: '#fff' }}>{form.name}</strong>.<br />
                We've received your message and sent a confirmation to <strong style={{ color: '#fff' }}>{form.email}</strong>.<br />
                Our team will respond as soon as possible.
              </p>
              <button
                onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: '', message: '' }); }}
                style={{ marginTop: '1.5rem', padding: '0.7rem 1.5rem', borderRadius: '8px', border: 'none', background: 'rgba(255,90,0,0.15)', color: '#FF5A00', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input type="text" required value={form.name} onChange={set('name')}
                    placeholder="John Smith" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#FF5A00'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email Address *</label>
                  <input type="email" required value={form.email} onChange={set('email')}
                    placeholder="you@example.com" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#FF5A00'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Subject *</label>
                <select required value={form.subject} onChange={set('subject')}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => e.target.style.borderColor = '#FF5A00'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                >
                  <option value="" disabled style={{ background: '#1a1a1a' }}>Select a subject…</option>
                  {subjects.map(s => <option key={s} value={s} style={{ background: '#1a1a1a' }}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Message *</label>
                <textarea required rows={6} value={form.message} onChange={set('message')}
                  placeholder="Describe your query in detail…"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '140px' }}
                  onFocus={e => e.target.style.borderColor = '#FF5A00'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
              </div>

              {status === 'error' && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#EF4444', fontSize: '0.88rem' }}>
                  {errorMsg || 'Something went wrong. Please try again.'}
                </div>
              )}

              <button
                type="submit" disabled={status === 'loading'}
                style={{
                  padding: '0.95rem', borderRadius: '12px', border: 'none',
                  background: status === 'loading' ? 'rgba(255,90,0,0.5)' : 'linear-gradient(135deg, #FF5A00, #FF8A00)',
                  color: '#fff', fontFamily: 'inherit', fontWeight: '700', fontSize: '1rem',
                  cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'opacity 0.2s',
                }}
              >
                {status === 'loading' ? (
                  <>
                    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Sending…
                  </>
                ) : 'Send Message →'}
              </button>

              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

              <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center' }}>
                By submitting this form, you agree to our{' '}
                <span style={{ color: '#FF5A00' }}>Privacy Policy</span>.
                We'll only use your details to respond to your enquiry.
              </p>
            </form>
          )}
        </div>

        {/* Info sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {[
            { icon: '📧', title: 'Email Us', detail: 'info@alpha-devs.cloud', link: 'mailto:info@alpha-devs.cloud' },
            { icon: '⏱️', title: 'Response Time', detail: 'Within 24–48 business hours', link: null },
            { icon: '🌍', title: 'Support Hours', detail: 'Mon – Fri, 9am – 6pm (PKT)', link: null },
          ].map(({ icon, title, detail, link }) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ fontWeight: '700', color: '#fff', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{title}</p>
                {link ? (
                  <a href={link} style={{ color: '#FF5A00', textDecoration: 'none', fontSize: '0.88rem' }}>{detail}</a>
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>{detail}</p>
                )}
              </div>
            </div>
          ))}

          <div style={{ background: 'rgba(255,90,0,0.07)', border: '1px solid rgba(255,90,0,0.2)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontWeight: '700', color: '#FF5A00', fontSize: '0.88rem', marginBottom: '0.5rem' }}>🍃 Fighting Food Waste Together</p>
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', lineHeight: 1.6 }}>
              Every question helps us improve Grabengo. We read every message personally and take your feedback seriously.
            </p>
          </div>
        </div>

      </div>

      <Divider />

      <Section title="Frequently Asked Questions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { q: 'How do I reset my password?', a: 'Use the "Forgot Password" option on the login screen. You\'ll receive an OTP to your registered email.' },
            { q: 'Can I list my business on Grabengo?', a: 'Yes! Click "Register as Seller" on our homepage or use the seller registration page, then log in to manage your stores.' },
            { q: 'How do refunds work?', a: 'If a business fails to fulfil your order, contact us within 24 hours of the scheduled pickup time for a refund.' },
            { q: 'Is my data safe?', a: 'Absolutely. We use industry-standard encryption and comply with GDPR. See our Privacy Policy for full details.' },
          ].map(({ q, a }) => (
            <div key={q} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem' }}>
              <p style={{ color: '#fff', fontWeight: '600', marginBottom: '0.3rem', fontSize: '0.95rem' }}>{q}</p>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </Section>
    </PageWrapper>
  );
}
