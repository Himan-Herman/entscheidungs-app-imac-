/** Odjeljci 1–7 — spaja datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Rukovalac podacima",
    blocks: [
      {
        type: "p",
        text:
          "Ova politika privatnosti objašnjava kako aplikacija MedScoutX obrađuje lične podatke.",
      },
      {
        type: "address",
        lineStrong: "Rukovalac u smislu GDPR-a",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Njemačka",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-pošta", dd: "himankhorshidy@gmail.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Telefon", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. O čemu se radi?",
    blocks: [
      {
        type: "p",
        text:
          "Ova obavještavanje opisuje kako MedScoutX obrađuje vaše lične podatke kada:",
      },
      {
        type: "ul",
        items: [
          "instalirate aplikaciju i kreirate nalog,",
          "prikupljate informacije za medicinski pregled na strukturisan način i ih po želji pripremate kao PDF,",
          "unosite simptome putem tekstualnog chata,",
          "birate regije tijela na karti tijela,",
          "otpremate slike (npr. fotografije kože ili medicinske snimke).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nije alat za dijagnozu ili liječenje i ne zamjenjuje medicinski pregled ili savjet. Aplikacija podržava strukturisanu pripremu i dokumentaciju vlastitih informacija prije medicinskih posjeta. Ako generišete PDF isključivo lokalno bez prijenosa, primjenjuju se posebne napomene tamo opisane.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Kategorije ličnih podataka",
    blocks: [
      {
        type: "p",
        text:
          "Ovisno o načinu korištenja aplikacije, mogu se obrađivati sljedeće kategorije ličnih podataka:",
      },
      {
        type: "ul",
        items: [
          "Podaci naloga: adresa e-pošte, eventualno ime ili korisničko ime, hash lozinke (ne lozinka u čistom tekstu), podešavanje jezika.",
          "Podaci vezani za zdravlje: tekstualni unosi o simptomima, odgovori u chatu za simptome, izbor regija tijela na karti, informacije vezane za zdravlje u poljima slobodnog teksta.",
          "Podaci slika: slike koje otpremate (npr. promjene na koži, fotografije regija tijela ili drugih oblasti vezane za zdravlje). MedScoutX koristi ove slike za opis uočljivih nalaza, ali ne za samostalnu medicinsku dijagnozu.",
          "Podaci korištenja i logovi: vremenske oznake zahtjeva, tehnički logovi grešaka, eventualno skraćena IP adresa, informacije o pregledniku/uređaju, operativni sistem, korištena verzija aplikacije.",
          "Podaci pretplate i ugovora (ako koristite plaćenu pretplatu): rezervisani plan, trajanje, status pretplate, tehničke informacije o kupovini (preko App Store / Play Store). Potpuni podaci o plaćanju (kao što su brojevi kartica) ne pohranjuju se u MedScoutX već ih obrađuje odgovarajuća platna usluga platforme.",
          "Lokalni podaci na vašem uređaju: npr. lokalno pohranjena istorija chata ili podešavanja (jezik, opcije pristupačnosti) u LocalStorage ili sličnim mehanizmima.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Svrhe obrade",
    blocks: [
      {
        type: "ul",
        items: [
          "Pružanje funkcija aplikacije: prijava, registracija, upravljanje nalogom i osnovne funkcije MedScoutX.",
          "Chat za simptome i AI podržana dodatna pitanja: obrada vašeg tekstualnog unosa radi davanja pitanja i napomena za dalju razjašnjenje.",
          "Karta tijela: mapiranje odabranih regija na odgovarajuća AI dodatna pitanja i napomene.",
          "Analiza slika: obrada otpremljenih slika radi opisa uočljivih nalaza i prijedloga mogućih sljedećih koraka (npr. razjašnjenje od strane liječnika). Ne vrši se automatska dijagnoza u medicinsko-pravnom smislu.",
          "Stabilnost i sigurnost: analiza grešaka, otkrivanje zloupotrebe, zaštita sistema i podataka.",
          "Pravni zahtjevi: ispunjavanje zakonskih obaveza (npr. dokumentacija IT sigurnosnih mjera, rokovi čuvanja).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Pravne osnove (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "Ovisno o situaciji oslanjamo se na sljedeće pravne osnove za obradu:",
      },
      {
        type: "ul",
        items: [
          "Čl. 6 st. (1) tačka b) GDPR – izvršavanje ugovora: za pružanje tehničkih funkcija aplikacije kao što su registracija, prijava i upravljanje korisničkim nalogom.",
          "Čl. 6 st. (1) tačka f) GDPR – legitimni interesi: za osiguranje IT sigurnosti, analizu grešaka i otkrivanje zloupotrebe.",
          "Čl. 6 st. (1) tačka c) GDPR – zakonska obaveza: gdje postoje zakonske obaveze čuvanja (npr. poreske obaveze u vezi s pretplatama).",
          "Čl. 9 st. (2) tačka a) GDPR – izričita saglasnost: ovo je primarna pravna osnova za obradu vaših zdravstvenih podataka. To uključuje simptome koje dobrovoljno unosite u tekstualni chat, izbore regija na karti tijela te otpremanje i analizu slika. Prije prvog korištenja ovih funkcija izričito ćete biti zamoljeni za saglasnost (npr. potvrdni okvir i dugme za potvrdu). Saglasnost možete povući u bilo kojem trenutku s efektom za budućnost.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Izvršioci obrade i otkrivanje trećim stranama",
    blocks: [
      {
        type: "p",
        text:
          "Za određene funkcije MedScoutX koristi pružaoce usluga kao izvršioce obrade prema čl. 28 GDPR-a. Glavne kategorije su:",
      },
      {
        type: "ul",
        items: [
          "Pružaoci hostinga (EU): evropski cloud pružalac osigurava infrastrukturu za servere i baze podataka (npr. Render.com s lokacijom u EU).",
          "AI pružalac – OpenAI (SAD): za AI obradu vašeg teksta, podataka slika i informacija sa karte tijela MedScoutX koristi usluge OpenAI LLC (San Francisco, SAD). Sadržaj se šifrovano prenosi OpenAI-u, obrađuje tamo i briše nakon obrade.",
          "Pružaoci e-pošte: koristi se tehnički pružalac za slanje sistemskih e-poruka (npr. poruka za verifikaciju).",
        ],
      },
      {
        type: "p",
        text:
          "Svi izvršioci vezani su ugovorom prema čl. 28 GDPR-a i obrađuju podatke samo po našim uputama. Nema otkrivanja vaših podataka u svrhu oglašavanja ili marketinga.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Prijenosi u treće zemlje",
    blocks: [
      {
        type: "p",
        text:
          "Pri korištenju AI funkcija MedScoutX sadržaj (npr. tekst, simptomi, podaci slika) prenosi se AI pružaocu OpenAI LLC u SAD-u. Takav prijenos predstavlja prijenos u treću zemlju u smislu GDPR-a.",
      },
      {
        type: "p",
        text:
          "Radi osiguranja odgovarajuće zaštite podataka prijenos se zasniva na standardnim ugovornim klauzulama EU (čl. 46 GDPR) uz dodatne tehničke i organizacione mjere (šifrovanje u prijenosu, kratko trajanje obrade, brisanje nakon odgovora AI usluge).",
      },
      {
        type: "p_link",
        before: "Daljnje informacije dostupne su u dokumentaciji OpenAI o privatnosti: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
