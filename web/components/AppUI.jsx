export default function AppUI() {
  return (
    <>
<div id="map-selector">
  <div className="selector-header">
    <h2>Selecciona un Territorio</h2>
    <p>Elige el mapa que deseas visualizar, o abre la vista general con todos los territorios juntos.</p>
  </div>
  <div className="selector-general" id="selector-general">
    <div className="selector-general-icon">🌐</div>
    <div className="selector-general-info">
      <div className="selector-general-title">Vista general <span className="selector-general-chip">Todos los mapas</span></div>
      <div className="selector-general-desc" id="selector-general-desc">Ver todos los mapas juntos con todos los polígonos</div>
      <div className="selector-general-bar"><i id="selector-general-bar-fill"></i></div>
    </div>
    <div className="selector-general-right">
      <span className="selector-general-pct" id="selector-general-pct">0%</span>
      <svg className="selector-general-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </div>
  </div>
  <div className="selector-grid" id="selector-grid"></div>
  <div className="selector-footer">
    <p className="admin-only">Puedes cargar más archivos KML después usando el botón "Cargar KMLs"</p>
    <p className="admin-hide">El administrador puede cargar más archivos KML usando el botón "Cargar KMLs"</p>
  </div>
</div>

<div id="app">
  <header>
    <button className="menu-toggle" id="menu-toggle" aria-label="Abrir menú">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <span className="menu-hint">Abrir panel</span>
    </button>
    <div className="header-logo">
      <div className="logo-mark">🗺</div>
      <span className="logo-text">MAP<span>VIEW</span></span>
    </div>

    <div className="header-divider"></div>

    <div className="upload-area admin-only">
      <label htmlFor="file-upload" className="upload-btn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10"/>
          <polyline points="5 6 8 3 11 6"/>
          <line x1="8" y1="3" x2="8" y2="10"/>
        </svg>
        Cargar KMLs
      </label>
      <input type="file" id="file-upload" accept=".kml,.xml" multiple />
    </div>

    <button className="btn-cambiar-mapa" id="btn-cambiar-mapa">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h12M2 8h12M2 12h12"/>
        </svg>
        Cambiar mapa
        <span id="pending-badge" style={{ display: "none", background: "#f59e0b", color: "#000", borderRadius: "50%", width: "18px", height: "18px", fontSize: "0.65rem", fontWeight: "700", alignItems: "center", justifyContent: "center", marginLeft: "4px" }}></span>
    </button>

    <button className="btn-cambiar-mapa btn-export-pdf" id="btn-export-pdf">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
          <path d="M5 8h6M8 5v6"/>
        </svg>
        Exportar PDF
    </button>

    <button className="btn-cambiar-mapa" id="btn-reporte" title="Reporte general de territorios">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13V9"/>
        <path d="M8 13V4"/>
        <path d="M13 13V7"/>
      </svg>
      Reporte
    </button>

    <div className="header-stats">
      <div className="stat-chip">
        <span>Mapas</span>
        <span className="val" id="map-count">0</span>
      </div>
      <div className="stat-chip">
        <span>Bloques</span>
        <span className="val" id="total-count">0</span>
      </div>
      <div className="status-dot" id="status-dot" title="Motor activo"></div>
      <div className="offline-badge" id="offline-badge" style={{ display: "none" }}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="15" y2="15"/>
          <path d="M16 12.5A10.3 10.3 0 0 0 3.5 4"/>
          <path d="M1 4.5A10.3 10.3 0 0 0 12 12"/>
          <path d="M5 8a5 5 0 0 1 7.5-3.5"/>
          <path d="M8 8a2 2 0 0 1 2.8-1.4"/>
        </svg>
        Offline
      </div>
      <div className="admin-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Admin
      </div>
      <button className="admin-login-btn" id="admin-login-btn" title="Acceso administrador">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Admin
      </button>
      <button className="admin-logout-btn" id="admin-logout-btn" title="Cerrar sesión admin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Salir
      </button>
      <button className="theme-toggle" id="theme-toggle" aria-label="Cambiar tema" title="Alternar modo claro/oscuro">
        <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </button>
    </div>
  </header>

  <main>
    <div id="map-container">
      <div id="hud-selection">
        <div className="hud-eyebrow">Territorio Seleccionado</div>
        <div className="hud-name" id="hud-name"></div>
      </div>
      <div className="map-empty-state" id="map-empty-state">
        <div className="map-empty-icon">📂</div>
        <div className="map-empty-title admin-only">Carga tu primer archivo KML</div>
        <div className="map-empty-title admin-hide">Esperando territorios...</div>
        <div className="map-empty-desc admin-only">Selecciona archivos KML o XML desde tu dispositivo para visualizar los polígonos en el mapa.</div>
        <div className="map-empty-desc admin-hide">El administrador aún no ha cargado ningún archivo KML. Vuelve a intentarlo más tarde.</div>
        <label htmlFor="file-upload-empty" className="map-empty-btn admin-only">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10"/>
            <polyline points="5 6 8 3 11 6"/>
            <line x1="8" y1="3" x2="8" y2="10"/>
          </svg>
          Seleccionar archivos KML
        </label>
        <input type="file" id="file-upload-empty" accept=".kml,.xml" multiple style={{ display: "none" }} />
        <div className="map-empty-steps admin-only">
          <div className="map-empty-step">
            <div className="map-empty-step-num">1</div>
            Cargar KML
          </div>
          <div className="map-empty-step">
            <div className="map-empty-step-num">2</div>
            Seleccionar mapa
          </div>
          <div className="map-empty-step">
            <div className="map-empty-step-num">3</div>
            Explorar bloques
          </div>
        </div>
      </div>
      <div id="map"></div>
      <div className="general-badge" id="general-badge">
        <div className="gb-eyebrow">🌐 Vista general</div>
        <div className="gb-main">
          <span className="gb-pct" id="gb-pct">0%</span>
          <span className="gb-label">trabajado</span>
        </div>
        <div className="gb-sub" id="gb-sub"></div>
        <div className="gb-bar"><i id="gb-bar-fill"></i></div>
      </div>
      <div className="workflow-toast" id="workflow-toast">
        <span className="workflow-toast-icon">👆</span>
        <span id="workflow-toast-text">Haz clic en un polígono del mapa o en la lista para ver sus datos</span>
      </div>
    </div>

    <div id="sidebar">
      <div className="sidebar-head">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
          <rect x="1" y="1" width="14" height="14" rx="2"/>
          <path d="M1 6h14M6 1v14"/>
        </svg>
        <span className="sidebar-head-label">Mapas Cargados</span>
        <button className="sidebar-records-btn admin-only" id="records-admin-btn" title="Gestionar registros de Google Sheets" aria-label="Gestionar registros">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"/>
            <line x1="7" y1="7" x2="7" y2="11"/>
            <line x1="9" y1="7" x2="9" y2="11"/>
          </svg>
        </button>
        <button className="sidebar-close" id="sidebar-close" aria-label="Cerrar panel">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="4" x2="12" y2="12"/>
            <line x1="12" y1="4" x2="4" y2="12"/>
          </svg>
        </button>
      </div>
      <div className="visit-legend">
        <div className="visit-legend-item"><span className="visit-dot" style={{ background: "#10b981" }}></span> Reciente (&lt;3 meses)</div>
        <div className="visit-legend-item"><span className="visit-dot" style={{ background: "#f59e0b" }}></span> 3 meses</div>
        <div className="visit-legend-item"><span className="visit-dot" style={{ background: "#ef4444" }}></span> Sin visita (4+ meses)</div>
        <div className="visit-legend-divider"></div>
        <div className="visit-legend-item"><span className="visit-legend-badge" style={{ background: "#10b981", color: "#fff" }}>✓</span> Con fecha de finalización</div>
        <div className="visit-legend-item"><span className="visit-legend-badge" style={{ background: "#f59e0b", color: "#000" }}>?</span> Visitado sin fecha fin</div>
        <div className="visit-legend-item"><span className="visit-legend-badge" style={{ background: "#ef4444", color: "#fff" }}>!</span> Sin trabajar</div>
      </div>
      <div id="map-list">
        <div className="map-empty">Adjunta archivos KML para comenzar</div>
      </div>
      <div className="sidebar-divider"></div>
      <div className="sidebar-search">
        <span className="sidebar-search-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14"/>
          </svg>
        </span>
        <input type="text" id="search-input" placeholder="Buscar bloque o territorio..." />
      </div>
      <div id="block-list"></div>
      <div id="detail">
        <div className="detail-eyebrow">Información del Polígono</div>
        <div className="detail-name" id="d-name">—</div>
        <div className="detail-rows" id="d-rows">
          <span className="detail-empty">Haz clic en un polígono para ver sus datos</span>
        </div>
        <div className="detail-form" id="d-form" style={{ display: "none" }}>
          <div className="registration-section">
            <div className="registration-header">
              <div className="registration-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
                  <path d="M5 8l2 2 4-4"/>
                </svg>
              </div>
              <span className="registration-title">Registrar Territorio</span>
            </div>
            <label>
              <span>Nombre del Publicador</span>
              <input type="text" id="d-publisher" placeholder="Ej: Juan Pérez" />
            </label>
            <label id="d-publisher-end-label" style={{ display: "none" }}>
              <span>Publicador que finalizó (opcional)</span>
              <input type="text" id="d-publisher-end" placeholder="Ej: María López" title="Si se deja vacío, se mantiene el publicador del inicio" />
            </label>
            <label>
              <span>Fecha de Inicio</span>
              <input type="date" id="d-date-start" />
            </label>
            <label>
              <span>Fecha de Finalización</span>
              <input type="date" id="d-date-end" />
            </label>
            <div className="save-status" id="d-save-status"></div>
            <button className="btn-grabar" id="d-btn-save">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
                <path d="M5 8l2 2 4-4"/>
              </svg>
              Grabar en Google Sheets
            </button>
          </div>
        </div>
      </div>
    </div>
    <div className="sidebar-overlay" id="sidebar-overlay"></div>
  </main>
</div>

<div className="login-modal" id="login-modal">
  <div className="login-box">
    <h3>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Acceso Administrador
    </h3>
    <p>Ingresa la contraseña para acceder al modo administrador. Solo los administradores pueden cargar y reemplazar archivos KML.</p>
    <input type="password" id="login-password" placeholder="Contraseña..." autoComplete="off" />
    <div className="login-error" id="login-error">Contraseña incorrecta. Intenta de nuevo.</div>
    <div className="login-actions">
      <button className="login-cancel" id="login-cancel">Cancelar</button>
      <button className="login-submit" id="login-submit">Entrar</button>
    </div>
  </div>
</div>

<div className="login-modal" id="records-modal">
  <div className="records-box">
    <h3>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
      Registros de Google Sheets
    </h3>
    <input type="text" id="records-search" placeholder="Buscar territorio, mapa o publicador..." />
    <div className="records-list" id="records-list"></div>
    <div className="records-footer">
      <span className="records-count" id="records-count"></span>
      <button className="login-cancel" id="records-close">Cerrar</button>
    </div>
  </div>
</div>

<div className="login-modal" id="rename-modal">
  <div className="rename-box">
    <h3>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", color: "var(--gold)" }}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
      Editar título del KML
    </h3>
    <input type="text" id="rename-input" placeholder="Nuevo título..." maxLength="80" autoComplete="off" />
    <div className="login-error" id="rename-error">El título no puede estar vacío.</div>
    <div className="login-actions">
      <button className="login-cancel" id="rename-cancel">Cancelar</button>
      <button className="login-submit" id="rename-submit">Guardar</button>
    </div>
  </div>
</div>

<div className="login-modal" id="pdf-modal">
  <div className="pdf-box">
    <h3>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", color: "var(--gold)" }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Vista previa del PDF
    </h3>
    <iframe id="pdf-frame" title="Vista previa del PDF"></iframe>
    <div className="pdf-actions">
      <span className="pdf-name" id="pdf-name"></span>
      <div className="pdf-actions-buttons">
        <button className="login-cancel" id="pdf-close">Cerrar</button>
        <button className="login-submit" id="pdf-download">Descargar</button>
      </div>
    </div>
  </div>
</div>

<div className="login-modal" id="report-modal">
  <div className="report-box">
    <h3>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", color: "var(--accent)" }}><line x1="4" y1="20" x2="4" y2="12"/><line x1="10" y1="20" x2="10" y2="6"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="21" y1="20" x2="3" y2="20"/></svg>
      Reporte general de territorios
    </h3>
    <div className="report-summary" id="report-summary"></div>
    <div className="report-legend">Completado = con fecha de finalización (100%) · En curso = solo fecha de inicio (50%) · Sin trabajar = sin registro (0%). Trabajado = con fecha de inicio o finalización.</div>
    <div className="report-body" id="report-body"></div>
    <div className="pdf-actions">
      <span className="pdf-name" id="report-count"></span>
      <div className="pdf-actions-buttons">
        <button className="login-submit" id="report-export">Exportar PDF</button>
        <button className="login-cancel" id="report-close">Cerrar</button>
      </div>
    </div>
  </div>
</div>
    </>
  );
}
