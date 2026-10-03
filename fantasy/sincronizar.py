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

Solo usa la biblioteca estándar de Python 3.8+: no hay que instalar nada.
"""
import argparse
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


def get(path, retries=3):
    url = API + path + ("&" if "?" in path else "?") + "x-lang=es"
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise SystemExit(
                    f"\nLa API ha respondido {e.code} (acceso denegado).\n"
                    "LaLiga Fantasy puede haber cerrado el acceso público. Mientras tanto,\n"
                    "introduce los puntos a mano en la ficha de cada jugador."
                )
            if e.code == 404:
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
    args = ap.parse_args()

    print("Pizarra Fantasy · sincronizando con LaLiga Fantasy…")
    raw = get("/api/v3/players")
    if not isinstance(raw, list) or not raw:
        raise SystemExit("No se ha podido descargar la lista de jugadores. Revisa tu conexión y vuelve a probar.")

    players = []
    for p in raw:
        pos = POSITIONS.get(int(as_number(p.get("positionId"))))
        code = team_code(p.get("team"))
        if not pos or not code:
            continue
        players.append({
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
        })
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
    print(f"\nListo. Archivo creado: {jpath}")
    print("Abre index.html de esta carpeta (se carga solo) o, en la web publicada,")
    print("ve a Datos > «Cargar datos-oficiales.json».")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
