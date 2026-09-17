const CAT_STOCK_BAJO = "__stock_bajo__";

const Categorias = (() => {
  const lista = [
    "Herramientas",
    "Fijaciones",
    "Medición",
    "Pinturas",
    "Cerrajería",
    "Protección",
    "Electricidad",
    "Plomería"
  ];
  const formulario = document.getElementById("filtro-categoria");
  function llenarSelect() {
    formulario.innerHTML = "";
    formulario.appendChild(new Option("Todas las categorías", ""));
    lista.forEach((c) => formulario.appendChild(new Option(c, c)));
    formulario.appendChild(new Option("Stock bajo", CAT_STOCK_BAJO));
  }
  return { lista, llenarSelect, formulario };
})();

const UNIDADES = [
  { clave: "pz", nombre: "Pieza (pz)" },
  { clave: "kg", nombre: "Kilogramo (kg)" },
  { clave: "g", nombre: "Gramo (g)" },
  { clave: "m", nombre: "Metro (m)" },
  { clave: "cm", nombre: "Centímetro (cm)" },
  { clave: "l", nombre: "Litro (L)" },
  { clave: "ml", nombre: "Mililitro (ml)" },
  { clave: "caja", nombre: "Caja" },
  { clave: "paquete", nombre: "Paquete" },
  { clave: "par", nombre: "Par" },
  { clave: "rollo", nombre: "Rollo" },
  { clave: "juego", nombre: "Juego" }
];

function redimensionarImagen(file, maxLado = 400) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        let ancho = img.width;
        let alto = img.height;
        const escala = Math.min(1, maxLado / Math.max(ancho, alto));
        ancho = Math.max(1, Math.round(ancho * escala));
        alto = Math.max(1, Math.round(alto * escala));
        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ancho, alto);
        ctx.drawImage(img, 0, 0, ancho, alto);
        const tipo = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(tipo, 0.85));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

const Inventario = {
  buscarTexto: "",
  categoria: "",

  listar() {
    const texto = this.buscarTexto.trim().toLowerCase();
    return Store.bd.productos.filter((p) => {
      const coincideTexto =
        !texto ||
        p.nombre.toLowerCase().includes(texto) ||
        p.codigo.toLowerCase().includes(texto) ||
        p.categoria.toLowerCase().includes(texto);
      let coincideCat;
      if (!this.categoria) coincideCat = true;
      else if (this.categoria === CAT_STOCK_BAJO) coincideCat = p.stock <= p.stockMinimo;
      else coincideCat = p.categoria === this.categoria;
      return coincideTexto && coincideCat;
    });
  },

  abrirModalExportar() {
    App.abrirModal({
      titulo: "Exportar productos",
      body: `<p>¿Qué productos quieres exportar a CSV?</p>`,
      botones: [
        {
          texto: "Todo el inventario",
          clase: "btn-primary",
          onClick: () => {
            App.cerrarModal();
            this.exportarCSV("todo");
          }
        },
        {
          texto: "Solo stock bajo",
          clase: "btn",
          onClick: () => {
            App.cerrarModal();
            this.exportarCSV("bajo");
          }
        }
      ],
      soloCerrar: true
    });
  },

  exportarCSV(filtro) {
    const base = Store.bd.productos
      .slice()
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    const productos = filtro === "bajo" ? base.filter((p) => p.stock <= p.stockMinimo) : base;
    if (!productos.length) {
      App.mostrarToast(
        filtro === "bajo" ? "No hay productos con stock bajo." : "No hay productos para exportar.",
        "error"
      );
      return;
    }
    const filas = [
      [
        "Código",
        "Nombre",
        "Categoría",
        "Unidad",
        "Costo",
        "Precio",
        "Precio mayoreo",
        "Mín. mayoreo",
        "Stock",
        "Stock mínimo",
        "Con imagen"
      ]
    ];
    productos.forEach((p) => {
      const unidad = (UNIDADES.find((u) => u.clave === p.unidad) || {}).clave || "pz";
      filas.push([
        p.codigo,
        p.nombre,
        p.categoria,
        unidad,
        Number(p.costo).toFixed(2),
        Number(p.precio).toFixed(2),
        Number(p.precioMayoreo || 0).toFixed(2),
        Number(p.mayoreoMinimo || 0),
        p.stock,
        p.stockMinimo,
        p.imagen ? "Sí" : "No"
      ]);
    });
    const prefijo = filtro === "bajo" ? "stock_bajo_" : "inventario_";
    descargarCSV(prefijo + diaClave(new Date()) + ".csv", filas);
    App.mostrarToast("Se exportaron " + productos.length + " productos.");
  },

  armarProducto(datosForm) {
    return {
      id: datosForm.id || uid(),
      codigo: datosForm.codigo.trim().toUpperCase(),
      nombre: datosForm.nombre.trim(),
      categoria: datosForm.categoria,
      costo: Number(datosForm.costo) || 0,
      precio: Number(datosForm.precio) || 0,
      stock: Number(datosForm.stock) || 0,
      stockMinimo: Number(datosForm.stockMinimo) || 0,
      icono: datosForm.icono || "📦",
      unidad: UNIDADES.some((u) => u.clave === datosForm.unidad) ? datosForm.unidad : "pz",
      precioMayoreo: Number(datosForm.precioMayoreo) || 0,
      mayoreoMinimo: Math.max(0, Math.floor(Number(datosForm.mayoreoMinimo)) || 0),
      imagen: datosForm.imagen || ""
    };
  },

  async guardar(producto, esNuevo) {
    try {
      await Store.guardarProducto(producto, esNuevo);
      await Store.cargarDatos();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async eliminar(id) {
    await Store.eliminarProducto(id);
    await Store.cargarDatos();
  },

  obtenerStockBajo() {
    return Store.bd.productos.filter((p) => p.stock <= p.stockMinimo);
  },

  porCategoria() {
    const res = {};
    Store.bd.productos.forEach((p) => {
      res[p.categoria] = (res[p.categoria] || 0) + 1;
    });
    return res;
  },

  render() {
    const productos = this.listar();
    const tbody = document.getElementById("productos-body");
    const vacio = document.getElementById("productos-vacio");
    tbody.innerHTML = "";

    if (!productos.length) {
      vacio.innerHTML = Store.bd.productos.length
        ? estadoVacioHTML("buscar", "Sin resultados", "Ningún producto coincide con la búsqueda.")
        : estadoVacioHTML("vacio", "Aún no hay productos", "Crea tu primer producto para empezar.");
      vacio.classList.remove("hidden");
      return;
    }
    vacio.classList.add("hidden");

    productos.forEach((p) => {
      const stockBajo = p.stock <= p.stockMinimo;
      const badge = stockBajo
        ? '<span class="badge badge-stock-bajo">Bajo</span>'
        : '<span class="badge badge-stock-ok">OK</span>';
      const visual = p.imagen
        ? `<img class="prod-thumb" src="${p.imagen}" alt="${esc(p.nombre)}" data-accion="ver-imagen" data-nombre="${esc(p.nombre)}" />`
        : '<span class="prod-placeholder"></span>';
      const ref = Math.max(p.stockMinimo * 2, 1);
      const pct = Math.max(4, Math.min(100, Math.round((p.stock / ref) * 100)));
      const nivel = stockBajo ? "bajo" : p.stock <= p.stockMinimo * 1.5 ? "medio" : "ok";
      const precio = Number(p.precio) || 0;
      const costo = Number(p.costo) || 0;
      const margen = precio - costo;
      const margenPct = precio > 0 ? Math.round((margen / precio) * 100) : 0;
      const margenClase = margen > 0 ? "margen-ok" : margen < 0 ? "margen-neg" : "margen-cero";
      const tieneMayoreo = (Number(p.precioMayoreo) || 0) > 0 && (Number(p.mayoreoMinimo) || 0) > 0;
      const etiquetaMayoreo = tieneMayoreo
        ? '<span class="etiqueta-mayoreo">(mayoreo)</span>'
        : "";
      const esAdmin = !!(App.sesion && App.sesion.rol === "admin");
      const acciones = esAdmin
        ? `<div class="text-acciones">
             <button class="icon-btn" data-accion="editar" data-id="${p.id}" title="Editar">Editar</button>
             <button class="icon-btn" data-accion="eliminar" data-id="${p.id}" title="Eliminar">Eliminar</button>
           </div>`
        : '<span class="text-light">—</span>';
      const tr = document.createElement("tr");
      tr.dataset.id = p.id;
      tr.innerHTML = `
        <td>${esc(p.codigo)}</td>
        <td>${visual} ${esc(p.nombre)} ${etiquetaMayoreo}</td>
        <td>${chipCategoria(p.categoria)}</td>
        <td>${esc(p.unidad || "pz")}</td>
        <td>${moneda(p.costo)} / ${esc(p.unidad || "pz")}</td>
        <td>${moneda(p.precio)} / ${esc(p.unidad || "pz")}</td>
        <td>
          <div class="margen-cell">
            <span class="${margenClase}">${moneda(margen)}</span>
            <small>${margenPct}%</small>
          </div>
        </td>
        <td>
          <div class="stock-cell">
            <span>${p.stock} ${esc(p.unidad || "pz")} ${badge}</span>
            <span class="stock-bar"><span class="stock-fill nivel-${nivel}" style="width:${pct}%"></span></span>
          </div>
        </td>
        <td>${acciones}</td>`;
      tbody.appendChild(tr);
    });
  },

  abrirModal(editar) {
    const esNuevo = !editar;
    const p = editar
      ? Store.bd.productos.find((x) => x.id === editar)
      : {
          id: "",
          codigo: "",
          nombre: "",
          categoria: Categorias.lista[0],
          costo: "",
          precio: "",
          stock: "",
          stockMinimo: "",
          unidad: "pz",
          precioMayoreo: "",
          mayoreoMinimo: "",
          imagen: ""
        };

    const opcionesCat = Categorias.lista
      .map((c) => `<option value="${c}" ${c === p.categoria ? "selected" : ""}>${c}</option>`)
      .join("");
    const opcionesUnidad = UNIDADES.map(
      (u) => `<option value="${u.clave}" ${u.clave === (p.unidad || "pz") ? "selected" : ""}>${u.nombre}</option>`
    ).join("");
    const usaMayoreo = Number(p.precioMayoreo) > 0 && Number(p.mayoreoMinimo) > 0;
    let imagenActual = p.imagen || "";

    App.abrirModal({
      titulo: esNuevo ? "Nuevo producto" : "Editar producto",
      body: `
        <input type="hidden" id="prod-id" value="${esc(p.id)}" />
        <label>Código</label>
        <input id="prod-codigo" value="${esc(p.codigo)}" />
        <label>Nombre del producto</label>
        <input id="prod-nombre" value="${esc(p.nombre)}" />

        <h4 class="modal-section">Imagen</h4>
        <div class="imagen-fila">
          <div class="imagen-preview" id="prod-imagen-preview"></div>
          <div class="imagen-controles">
            <input type="file" id="prod-imagen-file" accept="image/*" />
            <button type="button" class="btn" id="prod-imagen-quitar">Quitar imagen</button>
          </div>
        </div>
        <div class="modal-grid">
          <div>
            <label>Categoría</label>
            <select id="prod-categoria">${opcionesCat}</select>
          </div>
          <div>
            <label>Unidad de venta</label>
            <select id="prod-unidad">${opcionesUnidad}</select>
          </div>
        </div>

        <h4 class="modal-section">Precios</h4>
        <div class="modal-grid">
          <div>
            <label>Costo</label>
            <input id="prod-costo" type="number" min="0" step="0.01" value="${p.costo}" />
            <span class="campo-unidad">/<span data-leyenda-unidad>${p.unidad || "pz"}</span></span>
          </div>
          <div>
            <label>Precio de venta</label>
            <input id="prod-precio" type="number" min="0" step="0.01" value="${p.precio}" />
            <span class="campo-unidad">/<span data-leyenda-unidad>${p.unidad || "pz"}</span></span>
          </div>
        </div>
        <label class="switch-line">
          <input type="checkbox" id="prod-mayoreo" ${usaMayoreo ? "checked" : ""} />
          <span>Maneja precio de mayoreo</span>
        </label>
        <div id="campos-mayoreo" class="hidden">
          <div class="modal-grid">
            <div>
              <label>Precio de mayoreo</label>
              <input id="prod-preciomay" type="number" min="0" step="0.01" value="${p.precioMayoreo}" />
              <span class="campo-unidad">/<span data-leyenda-unidad>${p.unidad || "pz"}</span></span>
            </div>
            <div>
              <label>Cantidad mínima para mayoreo</label>
              <input id="prod-maymin" type="number" min="1" value="${p.mayoreoMinimo}" />
              <span class="campo-unidad"><span data-leyenda-unidad>${p.unidad || "pz"}</span></span>
            </div>
          </div>
        </div>

        <h4 class="modal-section">Inventario</h4>
        <div class="modal-grid">
          <div>
            <label>Stock actual</label>
            <input id="prod-stock" type="number" min="0" step="1" value="${p.stock}" />
            <span class="campo-unidad"><span data-leyenda-unidad>${p.unidad || "pz"}</span></span>
          </div>
          <div>
            <label>Stock mínimo</label>
            <input id="prod-stockmin" type="number" min="0" step="1" value="${p.stockMinimo}" />
            <span class="campo-unidad"><span data-leyenda-unidad>${p.unidad || "pz"}</span></span>
          </div>
        </div>
      `,
      onAceptar: async () => {
        const usaMayoreo = document.getElementById("prod-mayoreo").checked;
        const form = {
          id: document.getElementById("prod-id").value,
          codigo: document.getElementById("prod-codigo").value,
          nombre: document.getElementById("prod-nombre").value,
          categoria: document.getElementById("prod-categoria").value,
          unidad: document.getElementById("prod-unidad").value,
          costo: document.getElementById("prod-costo").value,
          precio: document.getElementById("prod-precio").value,
          stock: document.getElementById("prod-stock").value,
          stockMinimo: document.getElementById("prod-stockmin").value,
          precioMayoreo: usaMayoreo ? document.getElementById("prod-preciomay").value : "0",
          mayoreoMinimo: usaMayoreo ? document.getElementById("prod-maymin").value : "0",
          imagen: imagenActual
        };
        if (!form.nombre.trim() || !form.codigo.trim()) {
          App.mostrarToast("Nombre y código son obligatorios.", "error");
          return;
        }
        if (usaMayoreo) {
          const min = Number(form.mayoreoMinimo);
          const may = Number(form.precioMayoreo);
          if (!(may > 0) || !(min >= 1)) {
            App.mostrarToast(
              "Para mayoreo ingresa precio y cantidad mínima mayor o igual a 1.",
              "error"
            );
            return;
          }
        }
        const res = await Inventario.guardar(Inventario.armarProducto(form), esNuevo);
        if (!res.ok) {
          App.mostrarToast(res.error, "error");
          return;
        }
        Caja.actualizarLista();
        Estadisticas.render();
        Inventario.render();
        App.cerrarModal();
        App.mostrarToast(esNuevo ? "Producto creado." : "Producto actualizado.", "success");
      }
    });

    const mayoreoCheck = document.getElementById("prod-mayoreo");
    const camposMay = document.getElementById("campos-mayoreo");
    const sincronizarMayoreo = () => camposMay.classList.toggle("hidden", !mayoreoCheck.checked);
    mayoreoCheck.addEventListener("change", sincronizarMayoreo);
    sincronizarMayoreo();

    document.getElementById("prod-unidad").addEventListener("change", () => {
      const u = document.getElementById("prod-unidad").value;
      document.querySelectorAll("[data-leyenda-unidad]").forEach((el) => (el.textContent = u));
    });

    const preview = document.getElementById("prod-imagen-preview");
    const archivo = document.getElementById("prod-imagen-file");
    const btnQuitar = document.getElementById("prod-imagen-quitar");
    const pintarPreview = () => {
      if (imagenActual) {
        preview.innerHTML = `<img src="${imagenActual}" alt="Imagen del producto" />`;
        btnQuitar.classList.remove("hidden");
      } else {
        preview.innerHTML = '<span class="imagen-vacia">Sin imagen</span>';
        btnQuitar.classList.add("hidden");
      }
    };
    archivo.addEventListener("change", () => {
      const f = archivo.files && archivo.files[0];
      archivo.value = "";
      if (!f) return;
      redimensionarImagen(f)
        .then((dataUrl) => {
          imagenActual = dataUrl;
          pintarPreview();
        })
        .catch(() => App.mostrarToast("No se pudo leer la imagen.", "error"));
    });
    btnQuitar.addEventListener("click", () => {
      imagenActual = "";
      pintarPreview();
    });
    pintarPreview();
  }
};