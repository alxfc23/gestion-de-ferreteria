require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ferreteria",
  connectionLimit: 10,
  charset: "utf8mb4",
  decimalNumbers: true
};

const SEED_PRODUCTOS = [
  { codigo: "FER-001", nombre: "Martillo de uña 16 oz", categoria: "Herramientas", costo: 95, precio: 160, stock: 35, stockMinimo: 10, icono: "🔨", unidad: "pz" },
  { codigo: "FER-002", nombre: "Taladro percutor 1/2\"", categoria: "Herramientas", costo: 580, precio: 899, stock: 8, stockMinimo: 5, icono: "🛠️", unidad: "pz" },
  { codigo: "FER-003", nombre: "Caja de tornillos 1\"", categoria: "Fijaciones", costo: 45, precio: 78, stock: 60, stockMinimo: 20, icono: "⚙️", unidad: "caja" },
  { codigo: "FER-004", nombre: "Clavos de acero 2\" (kg)", categoria: "Fijaciones", costo: 38, precio: 62, stock: 3, stockMinimo: 15, icono: "📌", unidad: "kg", precioMayoreo: 50, mayoreoMinimo: 5 },
  { codigo: "FER-005", nombre: "Cinta métrica 5m", categoria: "Medición", costo: 55, precio: 95, stock: 25, stockMinimo: 8, icono: "📏", unidad: "pz" },
  { codigo: "FER-006", nombre: "Serrucho para madera", categoria: "Herramientas", costo: 65, precio: 110, stock: 12, stockMinimo: 6, icono: "🪚", unidad: "pz" },
  { codigo: "FER-007", nombre: "Broca para concreto 1/4\"", categoria: "Fijaciones", costo: 28, precio: 52, stock: 40, stockMinimo: 10, icono: "🌀", unidad: "pz" },
  { codigo: "FER-008", nombre: "Pintura vinílica blanca 4L", categoria: "Pinturas", costo: 220, precio: 350, stock: 18, stockMinimo: 6, icono: "🪣", unidad: "l", precioMayoreo: 320, mayoreoMinimo: 4 },
  { codigo: "FER-009", nombre: "Desarmador plano 6\"", categoria: "Herramientas", costo: 42, precio: 75, stock: 30, stockMinimo: 10, icono: "🧰", unidad: "pz" },
  { codigo: "FER-010", nombre: "Candado de seguridad", categoria: "Cerrajería", costo: 88, precio: 145, stock: 22, stockMinimo: 8, icono: "🔒", unidad: "pz" },
  { codigo: "FER-011", nombre: "Nivel torpedo 25cm", categoria: "Medición", costo: 70, precio: 120, stock: 2, stockMinimo: 10, icono: "📐", unidad: "pz" },
  { codigo: "FER-012", nombre: "Guantes de trabajo (par)", categoria: "Protección", costo: 35, precio: 60, stock: 50, stockMinimo: 15, icono: "🧤", unidad: "par", precioMayoreo: 50, mayoreoMinimo: 12 }
];

const SEED_USUARIOS = [
  { nombre: "Administrador", correo: "admin@ferreteria.com", password: "admin123", rol: "admin" },
  { nombre: "Vendedor", correo: "vendedor@ferreteria.com", password: "vendedor123", rol: "vendedor" }
];

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function semillaVentas() {
  const ventas = [];
  const vendedor = "Administrador";
  for (let i = 6; i >= 0; i--) {
    const base = diasAtras(i);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const fecha = new Date(base);
      fecha.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      const cantidad = 1 + Math.floor(Math.random() * 3);
      const p = SEED_PRODUCTOS[Math.floor(Math.random() * SEED_PRODUCTOS.length)];
      const subtotal = p.precio * cantidad;
      const iva = Math.round(subtotal * 0.16 * 100) / 100;
      ventas.push({
        id: "vseed" + i + "-" + j,
        folio: "V-" + String(1000 + i * 10 + j),
        fecha: fecha.toISOString(),
        subtotal,
        iva,
        total: Math.round((subtotal + iva) * 100) / 100,
        vendedor,
        items: [{ productoId: "pseed-" + (i % SEED_PRODUCTOS.length), nombre: p.nombre, precio: p.precio, cantidad }]
      });
    }
  }
  return ventas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

const pool = mysql.createPool(config);

async function encriptar(password) {
  return bcrypt.hash(String(password), 10);
}

async function asegurarColumna(conn, tabla, columna, definicion) {
  const [cols] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [tabla, columna]
  );
  if (!cols.length) {
    await conn.query("ALTER TABLE " + tabla + " ADD COLUMN " + columna + " " + definicion);
    console.log("Migración: columna " + tabla + "." + columna + " agregada.");
  }
}

async function crearBase() {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });
  const nombre = config.database.replace(/`/g, "");
  await conn.query(
    "CREATE DATABASE IF NOT EXISTS `" + nombre + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  );
  await conn.end();
}

async function inicializar() {
  await crearBase();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id VARCHAR(64) PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      correo VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      rol VARCHAR(20) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id VARCHAR(64) PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL,
      costo DECIMAL(12,2) NOT NULL DEFAULT 0,
      precio DECIMAL(12,2) NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      stockMinimo INT NOT NULL DEFAULT 0,
      icono VARCHAR(10) NOT NULL DEFAULT '📦',
      unidad VARCHAR(30) NOT NULL DEFAULT 'pz',
      precioMayoreo DECIMAL(12,2) NOT NULL DEFAULT 0,
      mayoreoMinimo INT NOT NULL DEFAULT 0,
      imagen MEDIUMTEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await asegurarColumna(pool, "productos", "unidad", "VARCHAR(30) NOT NULL DEFAULT 'pz'");
  await asegurarColumna(pool, "productos", "precioMayoreo", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await asegurarColumna(pool, "productos", "mayoreoMinimo", "INT NOT NULL DEFAULT 0");
  await asegurarColumna(pool, "productos", "imagen", "MEDIUMTEXT NULL");
  await asegurarColumna(pool, "ventas", "metodoPago", "VARCHAR(30) NOT NULL DEFAULT 'efectivo'");
  await asegurarColumna(pool, "ventas", "comision", "DECIMAL(12,2) NOT NULL DEFAULT 0");

  const unidadesLegacy = {
    "FER-003": ["caja", 0, 0],
    "FER-004": ["kg", 50, 5],
    "FER-005": ["m", 0, 0],
    "FER-008": ["l", 320, 4],
    "FER-012": ["par", 50, 12]
  };
  for (const [codigo, [unidad, precioMayoreo, mayoreoMinimo]] of Object.entries(unidadesLegacy)) {
    await pool.query(
      "UPDATE productos SET unidad = ?, precioMayoreo = ?, mayoreoMinimo = ? WHERE codigo = ? AND unidad = 'pz'",
      [unidad, precioMayoreo, mayoreoMinimo, codigo]
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ventas (
      id VARCHAR(64) PRIMARY KEY,
      folio VARCHAR(40) NOT NULL UNIQUE,
      fecha VARCHAR(40) NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      iva DECIMAL(12,2) NOT NULL,
      total DECIMAL(12,2) NOT NULL,
      vendedor VARCHAR(100) NOT NULL,
      metodoPago VARCHAR(30) NOT NULL DEFAULT 'efectivo'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS venta_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      venta_id VARCHAR(64) NOT NULL,
      producto_id VARCHAR(64) NULL,
      nombre VARCHAR(150) NOT NULL,
      precio DECIMAL(12,2) NOT NULL,
      cantidad INT NOT NULL,
      KEY idx_venta_id (venta_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave VARCHAR(50) PRIMARY KEY,
      valor VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(
    "INSERT IGNORE INTO configuracion (clave, valor) VALUES ('comision_tarjeta', '0')"
  );

  await pool.query(
    "INSERT IGNORE INTO configuracion (clave, valor) VALUES ('ocultar_montos', '0')"
  );

  await pool.query("DELETE FROM configuracion WHERE clave = 'comision_efectivo'");

  const [todos] = await pool.query("SELECT id, password FROM usuarios");
  for (const u of todos) {
    if (!String(u.password).startsWith("$2")) {
      const hash = await encriptar(u.password);
      await pool.query("UPDATE usuarios SET password = ? WHERE id = ?", [hash, u.id]);
    }
  }

  const [filas] = await pool.query("SELECT COUNT(*) AS c FROM usuarios");
  if (filas[0].c > 0) return;

  const passwords = [];
  for (const u of SEED_USUARIOS) passwords.push(await encriptar(u.password));

  await pool.query("INSERT INTO usuarios (id, nombre, correo, password, rol) VALUES ?", [
    SEED_USUARIOS.map((u, i) => ["u" + i, u.nombre, u.correo, passwords[i], u.rol])
  ]);

  await pool.query("INSERT INTO productos (id, codigo, nombre, categoria, costo, precio, stock, stockMinimo, icono, unidad, precioMayoreo, mayoreoMinimo) VALUES ?", [
    SEED_PRODUCTOS.map((p, i) => [
      "pseed-" + i,
      p.codigo,
      p.nombre,
      p.categoria,
      p.costo,
      p.precio,
      p.stock,
      p.stockMinimo,
      p.icono,
      p.unidad || "pz",
      p.precioMayoreo || 0,
      p.mayoreoMinimo || 0
    ])
  ]);

  const ventas = semillaVentas();
  for (const v of ventas) {
    await pool.query(
      "INSERT INTO ventas (id, folio, fecha, subtotal, iva, total, vendedor) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [v.id, v.folio, v.fecha, v.subtotal, v.iva, v.total, v.vendedor]
    );
    await pool.query(
      "INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)",
      [v.id, v.items[0].productoId, v.items[0].nombre, v.items[0].precio, v.items[0].cantidad]
    );
  }
}

module.exports = { pool, inicializar };

if (require.main === module) {
  inicializar()
    .then(() => {
      console.log("Base de datos lista: " + config.database);
      process.exit(0);
    })
    .catch((e) => {
      console.error("Error al inicializar la base:", e.message);
      process.exit(1);
    });
}