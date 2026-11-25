/* =============================================================
   SpaceTwin · Configuración global y reglas de negocio
   -------------------------------------------------------------
   Todo lo que el área de administración podría querer ajustar
   vive aquí, para no tocar la lógica.
   ============================================================= */
window.ST_CONFIG = {
  // --- Autenticación ---------------------------------------------------------
  // Client ID de Google Identity Services (OAuth 2.0, tipo "Aplicación web").
  // Si se deja vacío, login.html muestra el MODO DEMO (elegir rol) para que la
  // presentación nunca se rompa.
  GOOGLE_CLIENT_ID: '',
  // Solo se aceptan cuentas del dominio institucional.
  DOMINIO_PERMITIDO: 'ulasalle.edu.pe',

  // --- Roles (se deducen del correo; el usuario NO los elige) ---------------
  // En producción el rol viene de la base de datos / directorio institucional.
  ADMIN_EMAILS: ['admin@ulasalle.edu.pe', 'reservas@ulasalle.edu.pe'],
  DOCENTE_EMAILS: ['mflores@ulasalle.edu.pe'],
  // Patrón simple para la demo: correos que empiezan con "doc.", "prof." o "d." son docentes.
  // Todo lo demás se considera estudiante.
  DOCENTE_PATRON: '^(doc|prof|d)\\.',

  // Cuentas de prueba (se muestran en letra pequeña en el login para el pitch)
  CUENTAS_DEMO: [
    { correo: 'elias@ulasalle.edu.pe',   nombre: 'Elías Quispe',      area: 'Ingeniería de Software' },
    { correo: 'mflores@ulasalle.edu.pe', nombre: 'Dra. María Flores', area: 'Facultad de Ingeniería' },
    { correo: 'admin@ulasalle.edu.pe',   nombre: 'Lic. Carlos Ramos', area: 'Oficina de Infraestructura' },
  ],

  // --- Horario operativo -----------------------------------------------------
  HORA_APERTURA: 7,   // 07:00
  HORA_CIERRE: 22,    // 22:00 (último bloque 21:00–22:00)
  DIAS_HABILES: [1, 2, 3, 4, 5, 6], // Lunes(1) a Sábado(6). Domingo cerrado.

  // --- Reglas de reserva (por espacio) ---------------------------------------
  REGLAS: {
    ojeda:  { anticipacionMinHoras: 48, duracionMaxHoras: 6 },
    benito: { anticipacionMinHoras: 48, duracionMaxHoras: 6 },
    verde:  { anticipacionMinHoras: 72, duracionMaxHoras: 10 },
  },
  ANTICIPACION_MAX_DIAS: 60,        // No se puede reservar con más de 60 días
  CANCELACION_MIN_HORAS: 24,        // Cancelar con menos de 24 h = cancelación tardía
  APROBACION_LIMITE_HORAS: 48,      // Pendiente sin respuesta por 48 h = "por vencer"

  // --- Prioridades (1 = más alta) --------------------------------------------
  PRIORIDADES: {
    institucional: { nivel: 1, etiqueta: 'Institucional / Administrativo' },
    docente:       { nivel: 2, etiqueta: 'Docente' },
    estudiante:    { nivel: 3, etiqueta: 'Estudiante' },
  },

  // --- Catálogos -------------------------------------------------------------
  TIPOS_ACTIVIDAD: [
    'Institucional / Administrativo',
    'Académico (clase, conferencia, ponencia)',
    'Taller / Capacitación',
    'Cultural / Artístico',
    'Feria / Exposición',
    'Estudiantil / Integración',
    'Deportivo / Recreativo',
  ],
};
