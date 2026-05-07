/** Seksionet 1–7 — bashkohen në datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Përgjegjësi i përpunimit",
    blocks: [
      {
        type: "p",
        text:
          "Kjo politikë privatësie shpjegon se si aplikacioni MedScoutX përpunon të dhënat personale.",
      },
      {
        type: "address",
        lineStrong: "Përgjegjësi në kuptimin e GDPR",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Gjermani",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "Email", dd: "himankhorshidy@gmail.com", href: "mailto:privacy@medscout.app" },
          { dt: "Telefon", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Për çfarë është ky dokument?",
    blocks: [
      {
        type: "p",
        text:
          "Ky njoftim përshkruan se si MedScoutX përpunon të dhënat tuaja personale kur:",
      },
      {
        type: "ul",
        items: [
          "instaloni aplikacionin dhe krijoni një llogari,",
          "mbledhni në mënyrë të strukturuar informacion për një takim mjekësor dhe opsionalisht e përgatisni si PDF,",
          "fusni simptoma përmes bisedës me tekst,",
          "zgjidhni rajone trupore përmes hartës së trupit,",
          "ngarkoni imazhe (p.sh. foto të lëkurës ose imazhe mjekësore).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nuk është mjet diagnostikues ose terapeutik dhe nuk zëvendëson ekzaminimin mjekësor ose këshillën. Aplikacioni mbështet përgatitjen dhe dokumentimin e strukturuar të informacionit tuaj para takimeve mjekësore. Nëse gjeneroni një PDF vetëm lokalisht pa transmetim, zbatohen shënimet speciale të përshkruara atje.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Kategoritë e të dhënave personale",
    blocks: [
      {
        type: "p",
        text:
          "Varësisht nga mënyra e përdorimit të aplikacionit, mund të përpunohen kategoritë e mëposhtme të të dhënave personale:",
      },
      {
        type: "ul",
        items: [
          "Të dhënat e llogarisë: adresa email, ndoshta emri ose përdoruesi, hash i fjalëkalimit (jo fjalëkalim i tekstit të pastër), cilësimi i gjuhës.",
          "Të dhëna të lidhura me shëndetin: hyrje teksti për simptoma, përgjigje në bisedën e simptomave, zgjedhja e rajoneve të trupit në hartë, informacion shëndetësor në fusha teksti të lira.",
          "Të dhëna imazhi: imazhe që ngarkoni (p.sh. ndryshime të lëkurës, foto rajonesh trupore ose zona të tjera të lidhura me shëndetin). MedScoutX i përdor këto imazhe për të përshkruar gjetje të dukshme, jo për diagnozë të pavarur mjekësore.",
          "Të dhëna përdorimi dhe regjistrimi: kohëmatës kërkesash, regjistra gabimesh teknikë, ndoshta adresë IP e shkurtuar, informacion për shfletues/pajisje, sistem operativ, versioni i aplikacionit.",
          "Të dhëna abonimi dhe kontrate (nëse përdorni abonim me pagesë): plani i rezervuar, afati, statusi i abonimit, informacion teknik blerjeje (përmes App Store / Play Store). Të dhëna të plota pagesash (si numra kartash) nuk ruhen nga MedScoutX por përpunohen nga shërbimi i pagesës i platformës përkatëse.",
          "Të dhëna lokale në pajisjen tuaj: p.sh. historik bisede i ruajtur lokalisht ose cilësime (gjuhë, opsione aksesibiliteti) në LocalStorage ose mekanizma të ngjashëm.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Qëllimet e përpunimit",
    blocks: [
      {
        type: "ul",
        items: [
          "Ofrimi i funksioneve të aplikacionit: hyrje, regjistrim, menaxhim llogarie dhe veçoritë kryesore të MedScoutX.",
          "Biseda e simptomave dhe pyetje të mëpasshme të mbështetura nga IA: përpunimi i hyrjes suaj të tekstit për pyetje dhe sugjerime sqaruese.",
          "Harta e trupit: lidhja e rajoneve të zgjedhura me pyetje dhe sugjerime të përshtatshme IA.",
          "Analiza e imazhit: përpunimi i imazheve të ngarkuara për të përshkruar gjetje të dukshme dhe hapa të mundshëm të mëpasshëm (p.sh. sqarim nga klinicisti). Nuk bëhet diagnozë automatike në kuptimin juridiko-mjekësor.",
          "Qëndrueshmëri dhe siguri: analizë gabimesh, zbulim abuzimi, mbrojtje e sistemeve dhe të dhënave.",
          "Kërkesa ligjore: përmbushje detyrimesh ligjore (p.sh. dokumentim masash sigurie IT, periudha ruajtjeje).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Baza ligjore (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "Varësisht nga situata, mbështetemi në bazat e mëposhtme ligjore për përpunimin:",
      },
      {
        type: "ul",
        items: [
          "Neni 6 (1)(b) GDPR – ekzekutimi i kontratës: për ofrimin e funksioneve teknike të aplikacionit si regjistrimi, hyrja dhe menaxhimi i llogarisë.",
          "Neni 6 (1)(f) GDPR – interesa të ligjshme: për sigurinë IT, analizën e gabimeve dhe zbulimin e abuzimit.",
          "Neni 6 (1)(c) GDPR – detyrim ligjor: kur ekzistojnë detyrime ligjore ruajtjeje (p.sh. detyrime tatimore në lidhje me abonimet).",
          "Neni 9 (2)(a) GDPR – pëlqim i qartë: baza kryesore për përpunimin e të dhënave tuaja shëndetësore, përfshirë simptomat e futura vullnetarisht në bisedë, zgjedhjet në hartën e trupit dhe ngarkimin dhe analizën e imazheve. Para përdorimit të parë të këtyre funksioneve do të kërkohet pëlqim i qartë (p.sh. kutizë dhe buton konfirmimi). Pëlqimin mund ta tërhiqni në çdo kohë me efekt për të ardhmen.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Përpunuesit dhe zbulimi për palë të treta",
    blocks: [
      {
        type: "p",
        text:
          "Për disa funksione MedScoutX përdor ofrues shërbimesh si përpunues sipas nenit 28 GDPR. Kategoritë kryesore janë:",
      },
      {
        type: "ul",
        items: [
          "Ofrues strehimi (BE): një ofrues evropian reshu ofron infrastrukturë për servera dhe baza të dhënash (p.sh. Render.com me vendndodhje në BE).",
          "Ofrues IA – OpenAI (SHBA): për përpunimin IA të hyrjes suaj teksti, të dhënave të imazhit dhe informacionit të hartës së trupit, MedScoutX përdor shërbimet e OpenAI LLC (San Francisco, SHBA). Përmbajtja dërgohet e fshehtëzuar te OpenAI, përpunohet atje dhe fshihet pas përpunimit.",
          "Ofrues email-i: përdoret një ofrues teknik për dërgimin e email-eve të sistemit (p.sh. verifikimi i email-it).",
        ],
      },
      {
        type: "p",
        text:
          "Të gjithë përpunuesit janë të lidhur me kontrata sipas nenit 28 GDPR dhe përpunojnë të dhëna vetëm sipas udhëzimeve tona. Nuk ka zbulim të të dhënave tuaja për reklamë ose marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Transferimet drejt vendeve të treta",
    blocks: [
      {
        type: "p",
        text:
          "Kur përdorni funksionet IA të MedScoutX, përmbajtja (p.sh. tekst, simptoma, të dhëna imazhi) transferohet te ofruesi IA OpenAI LLC në SHBA. Një transfer i tillë përbën transfer drejt një vendi të tretë në kuptimin e GDPR.",
      },
      {
        type: "p",
        text:
          "Për të siguruar një nivel të përshtatshëm mbrojtjeje të dhënash, transferi bazohet në klauzola standardë kontrate të BE-së (nen 46 GDPR) plus masa shtesë teknike dhe organizative (fshehtëzim gjatë transmetimit, kohë e shkurtër përpunimi, fshirje pas përgjigjes së shërbimit IA).",
      },
      {
        type: "p_link",
        before: "Më shumë informacion në dokumentacionin e privatësisë së OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
