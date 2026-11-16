"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const supabase = require("./database");

const app = express();

app.use(cors());
app.use(express.json());

// Tus rutas de autenticación y datos unidas en auth.js
app.use("/api/auth", require("./routes/auth"));

// Archivos estáticos de la aplicación
app.use(express.static(path.resolve(__dirname, "..")));

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gamela Pro disponible en http://localhost:${PORT}`);
});