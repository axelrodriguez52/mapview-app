// features/theme.js — Tema claro/oscuro y sincronización del mapa base.

import { $themeToggle } from '../core/dom.js';
import { syncMapLayer } from './map.js';

export function getPreferredTheme() {
  const saved = localStorage.getItem('mapview-theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mapview-theme', theme);
}

/** Aplica el tema guardado y conecta el botón de cambio de tema. */
export function initTheme() {
  applyTheme(getPreferredTheme());
  $themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
    syncMapLayer();
  });
}
