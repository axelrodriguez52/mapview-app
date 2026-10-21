// features/pdf.js — Exportación del mapa a PDF.

import { gsap } from 'gsap';
import { jsPDF } from 'jspdf';
import { $pdfClose, $pdfDownload, $pdfFrame, $pdfModal, $pdfName } from '../core/dom.js';
import { state } from '../core/state.js';
import { getPolygonInteriorPoint, getVisitStatusInfo, normalizeTerritoryName } from '../core/utils.js';
import { showWorkflowToast } from '../ui/toast.js';
import { getRecordForBlock } from './records.js';

export function loadOSMTile(z, x, y) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 8000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

export function mercatorX(lng) {
  return (lng + 180) / 360;
}

export function mercatorY(lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = clamped * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

export function pdfIconRadius(minDim, scale) {
  return Math.max(3, Math.min(8 * scale, minDim * 0.28));
}

export async function drawMapCanvas(mapData) {
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  const W = 900 * SCALE, H = 500 * SCALE;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  mapData.blocks.forEach(b => {
    b.latlngs.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
  });

  if (minLat === Infinity) return canvas;

  if (maxLat - minLat < 0.002) { minLat -= 0.001; maxLat += 0.001; }
  if (maxLng - minLng < 0.002) { minLng -= 0.001; maxLng += 0.001; }

  const mx0 = mercatorX(minLng), mx1 = mercatorX(maxLng);
  const my0 = mercatorY(maxLat), my1 = mercatorY(minLat);
  const spanX = mx1 - mx0;
  const spanY = my1 - my0;

  const pad = 12 * SCALE;
  const availW = W - pad * 2;
  const availH = H - pad * 2;

  const fit = Math.min(availW / spanX, availH / spanY);
  let z = Math.floor(Math.log2(fit / 256));
  z = Math.max(0, Math.min(18, z));

  let tiles = [];
  while (tiles.length === 0 || tiles.length > 100) {
    const n = Math.pow(2, z);
    const tx0 = Math.max(0, Math.floor(mx0 * n));
    const tx1 = Math.min(n - 1, Math.floor(mx1 * n));
    const ty0 = Math.max(0, Math.floor(my0 * n));
    const ty1 = Math.min(n - 1, Math.floor(my1 * n));
    tiles = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        tiles.push({ z, x: tx, y: ty });
      }
    }
    if (tiles.length > 100) {
      if (z === 0) break;
      z--;
    }
  }

  const S = Math.min(availW / spanX, availH / spanY);
  const ox = pad + (availW - spanX * S) / 2 - mx0 * S;
  const oy = pad + (availH - spanY * S) / 2 - my0 * S;

  function project(lat, lng) {
    return [ox + mercatorX(lng) * S, oy + mercatorY(lat) * S];
  }

  const tileImgs = await Promise.all(tiles.map(t => loadOSMTile(t.z, t.x, t.y)));
  const n = Math.pow(2, z);
  const tilePx = S / n;

  tiles.forEach((t, i) => {
    const img = tileImgs[i];
    if (!img) return;
    const dx = ox + (t.x / n) * S;
    const dy = oy + (t.y / n) * S;
    try { ctx.drawImage(img, dx, dy, tilePx + 0.5, tilePx + 0.5); } catch (e) {}
  });

  const anyTile = tileImgs.some(Boolean);
  if (!anyTile) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = SCALE;
    for (let g = 0; g <= W; g += 50 * SCALE) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); }
    for (let g = 0; g <= H; g += 50 * SCALE) { ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }
  }

  const statusRGB = {
    fresh: 'rgba(16,185,129,0.42)',
    warning: 'rgba(245,158,11,0.42)',
    alert: 'rgba(239,68,68,0.42)'
  };
  const strokeRGB = {
    fresh: '#10b981',
    warning: '#f59e0b',
    alert: '#ef4444'
  };
  const blockVisits = mapData.blocks.map(b => getVisitStatusInfo(b.name));

  function traceBlockPath(block) {
    ctx.beginPath();
    block.latlngs.forEach(([lat, lng], idx) => {
      const [px, py] = project(lat, lng);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  // 1) Rellenos de estado
  mapData.blocks.forEach((block, i) => {
    traceBlockPath(block);
    ctx.fillStyle = statusRGB[blockVisits[i].status] || statusRGB.alert;
    ctx.fill();
  });

  // 2) Halo blanco: separa cada polígono del mapa base
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  mapData.blocks.forEach(block => {
    traceBlockPath(block);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4.5 * SCALE;
    ctx.stroke();
  });

  // 3) Contorno de color
  mapData.blocks.forEach((block, i) => {
    traceBlockPath(block);
    ctx.strokeStyle = strokeRGB[blockVisits[i].status] || strokeRGB.alert;
    ctx.lineWidth = 2 * SCALE;
    ctx.stroke();
  });

  // 4) Iconos con tamaño proporcional: nunca tapan el polígono
  mapData.blocks.forEach((block, i) => {
    const visitInfo = blockVisits[i];
    let icon = '';
    let iconBg = '';
    if (visitInfo.visitIcon === 'check') { icon = '✓'; iconBg = '#10b981'; }
    else if (visitInfo.visitIcon === 'question') { icon = '?'; iconBg = '#f59e0b'; }
    else if (visitInfo.visitIcon === 'alert') { icon = '!'; iconBg = '#ef4444'; }
    if (!icon) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    block.latlngs.forEach(([lat, lng]) => {
      const [px, py] = project(lat, lng);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });
    const minDim = Math.min(maxX - minX, maxY - minY);
    const R = pdfIconRadius(minDim, SCALE);
    const cp = getPolygonInteriorPoint(block.latlngs);
    const [cx, cy] = project(cp[0], cp[1]);

    const ringW = Math.max(0.8, R * 0.27);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R - ringW / 2, 0, Math.PI * 2);
    ctx.lineWidth = ringW;
    ctx.strokeStyle = iconBg;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = iconBg;
    ctx.fill();

    if (R >= 9) {
      ctx.fillStyle = iconBg === '#f59e0b' ? '#000' : '#fff';
      ctx.font = `bold ${Math.max(6, Math.round(R * 0.97))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, cx, cy);
    }
  });

  const attSize = 9 * SCALE;
  ctx.font = `${attSize}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const attText = '© OpenStreetMap contributors';
  const attW = ctx.measureText(attText).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(W - 8 * SCALE - attW - 5 * SCALE, H - 7 * SCALE - attSize - 4 * SCALE, attW + 10 * SCALE, attSize + 8 * SCALE);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(attText, W - 8 * SCALE, H - 7 * SCALE);

  return canvas;
}

function isTouchPrimary() {
  try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
}

let pdfPopupWin = null;

export function openPdfPopupEarly() {
  if (!isTouchPrimary()) return;
  if (pdfPopupWin && !pdfPopupWin.closed) return;
  try {
    pdfPopupWin = window.open('', '_blank');
    if (pdfPopupWin) {
      pdfPopupWin.document.write('<title>MapView - PDF</title><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666">Generando PDF...</body>');
      pdfPopupWin.document.close();
    }
  } catch (e) { pdfPopupWin = null; }
}

export function closePdfPopup() {
  if (!pdfPopupWin) return;
  try { pdfPopupWin.close(); } catch (e) {}
  pdfPopupWin = null;
}

export async function exportPDF() {
  if (state.loadedMaps.length === 0) {
    showWorkflowToast('No hay mapas cargados para exportar', '⚠️', 3000);
    return;
  }
  openPdfPopupEarly();
  try {
    await exportPDFCore();
  } catch (err) {
    console.warn('[MapView] Error exportando PDF:', err);
    closePdfPopup();
    showWorkflowToast('No se pudo generar el PDF en este dispositivo', '⚠️', 3500);
  }
}

export async function exportPDFCore() {
  showWorkflowToast('Generando PDF con mapa base...', '⏳', 3000);

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  function newPage() {
    doc.addPage();
    y = margin;
  }

  function ensureSpace(needed) {
    if (y + needed > pageH - margin) newPage();
  }

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('MAPVIEW - Reporte de Territorios', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Total de mapas: ${state.loadedMaps.length}`, margin, y);
  y += 8;

  const mapsUnique = state.loadedMaps.map(m => {
    const groups = new Map();
    m.blocks.forEach(b => {
      const k = normalizeTerritoryName(b.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(b);
    });
    const uniqueBlocks = [...groups.values()].map(list =>
      list.find(b => b.name.trim().toLowerCase() === normalizeTerritoryName(b.name)) || list[0]
    );
    return { mapData: m, uniqueBlocks };
  });

  const totalBlocks = mapsUnique.reduce((s, m) => s + m.uniqueBlocks.length, 0);
  doc.text(`Total de bloques: ${totalBlocks}`, margin, y);
  y += 10;

  const statusColors = {
    fresh: [16, 185, 129],
    warning: [245, 158, 11],
    alert: [239, 68, 68]
  };
  const statusLabels = {
    fresh: 'Reciente',
    warning: '3 meses',
    alert: 'Sin visita'
  };

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('LEYENDA', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');

  const legendItems = [
    { color: statusColors.fresh, label: 'Reciente - Visitado en menos de 3 meses con fecha de finalizacion' },
    { color: statusColors.warning, label: '3 meses - Visitado hace 3-4 meses' },
    { color: statusColors.alert, label: 'Sin visita - Sin registro o mas de 4 meses' }
  ];

  legendItems.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(margin + 3, y - 1.2, 2, 'F');
    doc.text(item.label, margin + 8, y);
    y += 5;
  });

  y += 2;

  const iconLegend = [
    { bg: [16, 185, 129], fg: [255, 255, 255], char: 'V', label: 'Visitado con fecha de finalizacion' },
    { bg: [245, 158, 11], fg: [0, 0, 0], char: '?', label: 'Visitado sin fecha de finalizacion' },
    { bg: [239, 68, 68], fg: [255, 255, 255], char: '!', label: 'Sin trabajar' }
  ];

  iconLegend.forEach(item => {
    doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
    doc.circle(margin + 3, y - 1.2, 2.5, 'F');
    doc.setTextColor(item.fg[0], item.fg[1], item.fg[2]);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(7);
    doc.text(item.char, margin + 3, y + 0.3, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(item.label, margin + 8, y);
    y += 5;
  });

  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  for (let mapIdx = 0; mapIdx < mapsUnique.length; mapIdx++) {
    const { mapData, uniqueBlocks } = mapsUnique[mapIdx];
    ensureSpace(20);

    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(`${mapIdx + 1}. ${mapData.name} (${uniqueBlocks.length} bloques)`, margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 12;

    const mapCanvas = await drawMapCanvas(mapData);
    const imgData = mapCanvas.toDataURL('image/png');
    const imgW = pageW - margin * 2;
    const imgH = imgW * (mapCanvas.height / mapCanvas.width);
    ensureSpace(imgH + 4);
    doc.addImage(imgData, 'PNG', margin, y, imgW, imgH);
    doc.setDrawColor(200);
    doc.rect(margin, y, imgW, imgH);
    y += imgH + 6;

    const colWidths = { num: 10, name: 55, status: 30, publisher: 40, date1: 23, date2: 22 };
    if (pageW < margin * 2 + colWidths.num + colWidths.name + colWidths.status + colWidths.publisher + colWidths.date1 + colWidths.date2) {
      colWidths.name = 40;
      colWidths.publisher = 30;
      colWidths.date1 = 19;
      colWidths.date2 = 16;
    }
    const startX = margin;
    const datesX = startX + colWidths.num + colWidths.name + colWidths.status + colWidths.publisher;

    ensureSpace(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(startX, y - 3.5, pageW - margin * 2, 7, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('#', startX + 2, y + 1);
    doc.text('Territorio', startX + colWidths.num + 2, y + 1);
    doc.text('Estado', startX + colWidths.num + colWidths.name + 2, y + 1);
    doc.text('Publicador', startX + colWidths.num + colWidths.name + colWidths.status + 2, y + 1);
    doc.text('Inicio', datesX + 2, y + 1);
    doc.text('Fin', datesX + colWidths.date1 + 2, y + 1);
    y += 7;
    doc.setFont(undefined, 'normal');

    uniqueBlocks.forEach((block, i) => {
      ensureSpace(7);
      const visitInfo = getVisitStatusInfo(block.name);
      const record = getRecordForBlock(block.name);
      const sc = statusColors[visitInfo.status] || statusColors.alert;

      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(startX, y - 3.5, pageW - margin * 2, 7, 'F');
      }

      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.circle(startX + 3, y, 1.8, 'F');

      doc.setFontSize(8);
      doc.text(String(i + 1), startX + 7, y + 1);
      doc.text(block.name.substring(0, 32), startX + colWidths.num + 2, y + 1);
      doc.text(statusLabels[visitInfo.status] || '', startX + colWidths.num + colWidths.name + 2, y + 1);

      const pub = record ? (record.publicador || '') : '';
      doc.text(pub.substring(0, 22), startX + colWidths.num + colWidths.name + colWidths.status + 2, y + 1);

      const fmt = d => d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
      const d1 = record && record.fecha_inicio ? new Date(record.fecha_inicio) : null;
      const d2 = record && record.fecha_fin ? new Date(record.fecha_fin) : null;
      doc.text(fmt(d1), datesX + 2, y + 1);
      doc.text(fmt(d2), datesX + colWidths.date1 + 2, y + 1);

      y += 6;
    });

    y += 8;
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`MapView - Pagina ${i} de ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  const activeMap = state.loadedMaps.find(m => m.id === state.activeMapFilter);
  const fileName = `MapView_${activeMap ? activeMap.name.replace(/\s+/g, '_') : 'Territorios'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  openPdfPreview(doc, fileName);
}

let pdfPreviewDoc = null;

let pdfPreviewFileName = '';

export function openPdfPreview(doc, fileName) {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    // Móvil/tablet: los navegadores móviles no muestran PDFs blob dentro de un iframe,
    // pero sí los muestran al navegar de forma superior → usar la pestaña abierta al iniciar.
    if (pdfPopupWin && !pdfPopupWin.closed) {
      try {
        pdfPopupWin.location = url;
        pdfPopupWin = null;
        showWorkflowToast('Vista previa del PDF abierta en otra pestaña', '👁️', 3200);
        return;
      } catch (e) { /* si falla, seguimos con el modal */ }
    }
    closePdfPopup();

    pdfPreviewDoc = doc;
    pdfPreviewFileName = fileName;
    $pdfName.textContent = fileName;
    if ($pdfFrame.src.startsWith('blob:')) URL.revokeObjectURL($pdfFrame.src);
    $pdfFrame.src = url;
    $pdfModal.classList.add('active');
    gsap.fromTo($pdfModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo('.pdf-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
    showWorkflowToast(isTouchPrimary() ? 'Si no ves el PDF, toca Descargar' : 'Revisa el PDF antes de descargarlo', isTouchPrimary() ? '⬇️' : '👁️', 3200);
  } catch (err) {
    console.warn('[MapView] Error generando vista previa:', err);
    closePdfPopup();
    doc.save(fileName);
    showWorkflowToast('PDF exportado correctamente ✓', '📄', 3000);
  }
}

export function closePdfPreview() {
  const revoke = () => {
    if ($pdfFrame.src.startsWith('blob:')) URL.revokeObjectURL($pdfFrame.src);
    $pdfFrame.src = '';
    pdfPreviewDoc = null;
  };
  gsap.to('.pdf-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($pdfModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $pdfModal.classList.remove('active');
      $pdfModal.style.opacity = '';
      revoke();
    }
  });
}

/** Conecta el modal de vista previa del PDF. */
export function initPdf() {
  $pdfClose.addEventListener('click', closePdfPreview);
  $pdfModal.addEventListener('click', (e) => {
    if (e.target === $pdfModal) closePdfPreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $pdfModal.classList.contains('active')) closePdfPreview();
  });
  $pdfDownload.addEventListener('click', () => {
    if (!pdfPreviewDoc) return;
    pdfPreviewDoc.save(pdfPreviewFileName);
    showWorkflowToast('PDF descargado ✓', '⬇️', 3000);
    closePdfPreview();
  });
}
