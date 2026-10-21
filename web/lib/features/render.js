// features/render.js — Polígonos, etiquetas, listas, estadísticas y selector.

import L from 'leaflet';
import { gsap } from 'gsap';
import { $blockList, $fileUpload, $mapCount, $mapEmptyState, $mapList, $totalCount } from '../core/dom.js';
import { state } from '../core/state.js';
import { getPolygonInteriorPoint, getVisitStatus, getVisitStatusInfo, isMobile, isTablet, normalizeTerritoryName } from '../core/utils.js';
import { deleteKmlFromSheet } from '../services/sheets.js';
import { deleteKmlData, saveKmlToStorage } from '../services/storage.js';
import { showWorkflowToast } from '../ui/toast.js';
import { findBlockByKey, getPolygonRef, renderDetailRecords, resetDetail, selectBlock } from './detail.js';
import { removeMap, selectMapFilter, toggleMapVisibility } from './map.js';
import { openRenameModal } from './rename.js';
import { buildGeneralReport } from './report.js';

export function renderAll() {
  renderAllPolygons();
  renderMapList();
  renderBlockList();
  updateStats();
  fitAllBounds();
  resetDetail();
}

export function buildCenterLabelHtml(visitIcon, vc, name, iconPx) {
  const fs = Math.max(8, Math.round(iconPx * 0.56));
  const base = `width:${iconPx}px;height:${iconPx}px;font-size:${fs}px;`;
  let badge;
  if (visitIcon === 'check') {
    badge = `<span class="plc-icon" style="${base}background:#10b981;color:#fff;" title="Con fecha de finalización">✓</span>`;
  } else if (visitIcon === 'question') {
    badge = `<span class="plc-icon" style="${base}background:#f59e0b;color:#000;" title="Sin fecha de finalización">?</span>`;
  } else if (visitIcon === 'alert') {
    badge = `<span class="plc-icon" style="${base}background:#ef4444;color:#fff;" title="Sin trabajar">!</span>`;
  } else {
    badge = `<span class="plc-icon" style="${base}visibility:hidden;"></span>`;
  }
  return `<div class="plc-stack">${badge}<span class="plc-name" style="color:${vc.stroke}">${name}</span></div>`;
}

export function buildCenterLabelIcon(visitIcon, vc, name, iconPx) {
  return L.divIcon({
    className: 'map-label',
    html: buildCenterLabelHtml(visitIcon, vc, name, iconPx),
    iconSize: [140, iconPx + 24],
    iconAnchor: [70, Math.round(iconPx / 2)]
  });
}

export function calcCenterIconPx(poly) {
  try {
    const b = poly.getBounds();
    const p1 = state.map.latLngToContainerPoint(b.getNorthEast());
    const p2 = state.map.latLngToContainerPoint(b.getSouthWest());
    const minDim = Math.min(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));
    return Math.max(9, Math.min(18, Math.round(minDim * 0.4)));
  } catch (e) {
    return 14;
  }
}

export function updateCenterLabelSizes() {
  for (const refKey in state.labelRefs) {
    const info = state.labelRefs[refKey];
    if (!info.poly) continue;
    const iconPx = calcCenterIconPx(info.poly);
    if (iconPx === info.size) continue;
    info.size = iconPx;
    info.marker.setIcon(buildCenterLabelIcon(info.visitIcon, info.vc, info.name, iconPx));
  }
}

export function restoreSelectionStyles() {
  if (!state.selectedBlockKey) return;
  const found = findBlockByKey(state.selectedBlockKey);
  if (found) {
    const poly = getPolygonRef(state.selectedBlockKey);
    const el = poly && poly.getElement();
    if (el) {
      const v = getVisitStatusInfo(found.block.name);
      el.style.fill = v.colors.fill;
      el.style.stroke = '#ffffff';
      el.classList.add('active-poly');
    }
  }
  document.querySelectorAll('.block-item.active').forEach(el => el.classList.remove('active'));
  const item = document.querySelector(`.block-item[data-map-id="${state.selectedBlockKey.mapId}"][data-local-id="${state.selectedBlockKey.localId}"]`);
  if (item) item.classList.add('active');
}

export function polygonTooltipHtml(blockName, mapName, vc, visitInfo) {
  let content = `<div style="font-weight:600;margin-bottom:2px;">${blockName}</div>`;
  content += `<div style="font-size:0.6rem;opacity:0.7;">${mapName}</div>`;
  const statusDot = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${vc.css};margin-right:4px;vertical-align:middle;"></span>`;
  content += `<div style="margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,0.15);font-size:0.58rem;color:${vc.css};">${statusDot}${vc.label}</div>`;
  if (visitInfo.lastDate) {
    const displayDate = visitInfo.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    content += `<div style="font-size:0.55rem;opacity:0.6;margin-top:1px;">Ultima visita: ${displayDate}</div>`;
  } else {
    content += `<div style="font-size:0.55rem;opacity:0.6;margin-top:1px;">Sin registro de visita</div>`;
  }
  return content;
}

export function renderAllPolygons() {
  state.polygonLayerGroup.clearLayers();
  state.polygonRefs = {};
  state.labelRefs = {};
  const layers = [];

  state.loadedMaps.forEach(mapData => {
    if (!mapData.visible) return;
    const c = mapData.color;

    mapData.blocks.forEach(block => {
      const visitInfo = getVisitStatusInfo(block.name);
      const vc = visitInfo.colors;

      const polygon = L.polygon(block.latlngs, {
        className: 'custom-poly',
        fillColor: vc.fill,
        fillOpacity: 0.28,
        color: vc.stroke,
        weight: 1.5
      });
      polygon._visitStatus = visitInfo.status;
      polygon._visitIcon = visitInfo.visitIcon;
      polygon.setStyle({ fillColor: vc.fill, fillOpacity: 0.28, color: vc.stroke, weight: 1.5 });
      requestAnimationFrame(() => {
        const el = polygon.getElement();
        if (el) {
          el.style.fill = vc.fill;
          el.style.stroke = vc.stroke;
          el.style.strokeWidth = '1.5';
          el.style.fillOpacity = '0.28';
        }
      });
      const blockName = block.name;
      const mapName = mapData.name;
      polygon.bindTooltip(function() {
        return polygonTooltipHtml(blockName, mapName, vc, visitInfo);
      }, { sticky: true, className: 'custom-tooltip', direction: 'top', opacity: 1 });
      polygon.on('click', () => {
        const key = { mapId: mapData.id, localId: block.localId };
        const isSame = state.selectedBlockKey && state.selectedBlockKey.mapId === key.mapId && state.selectedBlockKey.localId === key.localId;

        if (isMobile() || isTablet()) {
          if (isSame && state.mobileZoomOnly) {
            state.mobileZoomOnly = false;
            selectBlock(key);
            return;
          }
          if (isSame) {
            selectBlock(null);
            state.mobileZoomOnly = false;
            return;
          }

          if (state.selectedBlockKey) {
            const prevPoly = getPolygonRef(state.selectedBlockKey);
            if (prevPoly) {
              const prevFound = findBlockByKey(state.selectedBlockKey);
              const polyEl = prevPoly.getElement();
              if (polyEl && prevFound) {
                const prevVisit = getVisitStatusInfo(prevFound.block.name);
                polyEl.style.fill = prevVisit.colors.fill;
                polyEl.style.stroke = prevVisit.colors.stroke;
                polyEl.classList.remove('active-poly');
              }
            }
          }

          state.selectedBlockKey = key;
          state.mobileZoomOnly = true;
          const polyEl = polygon.getElement();
          if (polyEl) {
            const visitStatus = getVisitStatusInfo(block.name);
            polyEl.style.fill = visitStatus.colors.fill;
            polyEl.style.stroke = '#ffffff';
            polyEl.classList.add('active-poly');
          }
          state.map.fitBounds(polygon.getBounds(), { padding: [80, 80], maxZoom: 19, animate: true, duration: 0.9, easeLinearity: 0.25 });
          const blockItem = document.querySelector(`.block-item[data-map-id="${key.mapId}"][data-local-id="${key.localId}"]`);
          if (blockItem) blockItem.classList.add('active');
          return;
        }

        selectBlock(isSame ? null : key);
      });
      layers.push(polygon);

      const refKey = `${mapData.id}-${block.localId}`;
      state.polygonRefs[refKey] = polygon;

      const center = getPolygonInteriorPoint(block.latlngs);
      const iconPx = calcCenterIconPx(polygon);
      const labelMarker = L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: buildCenterLabelIcon(visitInfo.visitIcon, vc, block.name, iconPx)
      });
      layers.push(labelMarker);
      state.labelRefs[refKey] = {
        marker: labelMarker,
        name: block.name,
        mapName: mapData.name,
        color: vc.stroke,
        poly: polygon,
        visitIcon: visitInfo.visitIcon,
        vc: vc,
        size: iconPx
      };
    });
  });

  layers.forEach(l => l.addTo(state.polygonLayerGroup));
  requestAnimationFrame(restoreSelectionStyles);
}

export function updatePolygonColors() {
  let changed = false;
  for (const refKey in state.polygonRefs) {
    const polygon = state.polygonRefs[refKey];
    if (!polygon) continue;
    const dashIdx = refKey.indexOf('-');
    const mapId = Number(refKey.substring(0, dashIdx));
    const localId = Number(refKey.substring(dashIdx + 1));
    const mapData = state.loadedMaps.find(m => m.id === mapId);
    if (!mapData) continue;
    const block = mapData.blocks.find(b => b.localId === localId);
    if (!block) continue;

    const visitInfo = getVisitStatusInfo(block.name);
    const vc = visitInfo.colors;
    const prev = polygon._visitStatus;
    const prevIcon = polygon._visitIcon;
    const iconChanged = prevIcon !== visitInfo.visitIcon;
    if (prev === visitInfo.status && !iconChanged) continue;
    changed = true;

    polygon._visitStatus = visitInfo.status;
    polygon._visitIcon = visitInfo.visitIcon;
    polygon.setStyle({ fillColor: vc.fill, fillOpacity: 0.28, color: vc.stroke, weight: 1.5 });
    const el = polygon.getElement();
    if (el) {
      el.style.fill = vc.fill;
      el.style.stroke = vc.stroke;
    }
    const labelInfo = state.labelRefs[refKey];
    if (labelInfo) {
      labelInfo.visitIcon = visitInfo.visitIcon;
      labelInfo.vc = vc;
      labelInfo.marker.setIcon(buildCenterLabelIcon(visitInfo.visitIcon, vc, block.name, labelInfo.size || 14));
    }
    const blockName = block.name;
    const mapName = mapData.name;
    polygon.setTooltipContent(polygonTooltipHtml(blockName, mapName, vc, visitInfo));
  }
  if (changed) {
    renderBlockList();
    renderMapList();
    updateStats();
    requestAnimationFrame(restoreSelectionStyles);
  }
}

export function refreshBlockVisual(mapId, localId) {
  const refKey = `${mapId}-${localId}`;
  const polygon = state.polygonRefs[refKey];
  const mapData = state.loadedMaps.find(m => m.id === mapId);
  const block = mapData && mapData.blocks.find(b => b.localId === localId);

  if (block && polygon) {
    const visitInfo = getVisitStatusInfo(block.name);
    const vc = visitInfo.colors;
    polygon._visitStatus = visitInfo.status;
    polygon._visitIcon = visitInfo.visitIcon;
    polygon.setStyle({ fillColor: vc.fill, fillOpacity: 0.28, color: vc.stroke, weight: 1.5 });
    const el = polygon.getElement();
    if (el) {
      el.style.fill = vc.fill;
      el.style.stroke = vc.stroke;
    }
    polygon.setTooltipContent(polygonTooltipHtml(block.name, mapData.name, vc, visitInfo));
    const labelInfo = state.labelRefs[refKey];
    if (labelInfo) {
      labelInfo.visitIcon = visitInfo.visitIcon;
      labelInfo.vc = vc;
      labelInfo.marker.setIcon(buildCenterLabelIcon(visitInfo.visitIcon, vc, block.name, labelInfo.size || 14));
    }
  }

  const item = document.querySelector(`.block-item[data-map-id="${mapId}"][data-local-id="${localId}"]`);
  if (item && block) {
    const pip = item.querySelector('.block-color-pip');
    if (pip) pip.style.background = getVisitStatusInfo(block.name).colors.css;
  }

  renderMapList(true);
  updateStats();
  if (state.selectedBlockKey) renderDetailRecords();
  requestAnimationFrame(restoreSelectionStyles);
}

export function refreshVisualsForTerritory(territorio) {
  const key = normalizeTerritoryName(territorio || '');
  let matched = false;
  if (key) {
    state.loadedMaps.forEach(m => {
      m.blocks.forEach(b => {
        if (normalizeTerritoryName(b.name) === key) {
          matched = true;
          refreshBlockVisual(m.id, b.localId);
        }
      });
    });
  }
  if (!matched) {
    renderMapList(true);
    updateStats();
    if (state.selectedBlockKey) renderDetailRecords();
  }
}

export function renderMapList(skipAnimation) {
  const list = $mapList;

  if (state.loadedMaps.length === 0) {
    list.innerHTML = `
      <div class="map-empty">
        No hay mapas cargados
        <br>
        <label for="file-upload-sidebar" class="map-empty-btn-sidebar admin-only" style="display:none;">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10"/>
            <polyline points="5 6 8 3 11 6"/>
            <line x1="8" y1="3" x2="8" y2="10"/>
          </svg>
          Cargar KML
        </label>
        <input type="file" id="file-upload-sidebar" accept=".kml,.xml" multiple style="display:none">
      </div>`;
    if (state.isAdmin) {
      const label = list.querySelector('.map-empty-btn-sidebar');
      if (label) label.style.display = '';
    }
    return;
  }

  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  state.loadedMaps.forEach(m => {
    let freshCount = 0, warnCount = 0, alertCount = 0;
    m.blocks.forEach(b => {
      const s = getVisitStatus(b.name);
      if (s === 'fresh') freshCount++;
      else if (s === 'warning') warnCount++;
      else alertCount++;
    });
    const item = document.createElement('div');
    item.className = `map-item${m.visible ? ' visible' : ''}${state.activeMapFilter === m.id ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="map-color-dot" style="background:${m.color.solid}; color:${m.color.solid}"></div>
      <div class="map-item-info">
        <div class="map-item-name">${m.name}</div>
        <div class="map-item-count">
          ${m.blocks.length} bloques
          <span class="map-status-summary">
            ${freshCount > 0 ? `<span style="color:#10b981;">${freshCount}</span>` : ''}
            ${warnCount > 0 ? `<span style="color:#f59e0b;">${warnCount}</span>` : ''}
            ${alertCount > 0 ? `<span style="color:#ef4444;">${alertCount}</span>` : ''}
          </span>
        </div>
      </div>
      <button class="map-rename-btn" data-map-rename="${m.id}" title="Editar título">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
      </button>
      <button class="map-delete-btn" data-map-delete="${m.id}" title="Eliminar mapa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <button class="map-toggle ${m.visible ? 'on' : ''}" data-map-toggle="${m.id}" title="${m.visible ? 'Ocultar' : 'Mostrar'}"></button>
    `;

    item.querySelector('.map-item-info').addEventListener('click', () => selectMapFilter(m.id));

    item.querySelector('.map-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMapVisibility(m.id);
    });

    const deleteBtn = item.querySelector('.map-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`¿Eliminar el mapa "${m.name}" y todos sus bloques?\n\nTambién se borrará de Google Sheets.`)) {
        const fileName = m.fileName || m.name;
        deleteKmlFromSheet(fileName);
        if (m.fileName && m.fileName !== m.name) deleteKmlFromSheet(m.name);
        deleteKmlData(fileName);
        if (m.fileName && m.fileName !== m.name) deleteKmlData(m.name);
        removeMap(m.id);
        saveKmlToStorage();
        showWorkflowToast(`Mapa "${m.name}" eliminado ✓`, '🗑️', 3000);
      }
    });

    const renameBtn = item.querySelector('.map-rename-btn');
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileName = m.fileName || m.name;
      const idx = state.allKmlData.findIndex(k =>
        k.fileName === fileName ||
        k.fileName.replace(/\.(kml|xml)$/i, '') === m.name
      );
      if (idx === -1) {
        showWorkflowToast('No se encontró el KML para editar', '⚠️', 3000);
        return;
      }
      openRenameModal(idx);
    });

    fragment.appendChild(item);
  });
  list.appendChild(fragment);

  if (!skipAnimation) {
    gsap.fromTo($mapList.querySelectorAll('.map-item'), {
      opacity: 0,
      x: -8
    }, {
      opacity: 1,
      x: 0,
      duration: 0.35,
      stagger: 0.04,
      ease: 'power3.out'
    });
  }
}

export function renderBlockList() {
  const list = $blockList;
  list.innerHTML = '';
  state.allBlockItems = [];

  const sourceMaps = state.loadedMaps.filter(m => m.visible && (!state.activeMapFilter || m.id === state.activeMapFilter));

  if (sourceMaps.length === 0) {
    list.innerHTML = '<div class="map-empty" style="padding:1.5rem 1rem;">Selecciona un polígono en el mapa o usa la lista de arriba</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  let idx = 0;
  const showMapTags = state.loadedMaps.length > 1 && !state.activeMapFilter;
  sourceMaps.forEach(mapData => {
    mapData.blocks.forEach(block => {
      const key = { mapId: mapData.id, localId: block.localId };
      const isActive = state.selectedBlockKey && state.selectedBlockKey.mapId === key.mapId && state.selectedBlockKey.localId === key.localId;

      const item = document.createElement('div');
      item.className = `block-item${isActive ? ' active' : ''}`;
      item.dataset.mapId = key.mapId;
      item.dataset.localId = key.localId;
      item.dataset.name = block.name.toLowerCase();
      item.dataset.searchText = `${mapData.name} ${block.name}`.toLowerCase();
      const visitInfo = getVisitStatusInfo(block.name);
      item.innerHTML = `
        <div class="block-color-pip" style="background:${visitInfo.colors.css}"></div>
        <span class="num">${String(idx+1).padStart(2,'0')}</span>
        <span class="name">${block.name}${showMapTags ? `<em class="block-map-tag" style="color:${mapData.color.solid}">${mapData.name}</em>` : ''}</span>
        <span class="arrow">›</span>
      `;
      item.addEventListener('click', () => {
        const isSame = state.selectedBlockKey && state.selectedBlockKey.mapId === key.mapId && state.selectedBlockKey.localId === key.localId;
        selectBlock(isSame ? null : key);
      });
      fragment.appendChild(item);
      state.allBlockItems.push(item);
      idx++;
    });
  });
  list.appendChild(fragment);

  const blockItems = $blockList.querySelectorAll('.block-item');
  gsap.fromTo(blockItems, {
    opacity: 0,
    x: -12
  }, {
    opacity: 1,
    x: 0,
    duration: 0.4,
    stagger: Math.min(0.03, 0.5 / Math.max(blockItems.length, 1)),
    ease: 'power3.out'
  });
}

export function updateStats() {
  const totalBlocks = state.loadedMaps.reduce((sum, m) => sum + m.blocks.length, 0);
  $mapCount.textContent = state.loadedMaps.length;
  $totalCount.textContent = totalBlocks;

  if (state.loadedMaps.length > 0 || state.allKmlData.length > 0) {
    $mapEmptyState.classList.add('hidden');
  } else {
    $mapEmptyState.classList.remove('hidden');
  }

  updateGeneralBadge();
}

export function updateGeneralBadge() {
  const badge = document.getElementById('general-badge');
  if (!badge) return;
  if (!state.generalView) {
    badge.style.display = 'none';
    return;
  }
  const report = buildGeneralReport();
  const pct = report.pctWorked;
  const pctEl = document.getElementById('gb-pct');
  pctEl.textContent = pct + '%';
  pctEl.style.color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  document.getElementById('gb-bar-fill').style.width = pct + '%';
  document.getElementById('gb-sub').textContent = `${report.worked.length}/${report.total} territorios · Avance ${report.avg}%`;
  badge.style.display = 'flex';
}

export function updateSelectorGeneralCard() {
  const $sgGeneral = document.getElementById('selector-general');
  if (!$sgGeneral) return;
  if (state.allKmlData.length > 1) {
    const r = buildGeneralReport();
    const pct = r.pctWorked;
    const pctEl = document.getElementById('selector-general-pct');
    pctEl.textContent = pct + '%';
    pctEl.style.color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
    document.getElementById('selector-general-bar-fill').style.width = pct + '%';
    document.getElementById('selector-general-desc').textContent =
      `${state.allKmlData.length} mapas · ${r.total} territorios · ${r.worked.length} trabajados · avance ${r.avg}%`;
    $sgGeneral.style.display = 'flex';
  } else {
    $sgGeneral.style.display = 'none';
  }
}

export function fitAllBounds() {
  const bounds = L.latLngBounds();
  state.loadedMaps.forEach(m => {
    if (!m.visible) return;
    m.blocks.forEach(b => b.latlngs.forEach(pt => bounds.extend(pt)));
  });
  if (bounds.isValid()) {
    state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
  }
}

/** Conecta los eventos que dependen del mapa: colores, etiquetas y carga lateral. */
export function initRender() {
  setInterval(updatePolygonColors, 60000);
  state.map.on('zoomend', updateCenterLabelSizes);

  // Delegación del botón "Cargar KML" del estado vacío
  $mapList.addEventListener('click', (e) => {
    const label = e.target.closest('.map-empty-btn-sidebar');
    if (!label) return;
    e.preventDefault();
    $fileUpload.click();
  });
}
