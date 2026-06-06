/** §1–§4 — AGB na hrvatskom */
export default [
  {
    id: "agb-1-geltungsbereich",
    heading: "§1 Obuhvat i pružalac",
    blocks: [
      {
        type: "html",
        html: `
<p>Ovi Uvjeti korištenja uređuju korištenje mobilne i web aplikacije <strong>MedScoutX</strong> („Aplikacija”) od strane krajnjih privatnih korisnika.</p>
<p>Pružalac Aplikacije je:<br /><strong>MedScoutX Health Solutions – Himan Khorshidi</strong><br />Eisenstraße 64<br />40227 Düsseldorf<br />Njemačka<br />E-pošta: <a href="mailto:contact@medscoutx.com">contact@medscoutx.com</a></p>
<p>Korištenje Aplikacije dozvoljeno je isključivo punoljetnim osobama starijim od <strong>18 godina</strong>. Maloljetnici ne smiju koristiti Aplikaciju.</p>
`.trim(),
      },
    ],
  },
  {
    id: "agb-2-zweck",
    heading: "§2 Svrha Aplikacije i medicinska napomena",
    blocks: [
      {
        type: "html",
        html: `
<p>MedScoutX je informacioni i orijentacioni alat uz podršku vještačke inteligencije u oblasti zdravstva. Aplikacija je namijenjena da korisnicima pruži početni strukturisani pregled mogućih uzroka tegoba i potencijalno relevantnih medicinskih specijalnosti.</p>
<p>MedScoutX <strong>nije medicinski uređaj</strong> u smislu EU Uredbe o medicinskim uređajima (MDR). Posebno:</p>
<ul>
<li>Aplikacija <strong>ne postavlja dijagnoze</strong>,</li>
<li><strong>ne preporučuje posebne terapije</strong> ili lijekove,</li>
<li><strong>ne zamjenjuje kliničke odluke</strong> ili liječenje.</li>
</ul>
<p>Korištenje Aplikacije nikada ne zamjenjuje lični pregled, vođenje ili liječenje od strane liječnika ili drugih zdravstvenih radnika. Odluke o dijagnostici, terapijama ili lijekovima ne smiju se donositi isključivo na osnovu izlaza AI.</p>
<p>U akutnim ili životno ugrožavajućim situacijama odmah nazovite odgovarajući hitni broj (npr. EU: <strong>112</strong>, SAD: <strong>911</strong>) ili hitnu medicinsku službu.</p>
`.trim(),
      },
    ],
  },
  {
    id: "agb-3-vertrag",
    heading: "§3 Zahtjevi za korištenje, registracija i račun",
    blocks: [
      {
        type: "html",
        html: `
<p>(1) Korištenje MedScoutX općenito zahtijeva korisnički račun. Registracija je dozvoljena samo osobama koje su navršile <strong>18 godina</strong>.</p>
<p>(2) Pri registraciji korisnik izričito potvrđuje da ima najmanje 18 godina. Pružalac može zatražiti dokaz o godinama ili suspendirati račune ako postoji razumna sumnja u dob.</p>
<p>(3) Korisnik mora dati tačne i potpune informacije pri registraciji i ažurirati ih ako se promijene.</p>
<p>(4) Pristupni podaci (npr. lozinka, token za prijavu) moraju se čuvati povjerljivo i ne smiju se otkrivati trećim stranama. Korisnik je odgovoran za sve aktivnosti izvršene njegovim pristupnim podacima gdje je korisnik kriv.</p>
<p>(5) Zabranjeno je korištenje Aplikacije u nezakonite svrhe, analiza podataka trećih strana bez saglasnosti, zaobilaženje sigurnosnih mehanizama ili automatizovano masovno korištenje (scraping, botovi).</p>
`.trim(),
      },
    ],
  },
  {
    id: "agb-4-leistungen",
    heading: "§4 Usluge koje pruža Aplikacija",
    blocks: [
      {
        type: "html",
        html: `
<p>(1) MedScoutX pruža posebno sljedeće funkcije:</p>
<ul>
<li>AI podržana analiza simptoma putem područja chata,</li>
<li>AI podržana analiza slikovnih podataka,</li>
<li>izbor regija tijela putem karte tijela,</li>
<li>upravljanje korisničkim računom i funkcije istorije,</li>
<li>gdje je primjenjivo, dodatne funkcije unutar plaćenih pretplata.</li>
</ul>
<p>(2) Tačan obim funkcija može varirati ovisno o verziji aplikacije i odabranoj pretplati. Ne postoji pravo na određenu funkcionalnost osim ako je to izričito obećano.</p>
<p>(3) Pružalac može prilagođavati, proširivati ili ograničavati funkcije pod uvjetom da je to razumno za korisnika i da ne narušava bitne ugovorne obaveze.</p>
`.trim(),
      },
    ],
  },
];
