// features/selector.js — Selector de mapas y vista general.

import { gsap } from 'gsap';
import { MAP_COLORS } from '../core/constants.js';
import { $btnCambiarMapa, $mapEmptyState, $mapSelector, $selectorGrid } from '../core/dom.js';
import { state } from '../core/state.js';
import { parseCoordsToLeaflet } from '../core/utils.js';
import { deleteKmlFromSheet } from '../services/sheets.js';
import { deleteKmlData, saveKmlToStorage } from '../services/storage.js';
import { showWorkflowToast } from '../ui/toast.js';
import { removeMap } from './map.js';
import { openRenameModal } from './rename.js';
import { renderAll, renderMapList, updateGeneralBadge, updateSelectorGeneralCard } from './render.js';

export function openMapSelector() {
  $selectorGrid.innerHTML = '';
  $mapEmptyState.classList.add('hidden');

  updateSelectorGeneralCard();

  state.allKmlData.forEach((kml, i) => {
    const color = MAP_COLORS[i % MAP_COLORS.length];
    const card = document.createElement('div');
    card.className = 'selector-card';
    card.style.setProperty('--card-color', color.solid);
    card.style.animationDelay = `${0.1 + i * 0.08}s`;
    card.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color.solid};border-radius:12px 12px 0 0;"></div>
      <div class="selector-card-top">
        <div class="selector-card-dot" style="background:${color.solid}; color:${color.solid}"></div>
        <div class="selector-card-name">${kml.fileName.replace(/\.(kml|xml)$/i, '')}</div>
        <button class="selector-card-rename admin-only" title="Editar título" aria-label="Editar título">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        <button class="selector-card-delete admin-only" title="Eliminar KML" aria-label="Eliminar KML">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="selector-card-count">${kml.blocks.length} polígonos</div>
      <button class="selector-card-btn">Abrir este mapa</button>
    `;
    card.addEventListener('click', () => loadSelectedMap(i));
    const renBtn = card.querySelector('.selector-card-rename');
    renBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRenameModal(i);
    });
    const delBtn = card.querySelector('.selector-card-delete');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`¿Eliminar el KML "${kml.fileName}" y todos sus polígonos?\n\nTambién se borrará de Google Sheets.`)) {
        deleteKmlFromSheet(kml.fileName);
        deleteKmlData(kml.fileName);
        const idx = state.loadedMaps.findIndex(m => (m.fileName || m.name) === kml.fileName || m.name === kml.fileName.replace(/\.(kml|xml)$/i, ''));
        if (idx !== -1) removeMap(state.loadedMaps[idx].id);
        saveKmlToStorage();
        renderMapList();
        openMapSelector();
        showWorkflowToast(`KML "${kml.fileName.replace(/\.(kml|xml)$/i, '')}" eliminado ✓`, '🗑️', 3000);
      }
    });
    $selectorGrid.appendChild(card);
  });

  $mapSelector.classList.add('active');

  gsap.fromTo('.selector-header', {
    opacity: 0,
    y: 16
  }, {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power3.out'
  });

  gsap.fromTo('.selector-card', {
    opacity: 0,
    y: 20,
    scale: 0.95
  }, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.5,
    stagger: 0.07,
    ease: 'back.out(1.4)',
    delay: 0.15
  });
}

export function loadGeneralView() {
  gsap.to($mapSelector, {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      $mapSelector.classList.remove('active');
      $mapSelector.style.opacity = '';
    }
  });

  if (state.allKmlData.length === 0) {
    showWorkflowToast('No hay mapas cargados', '⚠️', 3000);
    return;
  }

  state.loadedMaps = [];
  state.nextMapId = 0;
  state.selectedBlockKey = null;
  state.activeMapFilter = null;

  state.allKmlData.forEach((kml, i) => {
    state.loadedMaps.push({
      id: state.nextMapId++,
      name: kml.fileName.replace(/\.(kml|xml)$/i, ''),
      fileName: kml.fileName,
      color: MAP_COLORS[i % MAP_COLORS.length],
      visible: true,
      blocks: kml.blocks.map((b, j) => ({
        localId: j,
        name: b.name,
        latlngs: parseCoordsToLeaflet(b.coords)
      }))
    });
  });

  state.generalView = true;
  document.getElementById('map-container').classList.add('general-active');
  $btnCambiarMapa.style.display = 'flex';
  document.getElementById('btn-export-pdf').style.display = 'flex';
  document.getElementById('btn-reporte').style.display = 'flex';
  updateGeneralBadge();
  state.recordsReady.then(() => {
    renderAll();
  });
  saveKmlToStorage();
  const totalPolys = state.loadedMaps.reduce((s, m) => s + m.blocks.length, 0);
  showWorkflowToast(`Vista general: ${state.loadedMaps.length} mapas y ${totalPolys} polígonos`, '🌐', 4000);
}

export function loadSelectedMap(index) {
  gsap.to($mapSelector, {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      $mapSelector.classList.remove('active');
      $mapSelector.style.opacity = '';
    }
  });

  const kml = state.allKmlData[index];
  state.loadedMaps = [];
  state.nextMapId = 0;
  state.selectedBlockKey = null;
  state.activeMapFilter = null;
  state.generalView = false;
  document.getElementById('map-container').classList.remove('general-active');

  const color = MAP_COLORS[0];
  const mapData = {
    id: state.nextMapId++,
    name: kml.fileName.replace(/\.(kml|xml)$/i, ''),
    fileName: kml.fileName,
    color: color,
    visible: true,
    blocks: kml.blocks.map((b, i) => ({
      localId: i,
      name: b.name,
      latlngs: parseCoordsToLeaflet(b.coords)
    }))
  };
  state.loadedMaps.push(mapData);
  state.activeMapFilter = mapData.id;

  $btnCambiarMapa.style.display = 'flex';
  document.getElementById('btn-export-pdf').style.display = 'flex';
  document.getElementById('btn-reporte').style.display = 'flex';
  state.recordsReady.then(() => {
    renderAll();
  });
  saveKmlToStorage();
  showWorkflowToast('Haz clic en un polígono del mapa o en la lista para ver sus datos', '👆', 4000);
}

export function closeMapSelector() {
  $mapSelector.classList.remove('active');
  if (state.loadedMaps.length === 0 && state.allKmlData.length === 0) {
    $mapEmptyState.classList.remove('hidden');
  }
}

/** Conecta el botón "Vista general" del selector de mapas. */
export function initSelector() {
  document.getElementById('selector-general').addEventListener('click', loadGeneralView);
}
