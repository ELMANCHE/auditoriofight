# SpaceTwin · Reserva inteligente de espacios con gemelo digital

**Parmenia Open Challenge 2026 · Universidad La Salle (Arequipa)**

SpaceTwin digitaliza la reserva de los espacios de la universidad combinando un **gemelo digital 3D** de cada espacio con una agenda por horas, reglas de negocio, aprobación administrativa y acceso con **código QR**.

🔗 **Demo en GitHub Pages:** https://elmanche.github.io/auditoriofight/

| Espacio | Capacidad | Página |
|---|---|---|
| Auditorio Hno. Ludolfo Ojeda y Ojeda | 70 | `auditorio.html` |
| Auditorio Hno. Benito Campos del Río | 100 | `auditroio2.html` |
| Área Verde | hasta 180 / 30 stands | `pasto.html` |

---

## Funcionalidades

**Acceso**
- **Sin cuenta** se puede explorar todo: inicio, los 3 espacios en 3D, el calendario, las franjas horarias y la disponibilidad.
- La sesión se pide **solo al pulsar "Reservar"**, en un modal y sin salir de la página. La selección (fecha, horario, zonas/sillas/stands, requerimientos) se guarda en `sessionStorage` y la solicitud se envía apenas inicias sesión.
- Mis reservas, Perfil, el detalle de una reserva y las notificaciones requieren sesión: muestran una pantalla de acceso y, al entrar, te dejan en la misma página.
- Login con Google restringido a `@ulasalle.edu.pe`. En modo demo es un único campo de correo institucional. **El rol se deduce del correo** (`ADMIN_EMAILS`, `DOCENTE_EMAILS`, `DOCENTE_PATRON` en `js/config.js`); el usuario no lo elige.
- `admin.html` muestra "Acceso restringido" a quien no es administrador.

**Solicitante (estudiante / docente)**
- Visor 3D interactivo de cada espacio: zonas VIP/Platinum/General, butacas, modo taller, feria con stands o concierto. **La configuración elegida se guarda en la reserva.**
- Calendario con días marcados como *libre / parcial / lleno / fuera de plazo*.
- Grilla horaria 07:00–22:00 en bloques de 1 h: *libre* (verde), *pendiente* (ámbar), *ocupado* (gris).
- Requerimientos: nombre del evento, tipo de actividad, aforo (validado contra la capacidad), equipamiento y observaciones.
- Validación de reglas y **re-verificación de cruces** al confirmar.
- Detalle de la reserva con estado, seguimiento y **QR de check-in** al aprobarse.
- "Mis reservas": filtro por estado y cancelación real (libera el horario; las cancelaciones tardías quedan registradas).
- Notificaciones in-app (campana). En producción también se enviarían al correo institucional.
- Sugerencia de espacio según aforo y tipo de actividad.
- **Asistente accesible "Lucía"**: reserva por voz con Web Speech API (por ejemplo, *"reservar auditorio Ojeda el viernes a las 10 para 50 personas"*) o por chat guiado. Incluye etiquetas ARIA, foco visible y modo de alto contraste.

**Administrador (`admin.html`)**
- KPIs: pendientes, solicitudes por vencer, aprobadas en la semana, ocupación y tasa de aprobación.
- Gráficos (Chart.js): ocupación por espacio y solicitudes por estado.
- Bandeja ordenada por **prioridad** (institucional › docente › estudiante) y por fecha, con etiquetas de conflicto y "por vencer".
- Aprobar o rechazar (con motivo). **Al aprobar se rechazan automáticamente las pendientes en conflicto.**
- Calendario semanal por espacio.
- Reporte de uso filtrable y **exportación a CSV**.

## Reglas de negocio (`js/config.js`)

| Regla | Valor por defecto |
|---|---|
| Anticipación mínima | 48 h en auditorios, 72 h en Área Verde |
| Anticipación máxima | 60 días |
| Duración máxima | 6 h en auditorios, 10 h en Área Verde |
| Horario / días | 07:00–22:00, lunes a sábado |
| Cancelación sin penalidad | hasta 24 h antes (después cuenta como *cancelación tardía*) |
| Aprobación | si una pendiente pasa 48 h sin respuesta, o el evento está a menos de 48 h, se marca *por vencer* |
| Prioridad | Institucional / Administrativo > Docente > Estudiante |

## Flujo de demo

1. **Visitante explora:** abre `index.html` sin iniciar sesión. Prueba el sugeridor con "60 personas" y entra a un espacio.
2. **Elige horario:** configura el 3D (por ejemplo, el preset VIP/Platinum), elige un día y una franja en la grilla, y completa los requerimientos.
3. **Reservar → inicia sesión:** se abre el modal. Escribe `pepe@gmail.com` para ver el bloqueo de dominio y luego `elias@ulasalle.edu.pe` (enlace "Cuentas de prueba").
4. **Solicitud pendiente:** se envía sola con todo lo que habías elegido y abre `reserva.html` en estado *pendiente*.
5. **Admin aprueba:** menú → Cerrar sesión → "Iniciar sesión" con `admin@ulasalle.edu.pe` → bandeja → **Aprobar**. Si hay cruces, las pendientes en conflicto se rechazan solas.
6. **QR:** vuelve a entrar como `elias@ulasalle.edu.pe`. La campana muestra la aprobación; abre la reserva y aparece el **QR**. Al escanearlo, la página valida el check-in.

Cuentas de prueba (modo demo): `elias@ulasalle.edu.pe` (estudiante), `mflores@ulasalle.edu.pe` (docente), `admin@ulasalle.edu.pe` (administrador).

Puedes volver al estado inicial con **Reiniciar demo** (menú de usuario, pie de página o login).

## Cómo correrlo

No requiere build ni dependencias. Basta con un servidor estático:

```bash
python3 -m http.server 8080
# abre http://localhost:8080/login.html
```

Para revisar que no haya links rotos:

```bash
node scripts/check-links.js
```

### Login con Google (opcional)
1. En Google Cloud Console crea un *OAuth Client ID* de tipo "Aplicación web" y agrega el origen `https://elmanche.github.io` (y `http://localhost:8080`).
2. Pega el ID en `GOOGLE_CLIENT_ID` dentro de `js/config.js`.
3. Con el Client ID configurado, el login muestra solo el botón **"Continuar con Google"**. El botón usa `hd=ulasalle.edu.pe`. Además se valida el dominio del email y el claim `hd` del token, así que cualquier otro dominio se rechaza con un mensaje claro.

Si el Client ID está vacío, la página muestra el **modo demo** para que la presentación nunca se rompa.

## Arquitectura del prototipo

```
index.html · auditorio.html · auditroio2.html · pasto.html   ← vistas (Tailwind CDN + Three.js r128)
reserva.html · myreservas.html · user.html · admin.html · login.html
js/config.js    reglas de negocio y Client ID
js/store.js     "base de datos" en localStorage: reservas, cruces, reglas, prioridades, notificaciones, CSV
js/app.js       header común, sesión, notificaciones, políticas, accesibilidad, asistente por voz
js/booking.js   widget de fecha + franja horaria + requerimientos
```

## Arquitectura propuesta para producción

```
[Frontend estático (este repo)] ──HTTPS──► [API REST (Node/NestJS o Django)]
      │  Google Identity Services                │
      └──── ID token ──────────────────────────► │ verifica firma, aud, hd y dominio
                                                 ├─► PostgreSQL (espacios, usuarios/roles, reservas,
                                                 │    historial, configuraciones 3D, equipamiento)
                                                 ├─► Cola de notificaciones → Gmail API / SMTP institucional
                                                 ├─► Job programado: marca "por vencer" y envía recordatorios
                                                 └─► Endpoint de check-in QR (código firmado con HMAC)
```

- **Integridad de horarios:** en PostgreSQL, una restricción `EXCLUDE USING gist (espacio_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE estado IN ('pendiente','aprobada')` impide los cruces incluso con solicitudes concurrentes.
- **Roles** asignados en la BD (estudiante, docente, administrador), no en el cliente.
- **Auditoría:** cada cambio de estado se guarda en una tabla de historial.
- Cada función de `js/store.js` corresponde a un endpoint (`GET /reservas`, `POST /reservas`, `PATCH /reservas/:id/aprobar`, …), por lo que la migración es directa.
