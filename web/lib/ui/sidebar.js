// ui/sidebar.js — Apertura y cierre de la barra lateral.

import { gsap } from 'gsap';
import { $menuToggle, $sidebar, $sidebarClose, $sidebarOverlay } from '../core/dom.js';
import { state } from '../core/state.js';
import { debounce, isMobile, isTablet, isTouchDevice } from '../core/utils.js';

export function openSidebar() {
  $sidebar.classList.add('open');
  $sidebarOverlay.classList.add('active');
  $menuToggle.setAttribute('aria-label', 'Cerrar menú');
  gsap.fromTo($sidebarOverlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
}

export function closeSidebar() {
  gsap.to($sidebarOverlay, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $sidebar.classList.remove('open');
      $sidebarOverlay.classList.remove('active');
      $menuToggle.setAttribute('aria-label', 'Abrir menú');
    }
  });
}

export function autoCloseSidebar() {
  if (isMobile() || isTablet()) {
    openSidebar();
  }
}

/** Conecta el menú lateral, el redimensionado y la prevención de doble toque. */
export function initSidebar() {
  $menuToggle.addEventListener('click', () => {
    if ($sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  });

  $sidebarOverlay.addEventListener('click', closeSidebar);
  $sidebarClose.addEventListener('click', closeSidebar);

  window.addEventListener('resize', debounce(() => {
    if (!isMobile() && !isTablet()) {
      $sidebar.classList.remove('open');
      $sidebarOverlay.classList.remove('active');
    }
    state.map.invalidateSize();
  }, 200));

  if (isTouchDevice()) {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    }, false);
  }
}
