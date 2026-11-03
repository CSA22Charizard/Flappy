# Flappy Bird

Speel online: https://csa22charizard.github.io/Flappy/

Open `index.html` in een moderne browser. Geen installatie, buildstap of internet nodig: Phaser en Lucide zijn lokaal meegeleverd.

## Spelen

- Klik op Spelen en gebruik spatie, pijltje omhoog, klikken of tikken om te vliegen.
- De vogel begint vanuit zijn zichtbare positie te vliegen, zonder sprong naar een andere plek. Drie vleugelstanden vormen een doorlopende flapanimatie; die stopt bij pauze en Gameover.
- Vlieg tussen de pijpen door. Elke gepasseerde pijpenset levert een punt op.
- Pijpen bewegen met 220 px/s en staan minimaal 240 pixels uit elkaar: ongeveer elke 1,09 seconde een nieuwe set. Een derde pijpenset kan kort aan de schermrand verschijnen. De zwaartekracht is 1100 px/s2 tijdens het stijgen en 1500 px/s2 tijdens het vallen; de flapsnelheid is -350 px/s. Hierdoor stijgt de vogel ongeveer 0,32 seconde na iedere flap, met een spronghoogte van ongeveer 53 pixels.
- De gaten worden per scoreband smaller: 0-9 easy (150-160 px), 10-19 medium (134-144 px), 20-29 hard (118-128 px), 30-39 expert (106-116 px) en 40+ master (96-104 px). Vanaf score 10 kunnen gaten ook extremer hoog of laag liggen. Hoogteverschillen tussen opeenvolgende gaten blijven begrensd.
- De vogel zweeft na een flap iets langer omhoog en houdt zijn neus omhoog tot hij echt begint te vallen. Tijdens het vallen neemt de snelheid bovenop de zwaartekracht exponentieel toe (factor exp(2,5 * tijdstap in seconden)), tot maximaal 900 px/s, en draait de vogel geleidelijk omlaag. Een flap onderbreekt de val direct. Nieuwe moeilijkheidsgraden gelden voor nieuw verschijnende pijpen; bestaande pijpen veranderen niet.
- Een botsing met een pijp, de grond of de bovenrand stopt de ronde.
- Pauzeer met P, Escape of de pauzeknop. Bij het verlaten van het venster pauzeert het spel automatisch.
- Alleen korte geluidseffecten zijn aanwezig, geen achtergrondmuziek. Een tweeklank als een arcade-muntje klinkt bij ieder punt. De geluidsknop dempt de effecten en de browser onthoudt die keuze wanneer opslag beschikbaar is.
- Na een botsing verschijnt Gameover met Score en Best. Best is je record en wordt lokaal in de browser bewaard wanneer opslag beschikbaar is. Een nieuw record blijft ook bewaard als je tijdens de ronde pauzeert, opnieuw start of de pagina verlaat.
- Per ronde verdien je medailles bij 1 punt (Easy), 10 (Medium), 20 (Hard), 30 (Expert) en 40 (Master). Alleen de hoogst behaalde medaille van die ronde verschijnt op Gameover; tijdens het spelen verschijnen geen medaillemeldingen. Bij nul punten wordt geen medaille getoond.

Het speelveld gebruikt intern 440 x 540 pixels en schaalt mee met de breedte en hoogte van je scherm. Op lage schermen verdwijnen de kop- en voettekst, zodat het speelveld zichtbaar blijft. Een formaatwijziging behoudt de huidige ronde, score en pijpen. De herstartknop op Gameover reageert direct; alleen losse tikken op het speelveld hebben kort bescherming tegen onbedoeld herstarten. Lokale opslag bij `file://` is browserafhankelijk; het spel blijft werken als opslag is geblokkeerd.

De physics volgt de frametijd van de browser, zodat de beweging ook bij onregelmatige frames en schermen boven 60 Hz iedere frame doorgaat. De standaard begrenzing van Phaser op de frametijd in de eerste 120 frames staat uit (`panicMax: 0`), omdat trage apparaten anders de eerste seconden in slow motion draaien. De geluidscontext en de geluidseffecten worden al bij het laden gemaakt, en tikken worden direct op het speelveld gelezen in plaats van via de touchafhandeling van Phaser. Zo blijft een tik zo licht mogelijk en hapert het beeld niet, ook niet in Safari op iOS. De werkelijke beeldsnelheid blijft afhankelijk van de browser, het scherm en de belasting van de computer.

## Online delen

Dit is een statische website zonder buildstap, servercode, accounts voor spelers of externe bestanden. De bestanden werken ook via HTTPS en onder een submap van een website.

Het spel staat online via GitHub Pages en wordt gepubliceerd vanaf de `main`-branch. Een wijziging op `main` staat binnen enkele minuten live. Zie `DEVELOPMENT.md` voor de werkwijze met Git, GitHub en Visual Studio Code.

Een record blijft per browser opgeslagen, niet in een gedeelde ranglijst.

Op een andere webhost hoef je alleen `index.html`, `style.css`, `game.js`, `phaser.min.js` en `lucide.min.js` samen in de publieke map te plaatsen. Tests hoeven niet online te staan.

## Browsercontrole

`smoke-test.js` bevat gerichte controles voor flappen, pijpen, score, pauze, botsingen, recordopslag, de geluidsknop, direct herstarten en behoud van de ronde bij formaatwijzigingen, plus 1000 pijpensets aan de grenzen van de moeilijkheidsniveaus. Ook worden onregelmatige frametijden en passages door de kleinste gaten bij 30, 60, 90, 120 en 144 FPS gecontroleerd. Voer ze met een Playwright-pagina uit nadat de app is geladen:

```js
await page.waitForFunction(() => window.flappyGame?.scene.getScene('Flight')?.bird);
await page.addScriptTag({ url: new URL('smoke-test.js', page.url()).href });
console.log(await page.evaluate(() => window.runFlappySmokeTest()));
await page.reload();
```

De controle herstelt het opgeslagen record en de geluidskeuze. Vernieuwen herstelt ook het record in het werkgeheugen.

## Bibliotheken

- Phaser 3.90.0 (MIT): https://phaser.io
- Lucide 0.468.0 (ISC): https://lucide.dev

De pixelillustraties worden in `game.js` getekend; er zijn geen originele Flappy Bird-afbeeldingen gebruikt.