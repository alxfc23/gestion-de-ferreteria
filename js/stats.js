const Estadisticas = {
  periodo: "todo",
  desde: "",
  hasta: "",
  etiquetas: {
    hoy: "Hoy",
    "7d": "Últimos 7 días",
    "30d": "Últimos 30 días",
    todo: "Todo el tiempo"
  },

  filtrarVentas(ventas, periodo) {
    if (periodo === "hoy") return ventas.filter((v) => diaClave(v.fecha) >= diaClave(new Date()));
    if (periodo === "7d") return ventas.filter((v) => diaClave(v.fecha) >= diaClave(diasAtras(6)));
    if (periodo === "30d") return ventas.filter((v) => diaClave(v.fecha) >= diaClave(diasAtras(29)));
    if (periodo === "otro") {
      if (!this.desde && !this.hasta) return ventas;
      return ventas.filter((v) => {
        const k = diaClave(v.fecha);
        if (this.desde && k < this.desde) return false;
        if (this.hasta && k > this.hasta) return false;
        return true;
      });
    }
    return ventas;
  },

  fmtFecha(d) {
    if (!d) return "";
    const partes = d.split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  },

  etiquetaActual() {
    if (this.periodo === "otro") {
      if (this.desde && this.hasta) {
        return "del " + this.fmtFecha(this.desde) + " al " + this.fmtFecha(this.hasta);
      }
      if (this.desde) return "desde " + this.fmtFecha(this.desde);
      if (this.hasta) return "hasta " + this.fmtFecha(this.hasta);
      return "Todo el tiempo";
    }
    return this.etiquetas[this.periodo] || this.etiquetas.todo;
  },

  render() {
    const esAdmin = !!(App.sesion && App.sesion.rol === "admin");
    if (!esAdmin) this.periodo = "hoy";
    const filtros = document.querySelector("#vista-inicio .filtros-periodo");
    if (filtros) filtros.classList.toggle("hidden", !esAdmin);
    const ventas = Store.bd.ventas;
    const productos = Store.bd.productos;
    const ventasFiltradas = this.filtrarVentas(ventas, this.periodo);
    const etiqueta = this.etiquetaActual();

    const totalVentas = ventasFiltradas.reduce((acc, v) => acc + Number(v.total), 0);
    const totalArticulos = ventasFiltradas.reduce(
      (acc, v) => acc + v.items.reduce((a, i) => a + i.cantidad, 0),
      0
    );
    const stockBajo = productos.filter((p) => p.stock <= p.stockMinimo).length;
    const numeroVentas = ventasFiltradas.length;

    const costoPorId = {};
    productos.forEach((p) => {
      costoPorId[p.id] = Number(p.costo) || 0;
    });
    let ganancia = 0;
    ventasFiltradas.forEach((v) => {
      v.items.forEach((i) => {
        const pid = i.producto_id !== undefined ? i.producto_id : i.productoId;
        if (costoPorId[pid] === undefined) return;
        ganancia += (Number(i.precio) - costoPorId[pid]) * i.cantidad;
      });
    });

    const cards = [
      {
        titulo: "Ventas totales",
        numero: totalVentas,
        formato: "moneda",
        nota: etiqueta,
        clase: "",
        icono: "dinero",
        tono: "primary",
        dinero: true
      },
      {
        titulo: "Ganancia estimada",
        numero: ganancia,
        formato: "moneda",
        nota: "venta − costo actual",
        clase: "card-success",
        icono: "tendencia",
        tono: "success",
        dinero: true,
        admin: true
      },
      {
        titulo: "Ventas registradas",
        numero: numeroVentas,
        formato: "entero",
        nota: etiqueta,
        clase: "",
        icono: "carrito",
        tono: "info"
      },
      {
        titulo: "Artículos vendidos",
        numero: totalArticulos,
        formato: "entero",
        nota: etiqueta,
        clase: "",
        icono: "bolsa",
        tono: "info"
      },
      {
        titulo: "Productos stock bajo",
        numero: stockBajo,
        formato: "entero",
        nota: "estado actual del inventario",
        clase: "card-danger",
        icono: "alerta",
        tono: "danger"
      }
    ];
    const cardsVisibles = esAdmin ? cards : cards.filter((c) => !c.admin);
    document.getElementById("cards-resumen").innerHTML = cardsVisibles
      .map(
        (c) => `
        <div class="card-resumen ${c.clase} ${c.dinero ? "dato-dinero" : ""}">
          <div class="card-head">
            <h4>${c.titulo}</h4>
            <span class="icono-circle tono-${c.tono}">${icono(c.icono)}</span>
          </div>
          <div class="valor" data-numero="${c.numero}" data-formato="${c.formato}">0</div>
          <div class="nota">${c.nota}</div>
        </div>`
      )
      .join("");
    this.animarValores();

    this.renderChartVentas(ventas);
    this.renderTopProductos(ventasFiltradas);
    this.renderStockBajo(productos);
    this.renderChartCategorias();
  },

  animarValores() {
    const reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("#cards-resumen .valor").forEach((el) => {
      const destino = Number(el.dataset.numero) || 0;
      const esMoneda = el.dataset.formato === "moneda";
      const escribir = (v) => {
        el.textContent = esMoneda ? moneda(v) : String(Math.round(v));
      };
      if (reducir) {
        escribir(destino);
        return;
      }
      const inicio = performance.now();
      const duracion = 600;
      const paso = (ahora) => {
        const t = Math.min((ahora - inicio) / duracion, 1);
        const suave = 1 - Math.pow(1 - t, 3);
        escribir(destino * suave);
        if (t < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  },

  alternarDinero() {
    const cont = document.getElementById("vista-inicio");
    const btn = document.getElementById("btn-ocultar-dinero");
    if (!cont || !btn) return;
    const oculto = cont.classList.toggle("dinero-oculto");
    btn.classList.toggle("activo", oculto);
    btn.setAttribute("aria-pressed", oculto ? "true" : "false");
    btn.innerHTML =
      icono(oculto ? "ojo-off" : "ojo") +
      `<span>${oculto ? "Mostrar montos" : "Ocultar montos"}</span>`;
  },

  aplicarMontosInicial() {
    const cont = document.getElementById("vista-inicio");
    const btn = document.getElementById("btn-ocultar-dinero");
    if (!cont || !btn) return;
    const cfg = Store.bd.configuracion || {};
    const oculto = cfg.ocultar_montos === true;
    cont.classList.toggle("dinero-oculto", oculto);
    btn.classList.toggle("activo", oculto);
    btn.setAttribute("aria-pressed", oculto ? "true" : "false");
    btn.innerHTML =
      icono(oculto ? "ojo-off" : "ojo") +
      `<span>${oculto ? "Mostrar montos" : "Ocultar montos"}</span>`;
  },

  renderChartVentas(ventas) {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      dias.push({ clave: diaClave(diasAtras(i)), label: "", total: 0 });
    }
    const nombres = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    dias.forEach((d) => {
      d.label = nombres[new Date(d.clave + "T00:00:00").getDay()];
    });
    ventas.forEach((v) => {
      const k = diaClave(v.fecha);
      const d = dias.find((x) => x.clave === k);
      if (d) d.total += Number(v.total);
    });
    const hoyClave = diaClave(new Date());
    const max = Math.max(...dias.map((d) => d.total), 1);
    document.getElementById("chart-ventas").innerHTML = dias
      .map(
        (d) => `
        <div class="chart-col${d.clave === hoyClave ? " hoy" : ""}">
          <span class="chart-val">${d.total > 0 ? moneda(d.total) : ""}</span>
          <div class="chart-bar" style="height:${Math.max((d.total / max) * 120, 4)}px" title="${moneda(d.total)}"></div>
          <span class="chart-label">${d.label}</span>
        </div>`
      )
      .join("");
  },

  renderTopProductos(ventas) {
    const conteo = {};
    ventas.forEach((v) => {
      v.items.forEach((i) => {
        conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad;
      });
    });
    const top = Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const contenedor = document.getElementById("top-productos");
    if (!top.length) {
      contenedor.innerHTML = estadoVacio(
        "carrito",
        "Aún no hay ventas",
        "Las ventas del periodo aparecerán aquí."
      );
      return;
    }
    contenedor.innerHTML = top
      .map(
        (t, i) => `
        <div class="top-item">
          <div class="rank">${i + 1}</div>
          <div class="top-nombre">${esc(t[0])}</div>
          <div class="top-cant">${t[1]} uds.</div>
        </div>`
      )
      .join("");
  },

  renderStockBajo(productos) {
    const bajo = productos.filter((p) => p.stock <= p.stockMinimo).sort((a, b) => a.stock - b.stock);
    const contenedor = document.getElementById("stock-bajo");
    if (!bajo.length) {
      contenedor.innerHTML = estadoVacio(
        "ok",
        "Todo en orden",
        "Ningún producto está en nivel bajo."
      );
      return;
    }
    contenedor.innerHTML = bajo
      .map((p) => `
        <div class="top-item">
          <div class="rank">${p.icono}</div>
          <div class="top-nombre"><strong>${esc(p.nombre)}</strong><br><small>Mínimo ${p.stockMinimo}</small></div>
          <div class="top-cant" style="color:var(--danger)">${p.stock} uds.</div>
        </div>`)
      .join("");
  },

  renderChartCategorias() {
    const conteo = Inventario.porCategoria();
    const entradas = Object.entries(conteo);
    const max = Math.max(...entradas.map((e) => e[1]), 1);
    document.getElementById("chart-categorias").innerHTML = entradas
      .map(
        (e) => `
        <div class="chart-col">
          <div class="chart-bar" style="height:${Math.max((e[1] / max) * 120, 4)}px" title="${e[1]}"></div>
          <span>${esc(e[0])}</span>
        </div>`
      )
      .join("");
  }
};