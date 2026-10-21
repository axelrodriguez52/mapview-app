// features/report.js — Reporte general de territorios.

import { gsap } from 'gsap';
import { jsPDF } from 'jspdf';
import { $pdfModal, $reportBody, $reportClose, $reportCount, $reportExport, $reportModal, $reportSummary } from '../core/dom.js';
import { state } from '../core/state.js';
import { formatRecordDate, getProgressLabel, getTerritoryProgress, normalizeTerritoryName } from '../core/utils.js';
import { showWorkflowToast } from '../ui/toast.js';
import { closePdfPopup, openPdfPopupEarly, openPdfPreview } from './pdf.js';
import { getRecordForBlock } from './records.js';

export function buildGeneralReport() {
  const source = state.allKmlData.length > 0 ? state.allKmlData : state.loadedMaps;
  const maps = source.map(m => {
    const groups = new Map();
    m.blocks.forEach(b => {
      const k = normalizeTerritoryName(b.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(b);
    });
    const territories = [...groups.values()].map(list => {
      const rep = list.find(b => b.name.trim().toLowerCase() === normalizeTerritoryName(b.name)) || list[0];
      const record = getRecordForBlock(rep.name);
      const pct = getTerritoryProgress(record);
      return { name: rep.name, pct, record };
    });
    territories.sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
    const worked = territories.filter(t => t.pct > 0);
    const pending = territories.filter(t => t.pct === 0);
    const avg = territories.length ? Math.round(territories.reduce((s, t) => s + t.pct, 0) / territories.length) : 0;
    return { name: m.name || (m.fileName || '').replace(/\.(kml|xml)$/i, ''), territories, worked, pending, avg };
  });
  const all = maps.flatMap(x => x.territories);
  const worked = all.filter(t => t.pct > 0);
  const pending = all.filter(t => t.pct === 0);
  const avg = all.length ? Math.round(all.reduce((s, t) => s + t.pct, 0) / all.length) : 0;
  const pctWorked = all.length ? Math.round(worked.length / all.length * 100) : 0;
  return { maps, total: all.length, worked, pending, avg, pctWorked };
}

export function fmtReportDate(str) {
  return str && String(str).trim() ? formatRecordDate(String(str)) : '-';
}

export function renderReportModal() {
  const report = buildGeneralReport();

  $reportSummary.innerHTML = `
    <div class="report-card"><span class="rc-val">${report.total}</span><span class="rc-lab">Territorios</span></div>
    <div class="report-card ok"><span class="rc-val">${report.worked.length}</span><span class="rc-lab">Trabajados</span></div>
    <div class="report-card pending"><span class="rc-val">${report.pending.length}</span><span class="rc-lab">Falta por trabajar</span></div>
    <div class="report-card progress"><span class="rc-val">${report.avg}%</span><span class="rc-lab">Avance promedio</span></div>`;

  $reportCount.textContent = `${report.pctWorked}% trabajado · ${report.total} territorios`;

  if (report.total === 0) {
    $reportBody.innerHTML = '<div class="report-empty">No hay territorios cargados.</div>';
    return;
  }

  $reportBody.innerHTML = report.maps.map(m => {
    if (!m.territories.length) return '';
    const rows = m.territories.map(t => `
      <tr>
        <td class="rp-name">${t.name}</td>
        <td>${getProgressLabel(t.pct)}</td>
        <td><span class="report-pct p${t.pct}">${t.pct}%</span></td>
        <td><span class="report-pct p${t.pct}">${100 - t.pct}%</span></td>
        <td><div class="report-bar"><i class="${t.pct >= 100 ? '' : 'p50'}" style="width:${t.pct}%"></i></div></td>
        <td>${t.record ? fmtReportDate(t.record.fecha_inicio) : '-'}</td>
        <td>${t.record ? fmtReportDate(t.record.fecha_fin) : '-'}</td>
        <td>${t.record && t.record.publicador ? t.record.publicador : '-'}</td>
      </tr>`).join('');
    return `
      <div>
        <div class="report-map-head">
          <b>${m.name}</b>
          <span>${m.worked.length}/${m.territories.length} trabajados · avance ${m.avg}%</span>
        </div>
        <div class="report-scroll">
          <table class="report-table">
            <thead>
              <tr><th>Territorio</th><th>Estado</th><th>Avance</th><th>Falta</th><th></th><th>Inicio</th><th>Fin</th><th>Publicador</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

export function exportReportPDF() {
  if (state.loadedMaps.length === 0) {
    showWorkflowToast('No hay mapas cargados para exportar', '⚠️', 3000);
    return;
  }
  openPdfPopupEarly();
  try {
    exportReportPDFCore();
  } catch (err) {
    console.warn('[MapView] Error exportando reporte PDF:', err);
    closePdfPopup();
    showWorkflowToast('No se pudo generar el PDF en este dispositivo', '⚠️', 3500);
  }
}

export function exportReportPDFCore() {
  showWorkflowToast('Generando PDF del reporte...', '⏳', 3000);

  const report = buildGeneralReport();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  function newPage() { doc.addPage(); y = margin; }
  function ensureSpace(needed) { if (y + needed > pageH - margin) newPage(); }

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('MAPVIEW - Reporte General', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Total de territorios: ${report.total}`, margin, y);
  y += 5;
  doc.text(`Trabajados: ${report.worked.length} (${report.pctWorked}%)   -   Falta por trabajar: ${report.pending.length}`, margin, y);
  y += 5;
  doc.text(`Avance promedio: ${report.avg}%`, margin, y);
  y += 7;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFontSize(9);
  doc.splitTextToSize('Completado = 100% (con fecha de finalizacion) - En curso = 50% (solo fecha de inicio) - Sin trabajar = 0% (sin registro). Trabajado = con fecha de inicio o finalizacion.', pageW - margin * 2).forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  const fmt = d => d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

  report.maps.forEach((m, mapIdx) => {
    if (!m.territories.length) return;
    ensureSpace(22);

    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text(`${mapIdx + 1}. ${m.name} - ${m.worked.length}/${m.territories.length} trabajados - avance ${m.avg}%`, margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const c = { num: 8, name: 48, status: 26, pct: 16, rest: 16, date1: 20, date2: 20, pub: 28 };
    const xNum = margin;
    const xName = xNum + c.num;
    const xStatus = xName + c.name;
    const xPct = xStatus + c.status;
    const xRest = xPct + c.pct;
    const xD1 = xRest + c.rest;
    const xD2 = xD1 + c.date1;
    const xPub = xD2 + c.date2;

    ensureSpace(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 3.5, pageW - margin * 2, 7, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('#', xNum + 2, y + 1);
    doc.text('Territorio', xName + 2, y + 1);
    doc.text('Estado', xStatus + 2, y + 1);
    doc.text('Avance', xPct + 2, y + 1);
    doc.text('Falta', xRest + 2, y + 1);
    doc.text('Inicio', xD1 + 2, y + 1);
    doc.text('Fin', xD2 + 2, y + 1);
    doc.text('Publicador', xPub + 2, y + 1);
    y += 7;
    doc.setFont(undefined, 'normal');

    m.territories.forEach((t, i) => {
      ensureSpace(7);
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 3.5, pageW - margin * 2, 7, 'F');
      }
      doc.setFontSize(8);
      doc.text(String(i + 1), xNum + 2, y + 1);
      doc.text(t.name.substring(0, 30), xName + 2, y + 1);
      doc.text(getProgressLabel(t.pct), xStatus + 2, y + 1);

      const pc = t.pct >= 100 ? [16, 185, 129] : t.pct > 0 ? [245, 158, 11] : [239, 68, 68];
      doc.setTextColor(pc[0], pc[1], pc[2]);
      doc.text(`${t.pct}%`, xPct + 2, y + 1);
      doc.text(`${100 - t.pct}%`, xRest + 2, y + 1);
      doc.setTextColor(0, 0, 0);

      const d1 = t.record && t.record.fecha_inicio ? new Date(t.record.fecha_inicio) : null;
      const d2 = t.record && t.record.fecha_fin ? new Date(t.record.fecha_fin) : null;
      doc.text(fmt(d1), xD1 + 2, y + 1);
      doc.text(fmt(d2), xD2 + 2, y + 1);
      doc.text(t.record && t.record.publicador ? String(t.record.publicador).substring(0, 15) : '', xPub + 2, y + 1);
      y += 6;
    });

    y += 8;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`MapView - Reporte - Pagina ${i} de ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  const fileName = `Reporte_territorios_${new Date().toISOString().slice(0, 10)}.pdf`;
  openPdfPreview(doc, fileName);
}

export function openReportModal() {
  if (state.loadedMaps.length === 0) {
    showWorkflowToast('Carga un mapa primero', '🗺', 2600);
    return;
  }
  renderReportModal();
  $reportModal.classList.add('active');
  gsap.fromTo($reportModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.report-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
}

export function closeReportModal() {
  gsap.to('.report-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($reportModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $reportModal.classList.remove('active');
      $reportModal.style.opacity = '';
    }
  });
}

/** Conecta el modal del reporte general. */
export function initReport() {
  $reportClose.addEventListener('click', closeReportModal);
  $reportExport.addEventListener('click', exportReportPDF);
  $reportModal.addEventListener('click', (e) => {
    if (e.target === $reportModal) closeReportModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $reportModal.classList.contains('active') && !$pdfModal.classList.contains('active')) closeReportModal();
  });
}
