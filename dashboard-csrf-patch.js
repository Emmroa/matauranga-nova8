/**
 * NOVA Dashboard — CSRF Patch (dashboard-csrf-patch.js)
 * ======================================================
 * Incluir este script en dashboard.html ANTES de cualquier
 * fetch a /stats. Funciona automáticamente con el CSRF token
 * que el servidor inyecta como <meta name="csrf-token">.
 *
 * Cómo agregar al dashboard.html existente:
 *   Antes del cierre </body>, insertar:
 *   <script src="dashboard-csrf-patch.js"></script>
 *
 * O copiar el contenido directamente al <script> del dashboard.
 * ======================================================
 */

(function () {
  'use strict';

  // ── 1. Leer CSRF token inyectado por el servidor ────────────
  const csrfMeta  = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : null;

  if (!csrfToken) {
    console.warn('[NOVA-CSRF] Meta tag csrf-token no encontrado — requests sin protección CSRF');
  }

  // ── 2. Leer contraseña del sessionStorage (comportamiento actual) ──
  function getDashboardPassword() {
    return sessionStorage.getItem('nova_dashboard_pwd') || '';
  }

  // ── 3. Wrapper seguro para fetch a /stats ──────────────────
  //    Reemplaza cualquier llamada directa a /stats con esta.
  window.novaFetchStats = async function () {
    const pwd = getDashboardPassword();
    const headers = {
      'Content-Type': 'application/json',
      'X-Dashboard-Auth': pwd,
    };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const res = await fetch('/stats', { method: 'GET', headers });

    if (res.status === 401) {
      // Contraseña inválida — limpiar y pedir de nuevo
      sessionStorage.removeItem('nova_dashboard_pwd');
      window.location.reload();
      return null;
    }
    if (!res.ok) throw new Error(`/stats error ${res.status}`);
    return res.json();
  };

  // ── 4. Interceptar todos los fetch existentes al endpoint /stats ──
  //    Así el dashboard.html existente no necesita ser reescrito.
  const _origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = (typeof input === 'string') ? input : (input.url || '');
    if (url === '/stats' || url.endsWith('/stats')) {
      // Inyectar headers CSRF y auth automáticamente
      const pwd = getDashboardPassword();
      init = init || {};
      init.headers = Object.assign({}, init.headers || {}, {
        'X-Dashboard-Auth': pwd,
      });
      if (csrfToken) {
        init.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return _origFetch.call(this, input, init);
  };

  // ── 5. Login / logout helpers (compatibles con el dashboard existente) ──
  window.novaLogin = function (password) {
    if (!password) return false;
    sessionStorage.setItem('nova_dashboard_pwd', password);
    return true;
  };

  window.novaLogout = function () {
    sessionStorage.removeItem('nova_dashboard_pwd');
    // Forzar recarga para limpiar estado
    window.location.href = '/dashboard.html';
  };

  // ── 6. Auto-refresh de datos cada 30 segundos ──────────────
  //    Si el dashboard ya tiene su propio refresh, esto no duplica
  //    porque sólo llama a novaFetchStats() si está definido como
  //    función global que el dashboard puede usar.
  if (!window._novaAutoRefresh) {
    window._novaAutoRefresh = setInterval(async () => {
      if (!getDashboardPassword()) return;   // no autenticado aún
      try {
        const data = await window.novaFetchStats();
        if (data && typeof window.novaUpdateCharts === 'function') {
          window.novaUpdateCharts(data);
        }
      } catch (err) {
        console.warn('[NOVA-CSRF] Auto-refresh error:', err.message);
      }
    }, 30000);
  }

  console.log('[NOVA-CSRF] ✅ Patch aplicado — CSRF + auth interceptor activo');
})();
