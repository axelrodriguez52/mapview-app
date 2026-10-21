'use client';

import { useEffect } from 'react';
import AppUI from './AppUI';
import Splash from './Splash';

export default function MapViewApp() {
  useEffect(() => {
    let mounted = true;
    // El motor (Leaflet + GSAP + jsPDF) se carga solo en el navegador,
    // nunca durante el render en servidor.
    import('@/lib/app').then(({ initApp }) => {
      if (mounted) initApp();
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <Splash />
      <AppUI />
    </>
  );
}
