// Proxy de ESPN para el registro partido a partido de un jugador.
// Consulta la temporada solicitada y, si aún no tiene partidos, prueba la anterior.
export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim();
  const season = Number(req.query?.season || 2027);
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Falta un ID ESPN válido de jugador.' });
  if (!Number.isInteger(season) || season < 2000 || season > 2100) return res.status(400).json({ error: 'Temporada no válida.' });
  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const fetchLog = async (year) => {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${encodeURIComponent(id)}/gamelog?season=${year}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`ESPN HTTP ${response.status}`);
    return response.json();
  };
  try {
    let usedSeason = season;
    let data = await fetchLog(season);
    let events = Array.isArray(data.events) ? data.events : [];
    if (!events.length) {
      usedSeason = season - 1;
      data = await fetchLog(usedSeason);
      events = Array.isArray(data.events) ? data.events : [];
    }
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
    return res.status(200).json({ athleteId: id, season: usedSeason, data });
  } catch (error) {
    return res.status(502).json({ error: 'No se pudo obtener el registro de partidos de ESPN.', detail: String(error?.message || error) });
  }
}
