// Proxy server-side para el endpoint de equipos de ESPN, que puede bloquear CORS.
export default async function handler(req, res) {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=100';
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return res.status(502).json({ error: `ESPN respondió HTTP ${response.status} al cargar equipos.` });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'No se pudo consultar la lista de equipos en ESPN.', detail: String(error?.message || error) });
  }
}
