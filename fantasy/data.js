/* ==========================================================================
   Pizarra Fantasy · base de datos y motor de simulación
   --------------------------------------------------------------------------
   Equipos de LaLiga EA Sports 2026/27 y plantillas de referencia.
   El calendario, los resultados y las puntuaciones se generan con un motor
   determinista (misma semilla = mismos datos) para que la app funcione sin
   conexión. Cualquier puntuación se puede corregir a mano desde la ficha del
   jugador o importando un JSON con datos reales.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- Equipos (str = nivel global 0-100) ---------- */
  const TEAMS = [
    { id: 'ALA', name: 'Alavés',          color: '#1f4fa3', color2: '#ffffff', str: 63 },
    { id: 'ATH', name: 'Athletic Club',   color: '#d71f2b', color2: '#ffffff', str: 78 },
    { id: 'ATM', name: 'Atlético',        color: '#cb3524', color2: '#1d3a8a', str: 86 },
    { id: 'BAR', name: 'Barcelona',       color: '#a50044', color2: '#004d98', str: 94 },
    { id: 'BET', name: 'Real Betis',      color: '#0b9444', color2: '#ffffff', str: 76 },
    { id: 'CEL', name: 'Celta',           color: '#8ac3ee', color2: '#d4002f', str: 70 },
    { id: 'DEP', name: 'Deportivo',       color: '#1b4ea0', color2: '#ffffff', str: 63 },
    { id: 'ELC', name: 'Elche',           color: '#0a7a3c', color2: '#ffffff', str: 62 },
    { id: 'ESP', name: 'Espanyol',        color: '#1a7bc7', color2: '#ffffff', str: 66 },
    { id: 'GET', name: 'Getafe',          color: '#0055a5', color2: '#ffffff', str: 64 },
    { id: 'LEV', name: 'Levante',         color: '#a3132b', color2: '#123a7a', str: 60 },
    { id: 'MAL', name: 'Málaga',          color: '#4a8fd1', color2: '#ffffff', str: 60 },
    { id: 'OSA', name: 'Osasuna',         color: '#c8102e', color2: '#0a2240', str: 67 },
    { id: 'RAC', name: 'Racing',          color: '#118847', color2: '#ffffff', str: 61 },
    { id: 'RAY', name: 'Rayo Vallecano',  color: '#e30613', color2: '#ffffff', str: 68 },
    { id: 'RMA', name: 'Real Madrid',     color: '#d8b55a', color2: '#2b2b6b', str: 93 },
    { id: 'RSO', name: 'Real Sociedad',   color: '#0067b1', color2: '#ffffff', str: 72 },
    { id: 'SEV', name: 'Sevilla',         color: '#d4021d', color2: '#ffffff', str: 66 },
    { id: 'VAL', name: 'Valencia',        color: '#f39200', color2: '#1a1a1a', str: 66 },
    { id: 'VIL', name: 'Villarreal',      color: '#f5d000', color2: '#00529f', str: 80 }
  ];

  /* ---------- Plantillas 2026/27 (dorsales oficiales de verano): [equipo, nombre, posición, nivel 1-10, dorsal] ---------- */
  const RAW = [
    // RMA
    ["RMA","Courtois",'POR',9,1],["RMA","Lunin",'POR',5,13],["RMA","Raúl Asencio",'DEF',6,2],["RMA","Éder Militão",'DEF',7,3],["RMA","Dean Huijsen",'DEF',8,4],["RMA","Alexander-Arnold",'DEF',7,12],["RMA","Ibrahima Konaté",'DEF',7,16],["RMA","Marc Cucurella",'DEF',7,17],["RMA","Álvaro Carreras",'DEF',7,18],["RMA","Antonio Rüdiger",'DEF',6,22],["RMA","Ferland Mendy",'DEF',5,23],["RMA","Denzel Dumfries",'DEF',7,24],["RMA","Jude Bellingham",'CEN',9,5],["RMA","Eduardo Camavinga",'CEN',7,6],["RMA","Fede Valverde",'CEN',8,8],["RMA","Aurélien Tchouaméni",'CEN',7,14],["RMA","Arda Güler",'CEN',8,15],["RMA","Bernardo Silva",'CEN',8,20],["RMA","Thiago Pitarch",'CEN',4,27],["RMA","Vinícius Jr.",'DEL',9,7],["RMA","Endrick",'DEL',6,9],["RMA","Kylian Mbappé",'DEL',10,10],["RMA","Rodrygo",'DEL',7,11],["RMA","Carlos Espí",'DEL',5,19],["RMA","Brahim Díaz",'DEL',6,21],["RMA","Yan Diomande",'DEL',7,25],
    // BAR
    ["BAR","Joan García",'POR',9,1],["BAR","Wojciech Szczęsny",'POR',5,13],["BAR","Dominik Livaković",'POR',5,25],["BAR","João Cancelo",'DEF',7,2],["BAR","Alejandro Balde",'DEF',7,3],["BAR","Brian Fariñas",'DEF',4,4],["BAR","Pau Cubarsí",'DEF',8,5],["BAR","Xavi Espart",'DEF',4,12],["BAR","Andreas Christensen",'DEF',5,15],["BAR","Gerard Martín",'DEF',6,18],["BAR","Jules Koundé",'DEF',8,23],["BAR","Eric García",'DEF',6,24],["BAR","Gavi",'CEN',7,6],["BAR","Fermín López",'CEN',8,7],["BAR","Pedri",'CEN',9,8],["BAR","Dani Olmo",'CEN',7,20],["BAR","Frenkie de Jong",'CEN',8,21],["BAR","Marc Bernal",'CEN',6,22],["BAR","Gabriel Jesus",'DEL',7,9],["BAR","Lamine Yamal",'DEL',10,10],["BAR","Raphinha",'DEL',9,11],["BAR","Karim Adeyemi",'DEL',7,14],["BAR","Anthony Gordon",'DEL',8,17],["BAR","Roony Bardghji",'DEL',6,19],["BAR","Hamza Abdelkarim",'DEL',4,29],
    // ATM
    ["ATM","Juan Musso",'POR',5,1],["ATM","Jan Oblak",'POR',8,13],["ATM","Marcos Llorente",'DEF',7,14],["ATM","Dávid Hancko",'DEF',7,17],["ATM","Marc Pubill",'DEF',6,18],["ATM","Cuti Romero",'DEF',7,21],["ATM","Álex Grimaldo",'DEF',8,22],["ATM","Robin Le Normand",'DEF',6,24],["ATM","Obed Vargas",'CEN',5,3],["ATM","Rodrigo Mendoza",'CEN',5,4],["ATM","Johnny Cardoso",'CEN',6,5],["ATM","Koke",'CEN',6,6],["ATM","Kang-in Lee",'CEN',7,7],["ATM","Pablo Barrios",'CEN',7,8],["ATM","Álex Baena",'CEN',8,10],["ATM","Morten Hjulmand",'CEN',7,23],["ATM","Alexander Sørloth",'DEL',7,9],["ATM","Ademola Lookman",'DEL',8,11],["ATM","Jonathan David",'DEL',7,15],["ATM","Arnau Ortiz",'DEL',4,16],["ATM","Julián Álvarez",'DEL',9,19],["ATM","Giuliano Simeone",'DEL',7,20],
    // ATH
    ["ATH","Unai Simón",'POR',7,1],["ATH","Álex Padilla",'POR',5,13],["ATH","Mikel Santos",'POR',3,26],["ATH","Andoni Gorosabel",'DEF',5,2],["ATH","Dani Vivian",'DEF',6,3],["ATH","Aitor Paredes",'DEF',6,4],["ATH","Yeray Álvarez",'DEF',5,5],["ATH","Jesús Areso",'DEF',6,12],["ATH","Aymeric Laporte",'DEF',6,14],["ATH","Hugo Rincón",'DEF',4,15],["ATH","Yuri Berchiche",'DEF',5,17],["ATH","Adama Boiro",'DEF',5,19],["ATH","Unai Monreal",'DEF',4,30],["ATH","Beñat Prados",'CEN',5,6],["ATH","Oihan Sancet",'CEN',7,8],["ATH","Iñigo Ruiz de Galarreta",'CEN',6,16],["ATH","Mikel Jauregizar",'CEN',7,18],["ATH","Alejandro Rego",'CEN',5,20],["ATH","Unai Gerenabarrena",'CEN',4,24],["ATH","Peio Canales",'CEN',6,28],["ATH","Selton Sánchez",'CEN',5,44],["ATH","Álex Berenguer",'DEL',6,7],["ATH","Iñaki Williams",'DEL',6,9],["ATH","Nico Williams",'DEL',8,10],["ATH","Gorka Guruzeta",'DEL',6,11],["ATH","Maroan Sannadi",'DEL',5,21],["ATH","Nico Serrano",'DEL',5,22],["ATH","Robert Navarro",'DEL',6,23],["ATH","Álvaro Djaló",'DEL',5,25],["ATH","Asier Hierro",'DEL',4,29],
    // VIL
    ["VIL","Luiz Júnior",'POR',6,1],["VIL","Rubén Gómez",'POR',3,13],["VIL","Péter Gulácsi",'POR',5,25],["VIL","Juan Foyth",'DEF',6,8],["VIL","Logan Costa",'DEF',6,2],["VIL","Alassane Diatta",'DEF',4,4],["VIL","Renato Veiga",'DEF',6,12],["VIL","Santiago Mouriño",'DEF',6,15],["VIL","Willy Kambwala",'DEF',5,5],["VIL","Pau Navarro",'DEF',5,26],["VIL","Alex Freeman",'DEF',5,3],["VIL","Carlos Romero",'DEF',6,20],["VIL","Sergi Cardona",'DEF',6,23],["VIL","Thomas Partey",'CEN',7,16],["VIL","Pape Gueye",'CEN',6,18],["VIL","Santi Comesaña",'CEN',6,14],["VIL","Carlos Macià",'CEN',4,28],["VIL","Alberto Moleiro",'CEN',8,10],["VIL","Nicolas Pépé",'DEL',7,19],["VIL","Gerard Moreno",'DEL',7,7],["VIL","Georges Mikautadze",'DEL',7,9],["VIL","Ayoze Pérez",'DEL',7,22],["VIL","Ilias Akhomach",'DEL',6,11],["VIL","Tani Oluwaseyi",'DEL',6,21],["VIL","Tajon Buchanan",'DEL',6,17],
    // BET
    ["BET","Álvaro Valles",'POR',6,1],["BET","Diego Conde",'POR',5,13],["BET","Manu González",'POR',3,31],["BET","Héctor Bellerín",'DEF',5,2],["BET","Diego Llorente",'DEF',6,3],["BET","Natan",'DEF',6,4],["BET","Marc Bartra",'DEF',5,5],["BET","Fran García",'DEF',6,11],["BET","Valentín Gómez",'DEF',6,16],["BET","Junior Firpo",'DEF',6,19],["BET","Ángel Ortiz",'DEF',5,40],["BET","Facundo Bernal",'CEN',5,6],["BET","Pablo Fornals",'CEN',7,8],["BET","Iker Losada",'CEN',5,14],["BET","Álvaro Fidalgo",'CEN',7,15],["BET","Nelson Deossa",'CEN',6,18],["BET","Giovani Lo Celso",'CEN',7,20],["BET","Marc Roca",'CEN',6,21],["BET","Isco",'CEN',7,22],["BET","Antony",'DEL',8,7],["BET","Cucho Hernández",'DEL',7,9],["BET","Abde Ezzalzouli",'DEL',7,10],["BET","Rodrigo Riquelme",'DEL',6,17],["BET","Aitor Ruibal",'DEL',5,24],["BET","Pablo García",'DEL',4,52],
    // RSO
    ["RSO","Álex Remiro",'POR',7,1],["RSO","Unai Marrero",'POR',4,13],["RSO","Jon Aramburu",'DEF',6,2],["RSO","Aihen Muñoz",'DEF',5,3],["RSO","Igor Zubeldia",'DEF',6,5],["RSO","Jon Pacheco",'DEF',6,16],["RSO","Sergio Gómez",'DEF',6,17],["RSO","Álvaro Odriozola",'DEF',5,20],["RSO","Jon Gorrotxategi",'CEN',6,4],["RSO","Beñat Turrientes",'CEN',6,8],["RSO","Wesley Ochieng",'CEN',5,12],["RSO","Pablo Marín",'CEN',6,15],["RSO","Carlos Soler",'CEN',7,18],["RSO","Yangel Herrera",'CEN',6,21],["RSO","Jon Ander Goti",'CEN',5,22],["RSO","Arsen Zakharyan",'CEN',6,23],["RSO","Luka Sučić",'CEN',7,24],["RSO","Ander Barrenetxea",'DEL',6,7],["RSO","Orri Óskarsson",'DEL',6,9],["RSO","Mikel Oyarzabal",'DEL',8,10],["RSO","Gonçalo Guedes",'DEL',6,11],["RSO","Take Kubo",'DEL',7,14],["RSO","Jon Karrikaburu",'DEL',4,null],
    // CEL
    ["CEL","Altay Bayındır",'POR',6,1],["CEL","Ionuț Radu",'POR',5,13],["CEL","Iván Villar",'POR',4,25],["CEL","Carl Starfelt",'DEF',5,2],["CEL","Marcos Alonso",'DEF',6,3],["CEL","Mamadou Faye",'DEF',5,4],["CEL","Sergio Carreira",'DEF',5,5],["CEL","Álvaro Núñez",'DEF',5,15],["CEL","Javi Rueda",'DEF',5,17],["CEL","Yoel Lago",'DEF',5,18],["CEL","Javi Rodríguez",'DEF',5,20],["CEL","Sebastián Cáceres",'DEF',5,21],["CEL","Javi Galán",'DEF',5,22],["CEL","Ilaix Moriba",'CEN',6,6],["CEL","Miguel Román",'CEN',5,8],["CEL","Aleix Febas",'CEN',5,14],["CEL","Hugo González",'CEN',4,16],["CEL","Hugo Álvarez",'CEN',6,23],["CEL","Borja Iglesias",'DEL',7,7],["CEL","Ferran Jutglà",'DEL',6,9],["CEL","Iago Aspas",'DEL',6,10],["CEL","Pablo Durán",'DEL',5,11],["CEL","Williot Swedberg",'DEL',6,19],["CEL","Ilias Driouech",'DEL',5,24],
    // SEV
    ["SEV","Odysseas Vlachodimos",'POR',6,1],["SEV","Fran González",'POR',4,13],["SEV","Juan Iglesias",'DEF',5,2],["SEV","Julio Díaz",'DEF',4,3],["SEV","Kike Salas",'DEF',5,4],["SEV","Andrés Castrín",'DEF',5,5],["SEV","Joseph Sangante",'DEF',5,12],["SEV","Gabriel Suazo",'DEF',5,17],["SEV","Óscar Oso",'DEF',5,null],["SEV","José Ángel Carmona",'DEF',6,22],["SEV","Marcão",'DEF',6,23],["SEV","Lucien Agoumé",'CEN',5,6],["SEV","Peque Fernández",'CEN',6,10],["SEV","Jon Guridi",'CEN',6,18],["SEV","Diego Correia",'CEN',5,20],["SEV","Youssouf Fofana",'CEN',6,24],["SEV","Manuel Ángel",'CEN',4,26],["SEV","Alfon González",'DEL',6,7],["SEV","Robbie Ure",'DEL',5,9],["SEV","Rubén Vargas",'DEL',6,11],["SEV","Isaac Romero",'DEL',6,16],["SEV","Stassin",'DEL',6,19],["SEV","Chidera Ejuke",'DEL',6,21],
    // VAL
    ["VAL","Stole Dimitrievski",'POR',6,1],["VAL","Cristian Rivero",'POR',4,13],["VAL","Kayne van Oevelen",'POR',3,25],["VAL","José Copete",'DEF',5,3],["VAL","Mouctar Diakhaby",'DEF',5,4],["VAL","César Tárrega",'DEF',6,5],["VAL","Nick de Haas",'DEF',4,12],["VAL","José Luis Gayà",'DEF',6,14],["VAL","Dimitri Foulquier",'DEF',5,20],["VAL","Jesús Vázquez",'DEF',5,21],["VAL","Guido Rodríguez",'CEN',6,2],["VAL","Javi Guerra",'CEN',7,8],["VAL","André Almeida",'CEN',6,10],["VAL","Dieng",'CEN',5,15],["VAL","Pepelu",'CEN',6,18],["VAL","Filip Ugrinić",'CEN',5,23],["VAL","Umar Sadiq",'DEL',5,6],["VAL","Arnaut Danjuma",'DEL',6,7],["VAL","Hugo Duro",'DEL',7,9],["VAL","Luis Rioja",'DEL',6,11],["VAL","Diego López",'DEL',7,16],["VAL","Dani Raba",'DEL',5,19],
    // OSA
    ["OSA","Sergio Herrera",'POR',6,1],["OSA","Aitor Fernández",'POR',5,13],["OSA","Jorge Herrando",'DEF',5,5],["OSA","Rico",'DEF',4,15],["OSA","Valentin Rosier",'DEF',5,19],["OSA","Flavien Boyomo",'DEF',6,22],["OSA","Abel Bretones",'DEF',5,23],["OSA","Alejandro Catena",'DEF',6,24],["OSA","Iker Arguibide",'DEF',4,27],["OSA","Lucas Torró",'CEN',5,6],["OSA","Jon Moncayola",'CEN',6,7],["OSA","Iker Muñoz",'CEN',5,8],["OSA","Aimar Oroz",'CEN',6,10],["OSA","Moi Gómez",'CEN',5,16],["OSA","Mauro Echegoyen",'CEN',4,26],["OSA","Asier Osambela",'CEN',4,29],["OSA","Raúl García de Haro",'DEL',6,9],["OSA","Kike Barja",'DEL',5,11],["OSA","Rubén García",'DEL',6,14],["OSA","Ante Budimir",'DEL',7,17],["OSA","Raúl Moro",'DEL',5,18],["OSA","Del Castillo",'DEL',5,20],["OSA","Adrián Dubasin",'DEL',5,21],["OSA","Rockson",'DEL',4,48],
    // GET
    ["GET","Jiří Letáček",'POR',5,1],["GET","David Soria",'POR',6,13],["GET","Diego Ferrer",'POR',3,35],["GET","Djené",'DEF',6,2],["GET","Davinchi",'DEF',5,3],["GET","Saba Sazonov",'DEF',5,4],["GET","Abdelkabir Abqar",'DEF',5,5],["GET","Sebastián Boselli",'DEF',5,15],["GET","Kiko Femenía",'DEF',4,17],["GET","Andrés García",'DEF',4,21],["GET","Johan Mojica",'DEF',5,22],["GET","Zaid Romero",'DEF',5,24],["GET","Mario Martín",'CEN',6,6],["GET","Nemanja Gudelj",'CEN',5,8],["GET","Javi Muñoz",'CEN',5,14],["GET","Francho Serrano",'CEN',5,16],["GET","Orel Mangala",'CEN',5,23],["GET","Alberto Risco",'CEN',4,28],["GET","Juanmi",'DEL',5,7],["GET","Borja Mayoral",'DEL',6,9],["GET","Martín Satriano",'DEL',5,10],["GET","Álex San Cristóbal",'DEL',4,18],["GET","Enes Ünal",'DEL',6,19],
    // RAY
    ["RAY","Dani Cárdenas",'POR',4,1],["RAY","Augusto Batalla",'POR',7,13],["RAY","Andrei Rațiu",'DEF',6,2],["RAY","Marash Kumbulla",'DEF',6,3],["RAY","Iván Balliu",'DEF',5,20],["RAY","Pep Chavarría",'DEF',5,23],["RAY","Pacha Espino",'DEF',5,21],["RAY","Javi Pedrosa",'DEF',5,17],["RAY","Pelayo Fernández",'DEF',4,22],["RAY","Florian Lejeune",'DEF',6,24],["RAY","Pathé Ciss",'CEN',6,6],["RAY","Unai López",'CEN',5,17],["RAY","Óscar Valentín",'CEN',5,23],["RAY","Isi Palazón",'CEN',7,7],["RAY","Óscar Trejo",'CEN',5,8],["RAY","Gerard Gumbau",'CEN',5,15],["RAY","Jorge de Frutos",'DEL',6,19],["RAY","Álvaro García",'DEL',6,18],["RAY","Alemão",'DEL',6,9],["RAY","Sergio Camello",'DEL',5,10],["RAY","Fran Pérez",'DEL',5,11],["RAY","Randy Nteka",'DEL',5,null],
    // ESP
    ["ESP","Ángel Fortuño",'POR',4,1],["ESP","Marko Dmitrović",'POR',6,13],["ESP","Rubén Sánchez",'DEF',5,2],["ESP","Quilindschy Hartman",'DEF',5,3],["ESP","Urko González",'DEF',5,4],["ESP","Clemens Riedel",'DEF',5,5],["ESP","Leandro Cabrera",'DEF',5,6],["ESP","Miguel Rubio",'DEF',5,15],["ESP","Andrija Drkušić",'DEF',5,16],["ESP","Omar El Hilali",'DEF',5,23],["ESP","Edu Expósito",'CEN',6,8],["ESP","Pol Lozano",'CEN',5,10],["ESP","Gabriel Moscardo",'CEN',5,20],["ESP","Javi Puado",'DEL',6,7],["ESP","Roberto Fernández",'DEL',6,9],["ESP","Pere Milla",'DEL',5,11],["ESP","Kike García",'DEL',6,19],["ESP","Tyrhys Dolan",'DEL',6,24],
    // ALA
    ["ALA","Antonio Sivera",'POR',6,1],["ALA","Adrián Rodríguez",'POR',4,13],["ALA","Raúl Owono",'POR',4,25],["ALA","Nicolás Valentini",'DEF',5,2],["ALA","Youssef Enríquez",'DEF',5,3],["ALA","Facundo Garcés",'DEF',5,5],["ALA","Ángel Pérez",'DEF',5,7],["ALA","Hugo Novoa",'DEF',5,12],["ALA","Nahuel Tenaglia",'DEF',5,14],["ALA","Ville Koski",'DEF',5,16],["ALA","Jonny Otto",'DEF',5,17],["ALA","Mikel Rodríguez",'DEF',4,18],["ALA","Moussa Diarra",'DEF',5,24],["ALA","Denis Suárez",'CEN',6,4],["ALA","Ander Guevara",'CEN',5,6],["ALA","Antonio Blanco",'CEN',6,8],["ALA","Carles Aleñá",'CEN',5,10],["ALA","Pablo Ibáñez",'CEN',5,19],["ALA","Abde Rebbach",'CEN',5,21],["ALA","Carlos Protesoni",'CEN',5,23],["ALA","Mariano Díaz",'DEL',5,9],["ALA","Toni Martínez",'DEL',6,11],["ALA","Lucas Boyé",'DEL',6,15],["ALA","Mañas",'DEL',4,20],
    // ELC
    ["ELC","Matías Dituro",'POR',5,1],["ELC","Alejandro Iturbe",'POR',4,43],["ELC","Buba Sangaré",'DEF',4,2],["ELC","Pedro Bigas",'DEF',5,6],["ELC","Víctor Chust",'DEF',5,23],["ELC","Matia Barzic",'DEF',4,26],["ELC","David Affengruber",'DEF',6,22],["ELC","Josan",'DEF',5,17],["ELC","Federico Redondo",'CEN',5,5],["ELC","Marc Aguado",'CEN',5,8],["ELC","Facundo Buonanotte",'CEN',6,10],["ELC","Gonzalo Villar",'CEN',5,12],["ELC","Martim Neto",'CEN',5,16],["ELC","Grady Diangana",'DEL',5,19],["ELC","Lucas Cepeda",'DEL',5,21],["ELC","Ezequiel Ponce",'DEL',5,9],["ELC","Fer Niño",'DEL',5,14],["ELC","Tete Morente",'DEL',5,20],["ELC","Rafa Mir",'DEL',6,7],
    // LEV
    ["LEV","Pablo Cuñat",'POR',4,1],["LEV","Mathew Ryan",'POR',5,13],["LEV","Aïssa Mandi",'DEF',5,2],["LEV","Ndukwe",'DEF',4,3],["LEV","Adrián de la Fuente",'DEF',5,4],["LEV","Requena",'DEF',4,6],["LEV","Cabello",'DEF',4,14],["LEV","Jeremy Toljan",'DEF',5,22],["LEV","Manu Sánchez",'DEF',5,23],["LEV","Hugo Sotelo",'CEN',5,5],["LEV","Unai Olasagasti",'CEN',5,8],["LEV","Axel Tape",'CEN',5,16],["LEV","Bardeli",'CEN',4,18],["LEV","Oriol Rey",'CEN',5,20],["LEV","Thiago",'CEN',4,24],["LEV","Roger Brugué",'DEL',5,7],["LEV","Iván Romero",'DEL',6,9],["LEV","Petar Ratkov",'DEL',6,10],["LEV","Musuayi",'DEL',4,11],["LEV","Víctor García",'DEL',5,17],["LEV","Karl Etta Eyong",'DEL',6,21],
    // RAC
    ["RAC","Julen Agirrezabala",'POR',5,1],["RAC","Simon Eriksson",'POR',4,13],["RAC","Aitor Crespo",'POR',3,37],["RAC","Álvaro Mantilla",'DEF',5,2],["RAC","Manu Hernando",'DEF',5,4],["RAC","Aarón Martín",'DEF',5,3],["RAC","Pablo Ramón",'DEF',5,5],["RAC","Facundo González",'DEF',5,15],["RAC","Jorge Salinas",'DEF',4,32],["RAC","Carlos Sánchez",'DEF',4,46],["RAC","Íñigo Sainz-Maza",'CEN',5,6],["RAC","Maguette Gueye",'CEN',5,14],["RAC","Gustavo Puerta",'CEN',5,19],["RAC","Sergio Martínez",'CEN',4,36],["RAC","Sergio Canales",'CEN',6,8],["RAC","Andrés Martín",'DEL',6,11],["RAC","Juan Carlos Arana",'DEL',5,9],["RAC","Giorgi Guliashvili",'DEL',5,7],["RAC","Iñigo Vicente",'DEL',6,10],["RAC","Asier Villalibre",'DEL',5,12],
    // DEP
    ["DEP","Germán Parreño",'POR',5,1],["DEP","Leo Román",'POR',5,13],["DEP","Adrià Altimira",'DEF',5,2],["DEP","Arnau Comas",'DEF',5,3],["DEP","Lucas Noubi",'DEF',4,4],["DEP","Dani Barcia",'DEF',5,5],["DEP","Giacomo Quagliata",'DEF',5,12],["DEP","Miguel Loureiro",'DEF',5,15],["DEP","Angeliño",'DEF',6,17],["DEP","José María Giménez",'DEF',6,20],["DEP","Ximo Navarro",'DEF',5,23],["DEP","Marc Casadó",'CEN',6,6],["DEP","Diego Villares",'CEN',5,8],["DEP","Riki Rodríguez",'CEN',5,14],["DEP","Lorenzo Amatucci",'CEN',5,16],["DEP","Jonathan Asp Jensen",'CEN',5,18],["DEP","Mario Soriano",'CEN',6,21],["DEP","Pierre-Emerick Aubameyang",'DEL',6,7],["DEP","Zakaria Eddahchouri",'DEL',6,9],["DEP","Yeremay Hernández",'DEL',7,10],["DEP","David Mella",'DEL',6,11],["DEP","Luismi Cruz",'DEL',5,19],["DEP","Bright Ede",'DEL',4,22],["DEP","Adama Traoré",'DEL',6,24],
    // MAL
    ["MAL","Alfonso Herrero",'POR',5,1],["MAL","Carlos López",'POR',4,13],["MAL","Carlos Puga",'DEF',5,3],["MAL","Einar Galilea",'DEF',5,4],["MAL","Pastor",'DEF',4,5],["MAL","José Salinas",'DEF',4,12],["MAL","Recio",'DEF',4,15],["MAL","Murillo",'DEF',5,16],["MAL","Fernando Calero",'DEF',5,20],["MAL","Dani Sánchez",'DEF',4,null],["MAL","Ramón Enríquez",'CEN',5,6],["MAL","Dotor",'CEN',5,8],["MAL","David Larrubia",'CEN',6,10],["MAL","Rafa Rodríguez",'CEN',5,14],["MAL","Juan Cruz",'CEN',5,19],["MAL","Dani Lorenzo",'CEN',5,22],["MAL","Izan Merino",'CEN',5,23],["MAL","Haitam Abaida",'DEL',5,7],["MAL","Chupe",'DEL',6,9],["MAL","Joaquín Muñoz",'DEL',6,11],["MAL","Jáuregi",'DEL',5,17],["MAL","Adrián Niño",'DEL',5,21],["MAL","Antoñito Lobete",'DEL',5,24]
  ];

  /* ---------- Estado médico/disciplinario de referencia ---------- */
  const STATUS = {
    'Éder Militão': 'injured', 'Gavi': 'doubtful', 'Aymeric Laporte': 'doubtful', 'Isco': 'injured',
    'Gerard Moreno': 'injured', 'Iago Aspas': 'doubtful', 'Antonio Rüdiger': 'injured', 'Andreas Christensen': 'doubtful',
    'Take Kubo': 'doubtful', 'Djené': 'suspended', 'Marcos Alonso': 'suspended', 'Rubén García': 'doubtful',
    'Kike García': 'injured', 'Álvaro Mantilla': 'suspended', 'Arnaut Danjuma': 'doubtful'
  };

  /* ---------- Utilidades deterministas ---------- */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poisson(r, lambda) {
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }
  function pickWeighted(r, items, weightFn) {
    const w = items.map(weightFn); const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let x = r() * total;
    for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  }
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  /* ---------- Jugadores ---------- */
  const TEAM = Object.fromEntries(TEAMS.map(t => [t.id, t]));
  const PLAYERS = RAW.map(([team, name, pos, q, num]) => ({
    id: team.toLowerCase() + '-' + slug(name), team, name, pos, q, num,
    status: STATUS[name] || 'ok'
  }));
  // Portero titular: el de más nivel (a igualdad, el primero de la lista)
  const GK_STARTER = {};
  PLAYERS.forEach(p => { if (p.pos === 'POR' && (!GK_STARTER[p.team] || p.q > PLAYERS.find(x => x.id === GK_STARTER[p.team]).q)) GK_STARTER[p.team] = p.id; });
  // Orden en la rotación de cada línea (0 = primer titular)
  const STARTERS = { POR: 1, DEF: 4, CEN: 3, DEL: 3 };
  const DEPTH = {};
  TEAMS.forEach(t => ['DEF', 'CEN', 'DEL'].forEach(pos => {
    PLAYERS.filter(p => p.team === t.id && p.pos === pos).sort((a, b) => b.q - a.q).forEach((p, i) => { DEPTH[p.id] = i; });
  }));

  /* ---------- Calendario real ----------
     J1-J7: resultados publicados en prensa (null = marcador no encontrado).
     J8-J12: calendario oficial publicado por LaLiga.
     J13 en adelante: provisional hasta que se publique (o se sincronice). */
  const REAL = {
    1: 'ALA-GET 3-0|SEV-RAY 2-1|RAC-VIL 2-2|ESP-LEV 3-0|DEP-ELC 1-1|ATM-MAL 2-0|VAL-BET 0-1|RMA-RSO 4-1|CEL-OSA 1-2|BAR-ATH 2-0',
    2: 'RAY-ALA 1-1|BET-RSO 1-0|ATH-SEV 1-3|VAL-CEL 0-0|ESP-RMA 1-2|ATM-VIL 2-2|GET-RAC 1-0|ELC-BAR 0-5|OSA-LEV|MAL-DEP',
    3: 'RAC-ELC 3-2|ALA-VIL 1-0|SEV-ATM 1-3|RSO-ESP 2-1|LEV-BET 5-2|CEL-ATH 0-2|DEP-VAL 3-1|RMA-MAL 4-0|BAR-RAY 5-2|OSA-GET 1-0',
    4: 'BET-RMA 1-0|VIL-DEP 2-3|RAY-RAC 3-2|ATH-ATM 3-0|ESP-SEV 1-1|ALA-OSA 5-2|MAL-LEV 0-0|VAL-BAR 0-5|ELC-RSO 2-3|GET-CEL 1-1',
    5: 'SEV-VAL 1-0|RMA-RAY 4-1|ATH-ELC 1-1|OSA-ESP 0-2|RAC-ALA 2-1|RSO-ATM 0-3|GET-DEP 1-1|LEV-BAR 2-4|CEL-MAL 1-1|VIL-BET 1-2',
    6: 'MAL-VIL 1-3|BET-GET 1-0|BAR-RAC 7-2|DEP-SEV 0-1|ATM-OSA 4-0|ELC-RMA 2-3|ALA-VAL 0-1|RAY-ESP 2-1|RSO-CEL 0-0|ATH-LEV 2-0',
    7: 'ESP-ELC 1-3|OSA-RAY 1-1|ATH-ALA 0-0|CEL-RAC 5-0|SEV-BAR 1-3|GET-MAL 1-0|ATM-RMA 2-1|VIL-LEV 3-1|DEP-BET 2-1|VAL-RSO 2-3',
    8: 'MAL-ESP|RAY-ATH|ALA-ATM|BAR-GET|RMA-VIL|ELC-CEL|RSO-DEP|BET-OSA|RAC-VAL|LEV-SEV',
    9: 'DEP-LEV|OSA-RAC|GET-RAY|BET-BAR|RMA-SEV|ESP-ATM|CEL-ALA|MAL-RSO|VAL-ATH|VIL-ELC',
    10: 'ALA-MAL|RAC-ESP|CEL-BET|RAY-ELC|VAL-VIL|RSO-LEV|ATM-DEP|ATH-GET|BAR-RMA|SEV-OSA',
    11: 'DEP-OSA|RAC-RMA|GET-SEV|LEV-ATM|VIL-ESP|BET-MAL|ATH-RSO|BAR-ALA|ELC-VAL|RAY-CEL',
    12: 'VIL-GET|ESP-DEP|RSO-RAY|OSA-ATH|ELC-BET|ATM-BAR|VAL-RMA|MAL-RAC|SEV-ALA|CEL-LEV'
  };
  const parseRound = str => str.split('|').map(m => {
    const [teams, score] = m.split(' ');
    const [home, away] = teams.split('-');
    const g = { home, away };
    if (score) { const [hg, ag] = score.split('-').map(Number); g.hg = hg; g.ag = ag; }
    return g;
  });

  const SEASON_SEED = hash('laliga-2026-27');
  const order = TEAMS.map(t => t.id);
  (function shuffle() { const r = rng(SEASON_SEED); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } })();
  const ROUNDS = [];
  (function build() {
    const n = order.length, arr = order.slice(), gen = [];
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        games.push((r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
      gen.push(games);
      arr.splice(1, 0, arr.pop());
    }
    for (let r = 0; r < n - 1; r++) gen.push(gen[r].map(g => ({ home: g.away, away: g.home })));
    for (let j = 1; j <= 38; j++) ROUNDS.push(REAL[j] ? parseRound(REAL[j]) : gen[j - 1].map(g => Object.assign({ prov: true }, g)));
  })();

  // Fechas (domingo de cada jornada). J1-J12 según el calendario publicado.
  const DATES = ['2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06', '2026-09-13', '2026-09-16', '2026-09-27',
    '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];
  (function rest() {
    const BREAKS = ['2026-11-15', '2026-12-27', '2027-01-03', '2027-03-28'];
    const d = new Date('2026-11-22T12:00:00');
    while (DATES.length < 38) {
      const iso = d.toISOString().slice(0, 10);
      if (!BREAKS.includes(iso)) DATES.push(iso);
      d.setDate(d.getDate() + 7);
    }
  })();

  // Jornadas disputadas: como mínimo 7 (la próxima es la 8) y avanza sola con el calendario
  let MIN_PLAYED = 7;
  function playedJornadas(now) {
    const t = (now || new Date()).getTime();
    let n = 0;
    DATES.forEach((iso, i) => { if (t > new Date(iso + 'T23:59:00').getTime() + 864e5) n = i + 1; });
    return Math.min(38, Math.max(MIN_PLAYED, n));
  }
  function setMinPlayed(n) { if (n >= 0 && n <= 38) MIN_PLAYED = n; Object.keys(cache).forEach(k => delete cache[k]); }

  // Partidos oficiales importados (sustituyen a los de la tabla)
  function setFixtures(byWeek) {
    Object.entries(byWeek || {}).forEach(([w, list]) => {
      const j = Number(w);
      if (!(j >= 1 && j <= 38) || !Array.isArray(list) || list.length < 10) return;
      const ok = list.every(g => TEAM[g.home] && TEAM[g.away]);
      if (!ok) return;
      ROUNDS[j - 1] = list.map(g => {
        const m = { home: g.home, away: g.away };
        if (Number.isFinite(g.hg) && Number.isFinite(g.ag)) { m.hg = g.hg; m.ag = g.ag; }
        return m;
      });
    });
    Object.keys(cache).forEach(k => delete cache[k]);
  }

  /* ---------- Simulación de partido y puntos (sistema tipo LaLiga Fantasy) ---------- */
  const GOAL_PTS = { POR: 6, DEF: 6, CEN: 5, DEL: 4 };
  const GOAL_W = { POR: 0, DEF: 0.55, CEN: 1.6, DEL: 3.4 };
  const AST_W = { POR: 0.05, DEF: 0.9, CEN: 2.2, DEL: 1.7 };
  const byTeam = {};
  PLAYERS.forEach(p => (byTeam[p.team] = byTeam[p.team] || []).push(p));

  const cache = {};
  function simulateJornada(j) {
    if (cache[j]) return cache[j];
    const out = { matches: [], stats: {} };
    ROUNDS[j - 1].forEach(g => {
      const r = rng(hash(`J${j}-${g.home}-${g.away}`));
      const H = TEAM[g.home], A = TEAM[g.away];
      const lh = Math.max(0.25, 1.45 * Math.pow(H.str / A.str, 2.1) * 1.08);
      const la = Math.max(0.2, 1.2 * Math.pow(A.str / H.str, 2.1) * 0.94);
      const known = Number.isFinite(g.hg) && Number.isFinite(g.ag);
      const sh = poisson(r, lh), sa = poisson(r, la);
      const hg = known ? g.hg : sh, ag = known ? g.ag : sa;
      out.matches.push({ home: g.home, away: g.away, hg: known ? hg : null, ag: known ? ag : null, real: known });
      [[g.home, hg, ag, true, g.away], [g.away, ag, hg, false, g.home]].forEach(([team, gf, ga, home, opp]) => {
        const squad = byTeam[team];
        const lastJ = playedJornadas();
        const playing = squad.filter(p => {
          // los lesionados/sancionados actuales no jugaron la última jornada
          if (p.status !== 'ok' && p.status !== 'doubtful' && j >= lastJ) return false;
          if (p.pos === 'POR') return GK_STARTER[team] === p.id;
          // titulares habituales casi siempre; el resto según su lugar en la rotación
          const d = DEPTH[p.id];
          const prob = d < STARTERS[p.pos] ? 0.93 : d < STARTERS[p.pos] + 2 ? 0.42 : 0.12;
          return r() < prob;
        });
        const st = {};
        playing.forEach(p => {
          const full = r() < 0.55 + p.q * 0.04;
          st[p.id] = { j, team, opp, home, gf, ga, played: true, min: full ? 90 : (r() < 0.5 ? 70 : 30), g: 0, a: 0, cs: false, yc: 0, rc: 0, base: 0, pts: 0 };
        });
        for (let k = 0; k < gf; k++) {
          const sc = pickWeighted(r, playing, p => GOAL_W[p.pos] * Math.pow(p.q, 1.6) * (st[p.id].min / 90));
          if (sc) st[sc.id].g++;
          if (r() < 0.72) {
            const as = pickWeighted(r, playing.filter(p => p !== sc), p => AST_W[p.pos] * Math.pow(p.q, 1.4));
            if (as) st[as.id].a++;
          }
        }
        playing.forEach(p => {
          const s = st[p.id];
          let pts = s.min >= 60 ? 2 : 1;
          pts += s.g * GOAL_PTS[p.pos] + s.a * 3;
          if (ga === 0 && s.min >= 60) { s.cs = true; pts += p.pos === 'POR' ? 4 : p.pos === 'DEF' ? 3 : p.pos === 'CEN' ? 1 : 0; }
          if (p.pos === 'POR' || p.pos === 'DEF') pts -= Math.floor(ga / 2);
          if (p.pos === 'POR') pts += Math.round(r() * 3 * (A.str > H.str ? 1.2 : 0.8));
          if (r() < 0.13) { s.yc = 1; pts -= 1; }
          if (r() < 0.012) { s.rc = 1; pts -= 3; }
          // Componente de valoración (estadísticas avanzadas / crónica)
          const res = gf > ga ? 1 : gf < ga ? -0.6 : 0.2;
          s.base = Math.round(gauss(r) * 1.7 + (p.q - 5) * 0.32 + res + (s.min < 60 ? -0.6 : 0.3));
          pts += s.base;
          s.pts = pts;
        });
        Object.assign(out.stats, st);
      });
    });
    cache[j] = out;
    return out;
  }

  /* ---------- Valor de mercado (M€) ---------- */
  function baseValue(p) { return 0.17 * Math.pow(1.8, p.q); }

  global.FantasyDB = {
    TEAMS, TEAM, PLAYERS, ROUNDS, DATES, GK_STARTER,
    playedJornadas, simulateJornada, baseValue, hash, rng, slug, DEPTH, STARTERS, setFixtures, setMinPlayed
  };
})(window);
