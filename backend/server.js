
const express = require("express");
const path = require("path");
require("dotenv").config();

const pool = require("./database");
const session = require("express-session");
const app = express();

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8
    }
}));

app.use("/api/auth", require("./routes/auth"));

// Servir index.html, CSS y JavaScript
app.use(express.static(path.resolve(__dirname, "..")));

// Comprobar que Node puede comunicarse con la base de datos
app.get("/api/estado", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT VERSION() AS version"
        );

        res.json({
            conectado: true,
            motor: rows[0].version,
            base: process.env.DB_NAME
        });
    } catch (error) {
        console.error("Error de base de datos:", error.message);

        res.status(500).json({
            conectado: false,
            mensaje: "No se pudo conectar con la base de datos"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gamela Pro disponible en el puerto ${PORT}`);
});
