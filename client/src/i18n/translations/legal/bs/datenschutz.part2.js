/** Odjeljci 8–15 — spaja datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Rokovi čuvanja",
    blocks: [
      {
        type: "p",
        text:
          "Pravilo MedScoutX trajno ne pohranjuje istoriju chata, simptome ili slike na serveru. Sadržaj vezan za zdravlje pohranjuje se samo lokalno na vašem uređaju (npr. u LocalStorage) i može se u bilo kojem trenutku obrisati.",
      },
      {
        type: "ul",
        items: [
          "Podaci naloga: adresa e-pošte, hash lozinke i podešavanje jezika čuvaju se dok postoji korisnički nalog. Nakon brisanja naloga ti podaci se brišu ili anonimizuju osim ako ne važe zakonske obaveze čuvanja.",
          "Podaci chata i simptoma: ne pohranjuju se na serveru. Ostaju samo na vašem uređaju i u potpunosti se brišu kada koristite „Novi razgovor” ili „Obriši istoriju”.",
          "Otpreme slika: obrađuju se samo kratko radi proslijeđivanja AI usluzi, zatim se odbacuju. Nema trajnog skladištenja.",
          "Tehnički logovi / server logovi: za rad, sigurnost i analizu grešaka hosting usluge automatski pohranjuju tehničke logove (npr. vrijeme, skraćena IP adresa, detalji grešaka), obično 14–30 dana. Ti podaci nisu povezani s vašim profilom ili sadržajem i ne koriste se za oglašavanje.",
          "Lokalni podaci (LocalStorage, pohrana aplikacije): istorija chata, podešavanja (npr. jezik, pristupačnost) i unosi istorije pohranjuju se samo na uređaju i mogu se ukloniti u bilo kojem trenutku putem „Obriši istoriju” ili podešavanja uređaja.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Sigurnost",
    blocks: [
      {
        type: "p",
        text:
          "Primjenjujemo odgovarajuće tehničke i organizacione mjere radi zaštite vaših podataka od gubitka, izmjene, neovlaštenog pristupa ili druge zloupotrebe. To uključuje posebno:",
      },
      {
        type: "p",
        text:
          "Obrada vaših zdravstvenih podataka vrši se tek nakon što date izričitu saglasnost pri prvom korištenju odgovarajućih funkcija (chat simptomi, karta tijela, analiza slika) (potvrdni okvir + potvrda). Tu saglasnost možete povući u bilo kojem trenutku u postavkama aplikacije.",
      },
      {
        type: "ul",
        items: [
          "Šifrovanje u prijenosu (TLS/HTTPS),",
          "ograničenja pristupa i sistemi uloga/dozvola,",
          "minimizacija podataka i pseudonimizacija gdje je moguće,",
          "redovna ažuriranja sistema.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Djeca i mladi",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nije namijenjen djeci mlađoj od 16 godina. Maloljetnici trebaju koristiti aplikaciju samo uz saglasnost zakonskih staratelja. Ako saznamo da su podaci djeteta mlađeg od 16 godina obrađeni bez saglasnosti staratelja, te podatke ćemo obrisati.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Vaša prava (prava ispitanika)",
    blocks: [
      {
        type: "p",
        text:
          "Prema GDPR-u imate posebno sljedeća prava:",
      },
      {
        type: "ul",
        items: [
          "Pristup (čl. 15 GDPR): možete zatražiti informacije o tome koje lične podatke obrađujemo o vama.",
          "Ispravka (čl. 16 GDPR): možete zatražiti ispravak netačnih podataka ili dopunu nepotpunih podataka.",
          "Brisanje (čl. 17 GDPR): možete zatražiti brisanje vaših ličnih podataka osim ako zakonske obaveze čuvanja to sprječavaju.",
          "Ograničenje (čl. 18 GDPR): možete zatražiti ograničenje obrade.",
          "Prenosivost (čl. 20 GDPR): možete zatražiti svoje podatke u strukturisanom, uobičajenom i strojno čitljivom formatu.",
          "Prigovor (čl. 21 GDPR): gdje se oslanjamo na legitimne interese, možete se usprotiviti iz razloga koji se odnose na vašu posebnu situaciju.",
          "Povlačenje saglasnosti (čl. 7 st. (3) GDPR): danu saglasnost, posebno za zdravstvene podatke, možete povući u bilo kojem trenutku s efektom za budućnost.",
          "Žalba (čl. 77 GDPR): imate pravo podnijeti žalbu nadzornom tijelu, npr. na mjestu prebivališta ili na našoj lokaciji.",
        ],
      },
      {
        type: "p",
        text:
          "Za ostvarivanje prava nas možete kontaktirati u bilo kojem trenutku koristeći gore navedene kontakt podatke.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Kolačići i LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX ne koristi kolačiće za praćenje u svrhu oglašavanja. Radi praktičnosti može se koristiti lokalna pohrana na vašem uređaju, npr.:",
      },
      {
        type: "ul",
        items: [
          "pohrana vašeg jezičkog izbora,",
          "opcionalna pohrana istorije chata,",
          "opcije pristupačnosti (npr. veličina fonta).",
        ],
      },
      {
        type: "p",
        text:
          "Ove informacije možete obrisati u bilo kojem trenutku putem funkcija u aplikaciji ili putem podešavanja uređaja ili preglednika.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Dozvole aplikacije",
    blocks: [
      {
        type: "p",
        text:
          "Ovisno o korištenju MedScoutX može zatražiti sljedeće dozvole na vašem uređaju:",
      },
      {
        type: "ul",
        items: [
          "Pristup kameri/datotekama: za snimanje ili odabir slika za analizu slika. Ova dozvola je opciona i može se opozvati u postavkama uređaja.",
          "Pristup pohrani: za obradu slikovnih datoteka ili privremenih podataka.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX ne pristupa sadržaju bez vaše radnje i ne šalje u pozadini trećim stranama podatke koji nisu potrebni za rad aplikacije.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Napomene o obradi AI",
    blocks: [
      {
        type: "ul",
        items: [
          "Vaši tekstovi i, gdje je primjenjivo, slike obrađuju se automatski radi generisanja prijedloga i napomena.",
          "AI može griješiti ili pogrešno procijeniti situacije. Molimo kritički pregledajte izlaze i koristite ih samo za orijentaciju.",
          "Ne unosite imena trećih strana ili identifikujuće detalje i izbjegavajte nepotrebno opširne lične podatke.",
          "Korištenje aplikacije ne zamjenjuje lični medicinski savjet, dijagnozu ili liječenje od strane liječnika ili drugih zdravstvenih radnika.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading:
      "15. Bez automatizovanog donošenja odluka u smislu čl. 22 GDPR-a",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX ne postavlja dijagnoze niti donosi automatizovane odluke koje proizvode pravne ili slično značajne efekte. Sadržaj koji generiše AI služi samo orijentaciji i ne zamjenjuje medicinski savjet. U medicinski relevantnim situacijama bićete upozoreni da kontaktirate liječnika.",
      },
    ],
  },
];
