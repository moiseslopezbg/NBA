# NBA Analytics para Vercel

## Despliegue
1. Descomprime el proyecto.
2. Sube `index.html` y la carpeta `api/` a la raíz del repositorio de GitHub.
3. En Vercel, importa ese repositorio y despliega como proyecto estático con funciones serverless.
4. No hace falta configurar Streamlit ni Python.

La función `api/scoreboard.js` consulta ESPN desde el servidor de Vercel y evita que el navegador tenga que llamar directamente a ESPN, lo que soluciona los bloqueos CORS habituales. Si abres solo `index.html` como archivo local, la función de Vercel no estará disponible; publica el proyecto o usa el fallback directo.
