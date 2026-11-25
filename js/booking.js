/* =============================================================
   SpaceTwin · Widget de reserva (fecha + franja horaria + requerimientos)
   -------------------------------------------------------------
   Se monta en <div id="bookingWidget" data-espacio="ojeda|benito|verde">
   La página puede exponer window.obtenerConfiguracion() para guardar
   la distribución elegida en el visor 3D (zonas, sillas, stands...).
   ============================================================= */
(function () {
  'use strict';

  const raiz = document.getElementById('bookingWidget');
  if (!raiz || !window.Store || !window.ST) return;

  const CFG = window.ST_CONFIG;
  const S = window.Store;
  const U = S.util;
  const esc = window.ST.esc;
  const espacioId = raiz.dataset.espacio;
  const esp = S.espacio(espacioId);
  const reglas = S.reglasDe(espacioId);
  const params = new URLSearchParams(location.search);
  const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const st = {
    mes: null,            // Date (día 1 del mes visible)
    fecha: null,          // 'YYYY-MM-DD'
    inicio: null,         // número de hora (7..21)
    fin: null,            // número de hora (8..22)
  };

  /* ---------------------------------------------------------
     Estructura
     --------------------------------------------------------- */
  const tituloPaso = (n, t, extra) => `
    <div class="flex items-center justify-between mb-2.5">
      <h2 class="text-xs font-extrabold uppercase tracking-wider text-lasalle-blueDark flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-lasalle-vibrant text-white text-[11px] flex items-center justify-center" aria-hidden="true">${n}</span>${t}
      </h2>${extra || ''}
    </div>`;

  raiz.className = 'space-y-4';
  raiz.innerHTML = `
    <!-- PASO 1: FECHA -->
    <section class="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4" aria-labelledby="bw-t1">
      ${tituloPaso(1, '<span id="bw-t1">Elige la fecha</span>', '<span id="bw-fecha-badge" class="text-[11px] font-semibold text-lasalle-vibrant bg-lasalle-ice px-2 py-0.5 rounded-md">Sin fecha</span>')}
      <div class="flex items-center justify-between mb-2">
        <button type="button" id="bw-prev" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-lasalle-ice text-lasalle-blueDark font-bold disabled:opacity-30" aria-label="Mes anterior">‹</button>
        <p id="bw-mes" class="text-sm font-display font-extrabold text-slate-800 capitalize" aria-live="polite"></p>
        <button type="button" id="bw-next" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-lasalle-ice text-lasalle-blueDark font-bold disabled:opacity-30" aria-label="Mes siguiente">›</button>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1" aria-hidden="true">${DIAS_CORTOS.map((d) => `<span>${d}</span>`).join('')}</div>
      <div id="bw-dias" class="grid grid-cols-7 gap-1" role="grid" aria-label="Calendario de disponibilidad"></div>
      <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] text-slate-600">
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Libre</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span>Parcialmente ocupado</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span>Lleno</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-300"></span>Fuera de plazo</span>
      </div>
    </section>

    <!-- PASO 2: HORARIO -->
    <section class="rounded-2xl border border-slate-200/90 bg-white p-4" aria-labelledby="bw-t2">
      ${tituloPaso(2, '<span id="bw-t2">Elige la franja horaria</span>', '<span id="bw-hora-badge" class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">—</span>')}
      <p id="bw-hora-ayuda" class="text-[11px] text-slate-500 mb-2.5">Primero selecciona una fecha. Luego toca la hora de inicio y la hora final (bloques de 1 h).</p>
      <div id="bw-bloques" class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-1.5" role="group" aria-label="Bloques horarios"></div>
      <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] text-slate-600">
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-50 border border-emerald-300"></span>Libre</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>Pendiente (en revisión)</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-200 border border-slate-300"></span>Ocupado</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-lasalle-vibrant"></span>Tu selección</span>
      </div>
    </section>

    <!-- PASO 3: REQUERIMIENTOS -->
    <section class="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3" aria-labelledby="bw-t3">
      ${tituloPaso(3, '<span id="bw-t3">Detalles y requerimientos</span>')}
      <div>
        <label for="bw-evento" class="block text-[11px] font-bold text-slate-600 mb-1">Nombre del evento <span class="text-red-500" aria-hidden="true">*</span></label>
        <input id="bw-evento" required maxlength="80" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-lasalle-vibrant" placeholder="Ej. Conferencia de Innovación" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label for="bw-tipo" class="block text-[11px] font-bold text-slate-600 mb-1">Tipo de actividad <span class="text-red-500" aria-hidden="true">*</span></label>
          <select id="bw-tipo" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-lasalle-vibrant">
            <option value="">Selecciona…</option>
            ${CFG.TIPOS_ACTIVIDAD.map((t) => `<option>${esc(t)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="bw-aforo" class="block text-[11px] font-bold text-slate-600 mb-1">Aforo estimado (máx. ${esp.capacidad}) <span class="text-red-500" aria-hidden="true">*</span></label>
          <input id="bw-aforo" type="number" inputmode="numeric" min="1" max="${esp.capacidad}" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-lasalle-vibrant" placeholder="Ej. 50" aria-describedby="bw-aforo-hint" />
        </div>
      </div>
      <p id="bw-aforo-hint" class="text-[11px] text-slate-500 -mt-1" aria-live="polite"></p>
      <fieldset>
        <legend class="block text-[11px] font-bold text-slate-600 mb-1.5">Equipamiento requerido</legend>
        <div class="flex flex-wrap gap-1.5">
          ${esp.equipamiento.map((e, i) => `
            <label class="cursor-pointer">
              <input type="checkbox" class="peer st-sr" name="bw-equipo" value="${esc(e)}" id="bw-eq-${i}">
              <span class="inline-block px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 peer-checked:bg-lasalle-vibrant peer-checked:text-white peer-checked:border-lasalle-vibrant peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400 transition-colors">${esc(e)}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <div>
        <label for="bw-motivo" class="block text-[11px] font-bold text-slate-600 mb-1">Descripción / observaciones</label>
        <textarea id="bw-motivo" rows="2" maxlength="300" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-lasalle-vibrant" placeholder="Público objetivo, ponentes, necesidades especiales…"></textarea>
      </div>
    </section>

    <!-- POLÍTICAS -->
    <details class="rounded-2xl border border-lasalle-sky bg-lasalle-ice/50 p-4 group">
      <summary class="cursor-pointer text-xs font-extrabold text-lasalle-blueDark flex items-center justify-between list-none">
        <span>📋 Políticas de reserva de este espacio</span>
        <span class="text-lasalle-vibrant group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
      </summary>
      <div class="mt-3 text-[12px] text-slate-700">${window.ST.htmlPoliticas(espacioId)}</div>
    </details>

    <div id="bw-errores" class="hidden rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800" role="alert" tabindex="-1"></div>
  `;

  const $ = (id) => document.getElementById(id);

  /** Desplaza dentro del panel lateral (escritorio) o la ventana (móvil) sin esconder el header. */
  function desplazarA(el, centrar) {
    const cont = el.closest('.overflow-y-auto');
    if (cont && cont.scrollHeight > cont.clientHeight + 4) {
      let top = el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 12;
      if (centrar) top -= cont.clientHeight / 3;
      cont.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      const header = document.querySelector('header');
      const alto = header ? header.getBoundingClientRect().height + 16 : 16;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - alto), behavior: 'smooth' });
    }
  }

  /* ---------------------------------------------------------
     Calendario
     --------------------------------------------------------- */
  const ventana = S.ventanaReserva(espacioId);
  const minMes = new Date(ventana.min.getFullYear(), ventana.min.getMonth(), 1);
  const maxMes = new Date(ventana.max.getFullYear(), ventana.max.getMonth(), 1);
  st.mes = new Date(minMes);

  function diaReservable(d) {
    const fin = new Date(d); fin.setHours(CFG.HORA_CIERRE - 1, 0, 0, 0); // último bloque del día
    return CFG.DIAS_HABILES.includes(d.getDay()) && fin >= ventana.min && d <= ventana.max;
  }

  function pintarCalendario() {
    const y = st.mes.getFullYear(), m = st.mes.getMonth();
    $('bw-mes').textContent = `${U.MESES[m]} ${y}`;
    $('bw-prev').disabled = st.mes <= minMes;
    $('bw-next').disabled = st.mes >= maxMes;
    const primero = new Date(y, m, 1);
    const offset = (primero.getDay() + 6) % 7; // lunes primero
    const diasMes = new Date(y, m + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < offset; i++) html += '<span aria-hidden="true"></span>';
    for (let d = 1; d <= diasMes; d++) {
      const f = new Date(y, m, d);
      const iso = U.fechaISO(f);
      const ok = diaReservable(f);
      const oc = S.ocupacionDia(espacioId, iso);
      const sel = st.fecha === iso;
      let cls = 'relative h-10 rounded-lg text-xs font-bold border transition-all ';
      let punto = '';
      let etiqueta = U.fechaLarga(iso);
      if (!ok) {
        cls += 'bg-transparent border-transparent text-slate-300 cursor-not-allowed';
        etiqueta += ', fuera del plazo de reserva';
      } else if (oc.estadoDia === 'lleno') {
        cls += 'bg-red-50 border-red-200 text-red-300 line-through cursor-not-allowed';
        punto = 'bg-red-500'; etiqueta += ', sin horarios libres';
      } else {
        cls += sel ? 'bg-lasalle-vibrant border-lasalle-vibrant text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-lasalle-ice hover:border-lasalle-sky';
        punto = oc.estadoDia === 'parcial' ? 'bg-amber-400' : 'bg-emerald-500';
        etiqueta += oc.estadoDia === 'parcial' ? `, parcialmente ocupado (${oc.libres} de ${oc.total} bloques libres)` : ', totalmente libre';
      }
      const deshab = !ok || oc.estadoDia === 'lleno';
      html += `<button type="button" class="${cls}" data-fecha="${iso}" ${deshab ? 'disabled aria-disabled="true"' : ''} aria-pressed="${sel}" aria-label="${esc(etiqueta)}" title="${esc(etiqueta)}">
        ${d}${punto ? `<span class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${sel ? 'bg-white' : punto}"></span>` : ''}
      </button>`;
    }
    $('bw-dias').innerHTML = html;
  }

  $('bw-dias').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-fecha]');
    if (!b || b.disabled) return;
    elegirFecha(b.dataset.fecha);
  });
  $('bw-prev').onclick = () => { st.mes = new Date(st.mes.getFullYear(), st.mes.getMonth() - 1, 1); pintarCalendario(); };
  $('bw-next').onclick = () => { st.mes = new Date(st.mes.getFullYear(), st.mes.getMonth() + 1, 1); pintarCalendario(); };

  function elegirFecha(iso) {
    st.fecha = iso; st.inicio = null; st.fin = null;
    const d = U.parseFecha(iso);
    st.mes = new Date(d.getFullYear(), d.getMonth(), 1);
    $('bw-fecha-badge').textContent = U.fechaCorta(iso) + ' · ' + U.DIAS[d.getDay()];
    pintarCalendario();
    pintarBloques();
  }

  /* ---------------------------------------------------------
     Grilla horaria
     --------------------------------------------------------- */
  function bloqueValido(b) {
    // El bloque debe estar libre y respetar la anticipación mínima
    return b.estado === 'libre' && U.inicioDe(st.fecha, b.inicio) >= ventana.min;
  }

  function pintarBloques() {
    const cont = $('bw-bloques');
    if (!st.fecha) { cont.innerHTML = ''; actualizarResumenHora(); return; }
    const oc = S.ocupacionDia(espacioId, st.fecha);
    cont.innerHTML = oc.bloques.map((b) => {
      const enSel = st.inicio != null && b.hora >= st.inicio && b.hora < st.fin;
      const valido = bloqueValido(b);
      let cls = 'h-11 rounded-lg border text-[11px] font-bold leading-tight transition-all ';
      let desc;
      if (enSel) { cls += 'bg-lasalle-vibrant border-lasalle-vibrant text-white shadow'; desc = 'seleccionado'; }
      else if (b.estado === 'ocupado') { cls += 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'; desc = 'ocupado'; }
      else if (b.estado === 'pendiente') { cls += 'bg-amber-100 border-amber-300 text-amber-700 cursor-not-allowed'; desc = 'reservado, pendiente de aprobación'; }
      else if (!valido) { cls += 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'; desc = 'fuera del plazo de anticipación'; }
      else { cls += 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-500'; desc = 'libre'; }
      const dis = !enSel && !valido;
      return `<button type="button" class="${cls}" data-hora="${b.hora}" ${dis ? 'disabled aria-disabled="true"' : ''} aria-pressed="${enSel}" aria-label="De ${b.inicio} a ${b.fin}: ${desc}" title="${b.inicio}–${b.fin} · ${desc}">${b.inicio}<span class="block text-[9px] font-semibold opacity-70">${b.estado === 'libre' ? (valido ? 'libre' : '—') : b.estado}</span></button>`;
    }).join('');
    actualizarResumenHora();
  }

  $('bw-bloques').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-hora]');
    if (!b || b.disabled) return;
    const h = Number(b.dataset.hora);
    if (st.inicio == null || h < st.inicio || (h >= st.inicio && h < st.fin && st.fin - st.inicio > 1) || h === st.inicio) {
      // Nuevo inicio (o reinicio de la selección)
      if (h === st.inicio && st.fin - st.inicio === 1) { st.inicio = null; st.fin = null; }
      else { st.inicio = h; st.fin = h + 1; }
    } else {
      // Extender hasta el bloque tocado, si todo el tramo está libre
      const oc = S.ocupacionDia(espacioId, st.fecha);
      const tramo = oc.bloques.filter((x) => x.hora >= st.inicio && x.hora <= h);
      if (tramo.some((x) => !bloqueValido(x))) {
        window.ST.toast('No puedes saltar bloques ocupados: la franja debe ser continua.');
        st.inicio = h; st.fin = h + 1;
      } else if (h + 1 - st.inicio > reglas.duracionMaxHoras) {
        window.ST.toast(`La duración máxima es de ${reglas.duracionMaxHoras} h para este espacio.`);
        st.fin = st.inicio + reglas.duracionMaxHoras;
      } else {
        st.fin = h + 1;
      }
    }
    pintarBloques();
  });

  function actualizarResumenHora() {
    const badge = $('bw-hora-badge');
    const ayuda = $('bw-hora-ayuda');
    if (!st.fecha) { badge.textContent = '—'; return; }
    if (st.inicio == null) {
      badge.textContent = 'Sin horario';
      badge.className = 'text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md';
      ayuda.textContent = 'Toca la hora de inicio y luego la hora final. Puedes seleccionar varios bloques consecutivos.';
    } else {
      const dur = st.fin - st.inicio;
      badge.textContent = `${U.numAHora(st.inicio)} – ${U.numAHora(st.fin)} (${dur} h)`;
      badge.className = 'text-[11px] font-bold text-white bg-lasalle-vibrant px-2 py-0.5 rounded-md';
      ayuda.textContent = `Seleccionado de ${U.numAHora(st.inicio)} a ${U.numAHora(st.fin)}. Toca otro bloque posterior para extender (máx. ${reglas.duracionMaxHoras} h).`;
    }
  }

  /* ---------------------------------------------------------
     Aforo + sugerencia de espacio
     --------------------------------------------------------- */
  function revisarAforo() {
    const v = Number($('bw-aforo').value);
    const hint = $('bw-aforo-hint');
    if (!v) { hint.innerHTML = ''; return; }
    if (v > esp.capacidad) {
      const alt = S.sugerirEspacio(v, $('bw-tipo').value).find((x) => x.apto);
      hint.innerHTML = `<span class="text-red-600 font-bold">Supera la capacidad (${esp.capacidad}).</span> ` +
        (alt ? `Te sugerimos <a class="text-lasalle-vibrant font-bold underline" href="${alt.espacio.pagina}?aforo=${v}">${esc(alt.espacio.corto)} (${alt.espacio.capacidad})</a>.` : '');
    } else {
      const pct = Math.round((v / esp.capacidad) * 100);
      const mejor = S.sugerirEspacio(v, $('bw-tipo').value)[0];
      hint.innerHTML = `Ocupación estimada: <strong>${pct}%</strong>.` +
        (mejor.espacio.id !== espacioId && pct < 40 ? ` 💡 Para ${v} personas, <a class="text-lasalle-vibrant font-bold underline" href="${mejor.espacio.pagina}?aforo=${v}">${esc(mejor.espacio.corto)}</a> podría ajustarse mejor.` : '');
    }
  }
  $('bw-aforo').addEventListener('input', revisarAforo);
  $('bw-tipo').addEventListener('change', revisarAforo);

  /* ---------------------------------------------------------
     Prefill (URL, asistente)
     --------------------------------------------------------- */
  function prefill(d, opciones) {
    opciones = opciones || {};
    if (d.evento) $('bw-evento').value = d.evento;
    if (d.aforo) { $('bw-aforo').value = d.aforo; }
    if (d.tipo && CFG.TIPOS_ACTIVIDAD.includes(d.tipo)) $('bw-tipo').value = d.tipo;
    if (d.fecha) {
      const f = U.parseFecha(d.fecha);
      if (diaReservable(f)) {
        elegirFecha(d.fecha);
        if (d.inicio) {
          const a = Math.floor(U.horaANum(d.inicio)), b = Math.ceil(U.horaANum(d.fin || U.numAHora(a + 2)));
          const oc = S.ocupacionDia(espacioId, d.fecha);
          const tramo = oc.bloques.filter((x) => x.hora >= a && x.hora < b);
          if (tramo.length && tramo.every(bloqueValido)) { st.inicio = a; st.fin = Math.min(b, a + reglas.duracionMaxHoras); pintarBloques(); }
          else window.ST.toast('La franja pedida no está disponible; elige otra en la grilla.');
        }
      } else {
        window.ST.toast(`La fecha pedida está fuera del plazo (mín. ${reglas.anticipacionMinHoras} h de anticipación, máx. ${CFG.ANTICIPACION_MAX_DIAS} días).`);
      }
    }
    if (Array.isArray(d.equipamiento)) {
      document.querySelectorAll('input[name="bw-equipo"]').forEach((x) => { x.checked = d.equipamiento.includes(x.value); });
    }
    if (d.motivo) $('bw-motivo').value = d.motivo;
    revisarAforo();
    if (!opciones.sinScroll) desplazarA(raiz);
  }

  /* ---------------------------------------------------------
     Confirmación
     --------------------------------------------------------- */
  function mostrarErrores(lista) {
    const box = $('bw-errores');
    if (!lista.length) { box.classList.add('hidden'); return; }
    box.innerHTML = `<p class="font-extrabold mb-1.5">No pudimos registrar la reserva:</p><ul class="list-disc pl-5 space-y-0.5">${lista.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
    box.classList.remove('hidden');
    desplazarA(box, true);
    box.focus({ preventScroll: true });
  }

  const KEY_BORRADOR = 'spacetwin_borrador';

  function datosActuales() {
    const cfg = typeof window.obtenerConfiguracion === 'function' ? window.obtenerConfiguracion() : {};
    return {
      espacioId,
      fecha: st.fecha,
      horaInicio: st.inicio != null ? U.numAHora(st.inicio) : null,
      horaFin: st.fin != null ? U.numAHora(st.fin) : null,
      evento: $('bw-evento').value.trim(),
      tipoActividad: $('bw-tipo').value,
      aforo: Number($('bw-aforo').value),
      equipamiento: [...document.querySelectorAll('input[name="bw-equipo"]:checked')].map((x) => x.value),
      motivo: $('bw-motivo').value.trim(),
      configuracion: cfg,
    };
  }

  function guardarBorrador(datos) {
    try { sessionStorage.setItem(KEY_BORRADOR, JSON.stringify(Object.assign({ guardadoEn: Date.now(), pagina: location.pathname.split('/').pop() }, datos))); } catch (e) {}
  }
  function leerBorrador() {
    try {
      const b = JSON.parse(sessionStorage.getItem(KEY_BORRADOR));
      if (b && b.espacioId === espacioId && Date.now() - b.guardadoEn < 60 * 60 * 1000) return b;
    } catch (e) {}
    return null;
  }
  function borrarBorrador() { try { sessionStorage.removeItem(KEY_BORRADOR); } catch (e) {} }

  function confirmar() {
    const datos = datosActuales();
    // Sin sesión: se guarda la selección y se pide iniciar sesión aquí mismo
    if (!S.usuario()) {
      guardarBorrador(Object.assign({ enviarAlVolver: true }, datos));
      window.ST.pedirSesion({
        titulo: 'Inicia sesión para reservar',
        mensaje: 'Tu selección (fecha, horario, distribución y requerimientos) se guardó. Inicia sesión con tu correo institucional y enviaremos la solicitud.',
        onSuccess: () => { borrarBorrador(); confirmar(); },
      });
      return;
    }
    // Validación + re-verificación de cruces en el momento de guardar
    const res = S.crearReserva(datos);
    if (!res.ok) {
      mostrarErrores(res.errores);
      window.ST.toast(res.errores[0]);
      if (st.fecha) { pintarCalendario(); pintarBloques(); }
      return;
    }
    mostrarErrores([]);
    borrarBorrador();
    location.href = 'reserva.html?id=' + encodeURIComponent(res.reserva.id) + '&nueva=1';
  }

  /* ---------------------------------------------------------
     Inicio
     --------------------------------------------------------- */
  pintarCalendario();
  pintarBloques();
  const inicial = {
    evento: params.get('evento'), aforo: params.get('aforo'), tipo: params.get('tipo'),
    fecha: params.get('fecha'), inicio: params.get('inicio'), fin: params.get('fin'),
  };
  if (Object.values(inicial).some(Boolean)) setTimeout(() => prefill(inicial, { sinScroll: true }), 50);

  const borrador = leerBorrador();
  if (borrador) {
    // Se espera a que el visor 3D termine de montarse para reaplicar zonas / sillas / stands
    window.addEventListener('load', () => {
      prefill({
        evento: borrador.evento, aforo: borrador.aforo, tipo: borrador.tipoActividad, fecha: borrador.fecha,
        inicio: borrador.horaInicio, fin: borrador.horaFin, equipamiento: borrador.equipamiento, motivo: borrador.motivo,
      }, { sinScroll: true });
      if (typeof window.aplicarConfiguracion === 'function' && borrador.configuracion) {
        try { window.aplicarConfiguracion(borrador.configuracion); } catch (e) { /* el 3D sigue con su estado por defecto */ }
      }
      if (borrador.enviarAlVolver && S.usuario()) { borrarBorrador(); setTimeout(confirmar, 300); }
      else window.ST.toast('Recuperamos tu selección anterior.');
    });
  }

  window.STBooking = { espacioId, confirmar, prefill, estado: st };
})();
