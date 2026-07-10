import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BusWatch — crowdsourced speed audit of Greater Malé public transport';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Same tokens as tokens.css, flattened to hex for the OG renderer.
const paper = '#14161c';
const paper2 = '#1d2029';
const line = '#3a3f4d';
const ink = '#eceef2';
const dim = '#9aa1b0';
const amber = '#f0b429';
const red = '#e5484d';

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: paper,
          color: ink,
          padding: 72,
          fontFamily: 'sans-serif',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>BusWatch</div>
          <div style={{ width: 120, height: 8, background: amber, borderRadius: 4, marginTop: 8, marginBottom: 28 }} />
          <div style={{ fontSize: 30, color: dim, lineHeight: 1.4 }}>
            Crowdsourced speed audit of Greater Malé public transport. Riders are the sensors; the aggregate is the
            evidence.
          </div>
          <div style={{ display: 'flex', marginTop: 36, gap: 6 }}>
            {[amber, amber, amber, red, red, amber, red, red, red, amber, amber].map((c, i) => (
              <div key={i} style={{ width: 42, height: 10, background: c, borderRadius: 5 }} />
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: paper2,
            border: `2px solid ${line}`,
            borderRadius: 24,
            padding: '48px 64px',
          }}
        >
          <div style={{ fontSize: 150, fontWeight: 800, color: red, lineHeight: 1 }}>62</div>
          <div style={{ fontSize: 28, color: dim, marginBottom: 20 }}>km/h</div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: red,
              border: `3px solid ${red}`,
              borderRadius: 999,
              padding: '8px 28px',
            }}
          >
            LIMIT 50
          </div>
          <div style={{ fontSize: 22, color: dim, marginTop: 18 }}>Sinamalé Bridge</div>
        </div>
      </div>
    ),
    size
  );
}
