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
function eventDate(e) {
  const candidates = [e?.date, e?.eventDate, e?.gameDate, e?.datePlayed, e?.startDate, e?.event?.date, e?.event?.eventDate, e?.competitions?.[0]?.date, e?.event?.competitions?.[0]?.date];
  for (const value of candidates) { if (value) { const d = new Date(value); if (!Number.isNaN(d.getTime())) return d.toISOString(); } }
  return '';
}
function teamName(x) {
  if (typeof x === 'string') return x;
  return x?.displayName || x?.shortDisplayName || x?.fullName || x?.name || x?.abbreviation || x?.team?.displayName || x?.team?.shortDisplayName || x?.team?.name || x?.team?.abbreviation || '';
}
async function enrichEvent(e, headers) {
  const currentDate = eventDate(e);
  let currentOpponent = teamName(e?.opponent || e?.opponentTeam || e?.teamAgainst || e?.opponentName || e?.opp || e?.event?.opponent || e?.event?.opponentTeam);
  const competitors = e?.competitions?.[0]?.competitors || e?.event?.competitions?.[0]?.competitors || [];
  if (!currentOpponent && competitors.length) {
    const ownId = String(e?.teamId || e?.team?.id || e?.athleteTeamId || '');
    currentOpponent = teamName(competitors.find(c => ownId && String(c.team?.id || c.id || '') !== ownId)?.team || competitors.find(c => c.homeAway && c.homeAway !== e?.homeAway)?.team || competitors[1]?.team || competitors[1]);
  }
  if (currentDate && currentOpponent) return { ...e, date: currentDate, opponent: currentOpponent };
  const eventId = e?.id || e?.eventId || e?.event?.id;
  if (!eventId) return { ...e, date: currentDate, opponent: currentOpponent || '—' };
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(eventId)}`, { headers });
    if (!response.ok) return { ...e, date: currentDate, opponent: currentOpponent || '—' };
    const summary = await response.json();
    const competition = summary?.header?.competitions?.[0] || summary?.boxscore?.players?.[0]?.statistics?.[0]?.labels;
    const teams = competition?.competitors || summary?.header?.competitions?.[0]?.competitors || [];
    const date = currentDate || eventDate({ date: competition?.date || summary?.header?.competitions?.[0]?.date || summary?.gameInfo?.date || summary?.header?.season?.startDate });
    let opponent = currentOpponent;
    if (!opponent && teams.length) {
      const ownId = String(e?.teamId || e?.team?.id || e?.athleteTeamId || '');
      const other = teams.find(c => ownId && String(c.team?.id || c.id || '') !== ownId) || teams[1];
      opponent = teamName(other?.team || other);
    }
    return { ...e, date, opponent: opponent || '—' };
  } catch { return { ...e, date: currentDate, opponent: currentOpponent || '—' }; }
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim();
  const requestedSeason = Number(req.query?.season || 2027);
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Falta un ID ESPN válido de jugador.' });
  if (!Number.isInteger(requestedSeason) || requestedSeason < 2000 || requestedSeason > 2100) return res.status(400).json({ error: 'Temporada no válida.' });
  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const tried = [];
  const allEvents = [];
  let latestData = {};
  try {
    // Recorre todas las temporadas consultadas y combina los partidos para obtener
    // los 20 encuentros más recientes, aunque estén repartidos entre temporadas.
    for (const year of [requestedSeason, requestedSeason - 1, requestedSeason - 2, requestedSeason - 3, requestedSeason - 4]) {
      try {
        const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${encodeURIComponent(id)}/gamelog?season=${year}`;
        const response = await fetch(url, { headers });
        if (!response.ok) { tried.push({ season: year, status: response.status, events: 0 }); continue; }
        const data = await response.json();
        const events = extractEvents(data);
        tried.push({ season: year, status: response.status, events: events.length });
        if (events.length) {
          if (!latestData.labels && data.labels) latestData.labels = data.labels;
          if (!latestData.displayNames && data.displayNames) latestData.displayNames = data.displayNames;
          allEvents.push(...events.map(e => ({ ...e, _season: year })));
        }
      } catch (e) { tried.push({ season: year, error: String(e?.message || e), events: 0 }); }
    }
    const deduped = [...new Map(allEvents.map(e => [String(e.id || e.eventId || e.event?.id || e.date || JSON.stringify(e.stats)), e])).values()];
    // ESPN a veces devuelve estadísticas sin metadatos visibles de fecha/rival.
    // Completa esos campos desde el resumen del partido cuando haya un ID de evento.
    const enrichedEvents = await Promise.all(deduped.map((e, index) => index < 40 ? enrichEvent(e, headers) : Promise.resolve(e)));
    const uniqueEvents = enrichedEvents.sort((a, b) => new Date(b.date || b.eventDate || 0) - new Date(a.date || a.eventDate || 0));
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
    if (uniqueEvents.length) {
      return res.status(200).json({ athleteId: id, season: uniqueEvents[0]._season || requestedSeason, data: { ...latestData, events: uniqueEvents }, eventsFound: uniqueEvents.length, seasonsChecked: tried });
    }
    return res.status(200).json({ athleteId: id, season: null, data: { labels: [], events: [] }, eventsFound: 0, seasonsChecked: tried, error: 'ESPN no devolvió registros por partido en las últimas cinco temporadas consultadas.' });
  } catch (error) {
    return res.status(502).json({ error: 'No se pudo obtener el registro de partidos de ESPN.', detail: String(error?.message || error), seasonsChecked: tried });
  }
}
