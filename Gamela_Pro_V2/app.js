"use strict";

// GAMELA PRO - FRONTEND CONECTADO A SUPABASE MEDIANTE EL BACKEND

const app = document.getElementById("app");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");

let usuarioActual = null;
let tokenSesion = null;
let pantallaActual = "login";

let db = {
    variedades: [],
    precios: [],
    trabajadores: [],
    asignaciones: [],
    produccion: [],
    ajustes: []
};

const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function dinero(valor) {
    return Number(valor || 0).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2
    });
}

function mensaje(texto, tipo = "success") {
    const anterior = document.getElementById("gp-message");
    if (anterior) anterior.remove();

    const aviso = document.createElement("p");
    aviso.id = "gp-message";
    aviso.className = `gp-message gp-${tipo}`;
    aviso.textContent = texto;
    app.prepend(aviso);
}

async function api(ruta, opciones = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(opciones.headers || {})
    };

    if (tokenSesion) {
        headers.Authorization = `Bearer ${tokenSesion}`;
    }

    const respuesta = await fetch(`/api/auth${ruta}`, {
        ...opciones,
        headers
    });

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || resultado.exito === false) {
        throw new Error(resultado.mensaje || "No se pudo completar la solicitud.");
    }

    return resultado;
}

async function cargarDatos() {
    const resultado = await api("/datos");

    db = {
        variedades: resultado.datos.variedades || [],
        precios: resultado.datos.precios || [],
        trabajadores: resultado.datos.trabajadores || [],
        asignaciones: resultado.datos.asignaciones || [],
        produccion: resultado.datos.produccion || [],
        ajustes: resultado.datos.ajustes || []
    };
}

function fechaFormato(fecha) {
    if (!fecha) return "";

    const [a, m, d] = fecha.slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
}

function trabajadorPorId(id) {
    return db.trabajadores.find(t => t.id === id);
}

function variedadPorId(id) {
    return db.variedades.find(v => Number(v.id) === Number(id));
}

function precioActual(variedadId, contratistaId = usuarioActual?.id) {
    const fecha = hoy();

    return db.precios
        .filter(p =>
            p.contratista_id === contratistaId &&
            Number(p.variedad_id) === Number(variedadId) &&
            p.vigencia_desde <= fecha &&
            (!p.vigencia_hasta || p.vigencia_hasta >= fecha)
        )
        .sort((a, b) => b.vigencia_desde.localeCompare(a.vigencia_desde))[0];
}

function asignacionesActivas() {
    return db.asignaciones.filter(a => !a.fecha_fin);
}

function trabajadoresDelContratista() {
    const ids = new Set(
        asignacionesActivas()
            .filter(a => a.contratista_id === usuarioActual.id)
            .map(a => a.trabajador_id)
    );

    return db.trabajadores.filter(t => ids.has(t.id));
}

function opcionesTrabajadores() {
    const lista = trabajadoresDelContratista();

    return lista.length
        ? lista.map(t =>
            `<option value="${escapar(t.id)}">${escapar(t.nombre)} (@${escapar(t.usuario)})</option>`
        ).join("")
        : '<option value="">No hay trabajadores asignados</option>';
}

function ir(pantalla) {
    if (!usuarioActual && pantalla !== "login") {
        pantalla = "login";
    }

    if (pantalla === "contratista" && usuarioActual?.rol !== "contratista") {
        pantalla = "menu";
    }

    if (pantalla === "trabajador" && usuarioActual?.rol !== "trabajador") {
        pantalla = "menu";
    }

    pantallaActual = pantalla;

    const vistas = {
        login: renderLogin,
        menu: renderMenu,
        contratista: renderContratista,
        "registrar-valor": renderRegistrarValor,
        "asignar-trabajador": renderAsignarTrabajador,
        "registrar-produccion": renderRegistrarProduccion,
        ajustes: renderAjustes,
        trabajador: renderTrabajador,
        precios: renderPrecios,
        "resumen-semanal": renderResumenSemanal,
        "historial-mensual": renderHistorialMensual
    };

    (vistas[pantalla] || renderMenu)();
}

// LOGIN

function renderLogin() {
    userInfo.hidden = true;

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Iniciar sesión</h2>
            <p>Ingresá a tu cuenta de Gamela Pro.</p>

            <form id="login-form">
                <label for="login-email">Correo electrónico</label>
                <input id="login-email" type="email"
                    autocomplete="username" required
                    placeholder="ejemplo@correo.com">

                <label for="login-password">Contraseña</label>
                <input id="login-password" type="password"
                    autocomplete="current-password" required>

                <button type="submit">Ingresar</button>
            </form>

            <p class="gp-help">
                Ingresá con el correo y la contraseña registrados.
            </p>
        </section>`;

    document.getElementById("login-form")
        .addEventListener("submit", iniciarSesion);
}

async function iniciarSesion(evento) {
    evento.preventDefault();

    const boton = document.querySelector('#login-form button[type="submit"]');
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;

    boton.disabled = true;
    boton.textContent = "Ingresando...";

    try {
        const respuesta = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.conectado) {
            throw new Error(resultado.mensaje || "No se pudo iniciar sesión.");
        }

        tokenSesion = resultado.access_token;
        usuarioActual = resultado.usuario;

        await cargarDatos();

        userName.textContent = `${usuarioActual.nombre} (${usuarioActual.rol})`;
        userInfo.hidden = false;

        ir("menu");
    } catch (error) {
        mensaje(error.message, "error");
    } finally {
        boton.disabled = false;
        boton.textContent = "Ingresar";
    }
}

function cerrarSesion() {
    usuarioActual = null;
    tokenSesion = null;

    db = {
        variedades: [],
        precios: [],
        trabajadores: [],
        asignaciones: [],
        produccion: [],
        ajustes: []
    };

    userInfo.hidden = true;
    ir("login");
}

// MENÚS

function renderMenu() {
    const contratista = usuarioActual.rol === "contratista";

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Menú principal</h2>
            <p>Bienvenido, ${escapar(usuarioActual.nombre)}.</p>

            <div class="gp-grid">
                <button data-go="${contratista ? "contratista" : "trabajador"}">
                    ${contratista ? "Apartado contratista" : "Mi apartado de trabajador"}
                </button>
            </div>
        </section>`;
}

function renderContratista() {
    app.innerHTML = `
        <section class="gp-panel">
            <h2>Panel del contratista</h2>
            <p>Administrá trabajadores, precios y producción.</p>

            <div class="gp-grid">
                <button data-go="registrar-valor">Registrar valor</button>
                <button data-go="asignar-trabajador">Asignar trabajador</button>
                <button data-go="registrar-produccion">Registrar producción</button>
                <button data-go="ajustes">Descuentos y aumentos</button>
            </div>

            <button class="gp-secondary" data-go="menu">Volver al menú</button>
        </section>`;
}

function renderTrabajador() {
    app.innerHTML = `
        <section class="gp-panel">
            <h2>Panel del trabajador</h2>
            <p>Consultá tus precios y tu producción.</p>

            <div class="gp-grid">
                <button data-go="precios">Precio por gamela</button>
                <button data-go="resumen-semanal">Acumulado semanal</button>
                <button data-go="historial-mensual">Historial mensual</button>
            </div>

            <button class="gp-secondary" data-go="menu">Volver al menú</button>
        </section>`;
}

// PRECIOS

function renderRegistrarValor() {
    const filas = db.variedades.map(v => {
        const p = precioActual(v.id);

        return `
            <tr>
                <td>${escapar(v.nombre)}</td>
                <td>${p ? dinero(p.precio) : "Sin precio"}</td>
            </tr>`;
    }).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Registrar valor</h2>

            <form id="precio-form">
                <label for="precio-variedad">Tipo de uva</label>
                <select id="precio-variedad" required>
                    ${db.variedades.map(v =>
                        `<option value="${v.id}">${escapar(v.nombre)}</option>`
                    ).join("")}
                </select>

                <label for="precio-valor">Precio por gamela (ARS)</label>
                <input id="precio-valor" type="number"
                    min="0.01" step="0.01" required>

                <button type="submit">Guardar precio</button>
            </form>

            <h3>Precios vigentes</h3>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr><th>Variedad</th><th>Precio</th></tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='2'>No hay variedades cargadas.</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="contratista">Volver</button>
        </section>`;

    document.getElementById("precio-form")
        .addEventListener("submit", async e => {
            e.preventDefault();

            try {
                const resultado = await api("/precios", {
                    method: "POST",
                    body: JSON.stringify({
                        variedad_id: Number(document.getElementById("precio-variedad").value),
                        precio: Number(document.getElementById("precio-valor").value),
                        fecha: hoy()
                    })
                });

                await cargarDatos();
                renderRegistrarValor();
                mensaje(resultado.mensaje);
            } catch (error) {
                mensaje(error.message, "error");
            }
        });
}

function renderPrecios() {
    const misAsignaciones = db.asignaciones.filter(a =>
        a.trabajador_id === usuarioActual.id && !a.fecha_fin
    );

    const contratistas = [
        ...new Set(misAsignaciones.map(a => a.contratista_id))
    ];

    const filas = [];

    contratistas.forEach(contratistaId => {
        const precios = db.precios.filter(p =>
            p.contratista_id === contratistaId &&
            p.vigencia_desde <= hoy() &&
            (!p.vigencia_hasta || p.vigencia_hasta >= hoy())
        );

        precios.forEach(p => {
            const variedad = variedadPorId(p.variedad_id);

            filas.push(`
                <tr>
                    <td>${escapar(variedad?.nombre || "Variedad")}</td>
                    <td>${dinero(p.precio)}</td>
                </tr>`);
        });
    });

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Precio por gamela</h2>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr><th>Tipo de uva</th><th>Precio</th></tr>
                    </thead>
                    <tbody>
                        ${filas.join("") || "<tr><td colspan='2'>Todavía no hay precios vigentes.</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="trabajador">Volver</button>
        </section>`;
}

// ASIGNAR TRABAJADOR

function renderAsignarTrabajador() {
    const asignados = trabajadoresDelContratista();

    const disponibles = db.trabajadores.filter(t =>
        t.rol === "trabajador" &&
        !asignados.some(a => a.id === t.id)
    );

    const filas = asignados.map(t => {
        const a = db.asignaciones.find(x =>
            x.trabajador_id === t.id &&
            x.contratista_id === usuarioActual.id &&
            !x.fecha_fin
        );

        return `
            <tr>
                <td>${escapar(t.nombre)}</td>
                <td>@${escapar(t.usuario)}</td>
                <td>${fechaFormato(a?.fecha_inicio)}</td>
            </tr>`;
    }).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Asignar trabajador</h2>

            <form id="asignacion-form">
                <label for="asignacion-trabajador">Cuenta del trabajador</label>

                <select id="asignacion-trabajador" required>
                    <option value="">Seleccioná una cuenta</option>
                    ${disponibles.map(t =>
                        `<option value="${escapar(t.id)}">${escapar(t.nombre)} (@${escapar(t.usuario)})</option>`
                    ).join("")}
                </select>

                <button type="submit" ${disponibles.length ? "" : "disabled"}>
                    Asignar trabajador
                </button>
            </form>

            <p class="gp-help">
                Solo aparecen cuentas de trabajador ya registradas en Supabase.
            </p>

            <h3>Mis trabajadores asignados</h3>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr><th>Nombre</th><th>Usuario</th><th>Desde</th></tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='3'>Sin asignaciones.</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="contratista">Volver</button>
        </section>`;

    document.getElementById("asignacion-form")
        .addEventListener("submit", async e => {
            e.preventDefault();

            try {
                const resultado = await api("/asignaciones", {
                    method: "POST",
                    body: JSON.stringify({
                        trabajador_id: document.getElementById("asignacion-trabajador").value
                    })
                });

                await cargarDatos();
                renderAsignarTrabajador();
                mensaje(resultado.mensaje);
            } catch (error) {
                mensaje(error.message, "error");
            }
        });
}

// REGISTRO DE PRODUCCIÓN

function renderRegistrarProduccion() {
    const trabajadores = trabajadoresDelContratista();

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Registrar producción</h2>
            <p>Ingresá las gamelas que realizó un trabajador.</p>

            <form id="produccion-form">
                <label for="produccion-trabajador">Trabajador</label>
                <select id="produccion-trabajador" required>
                    <option value="">Seleccioná un trabajador</option>
                    ${trabajadores.map(t =>
                        `<option value="${escapar(t.id)}">${escapar(t.nombre)}</option>`
                    ).join("")}
                </select>

                <label for="produccion-variedad">Tipo de uva</label>
                <select id="produccion-variedad" required>
                    ${db.variedades.map(v =>
                        `<option value="${v.id}">${escapar(v.nombre)}</option>`
                    ).join("")}
                </select>

                <label for="produccion-cantidad">Cantidad de gamelas</label>
                <input id="produccion-cantidad" type="number"
                    min="1" step="1" required>

                <label for="produccion-fecha">Fecha de producción</label>
                <input id="produccion-fecha" type="date"
                    value="${hoy()}" max="${hoy()}" required>

                <p class="gp-help" id="produccion-precio-ayuda">
                    El precio se tomará de la tarifa vigente para la variedad y fecha elegidas.
                </p>

                <button type="submit"
                    ${trabajadores.length && db.variedades.length ? "" : "disabled"}>
                    Guardar producción
                </button>
            </form>

            <button class="gp-secondary" data-go="contratista">Volver</button>
        </section>`;

    document.getElementById("produccion-form")
        .addEventListener("submit", async e => {
            e.preventDefault();

            try {
                const resultado = await api("/produccion", {
                    method: "POST",
                    body: JSON.stringify({
                        trabajador_id: document.getElementById("produccion-trabajador").value,
                        variedad_id: Number(document.getElementById("produccion-variedad").value),
                        cantidad_gamelas: Number(document.getElementById("produccion-cantidad").value),
                        fecha: document.getElementById("produccion-fecha").value
                    })
                });

                await cargarDatos();
                renderRegistrarProduccion();
                mensaje(resultado.mensaje);
            } catch (error) {
                mensaje(error.message, "error");
            }
        });
}

// AJUSTES

function renderAjustes() {
    const filas = db.ajustes
        .filter(a => a.contratista_id === usuarioActual.id)
        .map(a => `
            <tr>
                <td>${escapar(trabajadorPorId(a.trabajador_id)?.nombre || "Trabajador")}</td>
                <td>${escapar(a.tipo)}</td>
                <td>${dinero(a.importe)}</td>
                <td>${escapar(a.motivo)}</td>
                <td>${fechaFormato(a.fecha)}</td>
            </tr>`
        ).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Descuentos y aumentos</h2>

            <form id="ajuste-form">
                <label for="ajuste-trabajador">Trabajador</label>
                <select id="ajuste-trabajador" required>
                    <option value="">Seleccioná</option>
                    ${opcionesTrabajadores()}
                </select>

                <label for="ajuste-tipo">Tipo de ajuste</label>
                <select id="ajuste-tipo" required>
                    <option value="descuento">Descuento</option>
                    <option value="aumento">Aumento</option>
                </select>

                <label for="ajuste-importe">Importe (ARS)</label>
                <input id="ajuste-importe" type="number"
                    min="0.01" step="0.01" required>

                <label for="ajuste-motivo">Motivo</label>
                <input id="ajuste-motivo" maxlength="200" required>

                <label for="ajuste-fecha">Fecha</label>
                <input id="ajuste-fecha" type="date"
                    value="${hoy()}" max="${hoy()}" required>

                <button type="submit">Guardar ajuste</button>
            </form>

            <h3>Ajustes registrados</h3>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Trabajador</th>
                            <th>Tipo</th>
                            <th>Importe</th>
                            <th>Motivo</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='5'>Sin ajustes registrados.</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="contratista">Volver</button>
        </section>`;

    document.getElementById("ajuste-form")
        .addEventListener("submit", async e => {
            e.preventDefault();

            try {
                const resultado = await api("/ajustes", {
                    method: "POST",
                    body: JSON.stringify({
                        trabajador_id: document.getElementById("ajuste-trabajador").value,
                        tipo: document.getElementById("ajuste-tipo").value,
                        importe: Number(document.getElementById("ajuste-importe").value),
                        motivo: document.getElementById("ajuste-motivo").value.trim(),
                        fecha: document.getElementById("ajuste-fecha").value
                    })
                });

                await cargarDatos();
                renderAjustes();
                mensaje(resultado.mensaje);
            } catch (error) {
                mensaje(error.message, "error");
            }
        });
}

// PRODUCCIÓN Y RESÚMENES DEL TRABAJADOR

function produccionPropia() {
    return db.produccion.filter(r =>
        r.trabajador_id === usuarioActual.id
    );
}

function ajustesPropios() {
    return db.ajustes.filter(a =>
        a.trabajador_id === usuarioActual.id
    );
}

function importeAjustes(lista) {
    return lista.reduce((s, a) =>
        s + (a.tipo === "aumento"
            ? Number(a.importe)
            : -Number(a.importe)), 0
    );
}

function renderResumenSemanal() {
    const ahora = new Date();
    const lunes = new Date(ahora);
    const dia = lunes.getDay();

    lunes.setDate(lunes.getDate() + (dia === 0 ? -6 : 1 - dia));

    const desde = `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, "0")}-${String(lunes.getDate()).padStart(2, "0")}`;
    const hasta = hoy();

    const registros = produccionPropia().filter(r =>
        r.fecha >= desde && r.fecha <= hasta
    );

    const ajustes = ajustesPropios().filter(a =>
        a.fecha >= desde && a.fecha <= hasta
    );

    const cantidad = registros.reduce((s, r) =>
        s + Number(r.cantidad_gamelas), 0
    );

    const bruto = registros.reduce((s, r) =>
        s + Number(r.cantidad_gamelas) * Number(r.precio_unitario), 0
    );

    const ajuste = importeAjustes(ajustes);

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Acumulado semanal</h2>
            <p>Desde el ${fechaFormato(desde)} hasta el ${fechaFormato(hasta)}.</p>

            <div class="gp-stats">
                <p>Gamelas registradas:<strong>${cantidad}</strong></p>
                <p>Producción bruta:<strong>${dinero(bruto)}</strong></p>
                <p>Ajustes:<strong>${dinero(ajuste)}</strong></p>
                <p>Total estimado:<strong>${dinero(bruto + ajuste)}</strong></p>
            </div>

            <p class="gp-help">
                El total es una estimación, no una liquidación de pago.
            </p>

            <button class="gp-secondary" data-go="trabajador">Volver</button>
        </section>`;
}

function renderHistorialMensual() {
    const meses = {};

    produccionPropia().forEach(r => {
        const mes = r.fecha.slice(0, 7);

        if (!meses[mes]) {
            meses[mes] = { gamelas: 0, total: 0 };
        }

        meses[mes].gamelas += Number(r.cantidad_gamelas);
        meses[mes].total +=
            Number(r.cantidad_gamelas) * Number(r.precio_unitario);
    });

    const filas = Object.entries(meses)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, d]) => `
            <tr>
                <td>${escapar(mes)}</td>
                <td>${d.gamelas}</td>
                <td>${dinero(d.total)}</td>
            </tr>`
        ).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Historial mensual</h2>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Mes</th>
                            <th>Gamelas</th>
                            <th>Producción bruta</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='3'>Todavía no hay registros.</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="trabajador">Volver</button>
        </section>`;
}

// EVENTOS

app.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-go]");

    if (boton) {
        ir(boton.dataset.go);
    }
});

logoutBtn.addEventListener("click", cerrarSesion);

ir("login");