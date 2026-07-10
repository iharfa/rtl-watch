import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BusWatch — RTL Speed Audit',
  description: 'Crowdsourced speed audit of RTL buses. Riders log trips; aggregates make the case.',
  manifest: '/manifest.webmanifest',
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
