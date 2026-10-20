// Devuelve plantillas NBA agregadas desde ESPN. Se consulta en servidor para evitar CORS.
const TEAMS = ['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
function collectPlayers(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) { for (const item of node) collectPlayers(item, out); return out; }
  if (typeof node !== 'object') return out;
  if (node.id && (node.fullName || node.displayName || node.firstName || node.lastName)) out.push(node);
  for (const key of ['athletes', 'items', 'players', 'entries']) if (node[key]) collectPlayers(node[key], out);
  return out;
}
export default async function handler(req, res) {
  try {
    const results = await Promise.all(TEAMS.map(async abbr => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${abbr}/roster`;
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return { team: abbr, players: [], error: `HTTP ${response.status}` };
        const data = await response.json();
        const players = collectPlayers(data.athletes || data.roster || data);
        const unique = [...new Map(players.map(p => [String(p.id), p])).values()];
        return { team: abbr, players: unique.map(p => ({ id: String(p.id), name: p.fullName || p.displayName || [p.firstName,p.lastName].filter(Boolean).join(' '), position: p.position?.abbreviation || p.position?.name || '', team: abbr })) };
      } catch (e) { return { team: abbr, players: [], error: String(e?.message || e) }; }
    }));
    const players = results.flatMap(r => r.players);
    if (!players.length) return res.status(502).json({ error: 'ESPN no devolvió jugadores para ningún equipo.', teams: results.map(({team,error})=>({team,error})) });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ players, teamsLoaded: results.filter(r => r.players.length).length, totalTeams: TEAMS.length });
  } catch (error) {
    return res.status(502).json({ error: 'No se pudieron cargar las plantillas NBA desde ESPN.', detail: String(error?.message || error) });
  }
}
