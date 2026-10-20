// Vercel Serverless Function: proxy de ESPN para evitar problemas CORS en el navegador.
export default async function handler(req, res) {
  const date = typeof req.query.date === "string" ? req.query.date : "";
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "La fecha debe tener formato YYYY-MM-DD." });
  }
  const params = new URLSearchParams();
  if (date) params.set("dates", date.replaceAll("-", ""));
  const url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard" +
    (params.size ? `?${params.toString()}` : "");
  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      return res.status(502).json({ error: `ESPN respondió HTTP ${response.status}.` });
    }
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: "No se pudo consultar ESPN.", detail: String(error?.message || error) });
  }
}
