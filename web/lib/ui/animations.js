// ui/animations.js — Animaciones GSAP y feedback de botones.

import { gsap } from 'gsap';

/** Animaciones ambientales y feedback táctil de los botones. */
export function initAnimations() {
  document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.upload-btn, .btn-cambiar-mapa, .btn-grabar, .map-empty-btn, .admin-login-btn, .admin-logout-btn, .theme-toggle, .menu-toggle, .login-submit, .login-cancel, .selector-card-btn, .btn-export-pdf, #d-btn-delete');
    if (!btn) return;
    gsap.to(btn, { opacity: 0.7, duration: 0.1, ease: 'power2.in' });
  });

  document.addEventListener('mouseup', () => {
    document.querySelectorAll('.upload-btn, .btn-cambiar-mapa, .btn-grabar, .map-empty-btn, .admin-login-btn, .admin-logout-btn, .theme-toggle, .menu-toggle, .login-submit, .login-cancel, .selector-card-btn').forEach(btn => {
      gsap.to(btn, { opacity: 1, duration: 0.2, ease: 'power2.out' });
    });
  });

  gsap.to('.map-empty-icon', {
    keyframes: [
      { scale: 1.03, borderColor: 'rgba(59,130,246,0.5)', duration: 1.75 },
      { scale: 1, borderColor: 'rgba(59,130,246,0.25)', duration: 1.75 }
    ],
    repeat: -1,
    ease: 'sine.inOut'
  });

  gsap.to('.status-dot', {
    keyframes: [
      { opacity: 0.3, duration: 1 },
      { opacity: 1, duration: 1 }
    ],
    repeat: -1,
    ease: 'sine.inOut'
  });
}
