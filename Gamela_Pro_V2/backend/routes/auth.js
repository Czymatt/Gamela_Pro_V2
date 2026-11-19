"use strict";

const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

function crearCliente(token) {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
}

function responderError(res, error, mensaje = "No se pudo completar la operación.") {
    console.error("Gamela Pro / Supabase:", error?.message || error);

    return res.status(400).json({
        exito: false,
        mensaje: error?.message || mensaje
    });
}

async function autenticar(req, res, next) {
    try {
        const encabezado = req.headers.authorization || "";

        const token = encabezado.startsWith("Bearer ")
            ? encabezado.slice(7)
            : "";

        if (!token) {
            return res.status(401).json({
                exito: false,
                mensaje: "La sesión no es válida. Volvé a iniciar sesión."
            });
        }

        const supabase = crearCliente(token);

        const { data: authData, error: authError } =
            await supabase.auth.getUser(token);

        if (authError || !authData.user) {
            return res.status(401).json({
                exito: false,
                mensaje: "La sesión venció. Volvé a iniciar sesión."
            });
        }

        const { data: perfil, error: perfilError } = await supabase
            .from("perfiles")
            .select("id, usuario, nombre, rol")
            .eq("id", authData.user.id)
            .single();

        if (perfilError || !perfil) {
            return res.status(403).json({
                exito: false,
                mensaje: "La cuenta no tiene un perfil configurado."
            });
        }

        req.supabase = supabase;
        req.perfil = perfil;

        next();

    } catch (error) {
        return responderError(
            res,
            error,
            "No se pudo verificar la sesión."
        );
    }
}

function exigirRol(rol) {
    return (req, res, next) => {
        if (req.perfil.rol !== rol) {
            return res.status(403).json({
                exito: false,
                mensaje: "No tenés permiso para realizar esta acción."
            });
        }

        next();
    };
}

// ======================================
// REGISTRO DE USUARIOS
// ======================================

router.post("/registro", async (req, res) => {
    try {
        const nombre = String(req.body.nombre || "")
            .trim();

        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const password = String(req.body.password || "");

        // Validaciones
        if (!nombre || !email || !password) {
            return res.status(400).json({
                exito: false,
                mensaje: "Completá todos los campos."
            });
        }

        if (nombre.length > 100) {
            return res.status(400).json({
                exito: false,
                mensaje: "El nombre no puede superar los 100 caracteres."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                exito: false,
                mensaje: "La contraseña debe tener al menos 6 caracteres."
            });
        }

        // Cliente de Supabase para registrar al usuario
        const clienteRegistro = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        // Crear usuario en Supabase Auth
        const { data, error } =
            await clienteRegistro.auth.signUp({
                email,
                password,

                options: {
                    data: {
                        nombre,
                        usuario: email.split("@")[0]
                    }
                }
            });

        if (error) {
            return res.status(400).json({
                exito: false,
                mensaje: error.message
            });
        }

        // Supabase puede requerir confirmación del correo.
        if (!data.session) {
            return res.json({
                exito: true,
                mensaje:
                    "Cuenta creada correctamente. " +
                    "Revisá tu correo electrónico para confirmar el registro."
            });
        }

        // Si se devuelve una sesión, buscamos el perfil
        // creado automáticamente por el trigger de Supabase.
        const supabase = crearCliente(
            data.session.access_token
        );

        const { data: perfil, error: perfilError } =
            await supabase
                .from("perfiles")
                .select("id, usuario, nombre, rol")
                .eq("id", data.user.id)
                .single();

        if (perfilError || !perfil) {
            return res.status(500).json({
                exito: false,
                mensaje:
                    "La cuenta fue creada, pero no se pudo " +
                    "obtener el perfil. Contactá al administrador."
            });
        }

        return res.json({
            exito: true,
            mensaje: "Cuenta creada correctamente.",

            usuario: perfil,

            access_token: data.session.access_token,

            refresh_token: data.session.refresh_token
        });

    } catch (error) {
        return responderError(
            res,
            error,
            "Ocurrió un error al registrar la cuenta."
        );
    }
});

// ======================================
// LOGIN
// ======================================


router.post("/login", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({
                conectado: false,
                mensaje: "Ingresá tu correo y contraseña."
            });
        }

        const clienteLogin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        const { data, error } =
            await clienteLogin.auth.signInWithPassword({
                email,
                password
            });

        if (error || !data.session) {
            return res.status(401).json({
                conectado: false,
                mensaje: "Correo o contraseña incorrectos."
            });
        }

        const supabase = crearCliente(data.session.access_token);

        const { data: perfil, error: perfilError } = await supabase
            .from("perfiles")
            .select("id, usuario, nombre, rol")
            .eq("id", data.user.id)
            .single();

        if (perfilError || !perfil) {
            return res.status(403).json({
                conectado: false,
                mensaje: "La cuenta existe, pero todavía no tiene un perfil configurado."
            });
        }

        return res.json({
            conectado: true,
            mensaje: "Inicio de sesión exitoso.",
            usuario: perfil,
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });

    } catch (error) {
        return responderError(
            res,
            error,
            "Ocurrió un error al iniciar sesión."
        );
    }
});

// ======================================
// CARGAR DATOS
// ======================================

router.get("/datos", autenticar, async (req, res) => {
    try {
        const db = req.supabase;

        const [
            variedadesRes,
            preciosRes,
            asignacionesRes,
            perfilesRes,
            produccionRes,
            ajustesRes
        ] = await Promise.all([

            db.from("variedades_uva")
                .select("id, nombre, activa")
                .eq("activa", true)
                .order("nombre"),

            db.from("precios")
                .select("id, contratista_id, variedad_id, precio, vigencia_desde, vigencia_hasta")
                .order("vigencia_desde", { ascending: false }),

            db.from("asignaciones")
                .select("id, contratista_id, trabajador_id, fecha_inicio, fecha_fin")
                .is("fecha_fin", null),

            db.from("perfiles")
                .select("id, usuario, nombre, rol"),

            db.from("produccion")
                .select("id, trabajador_id, contratista_id, variedad_id, fecha, cantidad_gamelas, precio_unitario, creado_por")
                .order("fecha", { ascending: false }),

            db.from("ajustes")
                .select("id, trabajador_id, contratista_id, tipo, importe, motivo, fecha, creado_por")
                .order("fecha", { ascending: false })
        ]);

        const resultados = [
            variedadesRes,
            preciosRes,
            asignacionesRes,
            perfilesRes,
            produccionRes,
            ajustesRes
        ];

        for (const resultado of resultados) {
            if (resultado.error) {
                throw resultado.error;
            }
        }

        return res.json({
            exito: true,
            usuario: req.perfil,

            datos: {
                variedades: variedadesRes.data || [],
                precios: preciosRes.data || [],
                asignaciones: asignacionesRes.data || [],

                trabajadores: (perfilesRes.data || [])
                    .filter(p => p.rol === "trabajador"),

                produccion: produccionRes.data || [],
                ajustes: ajustesRes.data || []
            }
        });

    } catch (error) {
        return responderError(
            res,
            error,
            "No se pudieron cargar los datos."
        );
    }
});

// ======================================
// REGISTRAR PRECIO
// ======================================

router.post(
    "/precios",
    autenticar,
    exigirRol("contratista"),
    async (req, res) => {
        try {
            const variedadId = Number(req.body.variedad_id);
            const precio = Number(req.body.precio);
            const fecha = String(
                req.body.fecha || new Date().toISOString().slice(0, 10)
            );

            if (
                !Number.isInteger(variedadId) ||
                !Number.isFinite(precio) ||
                precio <= 0 ||
                !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ) {
                return res.status(400).json({
                    exito: false,
                    mensaje: "Ingresá una variedad, un precio y una fecha válidos."
                });
            }

            const db = req.supabase;

            const { data: existentes, error: buscarError } = await db
                .from("precios")
                .select("id, precio, vigencia_desde, vigencia_hasta")
                .eq("contratista_id", req.perfil.id)
                .eq("variedad_id", variedadId)
                .is("vigencia_hasta", null)
                .order("vigencia_desde", { ascending: false })
                .limit(1);

            if (buscarError) {
                throw buscarError;
            }

            // Si ya existe un precio registrado para la misma fecha,
            // actualizamos ese registro sin crear otro duplicado.
            if (existentes?.length && existentes[0].vigencia_desde === fecha) {
                const { data, error } = await db
                    .from("precios")
                    .update({ precio })
                    .eq("id", existentes[0].id)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                return res.json({
                    exito: true,
                    mensaje: "Precio actualizado correctamente.",
                    dato: data
                });
            }

            // Si existía un precio anterior, cerramos su vigencia.
            if (existentes?.length) {
                const fechaAnterior = new Date(`${fecha}T00:00:00Z`);
                fechaAnterior.setUTCDate(fechaAnterior.getUTCDate() - 1);

                const fechaFinAnterior = fechaAnterior
                    .toISOString()
                    .slice(0, 10);

                const { error: cerrarError } = await db
                    .from("precios")
                    .update({
                        vigencia_hasta: fechaFinAnterior
                    })
                    .eq("id", existentes[0].id);

                if (cerrarError) {
                    throw cerrarError;
                }
            }

            // Creamos el nuevo precio.
            const { data, error } = await db
                .from("precios")
                .insert({
                    contratista_id: req.perfil.id,
                    variedad_id: variedadId,
                    precio,
                    vigencia_desde: fecha,
                    vigencia_hasta: null
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return res.json({
                exito: true,
                mensaje: "Precio guardado correctamente.",
                dato: data
            });

        } catch (error) {
            return responderError(res, error);
        }
    }
);

// ======================================
// ASIGNAR TRABAJADOR
// ======================================

router.post(
    "/asignaciones",
    autenticar,
    exigirRol("contratista"),
    async (req, res) => {
        try {
            const trabajadorId = String(req.body.trabajador_id || "");

            if (!trabajadorId) {
                return res.status(400).json({
                    exito: false,
                    mensaje: "Seleccioná un trabajador."
                });
            }

            const db = req.supabase;

            const { data: trabajador, error: trabajadorError } = await db
                .from("perfiles")
                .select("id, rol")
                .eq("id", trabajadorId)
                .single();

            if (
                trabajadorError ||
                !trabajador ||
                trabajador.rol !== "trabajador"
            ) {
                return res.status(400).json({
                    exito: false,
                    mensaje: "La cuenta seleccionada no es un trabajador válido."
                });
            }

            const { data: existente, error: existeError } = await db
                .from("asignaciones")
                .select("id")
                .eq("contratista_id", req.perfil.id)
                .eq("trabajador_id", trabajadorId)
                .is("fecha_fin", null)
                .maybeSingle();

            if (existeError) {
                throw existeError;
            }

            if (existente) {
                return res.status(409).json({
                    exito: false,
                    mensaje: "Ese trabajador ya está asignado."
                });
            }

            const { data, error } = await db
                .from("asignaciones")
                .insert({
                    contratista_id: req.perfil.id,
                    trabajador_id: trabajadorId,
                    fecha_inicio: new Date().toISOString().slice(0, 10),
                    fecha_fin: null
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return res.json({
                exito: true,
                mensaje: "Trabajador asignado correctamente.",
                dato: data
            });

        } catch (error) {
            return responderError(res, error);
        }
    }
);

// ======================================
// REGISTRAR PRODUCCIÓN
// ======================================

router.post(
    "/produccion",
    autenticar,
    exigirRol("contratista"),
    async (req, res) => {
        try {
            const trabajadorId = String(req.body.trabajador_id || "");
            const variedadId = Number(req.body.variedad_id);
            const cantidad = Number(req.body.cantidad_gamelas);
            const fecha = String(req.body.fecha || "");

            if (
                !trabajadorId ||
                !Number.isInteger(variedadId) ||
                !Number.isInteger(cantidad) ||
                cantidad <= 0 ||
                !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ) {
                return res.status(400).json({
                    exito: false,
                    mensaje: "Revisá trabajador, variedad, cantidad y fecha."
                });
            }

            const db = req.supabase;

            // Verificar que el trabajador esté asignado al contratista.
            const { data: asignacion, error: asignacionError } = await db
                .from("asignaciones")
                .select("id")
                .eq("contratista_id", req.perfil.id)
                .eq("trabajador_id", trabajadorId)
                .is("fecha_fin", null)
                .maybeSingle();

            if (asignacionError) {
                throw asignacionError;
            }

            if (!asignacion) {
                return res.status(403).json({
                    exito: false,
                    mensaje: "Ese trabajador no está asignado actualmente."
                });
            }

            // Buscar el precio vigente para la variedad y fecha.
            const { data: precios, error: precioError } = await db
                .from("precios")
                .select("precio, vigencia_desde, vigencia_hasta")
                .eq("contratista_id", req.perfil.id)
                .eq("variedad_id", variedadId)
                .lte("vigencia_desde", fecha)
                .order("vigencia_desde", { ascending: false })
                .limit(20);

            if (precioError) {
                throw precioError;
            }

            const precioVigente = (precios || []).find(p =>
                !p.vigencia_hasta || p.vigencia_hasta >= fecha
            );

            if (!precioVigente) {
                return res.status(400).json({
                    exito: false,
                    mensaje: "No hay un precio vigente para esa variedad y fecha. Registrá primero el precio."
                });
            }

            const { data, error } = await db
                .from("produccion")
                .insert({
                    trabajador_id: trabajadorId,
                    contratista_id: req.perfil.id,
                    variedad_id: variedadId,
                    fecha,
                    cantidad_gamelas: cantidad,
                    precio_unitario: precioVigente.precio,
                    creado_por: req.perfil.id
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return res.json({
                exito: true,
                mensaje: "Producción registrada correctamente.",
                dato: data
            });

        } catch (error) {
            return responderError(res, error);
        }
    }
);

// ======================================
// REGISTRAR AJUSTE
// ======================================

router.post(
    "/ajustes",
    autenticar,
    exigirRol("contratista"),
    async (req, res) => {
        try {
            const trabajadorId = String(req.body.trabajador_id || "");
            const tipo = String(req.body.tipo || "");
            const importe = Number(req.body.importe);
            const motivo = String(req.body.motivo || "").trim();
            const fecha = String(
                req.body.fecha || new Date().toISOString().slice(0, 10)
            );

            if (
                !trabajadorId ||
                !["aumento", "descuento"].includes(tipo) ||
                !Number.isFinite(importe) ||
                importe <= 0 ||
                !motivo ||
                !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ) {
                return res.status(400).json({
                    exito: false,
                    mensaje: "Revisá los datos del ajuste."
                });
            }

            const db = req.supabase;

            // Comprobar que el trabajador esté asignado.
            const { data: asignacion, error: asignacionError } = await db
                .from("asignaciones")
                .select("id")
                .eq("contratista_id", req.perfil.id)
                .eq("trabajador_id", trabajadorId)
                .is("fecha_fin", null)
                .maybeSingle();

            if (asignacionError) {
                throw asignacionError;
            }

            if (!asignacion) {
                return res.status(403).json({
                    exito: false,
                    mensaje: "El trabajador no está asignado."
                });
            }

            const { data, error } = await db
                .from("ajustes")
                .insert({
                    trabajador_id: trabajadorId,
                    contratista_id: req.perfil.id,
                    tipo,
                    importe,
                    motivo,
                    fecha,
                    creado_por: req.perfil.id
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return res.json({
                exito: true,
                mensaje: "Ajuste registrado correctamente.",
                dato: data
            });

        } catch (error) {
            return responderError(res, error);
        }
    }
);

module.exports = router;