/* =============================================================
   SpaceTwin · Store (base de datos simulada en localStorage)
   -------------------------------------------------------------
   En producción, cada función de este módulo corresponde a un
   endpoint de la API (GET/POST/PATCH /reservas, /espacios, ...).
   Aquí todo se guarda en el navegador para que el prototipo
   funcione en GitHub Pages sin backend.
   ============================================================= */
(function () {
  'use strict';

  const CFG = window.ST_CONFIG;
  const KEY = 'spacetwin_db_v1';
  const KEY_SESION = 'spacetwin_sesion_v1';

  /* ---------------------------------------------------------
     Catálogo de espacios
     --------------------------------------------------------- */
  const ESPACIOS = [
    {
      id: 'ojeda',
      nombre: 'Auditorio Hno. Ludolfo Ojeda y Ojeda',
      corto: 'Auditorio Ojeda',
      tipo: 'auditorio',
      capacidad: 70,
      pagina: 'auditorio.html',
      imagen: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80',
      ideal: ['Académico (clase, conferencia, ponencia)', 'Taller / Capacitación', 'Institucional / Administrativo'],
      equipamiento: ['Proyector HD', 'Sonido', 'Micrófonos inalámbricos', 'Pizarra interactiva', 'Mesa de ponentes', 'Streaming / transmisión', 'Laptop de apoyo'],
      color: '#0044FF',
    },
    {
      id: 'benito',
      nombre: 'Auditorio Hno. Benito Campos del Río',
      corto: 'Auditorio Benito',
      tipo: 'auditorio',
      capacidad: 100,
      pagina: 'auditroio2.html',
      imagen: 'sources/auditorio2.JPG',
      ideal: ['Académico (clase, conferencia, ponencia)', 'Institucional / Administrativo', 'Cultural / Artístico', 'Taller / Capacitación'],
      equipamiento: ['Proyector HD', 'Sonido', 'Micrófonos inalámbricos', 'Streaming / transmisión', 'Mesas de taller', 'Wi-Fi alta densidad', 'Luces de escenario'],
      color: '#7C3AED',
    },
    {
      id: 'verde',
      nombre: 'Área Verde de la Universidad',
      corto: 'Área Verde',
      tipo: 'exterior',
      capacidad: 180,
      pagina: 'pasto.html',
      imagen: 'sources/cancha.JPG',
      ideal: ['Feria / Exposición', 'Estudiantil / Integración', 'Cultural / Artístico', 'Deportivo / Recreativo'],
      equipamiento: ['Sonido', 'Micrófonos inalámbricos', 'Toldos', 'Mesas', 'Sillas adicionales', 'Puntos eléctricos', 'Escenario', 'Streaming / transmisión'],
      color: '#10B981',
    },
  ];

  /* ---------------------------------------------------------
     Usuarios: el rol se deduce del correo (config.js)
     --------------------------------------------------------- */
  function rolDesdeCorreo(correo) {
    const c = String(correo || '').toLowerCase();
    if ((CFG.ADMIN_EMAILS || []).includes(c)) return 'admin';
    if ((CFG.DOCENTE_EMAILS || []).includes(c)) return 'docente';
    if (CFG.DOCENTE_PATRON && new RegExp(CFG.DOCENTE_PATRON).test(c.split('@')[0])) return 'docente';
    return 'estudiante';
  }

  /** Construye el usuario de sesión a partir del correo (y del nombre del token de Google, si hay). */
  function usuarioDesdeCorreo(correo, nombreToken, foto) {
    const c = String(correo || '').trim().toLowerCase();
    const demo = (CFG.CUENTAS_DEMO || []).find((x) => x.correo === c);
    const derivado = c.split('@')[0].replace(/^(doc|prof|d)\./, '').split(/[._-]+/)
      .map((p) => p.replace(/\d+/g, '')).filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Usuario';
    return {
      nombre: nombreToken || (demo && demo.nombre) || derivado,
      correo: c,
      rol: rolDesdeCorreo(c),
      area: (demo && demo.area) || '',
      foto: foto || '',
    };
  }

  // Atajos usados en la semilla y las pruebas (estudiante / docente / admin)
  const USUARIOS_DEMO = {};
  (CFG.CUENTAS_DEMO || []).forEach((x) => { const u = usuarioDesdeCorreo(x.correo); USUARIOS_DEMO[u.rol] = u; });

  /* ---------------------------------------------------------
     Utilidades de fecha (siempre en hora local, formato ISO corto)
     --------------------------------------------------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const fechaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseFecha = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const horaANum = (h) => { const [a, b] = String(h).split(':').map(Number); return a + (b || 0) / 60; };
  const numAHora = (n) => `${pad(Math.floor(n))}:${pad(Math.round((n % 1) * 60))}`;
  const inicioDe = (fecha, hora) => { const d = parseFecha(fecha); d.setHours(Math.floor(horaANum(hora)), Math.round((horaANum(hora) % 1) * 60)); return d; };
  const horasHasta = (d) => (d.getTime() - Date.now()) / 36e5;

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fechaLarga = (s) => { const d = parseFecha(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`; };
  const fechaCorta = (s) => { const d = parseFecha(s); return `${pad(d.getDate())} ${MESES[d.getMonth()].slice(0, 3)}`; };

  const nuevoId = () => 'R' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase();
  const codigoQR = (id) => `ST-${id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  /* ---------------------------------------------------------
     Persistencia
     --------------------------------------------------------- */
  let db = null;

  function leer() {
    if (db) return db; // ya cargada en esta página (evita perder escrituras en curso)
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.reservas)) { db = semilla(); guardar(); }
    return db;
  }
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* modo privado: se mantiene en memoria */ }
  }

  /* ---------------------------------------------------------
     Datos semilla: relativos a "hoy" para que la demo siempre
     muestre ocupación, pendientes y conflictos.
     --------------------------------------------------------- */
  function semilla() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    // Busca el siguiente día hábil a partir de "n" días
    const dia = (n) => { let d = sumarDias(hoy, n); while (d.getDay() === 0) d = sumarDias(d, 1); return fechaISO(d); };
    const hace = (h) => new Date(Date.now() - h * 36e5).toISOString();
    const U = USUARIOS_DEMO;
    const base = (o) => Object.assign({
      id: nuevoId(), equipamiento: [], configuracion: {}, motivo: '', creadaEn: hace(30),
      estado: 'pendiente', historial: [],
    }, o);

    const r = [
      // ---- Auditorio Ojeda ----
      base({ espacioId: 'ojeda', fecha: dia(1), horaInicio: '09:00', horaFin: '12:00', solicitante: U.docente.nombre, correo: U.docente.correo, rol: 'docente', evento: 'Conferencia: IA en la Educación', tipoActividad: 'Académico (clase, conferencia, ponencia)', aforo: 65, equipamiento: ['Proyector HD', 'Sonido', 'Micrófonos inalámbricos'], configuracion: { vip: 10, platinum: 20, general: 40 }, estado: 'aprobada', creadaEn: hace(24 * 6) }),
      base({ espacioId: 'ojeda', fecha: dia(2), horaInicio: '15:00', horaFin: '17:00', solicitante: U.estudiante.nombre, correo: U.estudiante.correo, rol: 'estudiante', evento: 'Taller de Git y GitHub', tipoActividad: 'Taller / Capacitación', aforo: 40, equipamiento: ['Proyector HD', 'Laptop de apoyo'], estado: 'aprobada', creadaEn: hace(24 * 5) }),
      // Día totalmente ocupado (para mostrar "lleno")
      base({ espacioId: 'ojeda', fecha: dia(5), horaInicio: '07:00', horaFin: '12:00', solicitante: 'Oficina de Admisión', correo: 'admision@ulasalle.edu.pe', rol: 'admin', evento: 'Examen de admisión – Inducción', tipoActividad: 'Institucional / Administrativo', aforo: 70, estado: 'aprobada', creadaEn: hace(24 * 9) }),
      base({ espacioId: 'ojeda', fecha: dia(5), horaInicio: '12:00', horaFin: '17:00', solicitante: 'Oficina de Admisión', correo: 'admision@ulasalle.edu.pe', rol: 'admin', evento: 'Examen de admisión – Evaluación', tipoActividad: 'Institucional / Administrativo', aforo: 70, estado: 'aprobada', creadaEn: hace(24 * 9) }),
      base({ espacioId: 'ojeda', fecha: dia(5), horaInicio: '17:00', horaFin: '22:00', solicitante: U.docente.nombre, correo: U.docente.correo, rol: 'docente', evento: 'Seminario de Tesis', tipoActividad: 'Académico (clase, conferencia, ponencia)', aforo: 35, estado: 'pendiente', creadaEn: hace(20) }),
      // Conflicto de pendientes (para demostrar auto-rechazo al aprobar)
      base({ espacioId: 'ojeda', fecha: dia(7), horaInicio: '10:00', horaFin: '12:00', solicitante: 'Centro Federado de Software', correo: 'cf.software@ulasalle.edu.pe', rol: 'estudiante', evento: 'Charla de Ciberseguridad', tipoActividad: 'Estudiantil / Integración', aforo: 60, equipamiento: ['Proyector HD', 'Sonido'], estado: 'pendiente', creadaEn: hace(60) }),
      base({ espacioId: 'ojeda', fecha: dia(7), horaInicio: '11:00', horaFin: '13:00', solicitante: 'Dirección Académica', correo: 'direccion.academica@ulasalle.edu.pe', rol: 'admin', evento: 'Reunión de Coordinadores', tipoActividad: 'Institucional / Administrativo', aforo: 30, equipamiento: ['Proyector HD', 'Streaming / transmisión'], estado: 'pendiente', creadaEn: hace(10) }),

      // ---- Auditorio Benito ----
      base({ espacioId: 'benito', fecha: dia(3), horaInicio: '08:00', horaFin: '13:00', solicitante: 'Facultad de Ingeniería', correo: 'ingenieria@ulasalle.edu.pe', rol: 'admin', evento: 'Hackatón Parmenia – Apertura', tipoActividad: 'Institucional / Administrativo', aforo: 100, equipamiento: ['Proyector HD', 'Sonido', 'Streaming / transmisión', 'Wi-Fi alta densidad'], configuracion: { vip: 20, platinum: 30, general: 50, modoTaller: true }, estado: 'aprobada', creadaEn: hace(24 * 8) }),
      base({ espacioId: 'benito', fecha: dia(4), horaInicio: '16:00', horaFin: '19:00', solicitante: U.estudiante.nombre, correo: U.estudiante.correo, rol: 'estudiante', evento: 'Presentación de Proyectos Finales', tipoActividad: 'Académico (clase, conferencia, ponencia)', aforo: 80, equipamiento: ['Proyector HD', 'Micrófonos inalámbricos'], estado: 'pendiente', creadaEn: hace(52) }),
      base({ espacioId: 'benito', fecha: dia(8), horaInicio: '18:00', horaFin: '21:00', solicitante: 'Elenco de Teatro', correo: 'teatro@ulasalle.edu.pe', rol: 'estudiante', evento: 'Muestra de Teatro', tipoActividad: 'Cultural / Artístico', aforo: 95, equipamiento: ['Luces de escenario', 'Sonido'], estado: 'rechazada', motivoRechazo: 'Cruce con mantenimiento programado del sistema de luces.', creadaEn: hace(24 * 4) }),

      // ---- Área Verde ----
      base({ espacioId: 'verde', fecha: dia(6), horaInicio: '09:00', horaFin: '17:00', solicitante: 'Incubadora LaSalle', correo: 'incubadora@ulasalle.edu.pe', rol: 'docente', evento: 'Expo Emprendimiento 2026', tipoActividad: 'Feria / Exposición', aforo: 150, equipamiento: ['Toldos', 'Mesas', 'Puntos eléctricos', 'Sonido'], configuracion: { modo: 'expo', stands: 20 }, estado: 'aprobada', creadaEn: hace(24 * 10) }),
      base({ espacioId: 'verde', fecha: dia(9), horaInicio: '16:00', horaFin: '20:00', solicitante: U.estudiante.nombre, correo: U.estudiante.correo, rol: 'estudiante', evento: 'Concierto de Integración', tipoActividad: 'Estudiantil / Integración', aforo: 120, equipamiento: ['Escenario', 'Sonido', 'Sillas adicionales'], configuracion: { modo: 'concert', sillas: 120 }, estado: 'pendiente', creadaEn: hace(5) }),
      base({ espacioId: 'verde', fecha: dia(-6), horaInicio: '10:00', horaFin: '14:00', solicitante: U.estudiante.nombre, correo: U.estudiante.correo, rol: 'estudiante', evento: 'Feria de Innovación', tipoActividad: 'Feria / Exposición', aforo: 90, configuracion: { modo: 'expo', stands: 16 }, estado: 'aprobada', creadaEn: hace(24 * 20) }),
    ];
    r.forEach((x) => { x.codigoQR = codigoQR(x.id); x.historial = [{ fecha: x.creadaEn, texto: 'Solicitud registrada' }]; });

    return {
      version: 1,
      reservas: r,
      notificaciones: [
        { id: 'N1', correo: U.estudiante.correo, texto: 'Tu reserva "Taller de Git y GitHub" fue aprobada.', fecha: hace(26), leida: false, reservaId: r[1].id },
        { id: 'N2', correo: U.docente.correo, texto: 'Tu reserva "Conferencia: IA en la Educación" fue aprobada.', fecha: hace(40), leida: false, reservaId: r[0].id },
      ],
    };
  }

  /* ---------------------------------------------------------
     Sesión
     --------------------------------------------------------- */
  /** Usuario actual o null (visitante sin sesión). */
  function usuario() {
    try {
      const u = JSON.parse(localStorage.getItem(KEY_SESION));
      return u && u.correo ? u : null;
    } catch (e) { return null; }
  }
  function iniciarSesion(u) { localStorage.setItem(KEY_SESION, JSON.stringify(u)); return u; }
  function cerrarSesion() { localStorage.removeItem(KEY_SESION); }

  /* ---------------------------------------------------------
     Consultas básicas
     --------------------------------------------------------- */
  const espacios = () => ESPACIOS.slice();
  const espacio = (id) => ESPACIOS.find((e) => e.id === id);
  const reservas = (filtro) => { leer(); return filtro ? db.reservas.filter(filtro) : db.reservas.slice(); };
  const reserva = (id) => reservas().find((r) => r.id === id) || null;
  const misReservas = () => { const u = usuario(); return u ? reservas((r) => r.correo === u.correo) : []; };

  const ACTIVOS = ['pendiente', 'aprobada'];

  /** Reservas activas (pendientes y aprobadas) que se cruzan con el rango dado. */
  function conflictos(espacioId, fecha, inicio, fin, excluirId) {
    const a = horaANum(inicio), b = horaANum(fin);
    return reservas((r) => r.espacioId === espacioId && r.fecha === fecha && r.id !== excluirId &&
      ACTIVOS.includes(r.estado) && horaANum(r.horaInicio) < b && a < horaANum(r.horaFin));
  }
  /** true si el rango se cruza con alguna reserva pendiente o aprobada. */
  function haySolapamiento(espacioId, fecha, inicio, fin, excluirId) {
    return conflictos(espacioId, fecha, inicio, fin, excluirId).length > 0;
  }

  /** Estado hora por hora de un día: libre / pendiente / ocupado. */
  function ocupacionDia(espacioId, fecha) {
    const bloques = [];
    const del = reservas((r) => r.espacioId === espacioId && r.fecha === fecha && ACTIVOS.includes(r.estado));
    for (let h = CFG.HORA_APERTURA; h < CFG.HORA_CIERRE; h++) {
      const r = del.find((x) => horaANum(x.horaInicio) < h + 1 && h < horaANum(x.horaFin));
      bloques.push({ hora: h, inicio: numAHora(h), fin: numAHora(h + 1), estado: r ? (r.estado === 'aprobada' ? 'ocupado' : 'pendiente') : 'libre', reserva: r || null });
    }
    const libres = bloques.filter((b) => b.estado === 'libre').length;
    return { bloques, libres, total: bloques.length, estadoDia: libres === bloques.length ? 'libre' : libres === 0 ? 'lleno' : 'parcial' };
  }

  /* ---------------------------------------------------------
     Reglas de negocio
     --------------------------------------------------------- */
  function reglasDe(espacioId) { return CFG.REGLAS[espacioId] || CFG.REGLAS.ojeda; }

  /** Ventana de fechas reservables para un espacio. */
  function ventanaReserva(espacioId) {
    const min = new Date(Date.now() + reglasDe(espacioId).anticipacionMinHoras * 36e5);
    const max = sumarDias(new Date(), CFG.ANTICIPACION_MAX_DIAS);
    return { min, max };
  }

  /** Devuelve una lista de errores (vacía si todo está OK). */
  function validarReglas(d) {
    const errores = [];
    const esp = espacio(d.espacioId);
    if (!esp) return ['Espacio no válido.'];
    const reg = reglasDe(d.espacioId);
    if (!d.fecha) errores.push('Selecciona una fecha.');
    if (!d.horaInicio || !d.horaFin) errores.push('Selecciona la franja horaria (hora de inicio y fin).');
    if (errores.length) return errores;

    const ini = inicioDe(d.fecha, d.horaInicio);
    const dur = horaANum(d.horaFin) - horaANum(d.horaInicio);
    if (!CFG.DIAS_HABILES.includes(parseFecha(d.fecha).getDay())) errores.push('El campus no atiende reservas los domingos.');
    if (dur <= 0) errores.push('La hora de fin debe ser posterior a la de inicio.');
    if (dur > reg.duracionMaxHoras) errores.push(`La duración máxima para este espacio es de ${reg.duracionMaxHoras} h.`);
    if (horaANum(d.horaInicio) < CFG.HORA_APERTURA || horaANum(d.horaFin) > CFG.HORA_CIERRE) errores.push(`El horario operativo es de ${pad(CFG.HORA_APERTURA)}:00 a ${pad(CFG.HORA_CIERRE)}:00.`);
    if (horasHasta(ini) < reg.anticipacionMinHoras) errores.push(`Se requiere una anticipación mínima de ${reg.anticipacionMinHoras} h para ${esp.corto}.`);
    if (horasHasta(ini) > CFG.ANTICIPACION_MAX_DIAS * 24) errores.push(`Solo se puede reservar con hasta ${CFG.ANTICIPACION_MAX_DIAS} días de anticipación.`);
    if (!d.evento || !String(d.evento).trim()) errores.push('Indica el nombre del evento.');
    if (!d.tipoActividad) errores.push('Selecciona el tipo de actividad.');
    const aforo = Number(d.aforo);
    if (!aforo || aforo < 1) errores.push('Indica el aforo estimado.');
    else if (aforo > esp.capacidad) errores.push(`El aforo (${aforo}) supera la capacidad de ${esp.corto} (${esp.capacidad}).`);
    if (haySolapamiento(d.espacioId, d.fecha, d.horaInicio, d.horaFin)) errores.push('El horario elegido se cruza con otra reserva pendiente o aprobada.');
    return errores;
  }

  /** Prioridad: institucional > docente > estudiante. */
  function prioridad(r) {
    const P = CFG.PRIORIDADES;
    if (r.rol === 'admin' || r.tipoActividad === 'Institucional / Administrativo') return P.institucional;
    if (r.rol === 'docente') return P.docente;
    return P.estudiante;
  }

  /** Una pendiente está "por vencer" si nadie respondió en X horas o el evento está a menos de 48 h. */
  function porVencer(r) {
    if (r.estado !== 'pendiente') return false;
    const sinRespuesta = (Date.now() - new Date(r.creadaEn).getTime()) / 36e5 >= CFG.APROBACION_LIMITE_HORAS;
    const eventoCerca = horasHasta(inicioDe(r.fecha, r.horaInicio)) <= 48;
    return sinRespuesta || eventoCerca;
  }

  /* ---------------------------------------------------------
     Escrituras
     --------------------------------------------------------- */
  function crearReserva(datos) {
    leer();
    const errores = validarReglas(datos);
    if (errores.length) return { ok: false, errores };
    const u = usuario() || {};
    const id = nuevoId();
    const r = Object.assign({
      id,
      solicitante: u.nombre, correo: u.correo, rol: u.rol || 'estudiante',
      equipamiento: [], configuracion: {}, motivo: '',
    }, datos, {
      id, aforo: Number(datos.aforo), estado: 'pendiente', creadaEn: new Date().toISOString(), codigoQR: codigoQR(id),
      historial: [{ fecha: new Date().toISOString(), texto: 'Solicitud registrada' }],
    });
    db.reservas.push(r);
    notificar(r.correo, `Recibimos tu solicitud "${r.evento}" (${espacio(r.espacioId).corto}, ${fechaCorta(r.fecha)} ${r.horaInicio}). Está en revisión.`, r.id);
    notificar('*admin', `📥 Nueva solicitud: "${r.evento}" de ${r.solicitante} (${espacio(r.espacioId).corto}, ${fechaCorta(r.fecha)}).`, r.id);
    guardar();
    return { ok: true, reserva: r };
  }

  /** Solicitud de disponibilidad en vacaciones (fuera del semestre y del plazo normal). */
  function solicitudEspecial(espacioId, fecha, motivo) {
    leer();
    if (!fecha || !motivo) return { ok: false, errores: ['Indica la fecha y un motivo breve.'] };
    if (U_horasHasta(fecha) < 0) return { ok: false, errores: ['La fecha debe ser futura.'] };
    if (haySolapamiento(espacioId, fecha, '08:00', '18:00')) return { ok: false, errores: ['Ya existe una solicitud para ese día.'] };
    const u = usuario() || {};
    const id = nuevoId();
    const r = {
      id, espacioId, fecha, horaInicio: '08:00', horaFin: '18:00', solicitante: u.nombre, correo: u.correo, rol: u.rol || 'estudiante',
      evento: `Evento especial: ${motivo}`, tipoActividad: 'Institucional / Administrativo', aforo: espacio(espacioId).capacidad,
      equipamiento: [], configuracion: {}, motivo: 'Solicitud de disponibilidad en periodo vacacional (fuera de semestre).', especial: true,
      estado: 'pendiente', creadaEn: new Date().toISOString(), codigoQR: codigoQR(id), historial: [{ fecha: new Date().toISOString(), texto: 'Solicitud especial registrada' }],
    };
    db.reservas.push(r);
    notificar('*admin', `📥 Solicitud especial (vacaciones) de ${r.solicitante} para el ${fechaCorta(fecha)}.`, id);
    notificar(r.correo, `Registramos tu solicitud especial para el ${fechaCorta(fecha)} en ${espacio(espacioId).corto}.`, id);
    guardar();
    return { ok: true, reserva: r };
  }
  const U_horasHasta = (fecha) => horasHasta(inicioDe(fecha, '23:59'));

  function cambiarEstado(id, estado, extra) {
    leer();
    const r = db.reservas.find((x) => x.id === id);
    if (!r) return null;
    r.estado = estado;
    Object.assign(r, extra || {});
    r.historial = r.historial || [];
    r.historial.push({ fecha: new Date().toISOString(), texto: textoEstado(estado) + (extra && extra.motivoRechazo ? `: ${extra.motivoRechazo}` : '') });
    guardar();
    return r;
  }

  /** Aprueba y rechaza automáticamente las pendientes que se cruzan. */
  function aprobar(id) {
    const r = reserva(id);
    if (!r) return { ok: false };
    const otros = conflictos(r.espacioId, r.fecha, r.horaInicio, r.horaFin, r.id);
    if (otros.some((o) => o.estado === 'aprobada')) {
      return { ok: false, error: 'Ya existe una reserva aprobada en ese horario.' };
    }
    cambiarEstado(id, 'aprobada', { resueltaEn: new Date().toISOString() });
    notificar(r.correo, `✅ Tu reserva "${r.evento}" fue APROBADA. Ya tienes tu código QR de acceso.`, r.id);
    const rechazadas = otros.filter((o) => o.estado === 'pendiente').map((o) => {
      cambiarEstado(o.id, 'rechazada', { motivoRechazo: `Cruce de horario con "${r.evento}" (aprobada con prioridad).`, resueltaEn: new Date().toISOString() });
      notificar(o.correo, `❌ Tu reserva "${o.evento}" fue rechazada por cruce de horario. Te sugerimos elegir otra franja.`, o.id);
      return o;
    });
    return { ok: true, rechazadas };
  }

  function rechazar(id, motivo) {
    const r = cambiarEstado(id, 'rechazada', { motivoRechazo: motivo || 'Sin motivo especificado', resueltaEn: new Date().toISOString() });
    if (r) notificar(r.correo, `❌ Tu reserva "${r.evento}" fue rechazada. Motivo: ${r.motivoRechazo}`, r.id);
    return r;
  }

  /** Cancela y libera el horario. Si es con menos de X horas, queda como cancelación tardía. */
  function cancelar(id) {
    const r = reserva(id);
    if (!r) return null;
    const tardia = horasHasta(inicioDe(r.fecha, r.horaInicio)) < CFG.CANCELACION_MIN_HORAS;
    cambiarEstado(id, 'cancelada', { cancelacionTardia: tardia, canceladaEn: new Date().toISOString() });
    notificar(r.correo, `Cancelaste "${r.evento}". ${tardia ? 'Quedó registrada como cancelación tardía.' : 'El horario quedó liberado.'}`, r.id);
    return { reserva: reserva(id), tardia };
  }

  /* ---------------------------------------------------------
     Notificaciones in-app (en producción: + correo institucional)
     --------------------------------------------------------- */
  function notificar(correo, texto, reservaId) {
    leer();
    db.notificaciones.unshift({ id: 'N' + Date.now() + Math.random().toString(36).slice(2, 5), correo, texto, fecha: new Date().toISOString(), leida: false, reservaId });
    guardar();
  }
  function notificaciones() {
    const u = usuario(); if (!u) return [];
    leer();
    return db.notificaciones.filter((n) => n.correo === u.correo || (u.rol === 'admin' && n.correo === '*admin'));
  }
  function marcarLeidas() {
    const u = usuario(); if (!u) return;
    leer();
    db.notificaciones.forEach((n) => { if (n.correo === u.correo || (u.rol === 'admin' && n.correo === '*admin')) n.leida = true; });
    guardar();
  }

  /* ---------------------------------------------------------
     Valor agregado: sugerencia de espacio
     --------------------------------------------------------- */
  function sugerirEspacio(aforo, tipoActividad) {
    aforo = Number(aforo) || 0;
    return ESPACIOS
      .map((e) => {
        let puntaje = 0; const razones = [];
        if (aforo > e.capacidad) { puntaje -= 100; razones.push(`capacidad insuficiente (${e.capacidad})`); }
        else {
          const holgura = (e.capacidad - aforo) / e.capacidad;
          puntaje += 40 - Math.round(holgura * 40); // más justo = mejor
          razones.push(`capacidad ${e.capacidad} (ocupación ${Math.round((aforo / e.capacidad) * 100)}%)`);
        }
        if (tipoActividad && e.ideal.includes(tipoActividad)) { puntaje += 30; razones.push('ideal para este tipo de actividad'); }
        return { espacio: e, puntaje, razones, apto: aforo <= e.capacidad };
      })
      .sort((a, b) => b.puntaje - a.puntaje);
  }

  /* ---------------------------------------------------------
     Reportes
     --------------------------------------------------------- */
  function exportarCSV(lista) {
    const cols = ['id', 'espacio', 'fecha', 'horaInicio', 'horaFin', 'evento', 'tipoActividad', 'aforo', 'solicitante', 'correo', 'prioridad', 'estado', 'equipamiento', 'motivoRechazo', 'cancelacionTardia', 'creadaEn'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const filas = (lista || reservas()).map((r) => [
      r.id, espacio(r.espacioId).nombre, r.fecha, r.horaInicio, r.horaFin, r.evento, r.tipoActividad, r.aforo,
      r.solicitante, r.correo, prioridad(r).etiqueta, r.estado, (r.equipamiento || []).join(' | '), r.motivoRechazo || '',
      r.cancelacionTardia ? 'sí' : '', r.creadaEn,
    ].map(esc).join(','));
    return '﻿' + [cols.join(','), ...filas].join('\n');
  }

  function resumenConfig(r) {
    const c = r.configuracion || {};
    if (c.modo === 'expo') return `Feria / Expo con ${c.stands} stands`;
    if (c.modo === 'concert') return `Concierto con ${c.sillas} sillas`;
    const partes = [];
    if (c.vip || c.platinum) partes.push(`${c.vip || 0} VIP · ${c.platinum || 0} Platinum · ${c.general} General`);
    if (c.modoTaller) partes.push('modo taller (mesas)');
    const sel = c.butacasSeleccionadas || c.sillasSeleccionadas;
    if (sel && sel.length) partes.push(`${sel.length} butacas marcadas`);
    return partes.join(' · ') || 'Distribución estándar';
  }

  function textoEstado(e) {
    return { pendiente: 'Pendiente de aprobación', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' }[e] || e;
  }

  function reiniciar() {
    localStorage.removeItem(KEY);
    db = null; leer();
  }

  // Si otra pestaña modifica los datos, se recargan en la próxima lectura
  window.addEventListener('storage', (e) => { if (e.key === KEY) db = null; });

  window.Store = {
    // datos
    espacios, espacio, reservas, reserva, misReservas, usuariosDemo: USUARIOS_DEMO, usuarioDesdeCorreo, rolDesdeCorreo,
    // sesión
    usuario, iniciarSesion, cerrarSesion,
    // disponibilidad y reglas
    haySolapamiento, conflictos, ocupacionDia, validarReglas, ventanaReserva, reglasDe, prioridad, porVencer,
    // escrituras
    crearReserva, solicitudEspecial, aprobar, rechazar, cancelar,
    // notificaciones
    notificar, notificaciones, marcarLeidas,
    // extras
    sugerirEspacio, exportarCSV, resumenConfig, textoEstado, reiniciar,
    // utilidades
    util: { fechaISO, parseFecha, sumarDias, horaANum, numAHora, inicioDe, horasHasta, fechaLarga, fechaCorta, MESES, DIAS, pad },
  };

  leer();
})();
