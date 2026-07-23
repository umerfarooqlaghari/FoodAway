import React, { useEffect, useRef, useState } from 'react';
import Map, { Marker } from 'react-map-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

async function searchPlaces(query) {
  if (!query?.trim() || !MAPBOX_TOKEN) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Address search failed');
  const data = await res.json();
  return data.features || [];
}

export default function LocationMapPicker({
  lat = 51.5074,
  lng = -0.1278,
  onChange,
  onAddressChange,
  addressHint = '',
  height = 220,
  disabled = false,
}) {
  const mapRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (addressHint && !searchText) {
      setSearchText(addressHint);
    }
  }, [addressHint]);

  const setCoords = (nextLat, nextLng, nextAddress) => {
    if (disabled) return;
    onChange?.(nextLat, nextLng);
    if (nextAddress && onAddressChange) onAddressChange(nextAddress);
    mapRef.current?.flyTo?.({ center: [nextLng, nextLat], zoom: 15, duration: 800 });
    setResults([]);
  };

  const runSearch = async (query) => {
    const text = (query ?? searchText).trim();
    if (!text) {
      setSearchError('Enter an address, postcode, or place name.');
      return;
    }
    if (!MAPBOX_TOKEN) {
      setSearchError('Map search is unavailable — add VITE_MAPBOX_TOKEN.');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const features = await searchPlaces(text);
      if (!features.length) {
        setResults([]);
        setSearchError('No locations found. Try a more specific address.');
        return;
      }
      if (features.length === 1) {
        const [featureLng, featureLat] = features[0].center;
        setCoords(featureLat, featureLng, features[0].place_name);
        setSearchText(features[0].place_name);
        return;
      }
      setResults(features);
    } catch (err) {
      setSearchError(err.message || 'Could not search for that address.');
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (feature) => {
    const [featureLng, featureLat] = feature.center;
    setSearchText(feature.place_name);
    setCoords(featureLat, featureLng, feature.place_name);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords(pos.coords.latitude, pos.coords.longitude),
      (err) => alert(err.message || 'Could not get your location.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setSearchError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
          placeholder="Search address, postcode, or city…"
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.7rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: '#F9FAFB',
            color: '#111827',
          }}
        />
        <button
          type="button"
          onClick={() => runSearch()}
          disabled={disabled || searching}
          className="btn-secondary"
          style={{ whiteSpace: 'nowrap', padding: '0.7rem 0.9rem' }}
        >
          {searching ? 'Searching…' : 'Find'}
        </button>
      </div>

      {addressHint?.trim() && addressHint.trim() !== searchText.trim() && (
        <button
          type="button"
          onClick={() => runSearch(addressHint)}
          disabled={disabled || searching}
          style={{
            width: '100%',
            marginBottom: '0.6rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            border: '1px dashed rgba(255, 92, 0, 0.35)',
            background: 'rgba(255, 92, 0, 0.06)',
            color: '#FF5C00',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Locate “{addressHint.trim()}” on map
        </button>
      )}

      {searchError ? (
        <p style={{ fontSize: '0.78rem', color: '#DC2626', margin: '0 0 0.6rem' }}>{searchError}</p>
      ) : null}

      {results.length > 0 && (
        <div style={{ marginBottom: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
          {results.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => selectResult(feature)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.65rem 0.85rem',
                border: 'none',
                borderBottom: '1px solid var(--border-color)',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: '#111827',
              }}
            >
              {feature.place_name}
            </button>
          ))}
        </div>
      )}

      <div style={{ height, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: disabled ? 'default' : 'crosshair' }}>
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ longitude: lng, latitude: lat, zoom: 14 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onClick={(e) => setCoords(e.lngLat.lat, e.lngLat.lng)}
        >
          <Marker
            longitude={lng}
            latitude={lat}
            draggable={!disabled}
            onDragEnd={(e) => setCoords(e.lngLat.lat, e.lngLat.lng)}
            color="#FF5C00"
          />
        </Map>
      </div>
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          width: '100%', marginTop: '0.6rem', padding: '0.6rem',
          background: '#FFFFFF', border: '1px solid rgba(255, 92, 0, 0.15)', borderRadius: '8px',
          color: '#FF5C00', fontWeight: '700', fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        Use Current Location
      </button>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0.4rem 0 0' }}>
        Search above or drag the pin · {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
      </p>
    </div>
  );
}
