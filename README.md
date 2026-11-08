# GeometryDash Frontend

Aplicación independiente en **React + TypeScript + Vite**, con editor y juego Canvas. El nombre local de esta carpeta puede cambiar: ningún archivo depende de llamarse `GeometryDash-web` ni de tener el backend en una ruta hermana.

## Ejecutar

Requisitos: Node.js **24 o superior** y npm. La API debe estar disponible en http://localhost:5080 para las funciones con servidor.

```powershell
npm ci
npm run dev
```

Abre **http://localhost:5173**. El proxy de `vite.config.ts` conecta `/api`, `/openapi` y `/health` con la API. Si cambias la dirección de la API, modifica ese destino. La API debe permitir el origen del navegador.

No necesitas clonar el backend si ya tienes una API compatible ejecutándose en otro lugar accesible por el proxy. La ruta `/play/demo` funciona como práctica sin API ni cuenta. La conexión a PostgreSQL y sus contraseñas solo pertenecen al backend.

## Estructura

```text
src/
  pages/              catálogo, acceso, cuenta, biblioteca, docs, administración
  editor/             editor y reglas de validación
  game/               física, dibujo Canvas y resultados pendientes
  lib/                HTTP y almacenamiento local
  auth.tsx            sesión y rutas privadas
  types.ts            contrato de datos
tests/                pruebas del motor y del editor
scripts/              comprobación de fuente
docs/                 arquitectura y publicación
package.json
package-lock.json
vite.config.ts
```

## Pantallas

Inicio, catálogo con filtros/paginación, ficha, registro/login, perfil, creación, biblioteca de niveles/favoritos/completados, editor, juego, documentación OpenAPI y administración por rol. La recuperación de contraseña y el replay no están disponibles en la API actual.

El editor permite colocar, seleccionar, mover por coordenadas, duplicar y eliminar cubos/triángulos/plataformas; deshacer/rehacer; zoom y desplazamiento; editar metadatos, velocidad, inicio y meta; prueba local; autosave e If-Match; recuperación de copias y descarga JSON. El juego usa pasos fijos de 120 Hz y pausa al perder foco. Los resultados remotos son ClientReported.

El token Bearer solo vive en memoria. Las cookies HttpOnly las administra la API. localStorage guarda copias por cuenta/nivel/revisión, resultados pendientes y preferencias de control; no almacena contraseñas ni tokens.

## Comprobar y construir

```powershell
npm test
npm run build
npm run preview
```

Hay 25 pruebas del motor y del editor. El build comprueba tipos y genera `dist/`. Se usa el cargador nativo de configuración de Vite, compatible con Node 24+, para cargar TypeScript sin el empaquetado previo del archivo de configuración. `preview` sirve localmente en 5173 con proxy a la API; detén antes `dev` para liberar ese puerto. No uses `preview` como servidor público de producción.

`.github/workflows/checks.yml` ejecuta instalación reproducible, pruebas y build al subir el repositorio a GitHub; no despliega.

## Publicar

Publica el contenido generado en `dist/` en un servidor estático con fallback a `index.html`. Debe existir un proxy real que envíe `/api`, `/openapi` y `/health` al backend, porque las solicitudes son relativas al origen del sitio. El proxy de Vite no forma parte del build.

Dos repositorios no obligan a usar dos dominios: un sitio HTTPS único con frontend estático y API detrás de un proxy conserva la sesión actual de forma más sencilla. Si decides separar dominios, debes adaptar el cliente HTTP, CORS, cookies y controles de origen de forma conjunta; subir solo `dist/` sin una API/proxy no habilita registro ni guardado.

Guía completa: [arquitectura y publicación](docs/arquitectura-y-publicacion.md), también [en Word](docs/arquitectura-y-publicacion.docx).

## Subir como repositorio independiente

Git está inicializado en esta carpeta con rama `main`; no hay commit ni remoto configurados. Crea un remoto vacío, por ejemplo `geometrydash-frontend`, y ejecuta aquí:

```powershell
git status
git add .
git diff --cached --name-only
git commit -m "Proyecto inicial del frontend"
git remote add origin https://github.com/TU_USUARIO/geometrydash-frontend.git
git push -u origin main
```

Se incluyen el lockfile y el código fuente. Se excluyen `node_modules/`, `dist/`, cachés y archivos de entorno locales. Revisa la lista antes del commit y utiliza tu propia autenticación para el push.
