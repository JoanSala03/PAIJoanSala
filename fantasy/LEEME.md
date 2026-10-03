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
