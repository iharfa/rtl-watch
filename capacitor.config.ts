import type { CapacitorConfig } from '@capacitor/cli';

// ponytail: remote-mode shell — the APK loads the deployed PWA, so web updates
// ship via Vercel with no APK rebuild. Bundle a static export into webDir if
// offline-first-launch ever matters.
const config: CapacitorConfig = {
  appId: 'mv.buswatch',
  appName: 'BusWatch',
  webDir: 'capacitor-shell',
  server: {
    url: 'https://rtl-watch.vercel.app',
  },
};

export default config;
