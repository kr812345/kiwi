import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'Kiwi AI Assistant',
  description: 'Personal AI Assistant powered by Synapse OS',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0D1117',
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Kiwi" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <div id="app-container" style={{ height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
          <main style={{ flex: 1, overflow: 'hidden' }}>
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
