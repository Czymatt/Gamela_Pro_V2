
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../database");

const router = express.Router();

// Iniciar sesión
router.post("/login", async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({
                mensaje: "Completa usuario y contraseña"
            });
        }

        const [rows] = await pool.execute(
            `SELECT id, usuario, password_hash, rol, activo
             FROM usuarios
             WHERE usuario = ?
             LIMIT 1`,
            [usuario]
        );

        if (rows.length === 0 || !rows[0].activo) {
            return res.status(401).json({
                mensaje: "Usuario o contraseña incorrectos"
            });
        }

        const user = rows[0];

        const passwordValida = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: "Usuario o contraseña incorrectos"
            });
        }

        req.session.user = {
            id: user.id,
            usuario: user.usuario,
            rol: user.rol
        };

        res.json({
            conectado: true,
            usuario: {
                id: user.id,
                usuario: user.usuario,
                rol: user.rol
            }
        });

    } catch (error) {
        console.error("Error en login:", error.message);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
});

// Consultar sesión actual
router.get("/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            conectado: false
        });
    }

    res.json({
        conectado: true,
        usuario: req.session.user
    });
});

// Cerrar sesión
router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                mensaje: "No se pudo cerrar la sesión"
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            conectado: false
        });
    });
});

module.exports = router;
