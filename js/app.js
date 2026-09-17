const App = {
  sesion: null,

  async init() {
    Login.init();
    Categorias.llenarSelect();
    this.enlazarNavegacion();
    this.enlazarEventos();

    window.addEventListener("sesion-expirada", () => {
      this.mostrarLogin();
      this.mostrarToast("Tu sesión expiró. Inicia sesión de nuevo.", "error");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.cerrarModal();
    });

    const sesion = Store.getSesion();
    if (sesion) {
      try {
        await Store.cargarDatos();
        this.mostrarApp(sesion);
      } catch {
        Store.cerrarSesion();
        this.mostrarLogin();
      }
    } else {
      this.mostrarLogin();
    }
  },

  mostrarLogin() {
    document.getElementById("vista-login").classList.remove("hidden");
    document.getElementById("vista-app").classList.add("hidden");
  },

  mostrarApp(sesion) {
    this.sesion = { ...sesion, userId: sesion.userId || sesion.id };
    document.getElementById("vista-login").classList.add("hidden");
    document.getElementById("vista-app").classList.remove("hidden");
    document.getElementById("user-nombre").textContent = sesion.nombre;
    document.getElementById("user-rol").textContent = sesion.rol;
    const avatar = document.getElementById("user-avatar-inicial");
    avatar.textContent = sesion.nombre.charAt(0).toUpperCase();
    avatar.style.background = colorAvatar(sesion.nombre);
    document.getElementById("fecha-hoy").textContent = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    document
      .querySelector('[data-accion="usuarios"]')
      .classList.toggle("hidden", sesion.rol !== "admin");
    document
      .querySelector('[data-accion="configuracion"]')
      .classList.toggle("hidden", sesion.rol !== "admin");
    document
      .getElementById("btn-nuevo-producto")
      .classList.toggle("hidden", sesion.rol !== "admin");
    this.actualizarBadgeStock();
    this.irA("inicio");
    Estadisticas.aplicarMontosInicial();
  },

  enlazarNavegacion() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const accion = btn.dataset.accion;
        if ((accion === "usuarios" || accion === "configuracion") && this.sesion && this.sesion.rol !== "admin") return;
        this.irA(accion);
      });
    });
  },

  async irA(accion) {
    try {
      await Store.cargarDatos();
    } catch (e) {
      document.getElementById("titulo-seccion").textContent = "Sin conexión";
      this.mostrarToast(e.message, "error");
      return;
    }
    const titulos = {
      inicio: "Inicio",
      ventas: "Caja / Ventas",
      productos: "Productos",
      historial: "Historial de ventas",
      usuarios: "Usuarios",
      configuracion: "Configuración"
    };
    document.getElementById("titulo-seccion").textContent = titulos[accion] || accion;
    document.title = (titulos[accion] || accion) + " · Gestión de Ferretería";
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.accion === accion);
    });
    document.querySelectorAll(".vista").forEach((v) => v.classList.remove("active"));
    document.getElementById("vista-" + accion).classList.add("active");
    this.actualizarBadgeStock();

    if (accion === "inicio") Estadisticas.render();
    if (accion === "ventas") {
      Caja.actualizarLista();
      Caja.renderCarrito();
      Caja.enfocarBusqueda();
    }
    if (accion === "productos") Inventario.render();
    if (accion === "historial") {
      Historial.llenarVendedores();
      Historial.render();
    }
    if (accion === "usuarios") this.renderUsuarios();
    if (accion === "configuracion") Configuracion.render();
  },

  enlazarEventos() {
    const selectorOtro = document.getElementById("rango-otro");
    document.querySelectorAll("[data-periodo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        Estadisticas.periodo = btn.dataset.periodo;
        document
          .querySelectorAll("[data-periodo]")
          .forEach((b) => b.classList.toggle("active", b === btn));
        if (selectorOtro) selectorOtro.classList.toggle("hidden", btn.dataset.periodo !== "otro");
        Estadisticas.render();
      });
    });

    const rangoDesde = document.getElementById("rango-desde");
    const rangoHasta = document.getElementById("rango-hasta");
    if (rangoDesde) {
      rangoDesde.addEventListener("change", () => {
        Estadisticas.periodo = "otro";
        Estadisticas.desde = rangoDesde.value;
        Estadisticas.render();
      });
    }
    if (rangoHasta) {
      rangoHasta.addEventListener("change", () => {
        Estadisticas.periodo = "otro";
        Estadisticas.hasta = rangoHasta.value;
        Estadisticas.render();
      });
    }

    document.getElementById("btn-salir").addEventListener("click", () => Login.salir());

    document.getElementById("btn-nuevo-producto").addEventListener("click", () => {
      if (!this.esAdmin()) return;
      Inventario.abrirModal(null);
    });

    document.getElementById("btn-exportar-productos").addEventListener("click", () => {
      Inventario.abrirModalExportar();
    });

    const btnDinero = document.getElementById("btn-ocultar-dinero");
    btnDinero.innerHTML = icono("ojo") + "<span>Ocultar montos</span>";
    btnDinero.addEventListener("click", () => Estadisticas.alternarDinero());

    document.getElementById("buscar-producto").addEventListener("input", (e) => {
      Inventario.buscarTexto = e.target.value;
      Inventario.render();
    });

    document.getElementById("filtro-categoria").addEventListener("change", (e) => {
      Inventario.categoria = e.target.value;
      Inventario.render();
    });

    this.delegarClicks(document.getElementById("productos-body"), async (btn) => {
      const accion = btn.dataset.accion;
      const id = btn.dataset.id;
      if (accion === "ver-imagen") {
        this.verImagen(btn.src, btn.dataset.nombre);
        return;
      }
      if (accion === "editar") {
        if (!this.esAdmin()) return;
        await Store.cargarDatos();
        Inventario.abrirModal(id);
      }
      if (accion === "eliminar") {
        if (!this.esAdmin()) return;
        if (confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) {
          try {
            await Inventario.eliminar(id);
            Caja.actualizarLista();
            Estadisticas.render();
            Inventario.render();
            App.mostrarToast("Producto eliminado.", "success");
          } catch (e) {
            App.mostrarToast(e.message, "error");
          }
        }
      }
    });

    this.delegarClicks(document.getElementById("carrito-body"), (btn) => {
      const fila = btn.closest("tr");
      const id = fila.dataset.productoId;
      if (btn.dataset.accion === "ver-imagen") {
        this.verImagen(btn.src, btn.dataset.nombre);
        return;
      }
      if (btn.dataset.accion === "sumar") Caja.agregar(id);
      if (btn.dataset.accion === "restar") Caja.restar(id);
      if (btn.dataset.accion === "quitar") Caja.quitar(id);
    });

    const buscadorVenta = document.getElementById("buscar-producto-venta");
    buscadorVenta.addEventListener("input", () => Caja.actualizarLista());
    buscadorVenta.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const producto = Caja.buscarPorCodigo(e.target.value);
      if (producto) {
        e.target.value = "";
        Caja.agregar(producto.id);
        Caja.actualizarLista();
        e.target.classList.add("busqueda-ok");
        setTimeout(() => e.target.classList.remove("busqueda-ok"), 600);
      } else if (e.target.value.trim()) {
        App.mostrarToast("No se encontró el producto con ese código.", "error");
      }
    });
    document.querySelectorAll("#metodo-pago .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        Caja.metodoPago = btn.dataset.metodo;
        document
          .querySelectorAll("#metodo-pago .seg-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        Caja.calcularTotales();
      });
    });
    document.getElementById("btn-cobrar").addEventListener("click", () => Caja.cobrar());
    document.getElementById("btn-guardar-configuracion").addEventListener("click", () => Configuracion.guardar());

    this.delegarClicks(document.getElementById("ventas-body"), (btn) => {
      if (btn.dataset.accion === "detalle") Historial.verDetalle(btn.dataset.id);
      if (btn.dataset.accion === "cancelar-venta") this.cancelarVenta(btn.dataset.id);
    });

    document.getElementById("filtro-desde").addEventListener("change", (e) => {
      Historial.desde = e.target.value;
      Historial.render();
    });
    document.getElementById("filtro-hasta").addEventListener("change", (e) => {
      Historial.hasta = e.target.value;
      Historial.render();
    });
    document.getElementById("filtro-vendedor").addEventListener("change", (e) => {
      Historial.vendedor = e.target.value;
      Historial.render();
    });
    document.getElementById("filtro-metodo").addEventListener("change", (e) => {
      Historial.metodoPago = e.target.value;
      Historial.render();
    });
    document.getElementById("btn-exportar-ventas").addEventListener("click", () => {
      Historial.exportarCSV();
    });
    document.getElementById("btn-corte-caja").addEventListener("click", () => {
      Historial.corte();
    });
    document.getElementById("btn-limpiar-filtros").addEventListener("click", () => {
      document.getElementById("filtro-desde").value = "";
      document.getElementById("filtro-hasta").value = "";
      document.getElementById("filtro-vendedor").value = "";
      document.getElementById("filtro-metodo").value = "";
      Historial.desde = "";
      Historial.hasta = "";
      Historial.vendedor = "";
      Historial.metodoPago = "";
      Historial.render();
    });

    document.getElementById("btn-nuevo-usuario").addEventListener("click", () => this.abrirModalUsuario());
    this.delegarClicks(document.getElementById("usuarios-body"), (btn) => {
      if (btn.dataset.accion === "eliminar-usuario") this.eliminarUsuario(btn.dataset.id);
    });
  },

  delegarClicks(contenedor, handler) {
    contenedor.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-accion]");
      if (!btn) return;
      e.stopPropagation();
      handler(btn);
    });
  },

  esAdmin() {
    if (this.sesion && this.sesion.rol === "admin") return true;
    this.mostrarToast("Solo el administrador puede hacer esta acción.", "error");
    return false;
  },

  actualizarBadgeStock() {
    const badge = document.getElementById("badge-stock");
    if (!badge) return;
    const productos = (Store.bd && Store.bd.productos) || [];
    const n = productos.filter((p) => p.stock <= p.stockMinimo).length;
    badge.textContent = String(n);
    badge.classList.toggle("hidden", n === 0);
    badge.title = n + " producto(s) con stock bajo";
  },

  abrirModal(opciones) {
    const botones = opciones.botones || [];
    const claseModal = "modal" + (opciones.modalClase ? " " + opciones.modalClase : "");
    document.getElementById("modal-root").innerHTML = `
      <div class="modal-overlay">
        <div class="${claseModal}">
          <button class="modal-close" id="modal-x" type="button" title="Cerrar">×</button>
          <h3>${opciones.titulo}</h3>
          <div>${opciones.body}</div>
          <div class="modal-actions">
            ${botones
              .map(
                (b, i) =>
                  `<button class="btn ${b.clase || ""}" data-modal-boton="${i}">${esc(b.texto)}</button>`
              )
              .join("")}
            <button class="btn" id="modal-cancelar">Cerrar</button>
            ${opciones.soloCerrar ? "" : '<button class="btn btn-primary" id="modal-aceptar">Guardar</button>'}
          </div>
        </div>
      </div>`;
    document.querySelectorAll("[data-modal-boton]").forEach((el) => {
      el.addEventListener("click", () => botones[Number(el.dataset.modalBoton)].onClick());
    });
    document.getElementById("modal-cancelar").addEventListener("click", () => this.cerrarModal());
    document.getElementById("modal-x").addEventListener("click", () => this.cerrarModal());
    const overlay = document.querySelector(".modal-overlay");
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.cerrarModal();
    });
    if (!opciones.soloCerrar) {
      document.getElementById("modal-aceptar").addEventListener("click", opciones.onAceptar);
    }
    const primerInput = document.querySelector(".modal input, .modal select");
    if (primerInput) primerInput.focus();
  },

  cerrarModal() {
    document.getElementById("modal-root").innerHTML = "";
  },

  verImagen(src, titulo) {
    if (!src) return;
    this.abrirModal({
      titulo: titulo || "Imagen del producto",
      body: `<div class="imagen-zoom"><img src="${src}" alt="${esc(titulo || "Imagen del producto")}" /></div>`,
      soloCerrar: true
    });
  },

  mostrarToast(mensaje, tipo) {
    const el = document.getElementById("toast");
    const nombreIco = tipo === "success" ? "ok" : tipo === "error" ? "error" : "";
    el.innerHTML =
      (nombreIco ? `<span class="toast-ico">${icono(nombreIco)}</span>` : "") +
      `<span>${esc(mensaje)}</span>`;
    el.className = "toast " + (tipo || "");
    el.classList.remove("hidden");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
  },

  renderUsuarios() {
    const body = document.getElementById("usuarios-body");
    body.innerHTML = "";
    Store.bd.usuarios.forEach((u) => {
      const badgeRol = u.rol === "admin" ? "badge-rol-admin" : "badge-rol-vendedor";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(u.nombre)}</td>
        <td>${esc(u.correo)}</td>
        <td><span class="badge ${badgeRol}">${u.rol}</span></td>
        <td>
          <div class="text-acciones">
            <button class="icon-btn" data-accion="eliminar-usuario" data-id="${u.id}" title="Eliminar">Eliminar</button>
          </div>
        </td>`;
      body.appendChild(tr);
    });
  },

  abrirModalUsuario() {
    this.abrirModal({
      titulo: "Nuevo usuario",
      body: `
        <label>Nombre</label>
        <input id="usu-nombre" />
        <label>Correo</label>
        <input id="usu-correo" type="email" />
        <label>Contraseña</label>
        <input id="usu-password" type="password" />
        <label>Rol</label>
        <select id="usu-rol">
          <option value="vendedor">Vendedor</option>
          <option value="admin">Administrador</option>
        </select>
      `,
      onAceptar: async () => {
        const nombre = document.getElementById("usu-nombre").value.trim();
        const correo = document.getElementById("usu-correo").value.trim();
        const password = document.getElementById("usu-password").value;
        const rol = document.getElementById("usu-rol").value;
        if (!nombre || !correo || !password) {
          this.mostrarToast("Todos los campos son obligatorios.", "error");
          return;
        }
        try {
          await Store.crearUsuario({ nombre, correo, password, rol });
          await Store.cargarDatos();
          this.renderUsuarios();
          this.cerrarModal();
          this.mostrarToast("Usuario creado.", "success");
        } catch (e) {
          this.mostrarToast(e.message, "error");
        }
      }
    });
  },

  async eliminarUsuario(id) {
    const objetivo = Store.bd.usuarios.find((u) => u.id === id);
    if (!objetivo) return;
    if (this.sesion.userId === id) {
      this.mostrarToast("No puedes eliminar tu propia cuenta.", "error");
      return;
    }
    try {
      await Store.eliminarUsuario(id);
      await Store.cargarDatos();
      this.renderUsuarios();
      this.mostrarToast("Usuario eliminado.", "success");
    } catch (e) {
      this.mostrarToast(e.message, "error");
    }
  },

  async cancelarVenta(id) {
    if (!this.esAdmin()) return;
    const v = Store.bd.ventas.find((x) => x.id === id);
    const folio = v ? v.folio : id;
    if (!confirm("¿Cancelar la venta " + folio + "?\nSe devolverá el stock de los productos.")) return;
    try {
      await Store.cancelarVenta(id);
      await Store.cargarDatos();
      Historial.render();
      Estadisticas.render();
      Caja.actualizarLista();
      Caja.renderCarrito();
      Inventario.render();
      App.actualizarBadgeStock();
      App.mostrarToast("Venta " + folio + " cancelada y stock devuelto.", "success");
    } catch (e) {
      App.mostrarToast(e.message, "error");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());