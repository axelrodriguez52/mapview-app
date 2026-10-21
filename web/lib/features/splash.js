// features/splash.js — Splash de inicio y progreso de carga.

import { gsap } from 'gsap';
import { $intro, $mapSelector, $splashBar, $splashPct, $splashStatus } from '../core/dom.js';
import { state } from '../core/state.js';
import { fetchKmlsFromSheet } from '../services/sheets.js';
import { openMapSelector } from './selector.js';

const splashState = { pct: 0 };

const SPLASH_MIN_MS = 2200;

const SPLASH_MAX_MS = 5200;

let splashStart = performance.now();

let splashFinished = false;

let onSplashDone = null;

export function splashProgress(target, status) {
  if (splashFinished) return;
  gsap.to(splashState, {
    pct: target,
    duration: Math.max(0.45, Math.abs(target - splashState.pct) / 55),
    ease: 'power2.out',
    overwrite: 'auto',
    onUpdate: () => {
      const v = Math.round(splashState.pct);
      if ($splashBar) $splashBar.style.width = v + '%';
      if ($splashPct) $splashPct.textContent = v + '%';
    },
    onComplete: () => {
      if (status && $splashStatus) $splashStatus.textContent = status;
    }
  });
}

export function splashExit() {
  if ($splashStatus) $splashStatus.textContent = 'Listo';
  gsap.to('.splash-content', {
    y: -16,
    opacity: 0,
    duration: 0.42,
    ease: 'power2.in'
  });
  gsap.to('#intro', {
    opacity: 0,
    scale: 1.045,
    duration: 0.55,
    ease: 'power2.inOut',
    onComplete: () => { if (onSplashDone) onSplashDone(); }
  });
}

export function finishSplash() {
  if (splashFinished) return;
  splashFinished = true;
  gsap.to(splashState, {
    pct: 100,
    duration: Math.max(0.3, (100 - splashState.pct) / 90),
    ease: 'power2.out',
    overwrite: 'auto',
    onUpdate: () => {
      const v = Math.round(splashState.pct);
      if ($splashBar) $splashBar.style.width = v + '%';
      if ($splashPct) $splashPct.textContent = v + '%';
    },
    onComplete: splashExit
  });
  // Respaldo duro: si GSAP no avanza (p. ej. pestaña en segundo plano),
  // la app aparece igualmente.
  setTimeout(() => { if (onSplashDone) onSplashDone(); }, 1900);
}

export function splashReady() {
  const elapsed = performance.now() - splashStart;
  setTimeout(finishSplash, Math.max(0, SPLASH_MIN_MS - elapsed));
}

/**
 * Arranca la secuencia del splash.
 * @param {() => void} onShowApp callback que revela la app al terminar.
 */
export function initSplash(onShowApp) {
  onSplashDone = onShowApp;
  splashStart = performance.now();

  splashProgress(22, 'Cargando mapas…');
  const kmlsReady = fetchKmlsFromSheet();
  Promise.resolve(state.recordsReady).then(() => splashProgress(62, 'Sincronizando territorios…'));
  kmlsReady.then(ok => splashProgress(ok ? 86 : 78, ok ? 'Preparando el mapa…' : 'Usando mapas guardados…'));

  // Sale cuando registros + KMLs estén listos (o al tope de tiempo), con un
  // mínimo de 2.2 s para que la animación de bienvenida se aprecie completa.
  Promise.race([
    Promise.allSettled([Promise.resolve(state.recordsReady), Promise.resolve(kmlsReady)]),
    new Promise(res => setTimeout(res, SPLASH_MAX_MS))
  ]).then(splashReady);
  setTimeout(finishSplash, 9000);

  kmlsReady.then(ok => {
    if (!ok) return;
    if ($intro.style.display === 'none' && ($mapSelector.classList.contains('active') || state.loadedMaps.length === 0)) {
      openMapSelector();
    }
  });
}
