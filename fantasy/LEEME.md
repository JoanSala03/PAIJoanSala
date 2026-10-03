# Pizarra Fantasy

Analizador de tu equipo de LaLiga Fantasy. Abre `index.html` en el navegador.

## Sincronizar con LaLiga Fantasy (cada jornada)

1. **Instala Python 3** (solo la primera vez): <https://www.python.org/downloads/>.
   En Windows, marca la casilla **«Add Python to PATH»** al instalar.
2. **Descarga el proyecto**: en GitHub pulsa **Code → Download ZIP** y descomprímelo
   (o `git pull` si ya lo tienes clonado).
3. **Ejecuta el sincronizador** dentro de la carpeta `fantasy`:
   - Windows: doble clic en `sincronizar.bat`.
   - Mac / Linux: abre un terminal en la carpeta y escribe `python3 sincronizar.py`.

   Tarda 1–2 minutos y crea `datos-oficiales.json` y `datos-oficiales.js`.
4. **Carga los datos**:
   - Si abres `index.html` desde esa misma carpeta, se cargan solos.
   - Si usas la web publicada: **Datos → Cargar datos-oficiales.json** y elige el archivo.

Repite los pasos 3 y 4 después de cada jornada (o antes de cerrar la alineación,
para tener los lesionados y precios al día).

### Qué se actualiza

- Precio de mercado y posición oficiales de todos los jugadores.
- Estado: disponible, duda, lesionado o sancionado.
- Puntos, minutos, goles y asistencias de cada jornada.
- Jugadores que no estaban en la base de datos (se añaden solos).

Tu plantilla, alineación y saldo no se tocan: los sigues gestionando en la app.

### Si algo falla

- *«No se ha podido descargar la lista de jugadores»*: revisa la conexión y vuelve a probar.
- *«Acceso denegado (401/403)»*: LaLiga Fantasy ha cerrado su API pública. Mientras tanto,
  puedes corregir los puntos a mano en la ficha de cada jugador.
- *`python` no se reconoce*: reinstala Python marcando «Add Python to PATH».

## Mi liga privada (mercado, rivales y cláusulas)

El valor de mercado de cada jugador es el mismo en todas las ligas. Lo que cambia en tu
liga con amigos es el mercado del día, las cláusulas y el saldo, y eso solo se ve con tu sesión.

1. En el ordenador, entra en la web de LaLiga Fantasy con Chrome o Edge e inicia sesión.
2. Pulsa **F12**, pestaña **Red** (Network), recarga con **F5** y escribe `api-fantasy` en el filtro.
3. Pulsa cualquier petición → **Encabezados de solicitud** → copia lo que va después de
   `authorization: Bearer ` (empieza por `eyJ`).
4. Doble clic en `sincronizar-liga.bat`, pega el token (clic derecho; no se ve) y pulsa Enter.
5. Abre `index.html` (se carga solo) o, en la web publicada, pestaña **Mi liga → Cargar datos-liga.json**.
6. En **Mi liga → Clasificación**, abre tu equipo y pulsa **«Es mi equipo»**.

**El token es como tu contraseña durante unas horas.** No lo pegues en ningún chat ni lo subas
a GitHub (`token.txt` y los datos de la liga ya están excluidos en `.gitignore`). Si el programa
dice que está caducado, vuelve a copiarlo.

Si algo no cuadra, el programa deja `liga-debug.json`, que solo contiene nombres de campos
(sin nombres de jugadores, de tus amigos ni el token), para poder ajustar el programa.
