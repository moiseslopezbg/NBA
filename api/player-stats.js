// Proxy de ESPN para el registro partido a partido. Prueba varias temporadas
// porque la temporada en curso puede no tener aún partidos regulares registrados.
function extractEvents(data) {
  if (Array.isArray(data?.events) && data.events.length) return data.events;
  // Algunas respuestas de ESPN organizan los registros por tipo/categoría.
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.events) && node.events.length && node.events[0]?.stats) found.push(...node.events);
    if (Array.isArray(node)) node.forEach(visit);
    else for (const [key, value] of Object.entries(node)) {
      if (key !== 'events') visit(value);
    }
  };
  visit(data);
  return [...new Map(found.map(e => [String(e.id || e.date || JSON.stringify(e.stats)), e])).values()];
}
export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim();
  const requestedSeason = Number(req.query?.season || 2027);
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Falta un ID ESPN válido de jugador.' });
  if (!Number.isInteger(requestedSeason) || requestedSeason < 2000 || requestedSeason > 2100) return res.status(400).json({ error: 'Temporada no válida.' });
  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const tried = [];
  try {
    // Años de finalización de temporada: 2027 = 2026-27, 2026 = 2025-26, etc.
    for (const year of [requestedSeason, requestedSeason - 1, requestedSeason - 2, requestedSeason - 3, requestedSeason - 4]) {
      try {
        const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${encodeURIComponent(id)}/gamelog?season=${year}`;
        const response = await fetch(url, { headers });
        if (!response.ok) { tried.push({ season: year, status: response.status, events: 0 }); continue; }
        const data = await response.json();
        const events = extractEvents(data);
        tried.push({ season: year, status: response.status, events: events.length });
        if (events.length) {
          // Devolver el payload normalizado para que el frontend siempre lea data.events.
          const normalized = { ...data, events };
          res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
          return res.status(200).json({ athleteId: id, season: year, data: normalized, eventsFound: events.length, seasonsChecked: tried });
        }
      } catch (e) { tried.push({ season: year, error: String(e?.message || e), events: 0 }); }
    }
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({ athleteId: id, season: null, data: { labels: [], events: [] }, eventsFound: 0, seasonsChecked: tried, error: 'ESPN no devolvió registros por partido en las últimas cinco temporadas consultadas.' });
  } catch (error) {
    return res.status(502).json({ error: 'No se pudo obtener el registro de partidos de ESPN.', detail: String(error?.message || error), seasonsChecked: tried });
  }
}
