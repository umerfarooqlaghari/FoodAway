import React, { useRef } from 'react';

const inputStyle = {
  flex: 1,
  padding: '0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: '#F9FAFB',
  color: '#111827',
};

export default function ImageUploadField({ value = '', onChange, placeholder = 'Image URL or upload…' }) {
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => onChange?.(event.target.result);
    reader.onerror = () => alert('Could not read that image file.');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileRef.current?.click()}
          style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}
        >
          Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <img
            src={value}
            alt="Preview"
            style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-color)' }}
          />
          <button type="button" onClick={() => onChange?.('')} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
