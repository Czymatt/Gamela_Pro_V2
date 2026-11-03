
"use strict";

// ==========================================
// GAMELA PRO - APLICACION DE PRUEBA
// ==========================================

const app = document.getElementById("app");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");

const STORAGE_KEY = "gamela_pro_demo_v1";

let usuarioActual = null;
let pantallaActual = "login";

const datosIniciales = {
    precios: [
        { id: 1, variedad: "Malbec", precio: 500 },
        { id: 2, variedad: "Cabernet", precio: 550 },
        { id: 3, variedad: "Bonarda", precio: 450 }
    ],

    trabajadores: [
        { id: 1, nombre: "Juan Pérez", usuario: "juan" },
        { id: 2, nombre: "Pedro Gómez", usuario: "pedro" }
    ],

    asignaciones: [],

    registros: [],

    ajustes: []
};

function cargarDatos() {
    try {
        const guardados = localStorage.getItem(STORAGE_KEY);

        if (!guardados) {
            return structuredClone(datosIniciales);
        }

        const datos = JSON.parse(guardados);

        if (
            !datos ||
            !Array.isArray(datos.precios) ||
            !Array.isArray(datos.trabajadores) ||
            !Array.isArray(datos.registros) ||
            !Array.isArray(datos.ajustes) ||
            !Array.isArray(datos.asignaciones)
        ) {
            throw new Error("Estructura de datos inválida.");
        }

        return datos;
    } catch (error) {
        console.error("No se pudieron cargar los datos:", error);
        return structuredClone(datosIniciales);
    }
}

let db = cargarDatos();

function guardarDatos() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        return true;
    } catch (error) {
        console.error("No se pudieron guardar los datos:", error);
        alert("No se pudieron guardar los cambios.");
        return false;
    }
}

// ==========================================
// UTILIDADES
// ==========================================

function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function dinero(valor) {
    return Number(valor).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2
    });
}

function fechaLocal(fecha = new Date()) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function fechaValida(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const comprobacion = new Date(anio, mes - 1, dia);

    return (
        comprobacion.getFullYear() === anio &&
        comprobacion.getMonth() === mes - 1 &&
        comprobacion.getDate() === dia
    );
}

function idNuevo(lista) {
    return lista.reduce((mayor, item) => Math.max(mayor, item.id), 0) + 1;
}

function trabajadorAsignado(id) {
    return db.asignaciones.some(asignacion =>
        asignacion.trabajadorId === Number(id) &&
        asignacion.contratista === usuarioActual.usuario
    );
}

function trabajadorVisible(id) {
    const trabajador = db.trabajadores.find(t => t.id === Number(id));

    if (!trabajador) return false;

    if (usuarioActual.rol === "contratista") {
        return trabajadorAsignado(id);
    }

    return trabajador.usuario === usuarioActual.usuario;
}

function obtenerTrabajadoresVisibles() {
    if (usuarioActual.rol === "contratista") {
        return db.trabajadores.filter(t => trabajadorAsignado(t.id));
    }

    return db.trabajadores.filter(t =>
        t.usuario === usuarioActual.usuario
    );
}

function trabajadorSelect() {
    const trabajadores = obtenerTrabajadoresVisibles();

    if (trabajadores.length === 0) {
        return '<option value="">No hay trabajadores asignados</option>';
    }

    return trabajadores.map(t => `
        <option value="${t.id}">${escapar(t.nombre)}</option>
    `).join("");
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

function volverMenu() {
    mostrarPantalla("menu");
}

// ==========================================
// INICIO DE SESION DE DEMOSTRACION
// ==========================================

// IMPORTANTE:
// Estas cuentas son solamente para probar la interfaz.
// No usar este sistema para cuentas reales.

const cuentasDemo = [
    {
        usuario: "contratista",
        clave: "1234",
        nombre: "Contratista de prueba",
        rol: "contratista"
    },
    {
        usuario: "juan",
        clave: "1234",
        nombre: "Juan Pérez",
        rol: "trabajador"
    },
    {
        usuario: "pedro",
        clave: "1234",
        nombre: "Pedro Gómez",
        rol: "trabajador"
    }
];

function iniciarSesion(evento) {
    evento.preventDefault();

    const usuario = document.getElementById("login-user")
        .value.trim().toLowerCase();

    const clave = document.getElementById("login-password").value;

    const cuenta = cuentasDemo.find(c =>
        c.usuario === usuario && c.clave === clave
    );

    if (!cuenta) {
        mensaje("Usuario o contraseña incorrectos.", "error");
        return;
    }

    usuarioActual = {
        usuario: cuenta.usuario,
        nombre: cuenta.nombre,
        rol: cuenta.rol
    };

    userName.textContent =
        `${usuarioActual.nombre} (${usuarioActual.rol})`;

    userInfo.hidden = false;
    mostrarPantalla("menu");
}

function cerrarSesion() {
    usuarioActual = null;
    userInfo.hidden = true;
    mostrarPantalla("login");
}

// ==========================================
// NAVEGACION
// ==========================================

function mostrarPantalla(pantalla) {
    pantallaActual = pantalla;

    if (!usuarioActual && pantalla !== "login") {
        pantalla = "login";
        pantallaActual = "login";
    }

    if (pantalla === "contratista" &&
        usuarioActual?.rol !== "contratista") {
        pantalla = "menu";
        pantallaActual = "menu";
    }

    if (pantalla === "trabajador" &&
        usuarioActual?.rol !== "trabajador") {
        pantalla = "menu";
        pantallaActual = "menu";
    }

    switch (pantalla) {
        case "login":
            renderLogin();
            break;

        case "menu":
            renderMenu();
            break;

        case "contratista":
            renderContratista();
            break;

        case "registrar-valor":
            renderRegistrarValor();
            break;

        case "asignar-trabajador":
            renderAsignarTrabajador();
            break;

        case "ajustes":
            renderAjustes();
            break;

        case "trabajador":
            renderTrabajador();
            break;

        case "precios":
            renderPrecios();
            break;

        case "resumen-semanal":
            renderResumenSemanal();
            break;

        case "historial-mensual":
            renderHistorialMensual();
            break;

        default:
            renderMenu();
    }
}

// ==========================================
// LOGIN
// ==========================================

function renderLogin() {
    userInfo.hidden = true;

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Iniciar sesión</h2>
            <p>Ingresá a tu cuenta de Gamela Pro.</p>

            <form id="login-form">
                <label for="login-user">Usuario</label>
                <input id="login-user"
                    type="text"
                    autocomplete="username"
                    required>

                <label for="login-password">Contraseña</label>
                <input id="login-password"
                    type="password"
                    autocomplete="current-password"
                    required>

                <button type="submit">Ingresar</button>
            </form>

            <p class="gp-help">
                Modo de prueba: usuario contratista, juan o pedro.
                Contraseña: 1234.
            </p>
        </section>
    `;

    document.getElementById("login-form")
        .addEventListener("submit", iniciarSesion);
}

// ==========================================
// MENU PRINCIPAL
// ==========================================

function renderMenu() {
    const esContratista = usuarioActual.rol === "contratista";

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Menú principal</h2>
            <p>Bienvenido, ${escapar(usuarioActual.nombre)}.</p>

            <div class="gp-grid">
                <button data-go="${
                    esContratista ? "contratista" : "trabajador"
                }">
                    ${esContratista
                        ? "Apartado contratista"
                        : "Mi apartado de trabajador"}
                </button>
            </div>
        </section>
    `;
}

// ==========================================
// MENU CONTRATISTA
// ==========================================

function renderContratista() {
    app.innerHTML = `
        <section class="gp-panel">
            <h2>Panel del contratista</h2>
            <p>Administrá la producción y los valores.</p>

            <div class="gp-grid">
                <button data-go="registrar-valor">
                    Registrar valor
                </button>

                <button data-go="asignar-trabajador">
                    Asignar trabajador
                </button>

                <button data-go="ajustes">
                    Descuentos y aumentos
                </button>
            </div>

            <button class="gp-secondary" data-go="menu">
                Volver al menú
            </button>
        </section>
    `;
}

// ==========================================
// REGISTRAR PRECIO POR TIPO DE UVA
// ==========================================

function renderRegistrarValor() {
    const filas = db.precios.map(p => `
        <tr>
            <td>${escapar(p.variedad)}</td>
            <td>${dinero(p.precio)}</td>
        </tr>
    `).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Registrar valor</h2>

            <form id="precio-form">
                <label for="variedad">Tipo de uva</label>
                <input id="variedad" required maxlength="80">

                <label for="precio">Precio por gamela (ARS)</label>
                <input id="precio"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required>

                <button type="submit">Guardar precio</button>
            </form>

            <h3>Precios actuales</h3>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr><th>Variedad</th><th>Precio</th></tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='2'>Sin precios</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="contratista">
                Volver
            </button>
        </section>
    `;

    document.getElementById("precio-form")
        .addEventListener("submit", evento => {
            evento.preventDefault();

            const variedad = document.getElementById("variedad")
                .value.trim();

            const precio = Number(
                document.getElementById("precio").value
            );

            if (!variedad || !Number.isFinite(precio) || precio <= 0) {
                mensaje("Ingresá una variedad y un precio válido.", "error");
                return;
            }

            const existente = db.precios.find(p =>
                p.variedad.toLowerCase() === variedad.toLowerCase()
            );

            if (existente) {
                // En producción conviene conservar el historial
                // de precios en una tabla independiente.
                existente.precio = precio;
            } else {
                db.precios.push({
                    id: idNuevo(db.precios),
                    variedad,
                    precio
                });
            }

            if (!guardarDatos()) return;

            renderRegistrarValor();
            mensaje("Precio guardado correctamente.");
        });
}

// ==========================================
// ASIGNAR TRABAJADOR
// ==========================================

function renderAsignarTrabajador() {
    const filas = db.asignaciones
        .filter(a => a.contratista === usuarioActual.usuario)
        .map(a => {
            const t = db.trabajadores.find(
                trabajador => trabajador.id === a.trabajadorId
            );

            return t ? `
                <tr>
                    <td>${escapar(t.nombre)}</td>
                    <td>${escapar(a.fecha)}</td>
                </tr>
            ` : "";
        }).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Asignar trabajador</h2>

            <form id="asignacion-form">
                <label for="trabajador-nombre">
                    Trabajador
                </label>

                <input id="trabajador-nombre"
                    required
                    maxlength="100"
                    placeholder="Nombre del trabajador">

                <label for="trabajador-usuario">
                    Nombre de usuario
                </label>

                <input id="trabajador-usuario"
                    required
                    maxlength="40"
                    placeholder="Ejemplo: maria">

                <button type="submit">Asignar trabajador</button>
            </form>

            <h3>Mis trabajadores asignados</h3>

            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr><th>Nombre</th><th>Fecha</th></tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='2'>Sin asignaciones</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="contratista">
                Volver
            </button>
        </section>
    `;

    document.getElementById("asignacion-form")
        .addEventListener("submit", evento => {
            evento.preventDefault();

            const nombre = document.getElementById("trabajador-nombre")
                .value.trim();

            const usuario = document.getElementById("trabajador-usuario")
                .value.trim().toLowerCase();

            if (!nombre || !/^[a-z0-9._-]{3,40}$/i.test(usuario)) {
                mensaje("Revisá el nombre y el usuario.", "error");
                return;
            }

            let trabajador = db.trabajadores.find(t =>
                t.usuario.toLowerCase() === usuario
            );

            if (!trabajador) {
                trabajador = {
                    id: idNuevo(db.trabajadores),
                    nombre,
                    usuario
                };

                db.trabajadores.push(trabajador);
            }

            const existe = db.asignaciones.some(a =>
                a.trabajadorId === trabajador.id &&
                a.contratista === usuarioActual.usuario
            );

            if (existe) {
                mensaje("Ese trabajador ya está asignado.", "error");
                return;
            }

            db.asignaciones.push({
                id: idNuevo(db.asignaciones),
                trabajadorId: trabajador.id,
                contratista: usuarioActual.usuario,
                fecha: fechaLocal()
            });

            if (!guardarDatos()) return;

            renderAsignarTrabajador();
            mensaje("Trabajador asignado correctamente.");
        });
}

// ==========================================
// REGISTRO DE DESCUENTOS Y AUMENTOS
// ==========================================

function renderAjustes() {
    const filas = db.ajustes
        .filter(a => a.contratista === usuarioActual.usuario)
        .map(a => {
            const t = db.trabajadores.find(
                trabajador => trabajador.id === a.trabajadorId
            );

            return `
                <tr>
                    <td>${escapar(t?.nombre || "No disponible")}</td>
                    <td>${escapar(a.tipo)}</td>
                    <td>${dinero(a.importe)}</td>
                    <td>${escapar(a.motivo)}</td>
                </tr>
            `;
        }).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Descuentos y aumentos</h2>

            <form id="ajuste-form">
                <label for="ajuste-trabajador">Trabajador</label>
                <select id="ajuste-trabajador" required>
                    ${trabajadorSelect()}
                </select>

                <label for="ajuste-tipo">Tipo de ajuste</label>
                <select id="ajuste-tipo" required>
                    <option value="descuento">Descuento</option>
                    <option value="aumento">Aumento</option>
                </select>

                <label for="ajuste-importe">Importe (ARS)</label>
                <input id="ajuste-importe"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required>

                <label for="ajuste-motivo">Motivo</label>
                <input id="ajuste-motivo"
                    maxlength="200"
                    required>

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
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='4'>Sin ajustes</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="contratista">
                Volver
            </button>
        </section>
    `;

    document.getElementById("ajuste-form")
        .addEventListener("submit", evento => {
            evento.preventDefault();

            const trabajadorId = Number(
                document.getElementById("ajuste-trabajador").value
            );

            const tipo = document.getElementById("ajuste-tipo").value;
            const importe = Number(
                document.getElementById("ajuste-importe").value
            );
            const motivo = document.getElementById("ajuste-motivo")
                .value.trim();

            if (
                !trabajadorVisible(trabajadorId) ||
                !["descuento", "aumento"].includes(tipo) ||
                !Number.isFinite(importe) ||
                importe <= 0 ||
                !motivo
            ) {
                mensaje("Revisá los datos del ajuste.", "error");
                return;
            }

            db.ajustes.push({
                id: idNuevo(db.ajustes),
                trabajadorId,
                contratista: usuarioActual.usuario,
                tipo,
                importe,
                motivo,
                fecha: fechaLocal()
            });

            if (!guardarDatos()) return;

            renderAjustes();
            mensaje("Ajuste registrado correctamente.");
        });
}

// ==========================================
// MENU DEL TRABAJADOR
// ==========================================

function renderTrabajador() {
    app.innerHTML = `
        <section class="gp-panel">
            <h2>Panel del trabajador</h2>
            <p>Consultá tus precios y tu producción.</p>

            <div class="gp-grid">
                <button data-go="precios">
                    Precio por gamela
                </button>

                <button data-go="resumen-semanal">
                    Acumulado semanal
                </button>

                <button data-go="historial-mensual">
                    Historial mensual
                </button>
            </div>

            <button class="gp-secondary" data-go="menu">
                Volver al menú
            </button>
        </section>
    `;
}

// ==========================================
// PRECIOS DISPONIBLES
// ==========================================

function renderPrecios() {
    const filas = db.precios.map(p => `
        <tr>
            <td>${escapar(p.variedad)}</td>
            <td>${dinero(p.precio)}</td>
        </tr>
    `).join("");

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Precio por gamela</h2>
            <div class="gp-table-wrap">
                <table>
                    <thead>
                        <tr><th>Tipo de uva</th><th>Precio</th></tr>
                    </thead>
                    <tbody>
                        ${filas || "<tr><td colspan='2'>Sin precios</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="trabajador">
                Volver
            </button>
        </section>
    `;
}

// ==========================================
// CONSULTAS DE PRODUCCION
// ==========================================

function registrosPropios() {
    const trabajador = db.trabajadores.find(t =>
        t.usuario === usuarioActual.usuario
    );

    if (!trabajador) return [];

    return db.registros.filter(r =>
        r.trabajadorId === trabajador.id
    );
}

function ajustesPropios() {
    const trabajador = db.trabajadores.find(t =>
        t.usuario === usuarioActual.usuario
    );

    if (!trabajador) return [];

    return db.ajustes.filter(a =>
        a.trabajadorId === trabajador.id
    );
}

function totalAjustes(ajustes) {
    return ajustes.reduce((total, ajuste) => {
        return total + (
            ajuste.tipo === "aumento"
                ? ajuste.importe
                : -ajuste.importe
        );
    }, 0);
}

function inicioSemana(fecha) {
    const resultado = new Date(`${fecha}T12:00:00`);
    const dia = resultado.getDay();

    resultado.setDate(
        resultado.getDate() + (dia === 0 ? -6 : 1 - dia)
    );

    return fechaLocal(resultado);
}

function renderResumenSemanal() {
    const hoy = fechaLocal();
    const lunes = inicioSemana(hoy);

    const registros = registrosPropios().filter(r =>
        r.fecha >= lunes && r.fecha <= hoy
    );

    const ajustes = ajustesPropios().filter(a =>
        a.fecha >= lunes && a.fecha <= hoy
    );

    const gamelas = registros.reduce(
        (total, r) => total + r.cantidad, 0
    );

    const bruto = registros.reduce(
        (total, r) => total + r.total, 0
    );

    const balance = bruto + totalAjustes(ajustes);

    app.innerHTML = `
        <section class="gp-panel">
            <h2>Acumulado semanal</h2>
            <p>Desde el lunes ${escapar(lunes)} hasta ${escapar(hoy)}.</p>

            <div class="gp-stats">
                <p>Gamelas registradas: <strong>${gamelas}</strong></p>
                <p>Producción bruta: <strong>${dinero(bruto)}</strong></p>
                <p>Ajustes: <strong>${dinero(totalAjustes(ajustes))}</strong></p>
                <p>Total estimado: <strong>${dinero(balance)}</strong></p>
            </div>

            <p class="gp-help">
                El total es una estimación, no una liquidación de pago.
            </p>

            <button class="gp-secondary" data-go="trabajador">
                Volver
            </button>
        </section>
    `;
}

function renderHistorialMensual() {
    const registros = registrosPropios();
    const meses = {};

    registros.forEach(r => {
        const mes = r.fecha.slice(0, 7);

        if (!meses[mes]) {
            meses[mes] = { gamelas: 0, total: 0 };
        }

        meses[mes].gamelas += r.cantidad;
        meses[mes].total += r.total;
    });

    const filas = Object.entries(meses)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, datos]) => `
            <tr>
                <td>${escapar(mes)}</td>
                <td>${datos.gamelas}</td>
                <td>${dinero(datos.total)}</td>
            </tr>
        `).join("");

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
                        ${filas || "<tr><td colspan='3'>Todavía no hay registros</td></tr>"}
                    </tbody>
                </table>
            </div>

            <button class="gp-secondary" data-go="trabajador">
                Volver
            </button>
        </section>
    `;
}

// ==========================================
// EVENTOS GENERALES
// ==========================================

app.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-go]");

    if (!boton) return;

    mostrarPantalla(boton.dataset.go);
});

logoutBtn.addEventListener("click", cerrarSesion);

// Iniciar
mostrarPantalla("login");
