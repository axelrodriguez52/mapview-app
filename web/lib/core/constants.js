// core/constants.js — Constantes compartidas: colores, claves de almacenamiento y endpoints.

export const MAP_COLORS = [
  { fill: 'rgba(59,130,246,0.22)',  stroke: '#3b82f6', solid: '#3b82f6', label: '#93bbfd' },
  { fill: 'rgba(16,185,129,0.22)',  stroke: '#10b981', solid: '#10b981', label: '#6ee7b7' },
  { fill: 'rgba(245,158,11,0.22)',  stroke: '#f59e0b', solid: '#f59e0b', label: '#fcd34d' },
  { fill: 'rgba(239,68,68,0.22)',   stroke: '#ef4444', solid: '#ef4444', label: '#fca5a5' },
  { fill: 'rgba(168,85,247,0.22)',  stroke: '#a855f7', solid: '#a855f7', label: '#c4b5fd' },
  { fill: 'rgba(20,184,166,0.22)',  stroke: '#14b8a6', solid: '#14b8a6', label: '#5eead4' },
  { fill: 'rgba(236,72,153,0.22)',  stroke: '#ec4899', solid: '#ec4899', label: '#f9a8d4' },
  { fill: 'rgba(34,211,238,0.22)',  stroke: '#22d3ee', solid: '#22d3ee', label: '#a5f3fc' },
];

export const ADMIN_PASSWORD_DEFAULT = 'admin123';

export const KML_STORAGE_KEY = 'mapview-kml-data';

export const KML_STORAGE_MAP_KEY = 'mapview-selected-map';

export const PENDING_RECORDS_KEY = 'mapview-pending-records';

export const RECORDS_STORAGE_KEY = 'mapview-records';

export const STATUS_COLORS = {
  fresh:  { fill: 'rgba(16,185,129,0.28)', stroke: '#10b981', label: 'Reciente', css: '#10b981' },
  warning:{ fill: 'rgba(245,158,11,0.28)', stroke: '#f59e0b', label: '3 meses',  css: '#f59e0b' },
  alert:  { fill: 'rgba(239,68,68,0.28)',  stroke: '#ef4444', label: 'Sin visita', css: '#ef4444' }
};

export const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw-WOLL5QBgohtvOo9he2ua9nn6Av9i4NFaymAM6_vpGQX50lkk7bRu-N4DiMw1-98/exec';

export const SAVE_BTN_DEFAULT_HTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Grabar en Google Sheets`;

export const SAVE_BTN_FINAL_HTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Guardar fecha finalización`;

export const SAVE_BTN_UPDATE_HTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Actualizar registro`;
