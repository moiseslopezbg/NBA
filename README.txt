NBA Analytics para Vercel — ESPN
=================================
Contenido:
- index.html
- api/scoreboard.js
- api/teams.js
- api/players.js
- api/player-stats.js

Instalación:
1. Descomprime el ZIP.
2. Sube index.html y la carpeta api completa a la raíz del repositorio GitHub conectado a Vercel.
3. Confirma que api/player-stats.js está dentro de la carpeta api.
4. Haz un nuevo deployment en Vercel y abre la URL publicada.

Estadísticas:
- Las plantillas se obtienen desde ESPN.
- Para evitar cientos de solicitudes a la vez, los registros por partido se consultan bajo demanda para los primeros 30 jugadores que coincidan con la búsqueda/equipo.
- Se calculan promedios PTS, REB, AST, 3PM y PRA y el hit rate Over respecto a la línea elegida, usando los últimos 5/10/20 partidos disponibles.
- Se consultan y combinan hasta cinco temporadas (2026-27 a 2022-23) para reunir el historial más reciente disponible.
- ESPN es una API pública no oficial y puede cambiar el formato o limitar las solicitudes. Los resultados pueden tardar en aparecer y no se muestran datos inventados.

Interfaz de jugadores:
- Se ha simplificado a un único selector de jugador. Al elegirlo aparecen sus promedios calculados sobre los últimos 20 partidos disponibles y la tabla con esos 20 encuentros, aunque correspondan a temporadas distintas.

Corrección adicional de consulta estadística:
- La API prueba hasta cinco temporadas: 2026-27, 2025-26, 2024-25, 2023-24 y 2022-23 (año de finalización).
- Busca registros tanto en la lista principal events como en estructuras anidadas de ESPN y devuelve qué temporadas ha consultado si no encuentra partidos.
- La interfaz combina los partidos de las temporadas consultadas, los ordena por fecha y muestra los 20 más recientes; la etiqueta indica que se han mezclado varias temporadas.
