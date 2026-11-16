
"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const supabase = require("./backend/database");
const app = express();

app.use(cors());
app.use(express.json());

// Rutas de autenticación y operaciones de Gamela Pro
app.use("/api/auth", require("./backend/routes/auth"));

// Comprobar conexión con Supabase
app.get("/api/estado", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("variedades_uva")
            .select("id, nombre")
            .limit(10);

        if (error) throw error;

        res.json({
            conectado: true,
            mensaje: "Conexión con Supabase exitosa",
            variedades: data
        });
    } catch (error) {
        console.error("Error de Supabase:", error.message);

        res.status(500).json({
            conectado: false,
            mensaje: "No se pudo conectar con Supabase"
        });
    }
});

// Archivos estáticos para ejecución local
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Exportar Express para Vercel
module.exports = app;

// Ejecutar servidor cuando se inicia localmente
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Gamela Pro disponible en http://localhost:${PORT}`);
    });
}
