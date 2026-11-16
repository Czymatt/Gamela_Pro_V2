
CREATE DATABASE IF NOT EXISTS gamela_pro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gamela_pro;

-- 1. Usuarios que pueden iniciar sesión
CREATE TABLE usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('contratista', 'trabajador') NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Datos específicos de cada contratista
CREATE TABLE contratistas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 3. Datos específicos de cada trabajador
CREATE TABLE trabajadores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    fecha_ingreso DATE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 4. Variedades de uva
CREATE TABLE variedades_uva (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. Relación entre contratistas y trabajadores
-- Permite conservar el historial de asignaciones.
CREATE TABLE asignaciones (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contratista_id INT UNSIGNED NOT NULL,
    trabajador_id INT UNSIGNED NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE DEFAULT NULL,
    FOREIGN KEY (contratista_id) REFERENCES contratistas(id),
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
    INDEX idx_asignacion_trabajador (trabajador_id),
    INDEX idx_asignacion_contratista (contratista_id)
);

-- 6. Historial de precios por contratista y variedad
CREATE TABLE precios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contratista_id INT UNSIGNED NOT NULL,
    variedad_id INT UNSIGNED NOT NULL,
    precio DECIMAL(12,2) NOT NULL,
    vigencia_desde DATE NOT NULL,
    vigencia_hasta DATE DEFAULT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contratista_id) REFERENCES contratistas(id),
    FOREIGN KEY (variedad_id) REFERENCES variedades_uva(id),
    INDEX idx_precio_vigencia (
        contratista_id, variedad_id, vigencia_desde
    )
);

-- 7. Producción registrada por día
CREATE TABLE produccion (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trabajador_id INT UNSIGNED NOT NULL,
    contratista_id INT UNSIGNED NOT NULL,
    variedad_id INT UNSIGNED NOT NULL,
    fecha DATE NOT NULL,
    cantidad_gamelas INT UNSIGNED NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    creado_por INT UNSIGNED NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
    FOREIGN KEY (contratista_id) REFERENCES contratistas(id),
    FOREIGN KEY (variedad_id) REFERENCES variedades_uva(id),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id),
    INDEX idx_produccion_trabajador_fecha (
        trabajador_id, fecha
    ),
    INDEX idx_produccion_contratista_fecha (
        contratista_id, fecha
    )
);

-- 8. Aumentos y descuentos
CREATE TABLE ajustes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trabajador_id INT UNSIGNED NOT NULL,
    contratista_id INT UNSIGNED NOT NULL,
    tipo ENUM('aumento', 'descuento') NOT NULL,
    importe DECIMAL(12,2) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    creado_por INT UNSIGNED NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
    FOREIGN KEY (contratista_id) REFERENCES contratistas(id),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id),
    INDEX idx_ajuste_trabajador_fecha (
        trabajador_id, fecha
    )
);
