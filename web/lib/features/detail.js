// features/detail.js — Panel de detalle de un bloque/territorio.

import { gsap } from 'gsap';
import { $dBtnSave, $dDateEnd, $dDateStart, $dForm, $dName, $dPublisher, $dRows, $dSaveStatus, $hudName, $hudSelection } from '../core/dom.js';
import { state } from '../core/state.js';
import { formatRecordDate, getVisitStatusInfo, isMobile, isTablet } from '../core/utils.js';
import { autoCloseSidebar } from '../ui/sidebar.js';
import { showWorkflowToast } from '../ui/toast.js';
import { enterCompletionMode, exitCompletionMode, saveToSheet } from './completion.js';
import { getAllRecordsForBlock, getEditableRecords, getOpenRecordForBlock } from './records.js';

export function getPolygonRef(key) {
  return state.polygonRefs[`${key.mapId}-${key.localId}`] || null;
}

export function findBlockByKey(key) {
  const m = state.loadedMaps.find(m => m.id === key.mapId);
  if (!m) return null;
  const b = m.blocks.find(b => b.localId === key.localId);
  if (!b) return null;
  return { mapData: m, block: b };
}

export function renderDetailRecords() {
  if (!state.selectedBlockKey) return;
  const found = findBlockByKey(state.selectedBlockKey);
  if (!found) return;
  const { mapData, block } = found;

  $dName.textContent = block.name;
  const visitDetail = getVisitStatusInfo(block.name);
  let recordHtml = `
    <div class="detail-map-badge" style="color:${mapData.color.solid}; border: 1px solid ${mapData.color.solid}33; background: ${mapData.color.solid}15;">
      <div class="map-color-dot" style="background:${mapData.color.solid}; width:7px; height:7px;"></div>
      ${mapData.name}
    </div>
    <div class="detail-map-badge" style="color:${visitDetail.colors.css}; border: 1px solid ${visitDetail.colors.css}33; background: ${visitDetail.colors.css}15; margin-bottom:0.5rem;">
      <div class="map-color-dot" style="background:${visitDetail.colors.css}; width:7px; height:7px;"></div>
      ${visitDetail.colors.label}
    </div>`;
  if (visitDetail.lastDate) {
    const displayDate = visitDetail.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    recordHtml += `
      <div class="detail-row">
        <span class="detail-key" style="color:${visitDetail.colors.css};">Ultima visita</span>
        <span class="detail-val" style="color:${visitDetail.colors.css};font-weight:600;">${displayDate}</span>
      </div>`;
  } else {
    recordHtml += `<span class="detail-empty" style="color:${visitDetail.colors.css};">Sin visita registrada</span>`;
  }
  if (!visitDetail.lastDate && !state.recordsLoaded) {
    recordHtml += '<span class="detail-empty" style="font-style:normal;color:var(--gold);">Conectando con Google Sheets...</span>';
  }

  const editableRecords = state.isAdmin ? getAllRecordsForBlock(block.name) : getEditableRecords(block.name);
  if (editableRecords.length > 0) {
    recordHtml += `<div class="detail-edit-section">`;
    if (editableRecords.length === 1) {
      const rec = editableRecords[0];
      const pub = rec.publicador || 'Sin publicador';
      const f = formatRecordDate(rec.fecha_fin || rec.fecha_inicio || '');
      recordHtml += `
        <div class="detail-edit-single">
          <span class="detail-edit-info">Registro: <strong>${pub}</strong>${f ? ' — ' + f : ''}</span>
          <div style="display:flex;gap:4px;">
            <button class="detail-edit-btn" onclick="startEditRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}')">
              Editar
            </button>
            <button class="detail-record-delete admin-only" onclick="deleteSingleRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}', '${(rec.territorio || '').replace(/'/g, "\\'")}')">
              Borrar
            </button>
          </div>
        </div>`;
    } else {
      const listLabel = state.isAdmin ? `Todos los registros (${editableRecords.length})` : `Varios registros este mes (${editableRecords.length})`;
      recordHtml += `<div class="detail-edit-multi"><span class="detail-edit-info">${listLabel}:</span><div class="detail-edit-list">`;
      editableRecords.forEach(rec => {
        const pub = rec.publicador || 'Sin publicador';
        const f = formatRecordDate(rec.fecha_fin || rec.fecha_inicio || '');
        recordHtml += `
          <div class="detail-record-row">
            <button class="detail-edit-btn detail-edit-option" onclick="startEditRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}')">
              ${pub}${f ? ' — ' + f : ''}
            </button>
            <button class="detail-record-delete admin-only" title="Borrar registro" onclick="deleteSingleRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}', '${(rec.territorio || '').replace(/'/g, "\\'")}')">
              ✕
            </button>
          </div>`;
      });
      recordHtml += `</div></div>`;
    }
    recordHtml += `</div>`;
  }
  $dRows.innerHTML = recordHtml;
}

export function selectBlock(key) {
  state.mobileZoomOnly = false;
  const hud = $hudSelection;

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
    document.querySelectorAll('.block-item.active').forEach(el => el.classList.remove('active'));
  }

  state.selectedBlockKey = key;

  if (key === null) {
    gsap.to(hud, {
      opacity: 0,
      y: -10,
      scale: 0.96,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => { hud.style.display = 'none'; }
    });
    resetDetail();
    return;
  }

  const found = findBlockByKey(key);
  if (!found) return;
  const { mapData, block } = found;

  const polygon = getPolygonRef(key);

  if (polygon) {
    const polyEl = polygon.getElement();
    if (polyEl) {
      const visitStatus = getVisitStatusInfo(block.name);
      polyEl.style.fill = visitStatus.colors.fill;
      polyEl.style.stroke = '#ffffff';
      polyEl.classList.add('active-poly');
    }
    state.map.fitBounds(polygon.getBounds(), { padding: [80, 80], maxZoom: 19, animate: true, duration: 0.9, easeLinearity: 0.25 });
  }

  const blockItem = document.querySelector(`.block-item[data-map-id="${key.mapId}"][data-local-id="${key.localId}"]`);
  if (blockItem) {
    blockItem.classList.add('active');
    blockItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  autoCloseSidebar();

  if (isMobile() || isTablet()) {
    setTimeout(() => {
      const detail = document.getElementById('detail');
      if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 350);
  }

  if (!state.firstBlockSelected) {
    state.firstBlockSelected = true;
    setTimeout(() => {
      if (state.completionRecord) {
        showWorkflowToast('Este territorio ya tiene inicio: solo falta registrar la fecha de finalización', '📅', 5000);
      } else {
        showWorkflowToast('Completa los campos y presiona "Grabar en Google Sheets" para guardar', '📝', 5000);
      }
    }, 1500);
  }

  const center = block.latlngs.reduce(
    (acc, pt) => [acc[0] + pt[0], acc[1] + pt[1]],
    [0, 0]
  ).map(v => v / block.latlngs.length);
  const centerLatLng = { lat: center[0], lng: center[1] };

  $hudName.textContent = `${mapData.name} — ${block.name}`;
  hud.style.display = "block";
  gsap.fromTo(hud, {
    opacity: 0,
    y: -12,
    scale: 0.96
  }, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.5,
    ease: 'back.out(1.5)'
  });

  $dName.textContent = block.name;
  renderDetailRecords();

  $dForm.style.display = 'flex';
  gsap.fromTo($dForm, {
    opacity: 0,
    y: 12
  }, {
    opacity: 1,
    y: 0,
    duration: 0.45,
    ease: 'back.out(1.3)'
  });
  const existingLabel = $dForm.querySelector('.edit-mode-label');
  if (existingLabel) existingLabel.remove();
  exitCompletionMode();
  state.editingRecord = null;
  $dPublisher.value = '';
  $dDateStart.value = '';
  $dDateEnd.value = '';
  $dBtnSave.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Grabar en Google Sheets`;
  $dBtnSave.onclick = saveToSheet;
  $dSaveStatus.className = 'save-status';
  $dSaveStatus.textContent = '';
  const openRec = getOpenRecordForBlock(block.name);
  if (openRec) enterCompletionMode(openRec);
}

export function deselectBlock() {
  state.selectedBlockKey = null;
  $hudSelection.style.display = 'none';
  resetDetail();
}

export function resetDetail() {
  if (state.completionRecord) exitCompletionMode();
  $dName.textContent = '—';
  $dRows.innerHTML = '<span class="detail-empty">Haz clic en un polígono para ver sus datos</span>';
  $dForm.style.display = 'none';
}
