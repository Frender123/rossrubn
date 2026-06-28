# ObrasPresup v3.0 — Ajustador de Presupuesto de Obra Civil

Sistema web responsive para ajustar cantidades de ítems hasta cuadrar con un monto objetivo.

## Características

- **Login** con sesión protegida por usuario/contraseña
- **Importación directa de archivo Excel** (.xlsx / .xls / .csv) con mapeo de columnas automático
- **Pegar desde Excel** (Ctrl+V) con detección automática de separadores (coma o punto)
- **Exportar** resultado a Excel (.xlsx) con encabezado institucional
- **4 métodos de ajuste**: proporcional, solo seleccionados, mayor peso absorbe, por porcentaje
- **Selector de decimales**: 0 a 4 decimales en cantidades
- **Condiciones por ítem**: cantidad mínima (≥) y máxima (≤)
- **Bloqueo de ítems**: protege la cantidad de un ítem del ajuste
- **Historial de ajustes**: guarda los últimos 10, con botón de restaurar
- **Advertencia** de ítems con precio cero antes de ajustar
- **Responsive**: funciona en móvil y PC

## Usuarios

| Usuario | Contraseña | Rol   |
|---------|-----------|-------|
| admin   | 1234      | Admin |
| ruben   | molle     | User  |
| planif  | planif    | User  |

Para agregar usuarios, edita el array `USERS` en `js/auth.js`.

## Estructura

```
presupuesto-obra/
├── index.html      ← Login
├── app.html        ← App principal
├── css/
│   ├── styles.css  ← Base compartida
│   ├── login.css   ← Estilos del login
│   └── app.css     ← Estilos de la app
└── js/
    ├── auth.js     ← Autenticación y sesión
    └── app.js      ← Toda la lógica del ajustador
```

## Cómo usar

### Importar desde archivo Excel
1. Haz clic en **"Archivo Excel"**
2. Selecciona o arrastra tu archivo `.xlsx`
3. La app detecta automáticamente los encabezados y sugiere el mapeo de columnas
4. Ajusta el mapeo si es necesario y haz clic en **"Importar"**
5. Los números vienen como valores puros — sin problemas de separadores

### Pegar desde Excel
1. Haz clic en **"Pegar desde Excel"**
2. En Excel, selecciona las filas (sin encabezado) y copia con Ctrl+C
3. Haz clic en la zona verde y pega con Ctrl+V
4. La app detecta automáticamente si el decimal es coma o punto

### Ajustar cantidades
1. Define el **monto objetivo**
2. Elige los **decimales** (0-4)
3. Selecciona el **método** de ajuste
4. Para métodos "Solo seleccionados" o "Mayor peso": marca los ítems con el checkbox
5. Opcionalmente define condiciones mínimas/máximas por ítem
6. Haz clic en **"Ajustar cantidades"**

### Bloquear un ítem
Haz clic en el ícono de candado en el ítem — su cantidad no será modificada por ningún ajuste.

### Restaurar un ajuste anterior
En el **Historial**, haz clic en el botón ↩ del ajuste que quieres restaurar.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub
2. Sube todos los archivos
3. Ve a **Settings → Pages → Branch: main → / (root)**
4. Tu URL: `https://tuusuario.github.io/presupuesto-obra/`

## Notas técnicas

- Sin backend — funciona con archivos estáticos
- No requiere instalación ni servidor
- Compatible con Chrome, Firefox, Edge, Safari
- SheetJS para lectura/escritura de Excel
