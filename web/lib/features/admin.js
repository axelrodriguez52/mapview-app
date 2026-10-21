// features/admin.js — Acceso administrador y gestión de la contraseña.

import { gsap } from 'gsap';
import { ADMIN_PASSWORD_DEFAULT, GOOGLE_SHEETS_URL } from '../core/constants.js';
import { $adminLoginBtn, $adminLogoutBtn, $loginCancel, $loginError, $loginModal, $loginPassword, $loginSubmit } from '../core/dom.js';
import { state } from '../core/state.js';
import { sheetFetch } from '../services/sheets.js';
import { renderDetailRecords } from './detail.js';

export function fetchAdminPassword() {
  return sheetFetch(`${GOOGLE_SHEETS_URL}?action=getPassword`, 12000)
    .then(r => r.json())
    .then(data => {
      const clave = data.clave || data.password;
      if (clave) {
        state.adminPassword = clave.toString().trim();
      }
      state.passwordFetched = true;
    })
    .catch(() => {
      state.adminPassword = ADMIN_PASSWORD_DEFAULT;
      state.passwordFetched = true;
    });
}

export function setAdminMode(active) {
  state.isAdmin = active;
  document.body.classList.toggle('is-admin', active);
  localStorage.setItem('mapview-admin', active ? '1' : '0');
  updateAdminUI();
  if (state.selectedBlockKey) renderDetailRecords();
}

export function updateAdminUI() {
  const emptyBtn = document.querySelector('.map-empty-btn');
  if (emptyBtn) {
    emptyBtn.style.display = state.isAdmin ? '' : 'none';
  }
}

export function checkLogin() {
  const entered = $loginPassword.value.trim();
  if (entered && entered === state.adminPassword) {
    setAdminMode(true);
    $loginModal.classList.remove('active');
    $loginError.classList.remove('show');
  } else {
    $loginError.textContent = 'Contraseña incorrecta. Intenta de nuevo.';
    $loginError.classList.add('show');
    $loginPassword.value = '';
    $loginPassword.focus();
  }
}

/** Conecta el modal de acceso y restaura la sesión de administrador. */
export function initAdmin() {
  $adminLoginBtn.addEventListener('click', () => {
    $loginPassword.value = '';
    $loginError.classList.remove('show');
    $loginModal.classList.add('active');
    gsap.fromTo($loginModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo('.login-box', {
      opacity: 0,
      scale: 0.9,
      y: 12
    }, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.45,
      ease: 'back.out(1.5)',
      delay: 0.05
    });
    setTimeout(() => $loginPassword.focus(), 200);
  });

  $adminLogoutBtn.addEventListener('click', () => {
    setAdminMode(false);
  });

  $loginCancel.addEventListener('click', () => {
    gsap.to('.login-box', {
      opacity: 0,
      scale: 0.92,
      y: 8,
      duration: 0.25,
      ease: 'power2.in'
    });
    gsap.to($loginModal, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => { $loginModal.classList.remove('active'); }
    });
  });

  $loginModal.addEventListener('click', (e) => {
    if (e.target === $loginModal) $loginModal.classList.remove('active');
  });

  $loginSubmit.addEventListener('click', () => {
    if (!state.passwordFetched) {
      $loginError.textContent = 'Verificando...';
      $loginError.classList.add('show');
      fetchAdminPassword().then(() => {
        checkLogin();
      });
      return;
    }
    checkLogin();
  });

  $loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $loginSubmit.click();
    if (e.key === 'Escape') $loginModal.classList.remove('active');
  });

  // Restaurar sesión de administrador
  if (localStorage.getItem('mapview-admin') === '1') {
    setAdminMode(true);
  }
}
