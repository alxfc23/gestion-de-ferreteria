const SESION_KEY = "ferreteria_sesion_v1";
const TOKEN_KEY = "ferreteria_token_v1";
const API_URL = "http://localhost:3001";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function moneda(n) {
  return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diaClave(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return dt.getFullYear() + "-" + mm + "-" + dd;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

const ICONOS = {
  dinero:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  carrito:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
  bolsa:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  alerta:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  usuarios:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  ok:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  vacio:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  buscar:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  tendencia:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  ojo:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  "ojo-off":
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
};

function icono(nombre) {
  return ICONOS[nombre] || "";
}

function estadoVacioHTML(nombreIcono, titulo, texto) {
  return (
    `<span class="empty-ico">${icono(nombreIcono)}</span>` +
    `<strong>${esc(titulo)}</strong>` +
    (texto ? "<p>" + esc(texto) + "</p>" : "")
  );
}

function estadoVacio(nombreIcono, titulo, texto) {
  return `<div class="empty">${estadoVacioHTML(nombreIcono, titulo, texto)}</div>`;
}

function chipCategoria(nombre) {
  const s = String(nombre || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `<span class="cat-chip" style="--cat-h:${h}">${esc(s)}</span>`;
}

function colorAvatar(nombre) {
  const s = String(nombre || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return "linear-gradient(135deg, hsl(" + h + ", 62%, 46%), hsl(" + ((h + 35) % 360) + ", 62%, 38%))";
}

function descargarCSV(nombreArchivo, filas) {
  const celda = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const texto = filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function apiFetch(ruta, opciones = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const cabeceras = Object.assign(
    {},
    opciones.headers,
    token ? { Authorization: "Bearer " + token } : {}
  );
  let respuesta;
  try {
    respuesta = await fetch(API_URL + ruta, { ...opciones, headers: cabeceras });
  } catch {
    throw new Error(
      "Sin conexión con la base de datos local. Inicia el servidor: cd backend && npm start"
    );
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401) {
    Store.cerrarSesion();
    window.dispatchEvent(new CustomEvent("sesion-expirada"));
    throw new Error(datos.error || "Sesión expirada. Inicia sesión de nuevo.");
  }
  if (!respuesta.ok || datos.ok === false) {
    throw new Error(datos.error || "Error del servidor (" + respuesta.status + ")");
  }
  return datos;
}

function apiJson(metodo, cuerpo) {
  return {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo)
  };
}

const Store = {
  bd: { productos: [], usuarios: [], ventas: [], configuracion: {} },

  async cargarDatos() {
    this.bd = await apiFetch("/api/datos");
    return this.bd;
  },

  async iniciarSesion(correo, password) {
    return await apiFetch("/api/login", apiJson("POST", { correo, password }));
  },

  async guardarProducto(producto, esNuevo) {
    const ruta = esNuevo
      ? "/api/productos"
      : "/api/productos/" + encodeURIComponent(producto.id);
    const r = await apiFetch(ruta, apiJson(esNuevo ? "POST" : "PUT", producto));
    return r.producto;
  },

  async eliminarProducto(id) {
    await apiFetch("/api/productos/" + encodeURIComponent(id), { method: "DELETE" });
  },

  async crearUsuario(usuario) {
    const r = await apiFetch("/api/usuarios", apiJson("POST", usuario));
    return r.usuario;
  },

  async eliminarUsuario(id) {
    await apiFetch("/api/usuarios/" + encodeURIComponent(id), { method: "DELETE" });
  },

  async registrarVenta(venta) {
    const r = await apiFetch("/api/ventas", apiJson("POST", venta));
    return r.venta;
  },

  async guardarConfiguracion(configuracion) {
    const r = await apiFetch("/api/configuracion", apiJson("PUT", configuracion));
    return r.configuracion;
  },

  async cancelarVenta(id) {
    await apiFetch("/api/ventas/" + encodeURIComponent(id) + "/cancelar", { method: "POST" });
  },

  async buscarVentas(filtros = {}) {
    const p = new URLSearchParams();
    if (filtros.desde) p.set("desde", filtros.desde);
    if (filtros.hasta) p.set("hasta", filtros.hasta);
    if (filtros.vendedor) p.set("vendedor", filtros.vendedor);
    if (filtros.metodoPago) p.set("metodoPago", filtros.metodoPago);
    const q = p.toString();
    const r = await apiFetch("/api/ventas" + (q ? "?" + q : ""));
    return r.ventas;
  },

  getSesion() {
    const raw = localStorage.getItem(SESION_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setSesion(s) {
    localStorage.setItem(SESION_KEY, JSON.stringify(s));
  },

  setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  },

  cerrarSesion() {
    localStorage.removeItem(SESION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
};