#!/usr/bin/env python3
"""
Pizarra Fantasy · sincronizador con LaLiga Fantasy
=================================================

Descarga de la API del juego oficial (la misma que usa su web) los datos de
todos los jugadores de LaLiga: precio, posición, estado físico y puntos de
cada jornada. Genera dos archivos junto a este script:

  datos-oficiales.json  -> para cargarlo en la app desde "Datos"
  datos-oficiales.js    -> la app (index.html de esta carpeta) lo carga sola

Uso:
  python3 sincronizar.py            (Mac / Linux)
  py sincronizar.py                 (Windows, o doble clic en sincronizar.bat)

Opciones:
  --rapido     solo precios, posiciones y estado (sin puntos por jornada)
  --jornada N  fuerza el número de jornadas disputadas (por defecto se detecta)
  --liga       además, descarga tus ligas privadas (mercado del día, plantillas
               y cláusulas de los rivales). Pide tu token de sesión: mira
               LEEME.md para saber cómo copiarlo. Crea datos-liga.json/.js.

Solo usa la biblioteca estándar de Python 3.8+: no hay que instalar nada.
"""
import argparse
import getpass
import json
import os
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

API = "https://api-fantasy.llt-services.com"
HERE = os.path.dirname(os.path.abspath(__file__))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (PizarraFantasy sync)",
    "Accept": "application/json",
    "Accept-Language": "es-ES,es;q=0.9",
}
POSITIONS = {1: "POR", 2: "DEF", 3: "CEN", 4: "DEL"}  # 5 = entrenador (se ignora)
STATUS = {"ok": "ok", "injured": "injured", "doubtful": "doubtful", "suspended": "suspended"}

# Nombre del equipo en el juego -> código que usa la app (el orden importa)
TEAM_KEYS = [
    ("real madrid", "RMA"), ("real sociedad", "RSO"), ("real betis", "BET"), ("betis", "BET"),
    ("atletico", "ATM"), ("athletic", "ATH"), ("barcelona", "BAR"), ("alaves", "ALA"),
    ("celta", "CEL"), ("deportivo", "DEP"), ("coruna", "DEP"), ("elche", "ELC"),
    ("espanyol", "ESP"), ("getafe", "GET"), ("levante", "LEV"), ("malaga", "MAL"),
    ("osasuna", "OSA"), ("racing", "RAC"), ("rayo", "RAY"), ("sevilla", "SEV"),
    ("valencia", "VAL"), ("villarreal", "VIL"),
]


def norm(text):
    text = unicodedata.normalize("NFD", str(text or ""))
    return "".join(c for c in text if unicodedata.category(c) != "Mn").lower()


def team_code(team):
    if not isinstance(team, dict):
        return None
    for field in ("name", "shortName", "slug"):
        n = norm(team.get(field, "")).replace("-", " ")
        for key, code in TEAM_KEYS:
            if key in n:
                return code
    return None


TOKEN = None  # solo en memoria; nunca se escribe en ningún archivo salvo que tú lo pidas


def get(path, retries=3, auth=False):
    url = API + path + ("&" if "?" in path else "?") + "x-lang=es"
    headers = dict(HEADERS)
    if auth and TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
        headers["X-App"] = "Fantasy"
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403) and auth:
                return {"__error__": e.code}
            if e.code in (401, 403):
                raise SystemExit(
                    f"\nLa API ha respondido {e.code} (acceso denegado).\n"
                    "LaLiga Fantasy puede haber cerrado el acceso público. Mientras tanto,\n"
                    "introduce los puntos a mano en la ficha de cada jugador."
                )
            if e.code in (404, 405):
                return None
            time.sleep(1 + attempt * 2)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(1 + attempt * 2)
    return None


def as_number(v):
    if isinstance(v, list):  # las estadísticas vienen como [valor, puntos]
        v = v[0] if v else 0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def to_player(p):
    """Convierte un jugador del juego al formato de la app (None si es entrenador)."""
    if not isinstance(p, dict):
        return None
    pos = POSITIONS.get(int(as_number(p.get("positionId"))))
    code = team_code(p.get("team"))
    if not pos or not code:
        return None
    return {
        "fid": str(p.get("id")),
        "nick": p.get("nickname") or p.get("name"),
        "name": p.get("name") or p.get("nickname"),
        "team": code,
        "pos": pos,
        "value": round(as_number(p.get("marketValue")) / 1e6, 2),
        "status": STATUS.get(p.get("playerStatus"), "ok"),
        "points": int(as_number(p.get("points"))),
        "avg": round(as_number(p.get("averagePoints")), 2),
        "weeks": {},
    }


def player_weeks(pid):
    """Devuelve {jornada: [puntos, minutos, goles, asistencias]}."""
    data = get(f"/api/v3/player/{pid}")
    weeks = {}
    if not isinstance(data, dict):
        return weeks
    for s in data.get("playerStats") or []:
        w = s.get("weekNumber")
        if w is None:
            continue
        st = s.get("stats") or {}
        mins = int(as_number(st.get("mins_played")))
        pts = int(round(as_number(s.get("totalPoints"))))
        if mins == 0 and pts == 0:
            continue  # no jugó
        weeks[str(int(w))] = [pts, mins, int(as_number(st.get("goals"))), int(as_number(st.get("goal_assist")))]
    return weeks


def fetch_fixtures(max_week):
    """Partidos por jornada. Si el endpoint no responde, la app usa su calendario."""
    out = {}
    for w in range(1, 39):
        data = get(f"/stats/v1/stats/week/{w}", retries=1)
        if not isinstance(data, list):
            if w == 1:
                return {}
            continue
        games = []
        for m in data:
            home, away = team_code(m.get("local")), team_code(m.get("visitor"))
            if not home or not away:
                continue
            g = {"home": home, "away": away}
            hs, vs = m.get("localScore"), m.get("visitorScore")
            if w <= max_week and isinstance(hs, int) and isinstance(vs, int):
                g["hg"], g["ag"] = hs, vs
            games.append(g)
        if len(games) == 10:
            out[str(w)] = games
    return out


def main():
    ap = argparse.ArgumentParser(description="Sincroniza Pizarra Fantasy con LaLiga Fantasy")
    ap.add_argument("--rapido", action="store_true", help="sin puntos por jornada")
    ap.add_argument("--jornada", type=int, default=0, help="jornadas disputadas (0 = detectar)")
    ap.add_argument("--liga", action="store_true", help="descargar también tus ligas privadas")
    args = ap.parse_args()
    if args.liga:
        ask_token()

    print("Pizarra Fantasy · sincronizando con LaLiga Fantasy…")
    raw = get("/api/v3/players")
    if not isinstance(raw, list) or not raw:
        raise SystemExit("No se ha podido descargar la lista de jugadores. Revisa tu conexión y vuelve a probar.")

    players = [x for x in (to_player(p) for p in raw) if x]
    print(f"  {len(players)} jugadores de {len({p['team'] for p in players})} equipos")

    if not args.rapido:
        print("  Descargando puntos por jornada (1-2 minutos)…")
        done = 0
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(player_weeks, p["fid"]): p for p in players}
            for f in as_completed(futures):
                futures[f]["weeks"] = f.result() or {}
                done += 1
                if done % 50 == 0 or done == len(players):
                    print(f"    {done}/{len(players)}", end="\r", flush=True)
        print()

    week = args.jornada or max((int(w) for p in players for w in p["weeks"]), default=0)
    print(f"  Jornadas disputadas: {week or 'sin datos'}")
    fixtures = fetch_fixtures(week)
    print(f"  Calendario oficial: {len(fixtures)} jornadas" if fixtures else "  Calendario: se usa el de la app")

    out = {
        "source": "laliga-fantasy",
        "version": 1,
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "week": week,
        "players": players,
        "fixtures": fixtures,
    }
    jpath = os.path.join(HERE, "datos-oficiales.json")
    with open(jpath, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(HERE, "datos-oficiales.js"), "w", encoding="utf-8") as fh:
        fh.write("window.OFFICIAL_DATA = ")
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    if args.liga:
        sync_leagues()
    print(f"\nListo. Archivo creado: {jpath}")
    print("Abre index.html de esta carpeta (se carga solo) o, en la web publicada,")
    print("ve a Datos > «Cargar datos-oficiales.json».")


# ---------------------------------------------------------------------------
# Ligas privadas (necesitan tu sesión)
# ---------------------------------------------------------------------------
LEAGUES = ["/api/v4/leagues", "/api/v3/leagues"]
MARKET = ["/api/v3/league/{lid}/market", "/api/v4/league/{lid}/market"]
RANKING = ["/api/v4/leagues/{lid}/ranking", "/api/v3/leagues/{lid}/ranking", "/api/v4/league/{lid}/ranking"]
TEAM = ["/api/v4/leagues/{lid}/teams/{tid}", "/api/v3/teams/{tid}", "/api/v3/leagues/{lid}/teams/{tid}"]
DEBUG = []  # forma (solo nombres de campos) de cada respuesta, para poder ajustar el programa


def ask_token():
    global TOKEN
    tok = os.environ.get("LALIGA_TOKEN", "").strip()
    tpath = os.path.join(HERE, "token.txt")
    if not tok and os.path.exists(tpath):
        with open(tpath, encoding="utf-8") as fh:
            tok = fh.read().strip()
        if tok:
            print("Usando el token guardado en token.txt (bórralo cuando quieras).")
    if not tok:
        print("\nPega tu token de sesión de LaLiga Fantasy y pulsa Enter.")
        print("(No se verá mientras lo pegas. Cómo conseguirlo: LEEME.md, apartado «Mi liga privada»)")
        tok = getpass.getpass("Token: ").strip()
    if tok.lower().startswith("bearer "):
        tok = tok[7:].strip()
    if len(tok) < 40:
        raise SystemExit("Ese token parece incompleto. Cópialo entero (empieza por «eyJ…») y vuelve a probar.")
    TOKEN = tok


def shape(obj, depth=0):
    if depth > 3:
        return "…"
    if isinstance(obj, dict):
        return {k: shape(v, depth + 1) for k, v in list(obj.items())[:40]}
    if isinstance(obj, list):
        return [shape(obj[0], depth + 1)] if obj else []
    return type(obj).__name__


def as_list(resp, *keys):
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for k in keys + ("data", "elements", "items", "leagues", "teams", "ranking"):
            if isinstance(resp.get(k), list):
                return resp[k]
    return []


def first_ok(paths, fatal=False, **fmt):
    for p in paths:
        path = p.format(**fmt)
        r = get(path, retries=2, auth=True)
        DEBUG.append({"endpoint": p, "ok": bool(r) and "__error__" not in (r if isinstance(r, dict) else {}),
                      "shape": shape(r)})
        if isinstance(r, dict) and r.get("__error__") in (401, 403):
            if fatal and p == paths[-1]:
                raise SystemExit("\nLaLiga Fantasy ha rechazado el token (caducado o incorrecto).\n"
                                 "Vuelve a copiarlo (dura unas horas) y repite.")
            continue
        if r:
            return r
    return None


def money(v):
    return round(as_number(v) / 1e6, 2)


def manager_name(team):
    m = team.get("manager") if isinstance(team, dict) else None
    if isinstance(m, dict):
        return m.get("managerName") or m.get("name") or "Mánager"
    return (team or {}).get("name") or "Mánager"


def team_players(detail):
    out = []
    for p in as_list(detail, "players"):
        pm = p.get("playerMaster") or p.get("player") or p
        x = to_player(pm)
        if not x:
            continue
        x["clause"] = money(p.get("buyoutClause"))
        x["clauseLockEnd"] = p.get("buyoutClauseLockedEndTime")
        x.pop("weeks", None)
        out.append(x)
    return out


def sync_leagues():
    print("\nMis ligas privadas…")
    resp = first_ok(LEAGUES, fatal=True)
    leagues = as_list(resp)
    if not leagues:
        write_debug()
        raise SystemExit("No se han encontrado ligas con ese token. Revisa liga-debug.json y mándaselo a quien te ayude.")
    out_leagues = []
    for lg in leagues:
        lid = lg.get("id")
        name = lg.get("name") or f"Liga {lid}"
        print(f"  · {name}")
        # Mercado del día
        market = []
        for it in as_list(first_ok(MARKET, lid=lid)):
            pm = it.get("playerMaster") or it.get("player") or {}
            x = to_player(pm)
            if not x:
                continue
            x.pop("weeks", None)
            seller = it.get("sellerTeam")
            x["price"] = money(it.get("salePrice") or it.get("price") or pm.get("marketValue"))
            x["expires"] = it.get("expirationDate")
            x["seller"] = manager_name(seller) if isinstance(seller, dict) else "Mercado"
            bids = it.get("bids")
            x["bids"] = int(as_number(it.get("numberOfBids"))) if it.get("numberOfBids") is not None else (len(bids) if isinstance(bids, list) else 0)
            market.append(x)
        # Equipos de la liga
        teams = []
        for i, it in enumerate(as_list(first_ok(RANKING, lid=lid))):
            t = it.get("team") if isinstance(it.get("team"), dict) else it
            tid = t.get("id")
            detail = first_ok(TEAM, lid=lid, tid=tid) if tid is not None else None
            d = detail if isinstance(detail, dict) else {}
            dteam = d.get("team") if isinstance(d.get("team"), dict) else d
            teams.append({
                "id": str(tid),
                "manager": manager_name(t),
                "position": int(as_number(it.get("position") or i + 1)),
                "points": int(as_number(it.get("points") or t.get("teamPoints"))),
                "value": money(dteam.get("teamValue") or t.get("teamValue")),
                "money": money(dteam.get("teamMoney")) if dteam.get("teamMoney") is not None else None,
                "players": team_players(dteam),
            })
        print(f"    mercado: {len(market)} jugadores · {len(teams)} equipos")
        out_leagues.append({"id": str(lid), "name": name, "market": market, "teams": teams})

    data = {"source": "laliga-fantasy-liga", "version": 1,
            "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "leagues": out_leagues}
    with open(os.path.join(HERE, "datos-liga.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(HERE, "datos-liga.js"), "w", encoding="utf-8") as fh:
        fh.write("window.LEAGUE_DATA = ")
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    write_debug()
    print("  Creado datos-liga.json")
    if not os.path.exists(os.path.join(HERE, "token.txt")):
        if input("\n¿Guardar el token en token.txt para no pegarlo cada vez? (s/N): ").strip().lower() == "s":
            with open(os.path.join(HERE, "token.txt"), "w", encoding="utf-8") as fh:
                fh.write(TOKEN)
            print("  Guardado. No compartas ese archivo con nadie.")


def write_debug():
    # Solo nombres de campos y tipos: sin valores, nombres ni token.
    with open(os.path.join(HERE, "liga-debug.json"), "w", encoding="utf-8") as fh:
        json.dump(DEBUG, fh, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
