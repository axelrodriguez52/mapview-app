import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'MapView — Visualizador KML',
  description: 'Visualiza y gestiona tus territorios KML',
  applicationName: 'MapView',
  manifest: '/mapview-app/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MapView'
  },
  icons: {
    icon: '/mapview-app/icon-192.png',
    apple: '/mapview-app/icon-192.png'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f1729'
};

const themeScript = `try{var t=localStorage.getItem('mapview-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://script.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://script.googleusercontent.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
