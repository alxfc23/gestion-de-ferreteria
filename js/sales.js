function etiquetaMetodo(clave) {
  return { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" }[clave] || "Efectivo";
}

const Caja = {
  carrito: [],
  metodoPago: "efectivo",

  buscarPorCodigo(texto) {
    const limpiar = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "");
    const codigo = limpiar(texto);
    if (!codigo) return null;
    return (
      Store.bd.productos.find((p) => limpiar(p.codigo) === codigo) ||
      Store.bd.productos.find((p) => limpiar(p.codigo).endsWith(codigo))
    );
  },

  enfocarBusqueda() {
    const campo = document.getElementById("buscar-producto-venta");
    if (campo && document.getElementById("vista-ventas").classList.contains("active")) {
      campo.focus();
      campo.select();
    }
  },

  listarProductosVenta() {
    const texto = document.getElementById("buscar-producto-venta").value.trim().toLowerCase();
    return Store.bd.productos.filter(
      (p) =>
        !texto ||
        p.nombre.toLowerCase().includes(texto) ||
        p.codigo.toLowerCase().includes(texto) ||
        p.categoria.toLowerCase().includes(texto)
    );
  },

  precioConMayoreo(p, cantidad) {
    const may = Number(p.precioMayoreo) || 0;
    const min = Math.floor(Number(p.mayoreoMinimo)) || 0;
    if (may > 0 && min > 0 && cantidad >= min) return may;
    return Number(p.precio) || 0;
  },

  comisionPct() {
    const cfg = Store.bd.configuracion || {};
    const n = Number(cfg.comision_tarjeta) || 0;
    return Math.max(0, Math.min(100, n));
  },

  actualizarLista() {
    const contenedor = document.getElementById("lista-productos-venta");
    contenedor.innerHTML = "";
    this.listarProductosVenta().forEach((p) => {
      const agotado = p.stock <= 0;
      const unidad = p.unidad || "pz";
      const tieneMayoreo = (Number(p.precioMayoreo) || 0) > 0 && (Number(p.mayoreoMinimo) || 0) > 0;
      const card = document.createElement("div");
      card.className = "producto-card";
      const visual = p.imagen
        ? `<img class="prod-thumb" src="${p.imagen}" alt="${esc(p.nombre)}" />`
        : '<span class="prod-placeholder"></span>';
      card.innerHTML = `
        <div class="prod-img">${visual}</div>
        <div class="nombre">${esc(p.nombre)}</div>
        <div class="card-cat">${chipCategoria(p.categoria)}</div>
        <div class="precio">${moneda(p.precio)}${tieneMayoreo ? `<span class="mayoreo-hint">mayoreo ≥ ${Number(p.mayoreoMinimo)} ${esc(unidad)}</span>` : ""}</div>
        <div class="stock ${agotado ? "agotado" : ""}">${agotado ? "Agotado" : p.stock + " " + esc(unidad) + " en stock"}</div>`;
      card.title = p.nombre;
      const miniatura = card.querySelector("img.prod-thumb");
      if (miniatura) {
        miniatura.style.cursor = "zoom-in";
        miniatura.addEventListener("click", (e) => {
          e.stopPropagation();
          App.verImagen(miniatura.src, p.nombre);
        });
      }
      if (!agotado) {
        card.onclick = () => this.agregar(p.id);
      }
      contenedor.appendChild(card);
    });
  },

  agregar(id) {
    const p = Store.bd.productos.find((x) => x.id === id);
    if (!p || p.stock <= 0) return;
    const item = this.carrito.find((i) => i.productoId === id);
    if (item) {
      if (item.cantidad >= p.stock) {
        App.mostrarToast("No hay más stock disponible.", "error");
        return;
      }
      item.cantidad++;
      item.precio = this.precioConMayoreo(p, item.cantidad);
    } else {
      this.carrito.push({
        productoId: id,
        nombre: p.nombre,
        unidad: p.unidad || "pz",
        precio: this.precioConMayoreo(p, 1),
        cantidad: 1
      });
    }
    this.renderCarrito();
    this.enfocarBusqueda();
  },

  restar(id) {
    const item = this.carrito.find((i) => i.productoId === id);
    if (!item) return;
    item.cantidad--;
    if (item.cantidad <= 0) {
      this.carrito = this.carrito.filter((i) => i.productoId !== id);
    } else {
      const p = Store.bd.productos.find((x) => x.id === id);
      if (p) item.precio = this.precioConMayoreo(p, item.cantidad);
    }
    this.renderCarrito();
  },

  quitar(id) {
    this.carrito = this.carrito.filter((i) => i.productoId !== id);
    this.renderCarrito();
  },

  renderCarrito() {
    const body = document.getElementById("carrito-body");
    const vacio = document.getElementById("carrito-vacio");
    body.innerHTML = "";
    if (!this.carrito.length) {
      vacio.innerHTML = estadoVacioHTML(
        "carrito",
        "El ticket está vacío",
        "Busca o escanea un producto para agregarlo."
      );
      vacio.classList.remove("hidden");
      document.getElementById("tabla-carrito").classList.add("hidden");
    } else {
      vacio.classList.add("hidden");
      document.getElementById("tabla-carrito").classList.remove("hidden");
      this.carrito.forEach((item) => {
        const tr = document.createElement("tr");
        tr.dataset.productoId = item.productoId;
        const p = Store.bd.productos.find((x) => x.id === item.productoId);
        const unidad = item.unidad || (p && p.unidad) || "pz";
        const enMayoreo = p && item.precio < Number(p.precio);
        const visual =
          p && p.imagen
            ? `<img class="prod-thumb" src="${p.imagen}" alt="${esc(item.nombre)}" data-accion="ver-imagen" data-nombre="${esc(item.nombre)}" />`
            : '<span class="prod-placeholder"></span>';
        tr.innerHTML = `
          <td>${visual} ${esc(item.nombre)}</td>
          <td>${moneda(item.precio)} / ${esc(unidad)}${enMayoreo ? ' <span class="mayoreo-hint">mayoreo</span>' : ""}</td>
          <td>
            <button class="icon-btn" data-accion="restar">−</button>
            <span class="input-cantidad" style="display:inline-block">${item.cantidad} ${esc(unidad)}</span>
            <button class="icon-btn" data-accion="sumar">+</button>
          </td>
          <td>${moneda(item.precio * item.cantidad)}</td>
          <td><button class="icon-btn" data-accion="quitar" title="Quitar">Quitar</button></td>`;
        body.appendChild(tr);
      });
    }
    this.calcularTotales();
  },

calcularTotales() {
    const subtotal = this.carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const pct = this.metodoPago === "tarjeta" ? this.comisionPct() : 0;
    const comision = pct > 0 ? Math.round((subtotal * pct) / 100 * 100) / 100 : 0;
    const total = Math.round((subtotal + comision) * 100) / 100;
    const fila = document.getElementById("fila-comision");
    if (fila) fila.classList.toggle("hidden", comision <= 0);
    document.getElementById("total-comision").textContent = moneda(comision);
    document.getElementById("total-subtotal").textContent = moneda(subtotal);
    document.getElementById("total-grand").textContent = moneda(total);
  },

  async cobrar() {
    if (!this.carrito.length) {
      App.mostrarToast("El ticket está vacío.", "error");
      return;
    }
    const subtotal = this.carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const pct = this.metodoPago === "tarjeta" ? this.comisionPct() : 0;
    const comision = pct > 0 ? Math.round((subtotal * pct) / 100 * 100) / 100 : 0;
    const total = Math.round((subtotal + comision) * 100) / 100;

    try {
      const venta = await Store.registrarVenta({
        metodoPago: this.metodoPago,
        items: this.carrito.map((i) => ({
          productoId: i.productoId,
          nombre: i.nombre,
          precio: i.precio,
          cantidad: i.cantidad
        })),
        subtotal,
        comision,
        total
      });

      await Store.cargarDatos();
      this.carrito = [];
      this.renderCarrito();
      this.actualizarLista();
      Estadisticas.render();
      Historial.render();
      App.actualizarBadgeStock();

      const bajos = venta.items
        .map((i) => Store.bd.productos.find((p) => p.id === i.productoId))
        .filter((p) => p && p.stock <= p.stockMinimo);
      const avisoStock = bajos.length
        ? `<p class="aviso-stock">⚠ Stock bajo: ${bajos
            .map((p) => esc(p.nombre) + " (" + p.stock + " " + esc(p.unidad || "pz") + ")")
            .join(", ")}</p>`
        : "";

      App.abrirModal({
        titulo: "Venta registrada " + venta.folio,
        body: `
          <p>Vendedor: <strong>${esc(venta.vendedor)}</strong></p>
          <p>Método de pago: <strong>${etiquetaMetodo(venta.metodoPago)}</strong></p>
          <div class="detalle-items" style="margin-top:10px">
            ${venta.items
              .map((i) => `<div class="det-row"><span>${esc(i.nombre)} × ${i.cantidad}</span><span>${moneda(i.precio * i.cantidad)}</span></div>`)
              .join("")}
          </div>
          <div class="ticket-totales">
            <div><span>Subtotal</span><span>${moneda(venta.subtotal)}</span></div>
            ${venta.comision > 0 ? `<div><span>Comisión tarjeta</span><span>${moneda(venta.comision)}</span></div>` : ""}
            <div class="total"><span>Total</span><span>${moneda(venta.total)}</span></div>
          </div>
          ${avisoStock}
        `,
        botones: [
          {
            texto: "Imprimir / PDF",
            clase: "btn-primary",
            onClick: () => Historial.generarPDF(venta)
          }
        ],
        soloCerrar: true
      });
      App.mostrarToast("Venta cobrada: " + venta.folio, "success");
    } catch (e) {
      App.mostrarToast(e.message, "error");
    }
  }
};

const Historial = {
  desde: "",
  hasta: "",
  vendedor: "",
  metodoPago: "",
  ventas: [],

  async render() {
    try {
      this.ventas = await Store.buscarVentas({
        desde: this.desde,
        hasta: this.hasta,
        vendedor: this.vendedor,
        metodoPago: this.metodoPago
      });
    } catch (e) {
      App.mostrarToast(e.message, "error");
      return;
    }
    this.pintar();
  },

  listar() {
    return this.ventas;
  },

  llenarVendedores() {
    const select = document.getElementById("filtro-vendedor");
    if (!select) return;
    const actual = select.value;
    const nombres = Array.from(
      new Set(Store.bd.ventas.map((v) => v.vendedor).filter(Boolean))
    ).sort();
    select.innerHTML =
      '<option value="">Todos los vendedores</option>' +
      nombres.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    select.value = actual;
  },

  pintar() {
    const ventas = this.listar();
    const body = document.getElementById("ventas-body");
    const vacio = document.getElementById("ventas-vacio");
    body.innerHTML = "";
    if (!ventas.length) {
      vacio.innerHTML = estadoVacioHTML(
        "vacio",
        "No hay ventas",
        "No se encontraron ventas con los filtros actuales."
      );
      vacio.classList.remove("hidden");
      return;
    }
    vacio.classList.add("hidden");
    ventas.forEach((v) => {
      const articulos = v.items.reduce((acc, i) => acc + i.cantidad, 0);
      const fecha = new Date(v.fecha);
      const esAdmin = !!(App.sesion && App.sesion.rol === "admin");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(v.folio)}</strong></td>
        <td>${fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
        <td>${esc(v.vendedor)}</td>
        <td>${esc(etiquetaMetodo(v.metodoPago))}</td>
        <td>${articulos}</td>
        <td><strong>${moneda(v.total)}</strong></td>
        <td>
          <button class="icon-btn" data-accion="detalle" data-id="${v.id}" title="Ver detalle">Ver</button>
          ${esAdmin ? `<button class="icon-btn btn-cancelar" data-accion="cancelar-venta" data-id="${v.id}" title="Cancelar venta">Cancelar</button>` : ""}
        </td>`;
      body.appendChild(tr);
    });
  },

  exportarCSV() {
    const ventas = this.listar();
    if (!ventas.length) {
      App.mostrarToast("No hay ventas para exportar.", "error");
      return;
    }
    const filas = [
      ["Folio", "Fecha", "Vendedor", "Método de pago", "Artículos", "Subtotal", "Total"]
    ];
    ventas.forEach((v) => {
      const articulos = v.items.reduce((acc, i) => acc + i.cantidad, 0);
      filas.push([
        v.folio,
        new Date(v.fecha).toLocaleString("es-MX"),
        v.vendedor,
        etiquetaMetodo(v.metodoPago),
        articulos,
        Number(v.subtotal).toFixed(2),
        Number(v.total).toFixed(2)
      ]);
    });
    descargarCSV("ventas_" + diaClave(new Date()) + ".csv", filas);
    App.mostrarToast("Se exportaron " + ventas.length + " ventas.");
  },

  verDetalle(id) {
    const v =
      this.ventas.find((x) => x.id === id) || Store.bd.ventas.find((x) => x.id === id);
    if (!v) return;
    const fecha = new Date(v.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
    App.abrirModal({
      titulo: "Detalle de venta " + v.folio,
      body: `
        <p><strong>${fecha}</strong> · Vendedor: ${esc(v.vendedor)}</p>
        <p>Método de pago: <strong>${etiquetaMetodo(v.metodoPago)}</strong></p>
        <div class="detalle-items" style="margin-top:12px">
          ${v.items
            .map(
              (i) =>
                `<div class="det-row"><span>${esc(i.nombre)} × ${i.cantidad}</span><span>${moneda(i.precio * i.cantidad)}</span></div>`
            )
            .join("")}
        </div>
        <div class="ticket-totales">
          <div><span>Subtotal</span><span>${moneda(v.subtotal)}</span></div>
          ${Number(v.comision) > 0 ? `<div><span>Comisión tarjeta</span><span>${moneda(v.comision)}</span></div>` : ""}
          <div class="total"><span>Total</span><span>${moneda(v.total)}</span></div>
        </div>
      `,
      botones: [
        {
          texto: "Imprimir / PDF",
          clase: "btn-primary",
          onClick: () => this.generarPDF(v)
        },
        ...(App.sesion && App.sesion.rol === "admin"
          ? [
              {
                texto: "Cancelar venta",
                clase: "btn-danger",
                onClick: () => {
                  App.cerrarModal();
                  App.cancelarVenta(v.id);
                }
              }
            ]
          : [])
      ],
      soloCerrar: true
    });
  },

  generarPDF(v) {
    const fecha = new Date(v.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
    const filas = v.items
      .map(
        (i) =>
          `<div class="fila"><span>${esc(i.cantidad)} × ${esc(i.nombre)}</span><span>${moneda(i.precio * i.cantidad)}</span></div>`
      )
      .join("");
    const html = `
        <div class="ticket">
          <div class="enc">FERRETERÍA<br/>Ticket de venta</div>
          <div class="sep"></div>
          <div class="meta">Folio: <strong>${esc(v.folio)}</strong></div>
          <div class="meta">Fecha: ${fecha}</div>
          <div class="meta">Vendedor: ${esc(v.vendedor)}</div>
          <div class="meta">Método de pago: ${esc(etiquetaMetodo(v.metodoPago))}</div>
          <div class="sep"></div>
          ${filas}
          <div class="sep"></div>
          <div class="meta der">Subtotal: ${moneda(v.subtotal)}</div>
          ${Number(v.comision) > 0 ? `<div class="meta der">Comisión tarjeta: ${moneda(v.comision)}</div>` : ""}
          <div class="tot">TOTAL: ${moneda(v.total)}</div>
          <div class="sep"></div>
          <div class="foot">¡Gracias por su compra!</div>
        </div>`;
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) {
      App.mostrarToast("Permite ventanas emergentes para imprimir el ticket.", "error");
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${esc(v.folio)}</title><style>
        body { margin: 0; font-family: 'Courier New', Courier, monospace; background: #fff; }
        .ticket { width: 240px; margin: 0 auto; padding: 14px 0; font-size: 12px; color: #000; }
        .enc { text-align: center; font-weight: 700; font-size: 14px; line-height: 1.4; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        .meta { margin: 3px 0; }
        .der { text-align: right; }
        .fila { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
        .fila span:first-child { flex: 1; }
        .tot { font-weight: 700; font-size: 16px; text-align: right; margin-top: 8px; }
        .foot { text-align: center; margin-top: 10px; font-size: 11px; }
      </style></head><body>${html}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  },

  corte() {
    const hoy = diaClave(new Date());
    const ultimoFondo = localStorage.getItem("ferreteria_fondo_abierto") || "";
    App.abrirModal({
      titulo: "Corte de caja",
      modalClase: "modal-lg",
      body: `
        <div class="corte-fila-controles">
          <div>
            <label class="metodo-label" for="corte-fecha">Día del corte</label>
            <input type="date" id="corte-fecha" value="${hoy}" />
          </div>
          <div>
            <label class="metodo-label" for="corte-fondo">Fondo de apertura</label>
            <input type="number" id="corte-fondo" min="0" step="0.01" placeholder="0.00" value="${esc(ultimoFondo)}" />
          </div>
          <button class="btn" id="corte-recargar" type="button">Recargar ventas</button>
        </div>
        <div id="corte-resultado" class="corte-resultado"></div>
      `,
      botones: [
        { texto: "Imprimir / PDF", clase: "btn", onClick: () => this.imprimirCorte() }
      ],
      soloCerrar: true
    });
    const input = document.getElementById("corte-fecha");
    const recargar = document.getElementById("corte-recargar");
    input.addEventListener("change", () => this.pintarCorte(input.value));
    recargar.addEventListener("click", () => this.pintarCorte(input.value));
    this.pintarCorte(hoy);
  },

  async pintarCorte(fecha) {
    const cont = document.getElementById("corte-resultado");
    if (!cont) return;
    if (!fecha) {
      cont.innerHTML = '<div class="empty">Elige una fecha.</div>';
      return;
    }
    cont.innerHTML = '<div class="empty">Calculando…</div>';
    let ventas;
    try {
      ventas = await Store.buscarVentas({ desde: fecha, hasta: fecha });
    } catch (e) {
      cont.innerHTML = '<div class="empty">' + esc(e.message) + "</div>";
      return;
    }
    this.corteActual = { fecha, ventas };
    ventas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    this.pintarResumen();
  },

  pintarResumen() {
    const cont = document.getElementById("corte-resultado");
    if (!cont) return;
    const ventas = this.corteActual.ventas;
    const metodos = ["efectivo", "tarjeta", "transferencia"];
    const resumen = {};
    metodos.forEach((m) => (resumen[m] = { n: 0, total: 0 }));
    let granTotal = 0;
    let articulos = 0;
    ventas.forEach((v) => {
      const m = metodos.includes(v.metodoPago) ? v.metodoPago : "efectivo";
      resumen[m].n += 1;
      resumen[m].total += Number(v.total);
      granTotal += Number(v.total);
      articulos += v.items.reduce((a, i) => a + i.cantidad, 0);
    });
    this.corteResumen = resumen;

    const contadoPrevio = (cont.querySelector("#corte-contado") || {}).value || "";
    const fondo = Number(document.getElementById("corte-fondo").value) || 0;

    const filasMetodos = metodos
      .map(
        (m) =>
          `<div class="det-row"><span>${esc(etiquetaMetodo(m))} <small>(${resumen[m].n} ${resumen[m].n === 1 ? "venta" : "ventas"})</small></span><span>${moneda(resumen[m].total)}</span></div>`
      )
      .join("");

    const filasVentas = ventas
      .map(
        (v) =>
          `<tr>
            <td><strong>${esc(v.folio)}</strong></td>
            <td>${new Date(v.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td>
            <td>${esc(v.vendedor)}</td>
            <td>${esc(etiquetaMetodo(v.metodoPago))}</td>
            <td>${v.items.reduce((a, i) => a + i.cantidad, 0)}</td>
            <td class="td-der"><strong>${moneda(v.total)}</strong></td>
          </tr>`
      )
      .join("");

    cont.innerHTML = `
      <div class="corte-grid-3">
        <div class="corte-card"><span>Ventas</span><strong>${ventas.length}</strong></div>
        <div class="corte-card"><span>Ingresos del día</span><strong>${moneda(granTotal)}</strong></div>
        <div class="corte-card"><span>Artículos vendidos</span><strong>${articulos}</strong></div>
      </div>

      <h4 class="modal-section">Ingresos por método de pago</h4>
      <div class="detalle-items">${filasMetodos}</div>

      <h4 class="modal-section">Arqueo de caja (efectivo)</h4>
      <div class="detalle-items">
        <div class="det-row"><span>Fondo de apertura</span><span id="arq-fondo">${moneda(fondo)}</span></div>
        <div class="det-row"><span>Ventas en efectivo</span><span>${moneda(resumen.efectivo.total)}</span></div>
      </div>
      <div class="ticket-totales">
        <div class="total"><span>Efectivo esperado en caja</span><span id="arq-esperado">${moneda(fondo + resumen.efectivo.total)}</span></div>
      </div>
      <label class="metodo-label" for="corte-contado">Efectivo contado (conteo físico)</label>
      <input type="number" id="corte-contado" min="0" step="0.01" placeholder="0.00" value="${esc(contadoPrevio)}" />
      <div id="arq-diferencia" class="corte-diferencia"></div>

      <h4 class="modal-section">Ventas del día (${ventas.length})</h4>
      ${
        ventas.length
          ? `<div class="corte-tabla-wrap">
              <table class="table table-corte">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Hora</th>
                    <th>Vendedor</th>
                    <th>Método</th>
                    <th>Art.</th>
                    <th class="th-der">Total</th>
                  </tr>
                </thead>
                <tbody>${filasVentas}</tbody>
              </table>
            </div>`
          : '<div class="empty">' + estadoVacioHTML("vacio", "Sin ventas", "No hubo ventas este día.") + "</div>"
      }
    `;

    const fondoInput = document.getElementById("corte-fondo");
    const contado = document.getElementById("corte-contado");
    fondoInput.addEventListener("change", () => {
      localStorage.setItem("ferreteria_fondo_abierto", String(fondoInput.value || ""));
      this.pintarResumen();
    });
    contado.addEventListener("input", () => this.actualizarArqueo());
    this.actualizarArqueo();
  },

  actualizarArqueo() {
    if (!this.corteActual || !this.corteResumen) return;
    const fondo = Number(document.getElementById("corte-fondo").value) || 0;
    const contado = Number(document.getElementById("corte-contado").value) || 0;
    const esperado = fondo + Number(this.corteResumen.efectivo.total);
    const diferencia = contado - esperado;
    const elEsperado = document.getElementById("arq-esperado");
    const elFondo = document.getElementById("arq-fondo");
    const elDiff = document.getElementById("arq-diferencia");
    if (elEsperado) elEsperado.textContent = moneda(esperado);
    if (elFondo) elFondo.textContent = moneda(fondo);
    if (!elDiff) return;
    if (diferencia === 0) {
      elDiff.textContent = "✔ Cuadra perfectamente";
      elDiff.className = "corte-diferencia ok";
    } else if (diferencia > 0) {
      elDiff.textContent = "▲ Sobrante de " + moneda(diferencia);
      elDiff.className = "corte-diferencia sobrante";
    } else {
      elDiff.textContent = "▼ Faltante de " + moneda(Math.abs(diferencia));
      elDiff.className = "corte-diferencia faltante";
    }
  },

  imprimirCorte() {
    const c = this.corteActual;
    if (!c || !this.corteResumen) {
      App.mostrarToast("Primero calcula el corte.", "error");
      return;
    }
    const r = this.corteResumen;
    const fondo = Number(document.getElementById("corte-fondo").value) || 0;
    const contado = Number(document.getElementById("corte-contado").value) || 0;
    const esperado = fondo + Number(r.efectivo.total);
    const diferencia = contado - esperado;
    const metodos = ["efectivo", "tarjeta", "transferencia"];
    const articulos = c.ventas.reduce(
      (a, v) => a + v.items.reduce((x, i) => x + i.cantidad, 0),
      0
    );
    const granTotal = c.ventas.reduce((a, v) => a + Number(v.total), 0);
    const estadoDiferencia =
      diferencia === 0
        ? "CUADRA ✔"
        : diferencia > 0
          ? "SOBRANTE " + moneda(diferencia)
          : "FALTANTE " + moneda(Math.abs(diferencia));

    const filasMetodos = metodos
      .map(
        (m) =>
          `<div class="fila"><span>${etiquetaMetodo(m)} (${r[m].n})</span><span>${moneda(r[m].total)}</span></div>`
      )
      .join("");
    const filasVentas = c.ventas
      .map((v) => {
        const hora = new Date(v.fecha).toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit"
        });
        return `<div class="fila"><span>${esc(v.folio)} ${hora} ${etiquetaMetodo(v.metodoPago)}</span><span>${moneda(v.total)}</span></div>`;
      })
      .join("");
    const html = `
        <div class="ticket">
          <div class="enc">FERRETERÍA<br/>Corte de caja</div>
          <div class="sep"></div>
          <div class="meta">Fecha: ${new Date(c.fecha + "T00:00:00").toLocaleDateString("es-MX", { dateStyle: "long" })}</div>
          <div class="meta">Generado: ${new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</div>
          <div class="meta">Usuario: ${esc((App.sesion && App.sesion.nombre) || "")}</div>
          <div class="sep"></div>
          <div class="meta">Ventas: ${c.ventas.length} · Artículos: ${articulos}</div>
          <div class="meta der">Ingresos totales: ${moneda(granTotal)}</div>
          <div class="sep"></div>
          <div class="meta negrita">Ingresos por método</div>
          ${filasMetodos}
          <div class="sep"></div>
          <div class="meta negrita">Arqueo de caja</div>
          <div class="fila"><span>Fondo inicial</span><span>${moneda(fondo)}</span></div>
          <div class="fila"><span>+ Ventas efectivo</span><span>${moneda(r.efectivo.total)}</span></div>
          <div class="fila negrita"><span>Esperado</span><span>${moneda(esperado)}</span></div>
          <div class="fila"><span>Contado</span><span>${moneda(contado)}</span></div>
          <div class="resaltado">${estadoDiferencia}</div>
          <div class="sep"></div>
          <div class="meta negrita">Detalle de ventas</div>
          ${filasVentas}
          <div class="sep"></div>
          <div class="tot">TOTAL DEL DÍA ${moneda(granTotal)}</div>
          <div class="sep"></div>
          <div class="foot">Gestión de Ferretería</div>
        </div>`;
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) {
      App.mostrarToast("Permite ventanas emergentes para imprimir el corte.", "error");
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Corte de caja</title><style>
        body { margin: 0; font-family: 'Courier New', Courier, monospace; background: #fff; }
        .ticket { width: 300px; margin: 0 auto; padding: 14px 0; font-size: 12px; color: #000; }
        .enc { text-align: center; font-weight: 700; font-size: 14px; line-height: 1.4; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        .meta { margin: 3px 0; }
        .der { text-align: right; }
        .negrita { font-weight: 700; }
        .resaltado { font-weight: 700; text-align: center; background: #f3f4f6; margin: 4px 0; padding: 4px 0; border-radius: 4px; }
        .fila { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
        .fila span:first-child { flex: 1; }
        .tot { font-weight: 700; font-size: 16px; text-align: right; margin-top: 8px; }
        .foot { text-align: center; margin-top: 10px; font-size: 11px; }
      </style></head><body>${html}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }
};