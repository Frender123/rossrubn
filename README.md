# ObrasPresup — Ajustador de Presupuesto de Obra Civil

Sistema web para ajustar cantidades de ítems de presupuesto de obra hasta cuadrar con un monto objetivo.

## Características

- Login con sesión protegida
- Importar tabla pegando directamente desde Excel (Ctrl+V)
- Exportar resultado a Excel (.xlsx)
- Tres métodos de ajuste: proporcional, por selección, o absorbiendo en el ítem mayor
- Diseño responsive — funciona en móvil y PC
- Sin backend — funciona con archivos estáticos

## Usuarios de demostración

| Usuario | Contraseña |
|---------|------------|
| admin   | 1234       |
| ruben   | molle      |
| planif  | planif     |

## Estructura del proyecto

```
presupuesto-obra/
├── index.html        ← Pantalla de login
├── app.html          ← App principal
├── css/
│   ├── styles.css    ← Estilos base compartidos
│   ├── login.css     ← Estilos del login
│   └── app.css       ← Estilos de la app
└── js/
    ├── auth.js       ← Lógica de autenticación
    └── app.js        ← Lógica del ajustador
```

## Uso

1. Abre `index.html` en el navegador
2. Ingresa con usuario `admin` / contraseña `1234`
3. Carga tus ítems (manualmente, con el ejemplo, o pegando desde Excel)
4. Define el monto objetivo y elige el método de ajuste
5. Presiona **Ajustar cantidades**
6. Exporta el resultado a Excel

## Cómo importar desde Excel

1. En Excel, selecciona las filas con datos (sin encabezado)
2. Copia con **Ctrl+C**
3. En la app, haz clic en la zona verde de pegado
4. Pega con **Ctrl+V**

Columnas reconocidas: `Descripción | Unidad | Cantidad | Precio unitario`

## GitHub Pages

Para publicarlo en GitHub Pages:

1. Sube el proyecto a un repositorio GitHub
2. Ve a **Settings → Pages**
3. Selecciona la rama `main` y carpeta `/root`
4. La URL pública será `https://tuusuario.github.io/presupuesto-obra/`

## Agregar usuarios

Edita el archivo `js/auth.js` y agrega entradas al array `USERS`:

```js
const USERS = [
  { username: 'admin', password: '1234', name: 'Administrador', role: 'admin' },
  { username: 'nuevo', password: 'clave', name: 'Nuevo Usuario', role: 'user' },
];
```

---

Desarrollado para Subalcaldía Molle · Gobierno Autónomo Municipal de Cochabamba
