// ui/toast.js — Avisos flotantes (toasts).

import { gsap } from 'gsap';
import { $workflowToast, $workflowToastText } from '../core/dom.js';

let toastTimer = null;

export function showWorkflowToast(text, icon, duration) {
  clearTimeout(toastTimer);
  $workflowToastText.textContent = text;
  $workflowToast.querySelector('.workflow-toast-icon').textContent = icon || '👆';

  gsap.fromTo($workflowToast, {
    opacity: 0,
    y: 20,
    scale: 0.95
  }, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.45,
    ease: 'back.out(1.4)'
  });

  toastTimer = setTimeout(() => {
    gsap.to($workflowToast, {
      opacity: 0,
      y: 12,
      scale: 0.97,
      duration: 0.3,
      ease: 'power2.in'
    });
  }, duration || 4000);
}
