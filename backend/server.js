require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, inicializar } = require("./db");

inicializar()
  .then(() => {
    iniciarServidor();
  })
  .catch((e) => {
    console.error("No se pudo conectar a MariaDB:", e.message);
    console.error("Revisa backend/.env y que el servicio MariaDB esté corriendo.");
    process.exit(1);
  });

const nuevoId = (prefijo) => prefijo + crypto.randomUUID();

const UNIDADES_VALIDAS = ["pz", "kg", "g", "m", "cm", "l", "ml", "caja", "paquete", "par", "rollo", "juego"];
const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia"];
const CONFIG_NUMERICAS = ["comision_tarjeta"];
const CONFIG_BOOLEANAS = ["ocultar_montos"];

const IMAGEN_MAX = 1500000;

function validarImagen(valor) {
  const img = typeof valor === "string" ? valor.trim() : "";
  if (!img) return "";
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(img)) return null;
  if (img.length > IMAGEN_MAX) return "grande";
  return img;
}

const SECRETO = process.env.JWT_SECRET || "ferreteria-secreto-local";
const TOKEN_VIGENCIA = "12h";

function firmarToken(u) {
  return jwt.sign({ id: u.id, nombre: u.nombre, rol: u.rol }, SECRETO, { expiresIn: TOKEN_VIGENCIA });
}

function autenticar(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  if (!token) {
    return res.status(401).json({ ok: false, error: "No autorizado. Inicia sesión." });
  }
  try {
    req.usuario = jwt.verify(token, SECRETO);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Sesión inválida o expirada." });
  }
}

function requiereAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== "admin") {
    return res.status(403).json({ ok: false, error: "Requiere permisos de administrador." });
  }
  next();
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

const ah = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(500).json({ ok: false, error: "Error interno del servidor." });
  });
};

function iniciarServidor() {
  const app = express();
app.use(cors());
app.use(express.json({ limit: "6mb" }));

  async function productosTodas() {
    const [filas] = await pool.query("SELECT * FROM productos ORDER BY nombre");
    return filas;
  }

  async function usuariosTodas() {
    const [filas] = await pool.query("SELECT id, nombre, correo, rol FROM usuarios ORDER BY nombre");
    return filas;
  }

  async function ventasConItems(filas) {
    if (!filas.length) return [];
    const ids = filas.map((v) => v.id);
    const [items] = await pool.query(
      "SELECT * FROM venta_items WHERE venta_id IN (?) ORDER BY id",
      [ids]
    );
    return filas.map((v) => ({
      ...v,
      items: items.filter((i) => i.venta_id === v.id)
    }));
  }

  async function ventasTodas() {
    const [filas] = await pool.query("SELECT * FROM ventas ORDER BY fecha DESC, folio DESC");
    return ventasConItems(filas);
  }

  async function leerConfiguracion() {
    const [filas] = await pool.query("SELECT clave, valor FROM configuracion");
    const cfg = {};
    for (const f of filas) cfg[f.clave] = f.valor;
    for (const k of CONFIG_NUMERICAS) {
      const n = Number(cfg[k]);
      cfg[k] = Number.isFinite(n) ? n : 0;
    }
    for (const k of CONFIG_BOOLEANAS) {
      cfg[k] = cfg[k] === "1" || cfg[k] === "true";
    }
    return cfg;
  }

  async function siguienteFolio(fecha) {
    const d = new Date(fecha);
    const prefijo =
      "V-" +
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") +
      "-";
    const [filas] = await pool.query(
      "SELECT folio FROM ventas WHERE folio LIKE ? ORDER BY folio DESC LIMIT 1",
      [prefijo + "%"]
    );
    let n = 1;
    if (filas[0]) {
      const ultimo = parseInt(String(filas[0].folio).slice(prefijo.length), 10);
      if (Number.isFinite(ultimo)) n = ultimo + 1;
    }
    return prefijo + String(n).padStart(3, "0");
  }

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/login",
    ah(async (req, res) => {
      const { correo = "", password = "" } = req.body || {};
      const [filas] = await pool.query(
        "SELECT * FROM usuarios WHERE LOWER(correo) = LOWER(?)",
        [String(correo)]
      );
      const u = filas[0];
      const coincide = u ? await bcrypt.compare(String(password), String(u.password)) : false;
      if (!u || !coincide) {
        return res.status(401).json({ ok: false, error: "Correo o contraseña incorrectos." });
      }
      res.json({
        ok: true,
        token: firmarToken(u),
        usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol }
      });
    })
  );

  app.get(
    "/api/datos",
    autenticar,
    ah(async (req, res) => {
      const [productos, usuarios, ventas] = await Promise.all([
        productosTodas(),
        usuariosTodas(),
        ventasTodas()
      ]);
      const configuracion = await leerConfiguracion();
      res.json({
        productos,
        usuarios: req.usuario.rol === "admin" ? usuarios : [],
        ventas,
        configuracion
      });
    })
  );

  app.get(
    "/api/configuracion",
    autenticar,
    ah(async (req, res) => {
      res.json({ ok: true, configuracion: await leerConfiguracion() });
    })
  );

  app.put(
    "/api/configuracion",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      const cuerpo = req.body || {};
      const configuracion = await leerConfiguracion();
      for (const clave of CONFIG_NUMERICAS) {
        if (cuerpo[clave] === undefined) continue;
        const n = Number(cuerpo[clave]);
        if (!Number.isFinite(n)) {
          return res.status(400).json({ ok: false, error: "Valor inválido para " + clave + "." });
        }
        const valor = Math.max(0, Math.min(100, n));
        await pool.query(
          "INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
          [clave, String(valor)]
        );
        configuracion[clave] = valor;
      }
      for (const clave of CONFIG_BOOLEANAS) {
        if (cuerpo[clave] === undefined) continue;
        const valor = cuerpo[clave] === true || cuerpo[clave] === "true" || cuerpo[clave] === 1 || cuerpo[clave] === "1";
        await pool.query(
          "INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
          [clave, valor ? "1" : "0"]
        );
        configuracion[clave] = valor;
      }
      res.json({ ok: true, configuracion });
    })
  );

  app.post(
    "/api/productos",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      const p = req.body || {};
      const codigo = String(p.codigo || "").trim().toUpperCase();
      const nombre = String(p.nombre || "").trim();
      if (!codigo || !nombre) {
        return res.status(400).json({ ok: false, error: "Nombre y código son obligatorios." });
      }
      const [dup] = await pool.query("SELECT id FROM productos WHERE codigo = ?", [codigo]);
      if (dup.length) {
        return res.status(400).json({ ok: false, error: "Ya existe un producto con ese código." });
      }
      const imagen = validarImagen(p.imagen);
      if (imagen === null) {
        return res.status(400).json({ ok: false, error: "La imagen no es un archivo válido." });
      }
      if (imagen === "grande") {
        return res.status(400).json({ ok: false, error: "La imagen es demasiado grande (máximo 1 MB)." });
      }
      const prod = {
        id: nuevoId("p"),
        codigo,
        nombre,
        categoria: p.categoria || "Herramientas",
        costo: Number(p.costo) || 0,
        precio: Number(p.precio) || 0,
        stock: Number(p.stock) || 0,
        stockMinimo: Number(p.stockMinimo) || 0,
        icono: p.icono || "📦",
        unidad: UNIDADES_VALIDAS.includes(String(p.unidad || "")) ? String(p.unidad) : "pz",
        precioMayoreo: Number(p.precioMayoreo) || 0,
        mayoreoMinimo: Math.max(0, Math.floor(Number(p.mayoreoMinimo)) || 0),
        imagen
      };
      await pool.query(
        "INSERT INTO productos (id, codigo, nombre, categoria, costo, precio, stock, stockMinimo, icono, unidad, precioMayoreo, mayoreoMinimo, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [prod.id, prod.codigo, prod.nombre, prod.categoria, prod.costo, prod.precio, prod.stock, prod.stockMinimo, prod.icono, prod.unidad, prod.precioMayoreo, prod.mayoreoMinimo, prod.imagen]
      );
      res.json({ ok: true, producto: prod });
    })
  );

  app.put(
    "/api/productos/:id",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      const p = req.body || {};
      const [existentes] = await pool.query("SELECT * FROM productos WHERE id = ?", [String(req.params.id)]);
      const existente = existentes[0];
      if (!existente) {
        return res.status(404).json({ ok: false, error: "Producto no encontrado." });
      }
      const codigo = String(p.codigo || "").trim().toUpperCase();
      const nombre = String(p.nombre || "").trim();
      if (!codigo || !nombre) {
        return res.status(400).json({ ok: false, error: "Nombre y código son obligatorios." });
      }
      const [dup] = await pool.query("SELECT id FROM productos WHERE codigo = ? AND id <> ?", [codigo, existente.id]);
      if (dup.length) {
        return res.status(400).json({ ok: false, error: "Ya existe un producto con ese código." });
      }
      const imagen = validarImagen(p.imagen === undefined ? existente.imagen : p.imagen);
      if (imagen === null) {
        return res.status(400).json({ ok: false, error: "La imagen no es un archivo válido." });
      }
      if (imagen === "grande") {
        return res.status(400).json({ ok: false, error: "La imagen es demasiado grande (máximo 1 MB)." });
      }
      const prod = {
        codigo,
        nombre,
        categoria: p.categoria || existente.categoria,
        costo: Number(p.costo) || 0,
        precio: Number(p.precio) || 0,
        stock: Number(p.stock) || 0,
        stockMinimo: Number(p.stockMinimo) || 0,
        icono: p.icono || existente.icono,
        unidad: UNIDADES_VALIDAS.includes(String(p.unidad || ""))
          ? String(p.unidad)
          : existente.unidad || "pz",
        precioMayoreo: Number(p.precioMayoreo) || 0,
        mayoreoMinimo: Math.max(0, Math.floor(Number(p.mayoreoMinimo)) || 0),
        imagen: imagen || ""
      };
      await pool.query(
        "UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, costo = ?, precio = ?, stock = ?, stockMinimo = ?, icono = ?, unidad = ?, precioMayoreo = ?, mayoreoMinimo = ?, imagen = ? WHERE id = ?",
        [prod.codigo, prod.nombre, prod.categoria, prod.costo, prod.precio, prod.stock, prod.stockMinimo, prod.icono, prod.unidad, prod.precioMayoreo, prod.mayoreoMinimo, prod.imagen, existente.id]
      );
      res.json({ ok: true, producto: { ...existente, ...prod } });
    })
  );

  app.delete(
    "/api/productos/:id",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      await pool.query("DELETE FROM productos WHERE id = ?", [String(req.params.id)]);
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/usuarios",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      const u = req.body || {};
      const nombre = String(u.nombre || "").trim();
      const correo = String(u.correo || "").trim();
      const password = String(u.password || "");
      if (!nombre || !correo || !password) {
        return res.status(400).json({ ok: false, error: "Todos los campos son obligatorios." });
      }
      const [dup] = await pool.query("SELECT id FROM usuarios WHERE LOWER(correo) = LOWER(?)", [correo]);
      if (dup.length) {
        return res.status(400).json({ ok: false, error: "Ya existe un usuario con ese correo." });
      }
      const usuario = {
        id: nuevoId("u"),
        nombre,
        correo,
        rol: u.rol === "admin" ? "admin" : "vendedor"
      };
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO usuarios (id, nombre, correo, password, rol) VALUES (?, ?, ?, ?, ?)",
        [usuario.id, usuario.nombre, usuario.correo, hash, usuario.rol]
      );
      res.json({ ok: true, usuario });
    })
  );

  app.delete(
    "/api/usuarios/:id",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      const id = String(req.params.id);
      const [objetivos] = await pool.query("SELECT * FROM usuarios WHERE id = ?", [id]);
      const objetivo = objetivos[0];
      if (!objetivo) {
        return res.status(404).json({ ok: false, error: "Usuario no encontrado." });
      }
      if (objetivo.rol === "admin") {
        const [adm] = await pool.query("SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'admin'");
        if (adm[0].c <= 1) {
          return res.status(400).json({ ok: false, error: "Debe quedar al menos un administrador." });
        }
      }
      await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
      res.json({ ok: true });
    })
  );

  app.get(
    "/api/ventas",
    autenticar,
    ah(async (req, res) => {
      const where = [];
      const params = [];
      const desde = String(req.query.desde || "");
      const hasta = String(req.query.hasta || "");
      const vendedor = String(req.query.vendedor || "");
      const metodoPago = String(req.query.metodoPago || "");

      if (/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
        const d = new Date(desde + "T00:00:00");
        where.push("fecha >= ?");
        params.push(d.toISOString());
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
        const h = new Date(hasta + "T23:59:59.999");
        where.push("fecha <= ?");
        params.push(h.toISOString());
      }
      if (vendedor) {
        where.push("vendedor = ?");
        params.push(vendedor);
      }
      if (METODOS_PAGO.includes(metodoPago)) {
        where.push("metodoPago = ?");
        params.push(metodoPago);
      }

      const sql =
        "SELECT * FROM ventas" +
        (where.length ? " WHERE " + where.join(" AND ") : "") +
        " ORDER BY fecha DESC, folio DESC";
      const [filas] = await pool.query(sql, params);
      const ventas = await ventasConItems(filas);
      res.json({ ok: true, ventas });
    })
  );

  app.post(
    "/api/ventas",
    autenticar,
    ah(async (req, res) => {
      const v = req.body || {};
      const items = Array.isArray(v.items) ? v.items : [];
      if (!items.length) {
        return res.status(400).json({ ok: false, error: "El ticket está vacío." });
      }

      const id = nuevoId("v");
      const fecha = new Date().toISOString();
      const folio = await siguienteFolio(fecha);
      const vendedor = req.usuario.nombre;
      const metodoPago = METODOS_PAGO.includes(String(v.metodoPago || ""))
        ? String(v.metodoPago)
        : "efectivo";

      const conn = await pool.getConnection();
      const ventaItems = [];
      const configuracion = await leerConfiguracion();
      let subtotal = 0;
      let iva = 0;
      let comision = 0;
      let total = 0;
      try {
        await conn.beginTransaction();
        for (const i of items) {
          const productoId = String(i.productoId || "");
          const cantidad = Number(i.cantidad);
          if (!productoId) {
            throw new Error("Cada artículo del ticket necesita un producto.");
          }
          if (!Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error("La cantidad de cada artículo debe ser un entero mayor a cero.");
          }
          const [filas] = await conn.query(
            "SELECT id, nombre, precio, precioMayoreo, mayoreoMinimo, stock FROM productos WHERE id = ? FOR UPDATE",
            [productoId]
          );
          const p = filas[0];
          if (!p) throw new Error("Producto no encontrado en el inventario.");
          if (p.stock < cantidad) {
            throw new Error("Stock insuficiente para " + p.nombre + " (disponible: " + p.stock + ").");
          }
          const precioBase = Number(p.precio);
          const precioMay = Number(p.precioMayoreo) || 0;
          const minimo = Number(p.mayoreoMinimo) || 0;
          const precio = precioMay > 0 && minimo > 0 && cantidad >= minimo ? precioMay : precioBase;
          subtotal = redondear(subtotal + precio * cantidad);
          ventaItems.push({ productoId: p.id, nombre: p.nombre, precio, cantidad });
          await conn.query(
            "INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)",
            [id, p.id, p.nombre, precio, cantidad]
          );
          await conn.query("UPDATE productos SET stock = stock - ? WHERE id = ?", [cantidad, p.id]);
        }
        iva = 0;
        if (metodoPago === "tarjeta") {
          const pct = Math.max(0, Math.min(100, Number(configuracion.comision_tarjeta) || 0));
          if (pct > 0) comision = redondear(subtotal * pct / 100);
        }
        total = redondear(subtotal + comision);
        await conn.query(
          "INSERT INTO ventas (id, folio, fecha, subtotal, iva, comision, total, vendedor, metodoPago) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, folio, fecha, subtotal, iva, comision, total, vendedor, metodoPago]
        );
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: e.message || "No se pudo registrar la venta." });
      } finally {
        conn.release();
      }

      res.json({
        ok: true,
        venta: { id, folio, fecha, subtotal, iva, comision, total, vendedor, metodoPago, items: ventaItems }
      });
    })
  );

  app.post(
    "/api/ventas/:id/cancelar",
    autenticar,
    requiereAdmin,
    ah(async (req, res) => {
      const id = String(req.params.id);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [filas] = await conn.query("SELECT * FROM ventas WHERE id = ? FOR UPDATE", [id]);
        const venta = filas[0];
        if (!venta) {
          await conn.rollback();
          return res.status(404).json({ ok: false, error: "Venta no encontrada." });
        }
        const [items] = await conn.query("SELECT * FROM venta_items WHERE venta_id = ?", [id]);
        for (const it of items) {
          if (it.producto_id) {
            await conn.query(
              "UPDATE productos SET stock = stock + ? WHERE id = ?",
              [it.cantidad, it.producto_id]
            );
          }
        }
        await conn.query("DELETE FROM venta_items WHERE venta_id = ?", [id]);
        await conn.query("DELETE FROM ventas WHERE id = ?", [id]);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      res.json({ ok: true });
    })
  );

  app.use(express.static(path.join(__dirname, "..")));

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log("Gestión de Ferretería · servidor en http://localhost:" + PORT);
    console.log("Base: MariaDB · " + process.env.DB_NAME + " en " + process.env.DB_HOST + ":" + process.env.DB_PORT);
  });
}

module.exports = { redondear };