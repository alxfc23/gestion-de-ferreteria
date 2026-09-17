const Configuracion = {
  render() {
    const cfg = Store.bd.configuracion || {};
    const campo = document.getElementById("cfg-comision-tarjeta");
    if (campo) campo.value = Number(cfg.comision_tarjeta) || 0;
    const chk = document.getElementById("cfg-ocultar-montos");
    if (chk) chk.checked = cfg.ocultar_montos === true;
  },

  leer() {
    const n = Number(document.getElementById("cfg-comision-tarjeta").value);
    return {
      comision_tarjeta: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0,
      ocultar_montos: document.getElementById("cfg-ocultar-montos").checked
    };
  },

  async guardar() {
    try {
      const configuracion = await Store.guardarConfiguracion(this.leer());
      Store.bd.configuracion = configuracion;
      Estadisticas.aplicarMontosInicial();
      App.mostrarToast("Configuración guardada.", "success");
    } catch (e) {
      App.mostrarToast(e.message, "error");
    }
  }
};