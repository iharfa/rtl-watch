import type { Metadata, Viewport } from 'next';
import './globals.css';

const DESCRIPTION =
  'Crowdsourced speed audit of Greater Malé public transport. Riders log RTL bus, taxi and other rides on their own phones; speeds are checked against per-road limits and pooled into segment-level evidence.';

export const metadata: Metadata = {
  metadataBase: new URL('https://rtl-watch.vercel.app'),
  title: 'BusWatch — RTL Speed Audit',
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'BusWatch — RTL Speed Audit',
    description: DESCRIPTION,
    url: 'https://rtl-watch.vercel.app',
    siteName: 'BusWatch',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BusWatch — RTL Speed Audit',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#14161c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === 'production'
                ? `if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}`
                : // dev: a stale SW serves mismatched dev chunks — make sure none is active
                  `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));caches?.keys().then(ks=>ks.forEach(k=>caches.delete(k)))}`,
          }}
        />
      </body>
    </html>
  );
}
