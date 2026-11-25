/* =============================================================
   SpaceTwin · Capa de interfaz compartida
   -------------------------------------------------------------
   - Protección de sesión (redirige a login.html)
   - Header uniforme: nombre real, menú, campana de notificaciones
   - Panel "Políticas de reserva"
   - Accesibilidad: foco visible, alto contraste
   - Asistente de reserva por voz / chat (Web Speech API)
   ============================================================= */
(function () {
  'use strict';

  const CFG = window.ST_CONFIG;
  const S = window.Store;
  const U = S.util;
  const pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  /* ---------------------------------------------------------
     0. Acceso
     - Públicas (sin cuenta): inicio, espacios 3D, calendario y disponibilidad.
     - Con sesión: mis reservas, perfil, detalle de reserva y notificaciones.
     - Solo administradores: admin.html.
     No se redirige: las páginas protegidas muestran una pantalla de acceso
     y, al iniciar sesión, el usuario sigue en la misma página.
     --------------------------------------------------------- */
  const PROTEGIDAS = ['myreservas.html', 'user.html', 'reserva.html', 'admin.html'];
  let usuario = S.usuario();
  let bloqueo = null; // null | 'sesion' | 'admin'
  if (PROTEGIDAS.includes(pagina) && !usuario) bloqueo = 'sesion';
  else if (pagina === 'admin.html' && usuario && usuario.rol !== 'admin') bloqueo = 'admin';
  // Las páginas protegidas consultan esta marca para no pintar datos sin permiso
  window.ST_BLOQUEADO = !!bloqueo;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const primerNombre = (n) => { const p = String(n || '').replace(/^(Dra?\.|Lic\.|Ing\.|Mg\.)\s*/i, '').split(' '); return p[0] || 'Usuario'; };
  const ROLES = { estudiante: 'Estudiante', docente: 'Docente', admin: 'Administrador' };

  /* ---------------------------------------------------------
     1. Estilos globales (accesibilidad + componentes propios)
     --------------------------------------------------------- */
  const css = document.createElement('style');
  css.textContent = `
    :focus-visible { outline: 3px solid #FACC15 !important; outline-offset: 2px !important; border-radius: 8px; }
    html.st-hc body { filter: contrast(1.18) saturate(1.1); }
    html.st-hc .text-slate-400, html.st-hc .text-slate-500 { color: #1e293b !important; }
    html.st-hc .text-blue-100, html.st-hc .text-blue-200 { color: #ffffff !important; }
    .st-sr { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0; }
    .st-scroll::-webkit-scrollbar { width: 6px; } .st-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:9999px; }
    @keyframes st-pop { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
    .st-pop { animation: st-pop .18s ease-out; }
    @keyframes st-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.6) } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0) } }
    .st-listening { animation: st-pulse 1.2s infinite; background:#ef4444 !important; color:#fff !important; }
  `;
  document.head.appendChild(css);
  try { if (localStorage.getItem('st_hc') === '1') document.documentElement.classList.add('st-hc'); } catch (e) {}

  /* ---------------------------------------------------------
     2. Toast (usa el de la página si existe)
     --------------------------------------------------------- */
  function toast(msg) {
    if (typeof window.showToast === 'function' && (document.getElementById('toast') || document.getElementById('toastNotification'))) {
      window.showToast(msg); return;
    }
    let t = document.getElementById('st-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'st-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.className = 'fixed bottom-5 right-5 z-[70] max-w-md bg-lasalle-gradient text-white px-5 py-3.5 rounded-xl shadow-2xl border border-white/30 text-sm font-medium transition-all duration-300 opacity-0 translate-y-24 pointer-events-none';
      t.style.background = 'linear-gradient(135deg,#0044FF 0%,#0026B8 100%)';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove('opacity-0', 'translate-y-24');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.add('opacity-0', 'translate-y-24'), 4200);
  }

  /* ---------------------------------------------------------
     3. Modal genérico accesible
     --------------------------------------------------------- */
  function modal(titulo, html, opciones) {
    opciones = opciones || {};
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-[80] flex items-center justify-center p-4';
    wrap.style.background = 'rgba(0,24,122,.55)';
    wrap.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="st-modal-t" class="st-pop bg-white rounded-2xl shadow-2xl w-full ${opciones.ancho || 'max-w-lg'} max-h-[88vh] flex flex-col overflow-hidden border border-blue-100">
        <div class="px-6 py-4 flex items-center justify-between text-white" style="background:linear-gradient(135deg,#0044FF 0%,#0026B8 100%)">
          <h2 id="st-modal-t" class="font-display font-extrabold text-lg">${esc(titulo)}</h2>
          <button type="button" data-cerrar class="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="Cerrar">✕</button>
        </div>
        <div class="p-6 overflow-y-auto st-scroll text-sm text-slate-700">${html}</div>
      </div>`;
    const cerrar = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-cerrar]')) cerrar(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    const f = wrap.querySelector('[data-autofocus]') || wrap.querySelector('[data-cerrar]');
    if (f) f.focus();
    return { el: wrap, cerrar };
  }

  /* ---------------------------------------------------------
     4. Políticas de reserva
     --------------------------------------------------------- */
  function htmlPoliticas(espacioId) {
    const espacios = espacioId ? [S.espacio(espacioId)] : S.espacios();
    const P = CFG.PRIORIDADES;
    return `
      <ul class="space-y-2.5">
        ${espacios.map((e) => { const r = S.reglasDe(e.id); return `<li class="flex gap-2"><span aria-hidden="true">🕑</span><span><strong>${esc(e.corto)}</strong>: anticipación mínima de <strong>${r.anticipacionMinHoras} h</strong> y duración máxima de <strong>${r.duracionMaxHoras} h</strong> por reserva. Aforo máximo ${e.capacidad} personas.</span></li>`; }).join('')}
        <li class="flex gap-2"><span aria-hidden="true">📅</span><span>Se puede reservar con hasta <strong>${CFG.ANTICIPACION_MAX_DIAS} días</strong> de anticipación, de lunes a sábado, entre <strong>${U.pad(CFG.HORA_APERTURA)}:00 y ${U.pad(CFG.HORA_CIERRE)}:00</strong>.</span></li>
        <li class="flex gap-2"><span aria-hidden="true">⚖️</span><span>Prioridad de aprobación: <strong>${P.institucional.etiqueta}</strong> &gt; <strong>${P.docente.etiqueta}</strong> &gt; <strong>${P.estudiante.etiqueta}</strong>. Ante un cruce, se aprueba la de mayor prioridad.</span></li>
        <li class="flex gap-2"><span aria-hidden="true">↩️</span><span>Puedes cancelar sin penalidad hasta <strong>${CFG.CANCELACION_MIN_HORAS} h antes</strong>; después queda registrada como <strong>cancelación tardía</strong>.</span></li>
        <li class="flex gap-2"><span aria-hidden="true">⏳</span><span>Toda solicitud queda <strong>pendiente</strong> hasta que la Oficina de Infraestructura la revise. Si no hay respuesta en <strong>${CFG.APROBACION_LIMITE_HORAS} h</strong>, se marca como <em>por vencer</em> y se prioriza.</span></li>
        <li class="flex gap-2"><span aria-hidden="true">🔳</span><span>Al ser aprobada recibirás un <strong>código QR</strong> para el check-in en la puerta del espacio.</span></li>
      </ul>`;
  }
  function mostrarPoliticas(espacioId) { modal('Políticas de reserva', htmlPoliticas(espacioId)); }

  /* ---------------------------------------------------------
     5. Header uniforme
     --------------------------------------------------------- */
  function reemplazarNombreFijo() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodos = [];
    while (walker.nextNode()) nodos.push(walker.currentNode);
    nodos.forEach((n) => {
      if (usuario && n.nodeValue.includes('elias@ulasalle.edu.pe')) n.nodeValue = n.nodeValue.replace(/elias@ulasalle\.edu\.pe/g, usuario.correo);
      // Solo los marcadores fijos ("Elías" solo), nunca datos reales como "Elías Quispe"
      if (n.nodeValue.trim() === 'Elías') {
        const enHeader = n.parentElement.closest('header');
        const texto = usuario ? (enHeader ? primerNombre(usuario.nombre) : usuario.nombre) : (enHeader ? 'Visitante' : 'Inicia sesión al reservar');
        n.nodeValue = n.nodeValue.replace('Elías', texto);
      }
    });
  }

  function iconoSVG(path) {
    return `<svg class="w-4 h-4 text-lasalle-vibrant flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">${path}</svg>`;
  }

  function montarMenuUsuario() {
    const dd = document.getElementById('userDropdown');
    const btn = document.getElementById('userMenuBtn');
    if (!dd || !btn) return;
    if (!usuario) {
      // Visitante: se oculta el menú y se muestra "Iniciar sesión"
      btn.classList.add('hidden');
      dd.classList.add('hidden');
      dd.innerHTML = '';
      const entrar = document.createElement('button');
      entrar.type = 'button';
      entrar.id = 'st-btn-entrar';
      entrar.className = 'flex items-center gap-2.5 p-2 pr-4 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 transition-all focus:outline-none focus:ring-2 focus:ring-white text-white';
      entrar.innerHTML = '<span class="w-10 h-10 rounded-full bg-white text-lasalle-vibrant flex items-center justify-center shadow-sm" aria-hidden="true"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.3"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg></span><span class="text-sm font-bold">Iniciar sesión</span>';
      entrar.onclick = () => pedirSesion({ onSuccess: () => location.reload() });
      btn.parentElement.appendChild(entrar);
      return;
    }
    btn.removeAttribute('onclick');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-controls', 'userDropdown');
    const item = (href, texto, icono, extra) => `<a href="${href}" role="menuitem" class="w-full text-left px-4 py-2.5 text-sm hover:bg-lasalle-ice flex items-center gap-2.5 text-slate-700 hover:text-lasalle-blue transition-colors ${extra || ''}">${icono}${texto}</a>`;
    const accion = (id, texto, icono, extra) => `<button type="button" id="${id}" role="menuitem" class="w-full text-left px-4 py-2.5 text-sm hover:bg-lasalle-ice flex items-center gap-2.5 text-slate-700 hover:text-lasalle-blue transition-colors ${extra || ''}">${icono}${texto}</button>`;
    dd.setAttribute('role', 'menu');
    dd.innerHTML = `
      <div class="px-4 py-3 border-b border-blue-50">
        <p class="text-xs font-bold uppercase tracking-wider text-lasalle-vibrant">${esc(ROLES[usuario.rol] || 'Comunidad Lasallista')}</p>
        <p class="text-sm font-semibold text-slate-900 mt-0.5">${esc(usuario.nombre)}</p>
        <p class="text-xs text-slate-500">${esc(usuario.correo)}</p>
      </div>
      <div class="py-1">
        ${item('index.html', 'Inicio · Espacios', iconoSVG('<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10"/>'))}
        ${item('user.html', 'Mi perfil', iconoSVG('<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>'))}
        ${item('myreservas.html', 'Mis reservas', iconoSVG('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'))}
        ${usuario.rol === 'admin' ? item('admin.html', 'Panel de administración', iconoSVG('<path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-6m4 6V7m4 10v-3M4 21h16"/>'), 'font-semibold') : ''}
        ${accion('st-menu-politicas', 'Políticas de reserva', iconoSVG('<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14l-7-3-7 3V6a2 2 0 012-2z"/>'))}
        ${accion('st-menu-contraste', 'Alto contraste', iconoSVG('<circle cx="12" cy="12" r="9"/><path d="M12 3v18" stroke-linecap="round"/>'))}
        ${accion('st-menu-reset', 'Reiniciar demo', iconoSVG('<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5 15a7 7 0 0012 3M19 9A7 7 0 007 6"/>'))}
      </div>
      <div class="border-t border-blue-50 pt-1">
        ${accion('st-menu-salir', 'Cerrar sesión', '<svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>', 'text-red-600 hover:bg-red-50 hover:text-red-700')}
      </div>`;
    dd.addEventListener('click', (e) => e.stopPropagation());
    dd.querySelector('#st-menu-politicas').onclick = () => { dd.classList.add('hidden'); mostrarPoliticas(); };
    dd.querySelector('#st-menu-contraste').onclick = alternarContraste;
    dd.querySelector('#st-menu-reset').onclick = reiniciarDemo;
    dd.querySelector('#st-menu-salir').onclick = () => { S.cerrarSesion(); location.href = PROTEGIDAS.includes(pagina) ? 'index.html' : location.href; };

    // Páginas nuevas no traen su propio script de menú
    if (document.body.hasAttribute('data-st-menu')) {
      const chev = document.getElementById('userChevron');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const oculto = dd.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', String(!oculto));
        if (chev) chev.style.transform = oculto ? '' : 'rotate(180deg)';
      });
      document.addEventListener('click', () => { dd.classList.add('hidden'); if (chev) chev.style.transform = ''; });
    }
  }

  function alternarContraste() {
    const on = document.documentElement.classList.toggle('st-hc');
    try { localStorage.setItem('st_hc', on ? '1' : '0'); } catch (e) {}
    toast(on ? 'Alto contraste activado' : 'Alto contraste desactivado');
  }

  function reiniciarDemo() {
    if (!confirm('¿Reiniciar la demo? Se borrarán las reservas creadas y se cargarán los datos de ejemplo.')) return;
    S.reiniciar();
    toast('Demo reiniciada con datos de ejemplo');
    setTimeout(() => location.reload(), 600);
  }

  function montarAccionesHeader() {
    const nav = document.querySelector('header nav');
    if (!nav) return;
    const logo = nav.querySelector('a[aria-label="LaSalle Universidad Arequipa"]') || nav.lastElementChild;
    if (logo && logo.tagName === 'A') logo.setAttribute('href', 'index.html');

    const grupo = document.createElement('div');
    grupo.className = 'flex items-center gap-2 sm:gap-3';
    grupo.innerHTML = `
      <span class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold tracking-wider uppercase text-white">
        <span class="w-2 h-2 rounded-full bg-emerald-300" aria-hidden="true"></span>SpaceTwin
      </span>
      ${usuario && usuario.rol === 'admin' && pagina !== 'admin.html' ? '<a href="admin.html" class="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-white text-lasalle-vibrant text-xs font-extrabold shadow-sm hover:bg-lasalle-ice">Panel admin</a>' : ''}
      <div class="relative" id="st-bell-wrap">
        <button type="button" id="st-bell" aria-label="Notificaciones" aria-haspopup="true" aria-expanded="false" class="relative w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 flex items-center justify-center text-white">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span id="st-bell-count" class="hidden absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-extrabold flex items-center justify-center border-2 border-white"></span>
        </button>
        <div id="st-bell-panel" class="hidden absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] bg-white text-slate-700 rounded-2xl shadow-xl border border-blue-100 z-50 overflow-hidden"></div>
      </div>`;
    if (logo && logo.parentElement === nav) {
      const der = document.createElement('div');
      der.className = 'flex items-center gap-3 sm:gap-4';
      nav.insertBefore(der, logo);
      der.appendChild(grupo);
      der.appendChild(logo);
      // En móvil el texto del logo se oculta para dar espacio
      const txt = logo.querySelector('.text-right');
      if (txt) txt.classList.add('hidden', 'sm:flex');
    } else {
      nav.appendChild(grupo);
    }
    pintarCampana();
    const bell = grupo.querySelector('#st-bell');
    const panel = grupo.querySelector('#st-bell-panel');
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!usuario) { pedirSesion({ titulo: 'Tus notificaciones', mensaje: 'Inicia sesión para ver el estado de tus solicitudes.', onSuccess: () => location.reload() }); return; }
      const abierto = panel.classList.toggle('hidden') === false;
      bell.setAttribute('aria-expanded', String(abierto));
      if (abierto) { pintarPanelNotificaciones(panel); S.marcarLeidas(); pintarCampana(); }
    });
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { panel.classList.add('hidden'); bell.setAttribute('aria-expanded', 'false'); });
  }

  function pintarCampana() {
    const c = document.getElementById('st-bell-count');
    if (!c) return;
    const n = S.notificaciones().filter((x) => !x.leida).length;
    c.textContent = n > 9 ? '9+' : n;
    c.classList.toggle('hidden', n === 0);
    c.classList.toggle('flex', n > 0);
    const b = document.getElementById('st-bell');
    if (b) b.setAttribute('aria-label', n ? `Notificaciones: ${n} sin leer` : 'Notificaciones');
  }

  function hace(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
  }

  function pintarPanelNotificaciones(panel) {
    const lista = S.notificaciones().slice(0, 12);
    panel.innerHTML = `
      <div class="px-4 py-3 border-b border-blue-50 flex items-center justify-between">
        <p class="font-display font-extrabold text-sm text-lasalle-blueDark">Notificaciones</p>
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">In-app + correo</span>
      </div>
      <ul class="max-h-80 overflow-y-auto st-scroll divide-y divide-slate-100">
        ${lista.length ? lista.map((n) => `
          <li><a href="${n.reservaId ? 'reserva.html?id=' + encodeURIComponent(n.reservaId) : '#'}" class="block px-4 py-3 hover:bg-lasalle-ice/60 ${n.leida ? '' : 'bg-lasalle-ice/40'}">
            <p class="text-xs text-slate-800 leading-snug">${esc(n.texto)}</p>
            <p class="text-[10px] text-slate-400 mt-1">${hace(n.fecha)}</p>
          </a></li>`).join('') : '<li class="px-4 py-6 text-center text-xs text-slate-500">No tienes notificaciones.</li>'}
      </ul>
      <p class="px-4 py-2.5 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">📧 En producción, cada cambio de estado también se enviaría a tu <strong>correo institucional</strong> ${esc(usuario.correo)}.</p>`;
  }

  /* =========================================================
     5b. INICIO DE SESIÓN (componente reutilizable)
     - Con GOOGLE_CLIENT_ID: solo el botón oficial "Continuar con Google".
     - Sin Client ID (modo demo): un único campo de correo institucional.
     En ambos casos solo se acepta @ulasalle.edu.pe y el rol se deduce del correo.
     ========================================================= */
  const dominioOK = (email, hd) => {
    const dom = String(email || '').toLowerCase().split('@')[1];
    return dom === CFG.DOMINIO_PERMITIDO && (hd === undefined || hd === CFG.DOMINIO_PERMITIDO);
  };
  const msgDominio = (email) => `La cuenta ${email} no pertenece a la Universidad La Salle. Usa tu correo @${CFG.DOMINIO_PERMITIDO}.`;

  let gisPromesa = null;
  function cargarGIS() {
    if (!gisPromesa) {
      gisPromesa = new Promise((ok, mal) => {
        if (window.google && google.accounts && google.accounts.id) return ok();
        const sc = document.createElement('script');
        sc.src = 'https://accounts.google.com/gsi/client';
        sc.async = true; sc.onload = ok; sc.onerror = mal;
        document.head.appendChild(sc);
      });
    }
    return gisPromesa;
  }

  function completarLogin(u, onSuccess) {
    S.iniciarSesion(u);
    usuario = u;
    toast(`Hola, ${primerNombre(u.nombre)} · sesión iniciada como ${ROLES[u.rol].toLowerCase()}`);
    if (onSuccess) onSuccess(u);
  }

  /** Pinta el formulario de acceso dentro de "cont". */
  function renderLogin(cont, opciones) {
    opciones = opciones || {};
    const uid = 'stl' + Math.random().toString(36).slice(2, 7);
    const conGoogle = !!CFG.GOOGLE_CLIENT_ID;
    cont.innerHTML = `
      <div id="${uid}-google" class="${conGoogle ? '' : 'hidden'} flex justify-center min-h-[44px]"></div>
      <form id="${uid}-form" class="${conGoogle ? 'hidden' : ''} space-y-2" novalidate autocomplete="on">
        <label for="${uid}-email" class="block text-xs font-bold text-slate-700">Correo institucional</label>
        <input id="${uid}-email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false"
          data-lpignore="true" data-1p-ignore data-form-type="other" required aria-describedby="${uid}-err"
          placeholder="nombre@${CFG.DOMINIO_PERMITIDO}"
          class="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-lasalle-vibrant" />
        <p id="${uid}-err" role="alert" class="hidden text-xs font-semibold text-red-600"></p>
        <button type="submit" class="w-full py-3 rounded-xl text-white font-display font-bold text-sm shadow-md hover:opacity-95" style="background:linear-gradient(135deg,#0044FF 0%,#0026B8 100%)">Continuar</button>
        <p class="text-[11px] text-slate-500">Modo demo: no se pide contraseña. En producción el acceso es con Google.</p>
      </form>
      ${conGoogle ? '' : `
      <div class="mt-4 text-center">
        <button type="button" id="${uid}-demo-t" aria-expanded="false" aria-controls="${uid}-demo" class="text-[11px] text-slate-400 hover:text-lasalle-vibrant underline underline-offset-2">Cuentas de prueba</button>
        <ul id="${uid}-demo" class="hidden mt-2 space-y-1 text-left">
          ${(CFG.CUENTAS_DEMO || []).map((c) => { const u = S.usuarioDesdeCorreo(c.correo); return `
            <li><button type="button" data-correo="${esc(c.correo)}" class="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-lasalle-ice text-[11px] text-slate-600">
              <span class="font-mono">${esc(c.correo)}</span><span class="font-semibold text-slate-400">${ROLES[u.rol]}</span></button></li>`; }).join('')}
        </ul>
      </div>`}`;

    const form = cont.querySelector(`#${uid}-form`);
    const input = cont.querySelector(`#${uid}-email`);
    const err = cont.querySelector(`#${uid}-err`);
    const mostrarError = (m) => {
      err.textContent = m; err.classList.remove('hidden');
      input.setAttribute('aria-invalid', 'true');
      input.classList.add('border-red-400', 'ring-1', 'ring-red-300');
    };
    input.addEventListener('input', () => { err.classList.add('hidden'); input.removeAttribute('aria-invalid'); input.classList.remove('border-red-400', 'ring-1', 'ring-red-300'); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { mostrarError('Escribe un correo válido, por ejemplo nombre@' + CFG.DOMINIO_PERMITIDO); input.focus(); return; }
      if (!dominioOK(email)) { mostrarError(msgDominio(email)); input.focus(); return; }
      completarLogin(S.usuarioDesdeCorreo(email), opciones.onSuccess);
    });
    const t = cont.querySelector(`#${uid}-demo-t`);
    if (t) {
      const lista = cont.querySelector(`#${uid}-demo`);
      t.onclick = () => { const ab = lista.classList.toggle('hidden') === false; t.setAttribute('aria-expanded', String(ab)); };
      lista.addEventListener('click', (e) => { const b = e.target.closest('[data-correo]'); if (b) { input.value = b.dataset.correo; input.dispatchEvent(new Event('input')); input.focus(); } });
    }

    if (conGoogle) {
      cargarGIS().then(() => {
        google.accounts.id.initialize({
          client_id: CFG.GOOGLE_CLIENT_ID,
          hd: CFG.DOMINIO_PERMITIDO,   // Google muestra solo cuentas del dominio institucional
          ux_mode: 'popup',
          callback: (resp) => {
            // Se decodifica el ID token SOLO para la interfaz del prototipo.
            // ⚠️ EN PRODUCCIÓN el token se envía al backend (POST /auth/google), que verifica
            // la firma con las claves públicas de Google, el "aud", el "hd" y el dominio del email,
            // y recién entonces crea la sesión y obtiene el rol desde la base de datos.
            const b64 = resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const p = JSON.parse(decodeURIComponent(escape(atob(b64))));
            if (!p.email_verified || !dominioOK(p.email, p.hd)) { mostrarError(msgDominio(p.email)); form.classList.remove('hidden'); input.classList.add('hidden'); form.querySelector('button[type=submit]').classList.add('hidden'); return; }
            completarLogin(S.usuarioDesdeCorreo(p.email, p.name, p.picture), opciones.onSuccess);
          },
        });
        google.accounts.id.renderButton(cont.querySelector(`#${uid}-google`), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: 300 });
      }).catch(() => {
        // Si Google no carga (sin red), se habilita el campo de correo para que la demo no se rompa
        cont.querySelector(`#${uid}-google`).classList.add('hidden');
        form.classList.remove('hidden');
      });
    } else if (opciones.autofocus !== false) {
      setTimeout(() => input.focus(), 60);
    }
  }

  /** Abre el modal de inicio de sesión sin sacar al usuario de la página. */
  function pedirSesion(opciones) {
    opciones = opciones || {};
    const m = modal(opciones.titulo || 'Iniciar sesión', `
      <p class="text-sm text-slate-600 mb-5">${esc(opciones.mensaje || 'Usa tu cuenta institucional de la Universidad La Salle.')}</p>
      <div data-login></div>`, { ancho: 'max-w-md' });
    renderLogin(m.el.querySelector('[data-login]'), {
      onSuccess: (u) => { m.cerrar(); if (opciones.onSuccess) opciones.onSuccess(u); },
    });
    return m;
  }

  /** Pantalla de acceso para páginas protegidas (no se puede cerrar). */
  function montarBloqueo() {
    if (!bloqueo) return;
    const capa = document.createElement('div');
    capa.id = 'st-bloqueo';
    capa.className = 'fixed inset-x-0 bottom-0 top-20 z-[45] bg-slate-50 overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-8';
    const titulos = {
      'myreservas.html': ['Mis reservas', 'Inicia sesión para ver y gestionar tus solicitudes.'],
      'user.html': ['Mi perfil', 'Inicia sesión para ver tu perfil y tu historial.'],
      'reserva.html': ['Detalle de reserva', 'Inicia sesión para ver el estado de la solicitud y su código QR.'],
      'admin.html': ['Panel de administración', 'Inicia sesión con una cuenta de administrador.'],
    };
    const [t, sub] = titulos[pagina] || ['Acceso', 'Inicia sesión para continuar.'];
    if (bloqueo === 'admin') {
      capa.innerHTML = `
        <div role="alert" class="st-pop w-full max-w-md bg-white rounded-3xl shadow-xl border border-blue-100 p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center text-3xl" aria-hidden="true">🔒</div>
          <h1 class="font-display text-2xl font-extrabold text-lasalle-blueDark mt-5">Acceso restringido</h1>
          <p class="text-sm text-slate-600 mt-2">El panel de administración es solo para la Oficina de Infraestructura. Tu cuenta (${esc(usuario.correo)}) es de ${esc(ROLES[usuario.rol].toLowerCase())}.</p>
          <div class="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <a href="index.html" class="px-5 py-3 rounded-xl text-white font-display font-bold text-sm" style="background:linear-gradient(135deg,#0044FF 0%,#0026B8 100%)">Volver al inicio</a>
            <button type="button" id="st-cambiar" class="px-5 py-3 rounded-xl bg-white border-2 border-blue-200 text-lasalle-blueDark font-display font-bold text-sm">Cambiar de cuenta</button>
          </div>
        </div>`;
      capa.querySelector('#st-cambiar').onclick = () => { S.cerrarSesion(); location.reload(); };
    } else {
      capa.innerHTML = `
        <div class="st-pop w-full max-w-md bg-white rounded-3xl shadow-xl border border-blue-100 p-7 sm:p-8">
          <span class="text-[11px] font-extrabold uppercase tracking-widest text-lasalle-vibrant">${esc(t)}</span>
          <h1 class="font-display text-2xl font-extrabold text-lasalle-blueDark mt-1">Inicia sesión</h1>
          <p class="text-sm text-slate-600 mt-1 mb-6">${esc(sub)}</p>
          <div data-login></div>
          <a href="index.html" class="block text-center mt-6 text-xs font-semibold text-slate-500 hover:text-lasalle-vibrant">← Seguir explorando los espacios</a>
        </div>`;
      renderLogin(capa.querySelector('[data-login]'), { onSuccess: () => location.reload() });
    }
    document.body.appendChild(capa);
    document.querySelectorAll('body > main, body > footer').forEach((el) => el.setAttribute('aria-hidden', 'true'));
  }

  /* ---------------------------------------------------------
     6. Pie de página (solo en páginas sin visor 3D a pantalla completa)
     --------------------------------------------------------- */
  function montarFooter() {
    if (pagina === 'login.html' || document.querySelector('canvas, #canvas-container') || document.querySelector('footer')) return;
    const f = document.createElement('footer');
    f.className = 'mt-auto border-t border-blue-100 bg-white/70';
    f.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <p><strong class="text-lasalle-blueDark">SpaceTwin</strong> · Reserva inteligente de espacios · Universidad La Salle Arequipa</p>
        <div class="flex items-center gap-4">
          <button type="button" class="hover:text-lasalle-vibrant underline-offset-2 hover:underline" data-st="politicas">Políticas de reserva</button>
          <a href="admin.html" class="hover:text-lasalle-vibrant underline-offset-2 hover:underline">Administración</a>
          <button type="button" class="hover:text-lasalle-vibrant underline-offset-2 hover:underline" data-st="reset">Reiniciar demo</button>
        </div>
      </div>`;
    f.querySelector('[data-st="politicas"]').onclick = () => mostrarPoliticas();
    f.querySelector('[data-st="reset"]').onclick = reiniciarDemo;
    document.body.appendChild(f);
  }

  /* =========================================================
     7. ASISTENTE DE RESERVA (voz + chat guiado)
     ========================================================= */
  const DIAS_SEMANA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const MESES_IDX = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
  const NUM_PALABRAS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

  const normalizar = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g, (m) => NUM_PALABRAS[m]);

  /** Interpreta frases como "reservar auditorio Ojeda el viernes a las 10 para 50 personas". */
  function interpretar(texto) {
    let t = normalizar(texto);
    const r = {};

    // Espacio
    if (/ojeda|ludolfo|auditorio 1\b|auditorio uno|primer auditorio/.test(t)) r.espacioId = 'ojeda';
    else if (/benito|campos|auditorio 2\b|segundo auditorio|polivalente/.test(t)) r.espacioId = 'benito';
    else if (/area verde|pasto|jardin|cancha|aire libre|exterior/.test(t)) r.espacioId = 'verde';

    // Aforo
    const af = t.match(/(?:para|de|unas?|aprox\w*)\s*(\d{1,3})\s*(?:personas|asistentes|invitados|alumnos|estudiantes|gente)/);
    if (af) { r.aforo = Number(af[1]); t = t.replace(af[0], ' '); }

    // Fecha
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (/pasado manana/.test(t)) r.fecha = U.fechaISO(U.sumarDias(hoy, 2));
    else if (/\bmanana\b/.test(t) && !/de la manana|en la manana|por la manana/.test(t)) r.fecha = U.fechaISO(U.sumarDias(hoy, 1));
    else if (/\bhoy\b/.test(t)) r.fecha = U.fechaISO(hoy);
    const fm = t.match(/(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/);
    const fs = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (fm) {
      let d = new Date(hoy.getFullYear(), MESES_IDX[fm[2]], Number(fm[1]));
      if (d < hoy) d = new Date(hoy.getFullYear() + 1, MESES_IDX[fm[2]], Number(fm[1]));
      r.fecha = U.fechaISO(d); t = t.replace(fm[0], ' ');
    } else if (fs) {
      let d = new Date(fs[3] ? Number(fs[3].length === 2 ? '20' + fs[3] : fs[3]) : hoy.getFullYear(), Number(fs[2]) - 1, Number(fs[1]));
      if (d < hoy && !fs[3]) d.setFullYear(d.getFullYear() + 1);
      r.fecha = U.fechaISO(d); t = t.replace(fs[0], ' ');
    } else {
      const ds = t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
      if (ds) {
        let delta = (DIAS_SEMANA[ds[1]] - hoy.getDay() + 7) % 7;
        if (delta === 0 || /proximo|siguiente|que viene/.test(t)) delta = delta === 0 ? 7 : delta + (/(semana que viene|proxima semana)/.test(t) ? 7 : 0);
        r.fecha = U.fechaISO(U.sumarDias(hoy, delta));
      }
    }

    // Horas
    const tarde = /(de la tarde|de la noche|\bpm\b|p\.m\.)/.test(t);
    const ajusta = (h) => (tarde && h < 12 ? h + 12 : (h >= 1 && h <= 6 ? h + 12 : h));
    const rango = t.match(/(?:de|desde)\s*(?:las\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta)\s*(?:las\s*)?(\d{1,2})(?::(\d{2}))?/);
    if (rango) {
      r.inicio = ajusta(Number(rango[1])); r.fin = ajusta(Number(rango[3]));
      if (r.fin <= r.inicio) r.fin += 12;
    } else {
      const una = t.match(/(?:a las|a la|desde las|las)\s*(\d{1,2})(?::(\d{2}))?|\b(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|hrs|horas\b(?!\s*de))/);
      if (una) r.inicio = ajusta(Number(una[1] || una[3]));
      const dur = t.match(/(?:por|durante)\s*(\d{1,2})\s*horas?/);
      if (r.inicio != null) r.fin = r.inicio + (dur ? Number(dur[1]) : 2);
    }
    if (r.inicio != null) {
      r.inicio = Math.max(CFG.HORA_APERTURA, Math.min(CFG.HORA_CIERRE - 1, r.inicio));
      r.fin = Math.max(r.inicio + 1, Math.min(CFG.HORA_CIERRE, r.fin));
    }

    // Tipo de actividad
    const tipos = [
      [/conferencia|ponencia|clase|charla|seminario|sustentacion/, 'Académico (clase, conferencia, ponencia)'],
      [/taller|capacitacion|curso|workshop/, 'Taller / Capacitación'],
      [/feria|expo|exposicion|stands?/, 'Feria / Exposición'],
      [/concierto|teatro|danza|cultural|musica/, 'Cultural / Artístico'],
      [/reunion|institucional|administrativ|ceremonia/, 'Institucional / Administrativo'],
      [/integracion|fiesta|bienvenida|estudiantil/, 'Estudiantil / Integración'],
      [/deport|campeonato|torneo/, 'Deportivo / Recreativo'],
    ];
    const tp = tipos.find(([re]) => re.test(t));
    if (tp) r.tipoActividad = tp[1];

    // Intenciones
    if (/mis reservas|ver reservas|mis solicitudes/.test(t)) r.intencion = 'mis';
    else if (/politica|regla|norma|anticipacion|cancelar/.test(t) && !r.espacioId) r.intencion = 'politicas';
    else if (/sugier|recomiend|que espacio|cual espacio|conviene/.test(t)) r.intencion = 'sugerir';
    return r;
  }

  function montarAsistente() {
    if (pagina === 'login.html' || bloqueo) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'st-asistente-btn';
    fab.setAttribute('aria-label', 'Abrir asistente de reserva por voz o texto');
    fab.setAttribute('aria-expanded', 'false');
    fab.className = 'fixed bottom-5 left-5 z-[60] h-14 pl-4 pr-5 rounded-full text-white shadow-2xl border-2 border-white flex items-center gap-2 font-display font-bold text-sm hover:scale-105 transition-transform';
    fab.style.background = 'linear-gradient(135deg,#0044FF 0%,#0026B8 100%)';
    fab.innerHTML = '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.5a6.5 6.5 0 006.5-6.5M12 18.5A6.5 6.5 0 015.5 12M12 18.5V22m-3 0h6M12 15a3 3 0 003-3V5a3 3 0 10-6 0v7a3 3 0 003 3z"/></svg><span class="hidden sm:inline">Reservar por voz</span>';
    // En páginas con visor 3D: botón compacto y elevado para no tapar la leyenda
    if (document.querySelector('canvas, #canvas-container')) {
      fab.classList.remove('bottom-5', 'pl-4', 'pr-5');
      fab.classList.add('bottom-24', 'w-14', 'justify-center');
      const lbl = fab.querySelector('span'); if (lbl) lbl.remove();
    }
    document.body.appendChild(fab);

    const panel = document.createElement('section');
    panel.id = 'st-asistente';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Asistente de reserva SpaceTwin');
    panel.className = 'hidden fixed z-[65] bottom-24 left-3 right-3 sm:right-auto sm:left-5 sm:w-[380px] h-[min(540px,calc(100vh-8rem))] bg-white rounded-3xl shadow-2xl border border-blue-100 flex-col overflow-hidden st-pop';
    panel.innerHTML = `
      <header class="px-5 py-4 text-white flex items-center justify-between flex-shrink-0" style="background:linear-gradient(135deg,#0044FF 0%,#0026B8 100%)">
        <div>
          <p class="text-[10px] uppercase tracking-widest font-bold text-blue-100">Asistente accesible</p>
          <h2 class="font-display font-extrabold text-base">Lucía · SpaceTwin</h2>
        </div>
        <button type="button" id="st-as-cerrar" aria-label="Cerrar asistente" class="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25">✕</button>
      </header>
      <div id="st-as-log" class="flex-grow overflow-y-auto st-scroll p-4 space-y-3 bg-slate-50" aria-live="polite" aria-relevant="additions"></div>
      <div id="st-as-chips" class="px-3 pt-2 flex flex-wrap gap-1.5 bg-white"></div>
      <form id="st-as-form" class="p-3 flex items-center gap-2 bg-white border-t border-slate-100 flex-shrink-0">
        <label for="st-as-input" class="st-sr">Escribe tu solicitud</label>
        <input id="st-as-input" autocomplete="off" class="flex-grow min-w-0 px-3.5 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-lasalle-vibrant" placeholder='Ej. "Auditorio Ojeda el viernes a las 10"' />
        <button type="button" id="st-as-mic" class="w-12 h-12 rounded-xl bg-lasalle-ice text-lasalle-vibrant flex items-center justify-center flex-shrink-0 ${SR ? '' : 'opacity-40 cursor-not-allowed'}" aria-label="${SR ? 'Hablar: dictar la solicitud por voz' : 'Reconocimiento de voz no disponible en este navegador'}" ${SR ? '' : 'disabled'}>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15a3 3 0 003-3V5a3 3 0 10-6 0v7a3 3 0 003 3zm6.5-3a6.5 6.5 0 01-13 0M12 18.5V22"/></svg>
        </button>
        <button type="submit" class="w-12 h-12 rounded-xl text-white flex items-center justify-center flex-shrink-0" style="background:#0044FF" aria-label="Enviar mensaje">➤</button>
      </form>`;
    document.body.appendChild(panel);

    const log = panel.querySelector('#st-as-log');
    const chips = panel.querySelector('#st-as-chips');
    const input = panel.querySelector('#st-as-input');
    const mic = panel.querySelector('#st-as-mic');
    let hablar = false; // leer respuestas en voz alta si el usuario usó la voz
    const estado = {};

    const abrir = () => {
      panel.classList.remove('hidden'); panel.classList.add('flex');
      fab.setAttribute('aria-expanded', 'true');
      if (!log.children.length) saludo();
      setTimeout(() => input.focus(), 50);
    };
    const cerrar = () => { panel.classList.add('hidden'); panel.classList.remove('flex'); fab.setAttribute('aria-expanded', 'false'); fab.focus(); if (window.speechSynthesis) speechSynthesis.cancel(); };
    fab.onclick = () => (panel.classList.contains('hidden') ? abrir() : cerrar());
    panel.querySelector('#st-as-cerrar').onclick = cerrar;
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

    function burbuja(texto, quien) {
      const d = document.createElement('div');
      d.className = quien === 'yo'
        ? 'ml-auto max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm text-white st-pop'
        : 'mr-auto max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm bg-white border border-blue-100 text-slate-800 shadow-sm st-pop';
      if (quien === 'yo') d.style.background = '#0044FF';
      d.innerHTML = texto;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      if (quien !== 'yo' && hablar && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(d.textContent);
        u.lang = 'es-PE'; speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
    }
    function opciones(lista) {
      chips.innerHTML = '';
      lista.forEach(([txt, fn]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'px-3 py-1.5 mb-1 rounded-full bg-lasalle-ice hover:bg-lasalle-sky text-lasalle-vibrant text-xs font-bold border border-lasalle-sky';
        b.textContent = txt;
        b.onclick = () => { burbuja(esc(txt), 'yo'); fn(); };
        chips.appendChild(b);
      });
    }

    function saludo() {
      burbuja(`¡Hola${usuario ? ', ' + esc(primerNombre(usuario.nombre)) : ''}! Soy Lucía. Puedo ayudarte a reservar diciendo, por ejemplo: <em>"reservar auditorio Ojeda el viernes a las 10 para 50 personas"</em>.${SR ? ' Pulsa el micrófono 🎤 para hablar.' : ' Tu navegador no admite voz, pero puedes escribir o usar los botones.'}`);
      menuPrincipal();
    }
    function menuPrincipal() {
      opciones([
        ['Reservar un espacio', () => preguntarEspacio()],
        ['¿Qué espacio me conviene?', () => preguntarSugerencia()],
        ['Ver mis reservas', () => { burbuja('Te llevo a tus reservas…'); location.href = 'myreservas.html'; }],
        ['Políticas', () => { burbuja(htmlPoliticas()); menuPrincipal(); }],
      ]);
    }
    function preguntarEspacio() {
      burbuja('¿Qué espacio quieres reservar?');
      opciones(S.espacios().map((e) => [`${e.corto} (${e.capacidad})`, () => { estado.espacioId = e.id; continuar(); }]));
    }
    function preguntarSugerencia() {
      burbuja('¿Para cuántas personas es tu evento? Escribe el número o elige una opción.');
      estado.esperando = 'aforo-sugerencia';
      opciones([['30 personas', () => sugerir(30)], ['80 personas', () => sugerir(80)], ['150 personas', () => sugerir(150)]]);
    }
    function sugerir(aforo, tipo) {
      estado.esperando = null;
      const s = S.sugerirEspacio(aforo, tipo || estado.tipoActividad);
      const top = s[0];
      if (!top.apto) { burbuja(`Ningún espacio admite ${aforo} personas. El de mayor capacidad es el Área Verde (180).`); menuPrincipal(); return; }
      estado.espacioId = top.espacio.id; estado.aforo = aforo;
      burbuja(`Te recomiendo <strong>${esc(top.espacio.nombre)}</strong>: ${esc(top.razones.join(', '))}.`);
      opciones([['Sí, reservar ahí', () => continuar()], ['Elegir otro', () => preguntarEspacio()]]);
    }
    function continuar() {
      if (!estado.espacioId) return preguntarEspacio();
      const e = S.espacio(estado.espacioId);
      if (!estado.fecha) {
        const min = S.ventanaReserva(e.id).min;
        burbuja(`Perfecto, <strong>${esc(e.corto)}</strong>. ¿Para qué día? Recuerda que este espacio requiere ${S.reglasDe(e.id).anticipacionMinHoras} h de anticipación.`);
        const sug = []; let d = new Date(min); d.setHours(0, 0, 0, 0); if (d < min) d = U.sumarDias(d, 1);
        while (sug.length < 3) { if (d.getDay() !== 0) sug.push(new Date(d)); d = U.sumarDias(d, 1); }
        estado.esperando = 'fecha';
        opciones(sug.map((x) => [U.fechaLarga(U.fechaISO(x)).replace(/, \d{4}$/, ''), () => { estado.fecha = U.fechaISO(x); continuar(); }]));
        return;
      }
      if (estado.inicio == null) {
        const oc = S.ocupacionDia(e.id, estado.fecha);
        const libres = oc.bloques.filter((b) => b.estado === 'libre');
        if (!libres.length) { burbuja(`El ${esc(U.fechaLarga(estado.fecha))} ya está completamente ocupado. Elige otro día.`); estado.fecha = null; return continuar(); }
        burbuja(`El ${esc(U.fechaLarga(estado.fecha))} hay ${libres.length} bloques libres. ¿A qué hora empieza tu evento? (duración por defecto: 2 h)`);
        estado.esperando = 'hora';
        opciones(libres.slice(0, 6).map((b) => [b.inicio, () => { estado.inicio = b.hora; estado.fin = Math.min(CFG.HORA_CIERRE, b.hora + 2); continuar(); }]));
        return;
      }
      aplicar();
    }
    function aplicar() {
      estado.esperando = null;
      const e = S.espacio(estado.espacioId);
      const ini = U.numAHora(estado.inicio), fin = U.numAHora(estado.fin);
      const choque = S.haySolapamiento(e.id, estado.fecha, ini, fin);
      burbuja(`Listo: <strong>${esc(e.corto)}</strong>, ${esc(U.fechaLarga(estado.fecha))}, de <strong>${ini} a ${fin}</strong>${estado.aforo ? `, ${estado.aforo} personas` : ''}.${choque ? ' ⚠️ Ojo: esa franja se cruza con otra reserva; podrás ajustarla en la grilla.' : ''} Estoy llenando el formulario por ti.`);
      const datos = { fecha: estado.fecha, inicio: ini, fin, aforo: estado.aforo, tipo: estado.tipoActividad };
      if (window.STBooking && window.STBooking.espacioId === e.id) {
        window.STBooking.prefill(datos);
        burbuja('Revisa los datos, completa el nombre del evento y pulsa <strong>Reservar</strong>.');
        opciones([['Nueva consulta', () => { reiniciarEstado(); menuPrincipal(); }]]);
      } else {
        const q = new URLSearchParams(Object.entries(datos).filter(([, v]) => v != null && v !== ''));
        q.set('asistente', '1');
        setTimeout(() => { location.href = `${e.pagina}?${q}`; }, 900);
      }
    }
    function reiniciarEstado() { Object.keys(estado).forEach((k) => delete estado[k]); }

    function procesar(texto) {
      burbuja(esc(texto), 'yo');
      const n = normalizar(texto);
      if (estado.esperando === 'aforo-sugerencia' && /\d+/.test(n)) return sugerir(Number(n.match(/\d+/)[0]));
      const r = interpretar(texto);
      if (r.intencion === 'mis') { burbuja('Te llevo a tus reservas…'); location.href = 'myreservas.html'; return; }
      if (r.intencion === 'politicas') { burbuja(htmlPoliticas()); return menuPrincipal(); }
      if (r.intencion === 'sugerir' && !r.espacioId) { if (r.aforo) return sugerir(r.aforo, r.tipoActividad); return preguntarSugerencia(); }
      if (estado.esperando === 'hora' && r.inicio == null && /\d{1,2}/.test(n)) { const h = Number(n.match(/\d{1,2}/)[0]); r.inicio = h < 7 ? h + 12 : h; r.fin = r.inicio + 2; }
      ['espacioId', 'fecha', 'inicio', 'fin', 'aforo', 'tipoActividad'].forEach((k) => { if (r[k] != null) estado[k] = r[k]; });
      if (!estado.espacioId && !r.fecha && r.inicio == null) {
        burbuja('No entendí del todo 🤔. Prueba con: <em>"auditorio Benito el jueves de 9 a 12"</em> o usa los botones.');
        return menuPrincipal();
      }
      continuar();
    }

    panel.querySelector('#st-as-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      input.value = ''; hablar = false; procesar(v);
    });

    if (SR) {
      const rec = new SR();
      rec.lang = 'es-PE'; rec.interimResults = false; rec.maxAlternatives = 1;
      let escuchando = false;
      mic.onclick = () => {
        if (escuchando) { rec.stop(); return; }
        try { rec.start(); } catch (e) { return; }
      };
      rec.onstart = () => { escuchando = true; mic.classList.add('st-listening'); mic.setAttribute('aria-label', 'Escuchando… pulsa para detener'); };
      rec.onend = () => { escuchando = false; mic.classList.remove('st-listening'); mic.setAttribute('aria-label', 'Hablar: dictar la solicitud por voz'); };
      rec.onerror = (e) => { burbuja(e.error === 'not-allowed' ? 'No tengo permiso para usar el micrófono. Puedes escribir tu solicitud.' : 'No pude escucharte bien, ¿lo intentamos de nuevo?'); };
      rec.onresult = (e) => { hablar = true; procesar(e.results[0][0].transcript); };
    }

    // Si llegamos desde el asistente, abrirlo con el resumen
    if (new URLSearchParams(location.search).get('asistente') === '1') {
      setTimeout(() => { abrir(); burbuja('Ya llené la fecha y el horario. Completa el nombre del evento y los requerimientos, luego pulsa <strong>Reservar</strong>.'); }, 400);
    }
  }

  /* ---------------------------------------------------------
     8. Arranque
     --------------------------------------------------------- */
  function iniciar() {
    reemplazarNombreFijo();
    montarMenuUsuario();
    montarAccionesHeader();
    montarFooter();
    montarBloqueo();
    montarAsistente();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.ST = { toast, modal, mostrarPoliticas, htmlPoliticas, esc, primerNombre, interpretar, pintarCampana, reiniciarDemo, ROLES, renderLogin, pedirSesion };
})();
