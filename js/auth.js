const Login = {
  init() {
    document.getElementById("form-login").addEventListener("submit", (e) => {
      e.preventDefault();
      this.entrar();
    });
  },

  async entrar() {
    const correo = document.getElementById("login-correo").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    errEl.textContent = "";
    try {
      const { usuario, token } = await Store.iniciarSesion(correo, password);
      Store.setSesion({ userId: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
      Store.setToken(token);
      document.getElementById("form-login").reset();
      await App.mostrarApp(usuario);
    } catch (e) {
      errEl.textContent = e.message;
    }
  },

  salir() {
    Store.cerrarSesion();
    App.mostrarLogin();
  }
};