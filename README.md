<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/0a5f9541-df83-4d96-b791-d2ef3e470467" />
# Gestión de Ferretería

Sistema de **código abierto** de punto de venta e inventario para ferreterías. Frontend en HTML/CSS/JS puro, backend en Node.js + Express + MariaDB. Clónalo, configúralo y adáptalo a tu tienda: el nombre de la ferretería se cambia en unos segundos (busca "Ferretería" o "Perico" en el código para re-marcar tus tickets).

## Funciones

- Caja para ventas con carrito, mayoreo, métodos de pago y comisión por tarjeta
- Inventario de productos (código, costo, precio, stock, unidades, imágenes)
- Historial de ventas con filtros, exportar CSV y **corte de caja**
- **Cancelación de ventas** con devolución de stock y permisos de admin
- Usuarios con roles (admin / vendedor)
- Sección de **Configuración** (comisión de tarjeta, ocultar montos)
- Estadísticas e indicadores del negocio (ventas, ganancia, stock bajo)

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior
- [MariaDB](https://mariadb.org) (o MySQL) 10.4+ corriendo localmente

## Instalación

```bash
# 1) Clonar
git clone https://github.com/TU_USUARIO/gestion-de-ferreteria.git
cd gestion-de-ferreteria

# 2) Configurar la base (solo la primera vez)
cd backend
copy .env.example .env      # Windows
# cp .env.example .env      # Linux / macOS
#    y edita .env con tu usuario y contraseña de MariaDB

# 3) Instalar dependencias y crear la base
npm install
npm run setup

# 4) Arrancar
npm start
```

Abre el navegador en **http://localhost:3001**

> La base de datos y las tablas **se crean solas** la primera vez (`npm run setup` o al iniciar), e incluyen productos de ejemplo para probar.

## Usuarios de ejemplo (solo para bases nuevas)

| Rol      | Correo                 | Contraseña     |
|----------|------------------------|----------------|
| Admin    | admin@ferreteria.com   | admin123       |
| Vendedor | vendedor@ferreteria.com| vendedor123    |

> Para empezar con una base limpia (sin datos de ejemplo), **borra la base `ferreteria`** y desactiva el seed: elimina el bloque `SEED_PRODUCTOS` / `SEED_USUARIOS` al arrancar por primera vez, o simplemente borra los productos después de instalar.

## Configuración `backend/.env`

| Variable      | Descripción                          | Ejemplo            |
|---------------|--------------------------------------|--------------------|
| `DB_HOST`     | Servidor de MariaDB                  | `localhost`        |
| `DB_PORT`     | Puerto de MariaDB                    | `3306`             |
| `DB_USER`     | Usuario de la base                   | `root`             |
| `DB_PASSWORD` | Contraseña del usuario               | *(vacío en XAMPP)* |
| `DB_NAME`     | Nombre de la base (se crea sola)     | `ferreteria`       |
| `PORT`        | Puerto de la app web                 | `3001`             |
| `JWT_SECRET`  | Secreto de sesiones (cámbialo)       | `frase-secreta`    |

## Notas

- El archivo `.env` (con tus contraseñas) **nunca se sube a Git**: está en `.gitignore`. Solo se sube `.env.example`.
- En XAMPP, MariaDB suele usar `DB_PORT=3306` y `DB_PASSWORD` vacío.
- Para personalizar el nombre de tu ferretería en la app y tickets, busca y reemplaza "Ferretería" / "FERRETERÍA" en `index.html`, `js/app.js` y `js/sales.js`.
