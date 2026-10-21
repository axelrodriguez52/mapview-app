// features/rename.js — Renombrado de mapas KML.

import { gsap } from 'gsap';
import { GOOGLE_SHEETS_URL } from '../core/constants.js';
import { $hudName, $mapSelector, $recordsModal, $recordsSearch, $renameCancel, $renameError, $renameInput, $renameModal, $renameSubmit } from '../core/dom.js';
import { state } from '../core/state.js';
import { getVisitStatusInfo } from '../core/utils.js';
import { deleteKmlFromSheet, saveKmlToSheet } from '../services/sheets.js';
import { saveKmlToStorage } from '../services/storage.js';
import { showWorkflowToast } from '../ui/toast.js';
import { findBlockByKey, getPolygonRef } from './detail.js';
import { renderRecordsList, saveRecordsToStorage } from './records.js';
import { renderAllPolygons, renderBlockList, renderMapList, updateStats } from './render.js';
import { openMapSelector } from './selector.js';

let renameTargetIndex = -1;

export function openRenameModal(kmlIndex) {
  const kml = state.allKmlData[kmlIndex];
  if (!kml) return;
  renameTargetIndex = kmlIndex;
  $renameInput.value = kml.fileName.replace(/\.(kml|xml)$/i, '');
  $renameError.classList.remove('show');
  $renameModal.classList.add('active');
  gsap.fromTo($renameModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.rename-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
  setTimeout(() => { $renameInput.focus(); $renameInput.select(); }, 200);
}

export function closeRenameModal() {
  gsap.to('.rename-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($renameModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $renameModal.classList.remove('active');
      $renameModal.style.opacity = '';
      renameTargetIndex = -1;
    }
  });
}

export function confirmRenameKml() {
  if (renameTargetIndex === -1) return;
  const kml = state.allKmlData[renameTargetIndex];
  if (!kml) { closeRenameModal(); return; }

  const oldFileName = kml.fileName;
  const oldTitle = oldFileName.replace(/\.(kml|xml)$/i, '');
  const newTitle = $renameInput.value.trim();

  if (!newTitle) {
    $renameError.textContent = 'El título no puede estar vacío.';
    $renameError.classList.add('show');
    return;
  }
  const isDuplicate = state.allKmlData.some((k, i) =>
    i !== renameTargetIndex && k.fileName.replace(/\.(kml|xml)$/i, '').toLowerCase() === newTitle.toLowerCase()
  );
  if (isDuplicate) {
    $renameError.textContent = 'Ya existe un KML con ese título.';
    $renameError.classList.add('show');
    return;
  }

  const extMatch = oldFileName.match(/\.(kml|xml)$/i);
  const newFileName = newTitle + (extMatch ? extMatch[0] : '.kml');
  if (newFileName === oldFileName) { closeRenameModal(); return; }

  kml.fileName = newFileName;
  state.loadedMaps.forEach(m => {
    if ((m.fileName || m.name) === oldFileName || m.name === oldTitle) {
      m.name = newTitle;
      m.fileName = newFileName;
    }
  });
  state.sheetRecords.forEach(r => {
    if (r.mapName === oldTitle || r.mapName === oldFileName) r.mapName = newTitle;
  });
  saveKmlToStorage();
  saveRecordsToStorage();
  closeRenameModal();

  showWorkflowToast('Sincronizando título con la nube...', '☁️', 10000);

  saveKmlToSheet(newFileName, kml.blocks)
    .then(() => deleteKmlFromSheet(oldFileName))
    .then(() => {
      if (oldTitle !== oldFileName) return deleteKmlFromSheet(oldTitle);
    })
    .then(() => {
      const payload = JSON.stringify({ oldName: oldTitle, newName: newTitle });
      return fetch(`${GOOGLE_SHEETS_URL}?action=renameMapColumn&d=${encodeURIComponent(payload)}`)
        .then(r => r.json())
        .catch(() => null);
    })
    .then(() => showWorkflowToast(`Título actualizado a "${newTitle}" ✓`, '✏️', 3000))
    .catch(() => showWorkflowToast('Título actualizado localmente. Reintenta sincronizar.', '⚠️', 4000));

  renderMapList();
  renderBlockList();
  renderAllPolygons();
  updateStats();
  if (state.selectedBlockKey) {
    const poly = getPolygonRef(state.selectedBlockKey);
    const found = findBlockByKey(state.selectedBlockKey);
    if (poly && found) {
      const polyEl = poly.getElement();
      if (polyEl) {
        const visitStatus = getVisitStatusInfo(found.block.name);
        polyEl.style.fill = visitStatus.colors.fill;
        polyEl.style.stroke = '#ffffff';
        polyEl.classList.add('active-poly');
      }
    }
    const blockItem = document.querySelector(`.block-item[data-map-id="${state.selectedBlockKey.mapId}"][data-local-id="${state.selectedBlockKey.localId}"]`);
    if (blockItem) blockItem.classList.add('active');
    if (found) $hudName.textContent = `${found.mapData.name} — ${found.block.name}`;
  }
  if ($mapSelector.classList.contains('active')) openMapSelector();
  if ($recordsModal.classList.contains('active')) renderRecordsList($recordsSearch.value.trim().toLowerCase());
}

/** Conecta el modal para renombrar un KML. */
export function initRenameUI() {
  $renameCancel.addEventListener('click', closeRenameModal);
  $renameModal.addEventListener('click', (e) => {
    if (e.target === $renameModal) closeRenameModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $renameModal.classList.contains('active')) closeRenameModal();
  });
  $renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $renameSubmit.click();
  });
  $renameSubmit.addEventListener('click', confirmRenameKml);
}
