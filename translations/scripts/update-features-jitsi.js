#!/usr/bin/env node
/*
Update landing.features.item3 and item4 across all locales to reflect Jitsi-only direct communication.
- item3: Direct communication via Jitsi — text/audio/video; nothing is stored or recorded on SoulTribe.chat.
- item4: Easy link join — private Jitsi room for confirmed meetups; privacy‑friendly, no desktop install required.

Curated translations provided for: en, de, es, fr, it.
All other locales will receive English strings.

Usage: node translations/scripts/update-features-jitsi.js
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'web', 'i18n', 'locales');

const EN = {
  item3: '<strong>Direct communication via Jitsi</strong> — text/audio/video; nothing is stored or recorded on SoulTribe.chat.',
  item4: '<strong>Easy link join</strong> — private Jitsi room for confirmed meetups; privacy‑friendly, no desktop install required.',
};

const MAP = {
  en: EN,
  de: {
    item3: '<strong>Direkte Kommunikation über Jitsi</strong> — Text/Audio/Video; es wird nichts auf SoulTribe.chat gespeichert oder aufgezeichnet.',
    item4: '<strong>Einfacher Beitritt per Link</strong> — privater Jitsi‑Raum für bestätigte Treffen; datenschutzfreundlich, keine Installation am Desktop nötig.',
  },
  es: {
    item3: '<strong>Comunicación directa vía Jitsi</strong> — texto/audio/vídeo; nada se almacena ni se graba en SoulTribe.chat.',
    item4: '<strong>Acceso fácil por enlace</strong> — sala privada de Jitsi para encuentros confirmados; respetuosa con la privacidad, sin instalación en escritorio.',
  },
  fr: {
    item3: '<strong>Communication directe via Jitsi</strong> — texte/audio/vidéo ; rien n’est stocké ni enregistré sur SoulTribe.chat.',
    item4: '<strong>Accès facile par lien</strong> — salle Jitsi privée pour les rendez‑vous confirmés ; respect de la vie privée, aucune installation sur ordinateur.',
  },
  it: {
    item3: '<strong>Comunicazione diretta via Jitsi</strong> — testo/audio/video; nulla viene salvato o registrato su SoulTribe.chat.',
    item4: '<strong>Accesso tramite link</strong> — stanza Jitsi privata per incontri confermati; rispettosa della privacy, nessuna installazione su desktop.',
  },
  pt: {
    item3: '<strong>Comunicação direta via Jitsi</strong> — texto/áudio/vídeo; nada é armazenado ou gravado no SoulTribe.chat.',
    item4: '<strong>Entrada fácil por link</strong> — sala Jitsi privada para encontros confirmados; amigável à privacidade, nenhuma instalação no desktop é necessária.',
  },
  nl: {
    item3: '<strong>Directe communicatie via Jitsi</strong> — tekst/audio/video; er wordt niets opgeslagen of opgenomen op SoulTribe.chat.',
    item4: '<strong>Eenvoudig deelnemen via link</strong> — privé Jitsi‑ruimte voor bevestigde afspraken; privacyvriendelijk, geen desktopinstallatie nodig.',
  },
  pl: {
    item3: '<strong>Bezpośrednia komunikacja przez Jitsi</strong> — tekst/głos/wideo; nic nie jest przechowywane ani nagrywane na SoulTribe.chat.',
    item4: '<strong>Łatwe dołączenie przez link</strong> — prywatny pokój Jitsi dla potwierdzonych spotkań; przyjazne prywatności, bez instalacji na komputerze.',
  },
  cs: {
    item3: '<strong>Přímá komunikace přes Jitsi</strong> — text/hlas/video; na SoulTribe.chat se nic neukládá ani nenahrává.',
    item4: '<strong>Snadné připojení odkazem</strong> — soukromá místnost Jitsi pro potvrzené schůzky; ohleduplné k soukromí, bez instalace na desktopu.',
  },
  sk: {
    item3: '<strong>Priama komunikácia cez Jitsi</strong> — text/zvuk/video; na SoulTribe.chat sa nič neukladá ani nenahráva.',
    item4: '<strong>Jednoduché pripojenie cez odkaz</strong> — súkromná miestnosť Jitsi pre potvrdené stretnutia; šetriace súkromie, bez potreby inštalácie.',
  },
  sl: {
    item3: '<strong>Neposredna komunikacija prek Jitsi</strong> — besedilo/zvok/video; na SoulTribe.chat se nič ne shranjuje ali snema.',
    item4: '<strong>Enostavna pridružitev prek povezave</strong> — zasebna soba Jitsi za potrjena srečanja; prijazno do zasebnosti, brez namestitve na namizju.',
  },
  hr: {
    item3: '<strong>Izravna komunikacija putem Jitsija</strong> — tekst/audio/video; ništa se ne pohranjuje niti snima na SoulTribe.chat.',
    item4: '<strong>Jednostavno pridruživanje putem poveznice</strong> — privatna Jitsi soba za potvrđene susrete; prilagođeno privatnosti, bez instalacije na računalu.',
  },
  ro: {
    item3: '<strong>Comunicare directă prin Jitsi</strong> — text/audio/video; nimic nu este stocat sau înregistrat pe SoulTribe.chat.',
    item4: '<strong>Alăturare ușoară prin link</strong> — cameră Jitsi privată pentru întâlniri confirmate; prietenoasă cu confidențialitatea, fără instalare pe desktop.',
  },
  hu: {
    item3: '<strong>Közvetlen kommunikáció Jitsin keresztül</strong> — szöveg/hang/videó; semmi sem kerül tárolásra vagy rögzítésre a SoulTribe.chat oldalon.',
    item4: '<strong>Egyszerű csatlakozás linken</strong> — privát Jitsi-szoba megerősített találkozókhoz; adatvédelmi szempontból kedvező, nincs szükség asztali telepítésre.',
  },
  bg: {
    item3: '<strong>Директна комуникация чрез Jitsi</strong> — текст/аудио/видео; нищо не се съхранява или записва в SoulTribe.chat.',
    item4: '<strong>Лесно присъединяване чрез линк</strong> — частна Jitsi стая за потвърдени срещи; щадящо поверителността, без нужда от инсталация на компютър.',
  },
  el: {
    item3: '<strong>Άμεση επικοινωνία μέσω Jitsi</strong> — κείμενο/ήχος/βίντεο· δεν αποθηκεύεται ή καταγράφεται τίποτα στο SoulTribe.chat.',
    item4: '<strong>Εύκολη συμμετοχή μέσω συνδέσμου</strong> — ιδιωτικό δωμάτιο Jitsi για επιβεβαιωμένα ραντεβού· φιλικό προς την ιδιωτικότητα, χωρίς εγκατάσταση σε υπολογιστή.',
  },
  da: {
    item3: '<strong>Direkte kommunikation via Jitsi</strong> — tekst/lyd/video; intet gemmes eller optages på SoulTribe.chat.',
    item4: '<strong>Nemt at deltage via link</strong> — privat Jitsi‑rum til bekræftede møder; privatlivsvenligt, ingen desktop‑installation nødvendig.',
  },
  no: {
    item3: '<strong>Direkte kommunikasjon via Jitsi</strong> — tekst/lyd/video; ingenting lagres eller tas opp på SoulTribe.chat.',
    item4: '<strong>Enkel lenkepålogging</strong> — privat Jitsi‑rom for bekreftede møter; personvernvennlig, ingen installasjon på datamaskin nødvendig.',
  },
  sv: {
    item3: '<strong>Direktkommunikation via Jitsi</strong> — text/ljud/video; inget sparas eller spelas in på SoulTribe.chat.',
    item4: '<strong>Enkel länkanslutning</strong> — privat Jitsi‑rum för bekräftade möten; integritetsvänligt, ingen installation på datorn krävs.',
  },
  fi: {
    item3: '<strong>Suora viestintä Jitsin kautta</strong> — teksti/ääni/video; mitään ei tallenneta tai nauhoiteta SoulTribe.chatissa.',
    item4: '<strong>Helppo liittyminen linkillä</strong> — yksityinen Jitsi‑huone vahvistetuille tapaamisille; yksityisyyttä kunnioittava, ei työpöytäsovelluksen asennusta.',
  },
  et: {
    item3: '<strong>Otsesuhtlus Jitsi kaudu</strong> — tekst/heli/video; SoulTribe.chatis ei salvestata ega lindistata midagi.',
    item4: '<strong>Lihtne liitumine lingiga</strong> — privaatne Jitsi‑tuba kinnitatud kohtumisteks; privaatsussõbralik, pole vaja lauaarvutisse paigaldust.',
  },
  lv: {
    item3: '<strong>Tieša saziņa caur Jitsi</strong> — teksts/audio/video; nekas netiek glabāts vai ierakstīts vietnē SoulTribe.chat.',
    item4: '<strong>Viega pievienošanās ar saiti</strong> — privāta Jitsi telpa apstiprinātām tikšanām; privātumu saudzējoši, nav nepieciešama instalēšana datorā.',
  },
  lt: {
    item3: '<strong>Tiesioginis bendravimas per Jitsi</strong> — tekstas/garso/vaizdo; niekas nėra saugoma ar įrašoma svetainėje SoulTribe.chat.',
    item4: '<strong>Paprasta prisijungti per nuorodą</strong> — privatus Jitsi kambarys patvirtintiems susitikimams; gerbiantis privatumą, nereikia darbalaukio diegimo.',
  },
  mt: {
    item3: '<strong>Komunikazzjoni diretta permezz ta’ Jitsi</strong> — test/awdio/vidjo; xejn ma jinħażen jew jiġi rrekordjat fuq SoulTribe.chat.',
    item4: '<strong>Dħul faċli permezz ta’ link</strong> — kamra privata Jitsi għal laqgħat ikkonfermati; favur il-privatezza, bla installazzjoni fuq desktop.',
  },
  ga: {
    item3: '<strong>Cumarsáid dhíreach trí Jitsi</strong> — téacs/fuaim/físeán; ní stóráiltear ná taifeadtar aon rud ar SoulTribe.chat.',
    item4: '<strong>Nasc éasca le páirt a ghlacadh</strong> — seomra príobháideach Jitsi do chruinnithe deimhnithe; cairdiúil don phríobháideachas, gan suiteáil deisce.',
  },
  ru: {
    item3: '<strong>Прямая связь через Jitsi</strong> — текст/аудио/видео; ничего не хранится и не записывается на SoulTribe.chat.',
    item4: '<strong>Лёгкое подключение по ссылке</strong> — приватная комната Jitsi для подтверждённых встреч; с уважением к приватности, установка на ПК не требуется.',
  },
};

function updateFile(file, code){
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(raw);
    const cur = MAP[code] || EN;
    if (!json.landing) json.landing = {};
    if (!json.landing.features) json.landing.features = {};
    json.landing.features.item3 = cur.item3;
    json.landing.features.item4 = cur.item4;
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
    console.log('Updated', path.relative(ROOT, file));
  } catch (e) {
    console.error('Failed', file, e.message);
  }
}

function main(){
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const code = dirent.name;
    const file = path.join(LOCALES_DIR, code, 'translation.json');
    if (!fs.existsSync(file)) continue;
    updateFile(file, code);
  }
}

main();
