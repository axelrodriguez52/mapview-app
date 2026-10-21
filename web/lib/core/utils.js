// core/utils.js — Utilidades de fechas, territorios, visitas y geometría.

import { getRecordForBlock } from '../features/records.js';
import { STATUS_COLORS } from './constants.js';

export function parseDateValue(str) {
  if (!str) return 0;
  if (str instanceof Date) return str.getTime();
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();
  const m = String(str).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, c] = m;
    if (c.length === 2) c = '20' + c;
    d = new Date(Number(c), Number(b) - 1, Number(a));
    if (!isNaN(d.getTime())) return d.getTime();
    d = new Date(Number(c), Number(a) - 1, Number(b));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

export function normalizeTerritoryName(name) {
  return name.replace(/(\s*\(\d+\))+\s*$/, '').toLowerCase().trim();
}

export function formatRecordDate(str) {
  const ts = parseDateValue(str);
  if (!ts) return str ? String(str) : '';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toISODate(str) {
  if (!str) return '';
  const s = String(str).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (m) {
    const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const mo = months[m[1]];
    if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
  }
  const ts = parseDateValue(s);
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getVisitStatus(blockName) {
  const record = getRecordForBlock(blockName);
  if (!record) return 'alert';

  const dateStr = record.fecha_fin || record.fecha_inicio || '';
  if (!dateStr) return 'alert';

  const ts = parseDateValue(dateStr);
  if (!ts) return 'alert';

  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'fresh';
  if (diffDays < 90) return 'fresh';
  if (diffDays < 120) return 'warning';
  return 'alert';
}

export function getVisitStatusInfo(blockName) {
  const status = getVisitStatus(blockName);
  const record = getRecordForBlock(blockName);
  let lastDate = null;
  let visitIcon = null;
  if (record) {
    const dateStr = record.fecha_fin || record.fecha_inicio || '';
    if (dateStr) {
      const ts = parseDateValue(dateStr);
      if (ts) {
        lastDate = new Date(ts);
        const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
        if (diffDays < 90) {
          visitIcon = record.fecha_fin ? 'check' : 'question';
        }
      }
    }
  } else {
    visitIcon = 'alert';
  }
  return { status, colors: STATUS_COLORS[status], lastDate, visitIcon };
}

export function getTerritoryProgress(record) {
  if (record && record.fecha_fin && String(record.fecha_fin).trim()) return 100;
  if (record && record.fecha_inicio && String(record.fecha_inicio).trim()) return 50;
  return 0;
}

export function getProgressLabel(pct) {
  if (pct >= 100) return 'Completado';
  if (pct > 0) return 'En curso';
  return 'Sin trabajar';
}

export function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function isPointInPolygon(point, polygon) {
  let inside = false;
  const x = point.lat, y = point.lng;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function parseCoordsToLeaflet(str) {
  return str.trim().split(/\s+/).map(t => {
    const [lng, lat] = t.split(',').map(Number);
    return [lat, lng];
  });
}

export function polygonCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const cross = p1[0] * p2[1] - p2[0] * p1[1];
    a += cross;
    cx += (p1[0] + p2[0]) * cross;
    cy += (p1[1] + p2[1]) * cross;
  }
  if (Math.abs(a) < 1e-12) return null;
  return [cx / (3 * a), cy / (3 * a)];
}

export function pointInPolygon(pt, poly) {
  const x = pt[1], y = pt[0];
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][1], yi = poly[i][0];
    const xj = poly[j][1], yj = poly[j][0];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export function distToSegment2(p, a, b) {
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = a[1] + t * dx - p[1], ey = a[0] + t * dy - p[0];
  return Math.sqrt(ex * ex + ey * ey);
}

export function minEdgeDistance(p, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment2(p, poly[i], poly[j]);
    if (d < m) m = d;
  }
  return m;
}

export function getPolygonInteriorPoint(latlngs) {
  if (!latlngs || latlngs.length === 0) return [0, 0];
  if (latlngs.length < 3) return latlngs[0];
  const c = polygonCentroid(latlngs);
  if (c && pointInPolygon(c, latlngs)) return c;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  latlngs.forEach(p => {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  });
  let best = null, bestD = -1;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = [minLat + (maxLat - minLat) * i / N, minLng + (maxLng - minLng) * j / N];
      if (!pointInPolygon(p, latlngs)) continue;
      const d = minEdgeDistance(p, latlngs);
      if (d > bestD) { bestD = d; best = p; }
    }
  }
  if (best) return best;
  if (c) return c;
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

export function isMobile() {
  return window.innerWidth <= 600;
}

export function isTablet() {
  return window.innerWidth > 600 && window.innerWidth <= 1024;
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
