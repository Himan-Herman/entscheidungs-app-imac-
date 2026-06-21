/** Secțiunile 1–7 — unite în datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Operatorul",
    blocks: [
      {
        type: "p",
        text:
          "Această politică de confidențialitate explică modul în care aplicația MedScoutX prelucrează datele cu caracter personal.",
      },
      {
        type: "address",
        lineStrong: "Operator în sensul GDPR",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Germania",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-mail", dd: "contact@medscoutx.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Telefon", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Despre ce este vorba?",
    blocks: [
      {
        type: "p",
        text:
          "Această notificare descrie modul în care MedScoutX prelucrează datele dumneavoastră cu caracter personal atunci când:",
      },
      {
        type: "ul",
        items: [
          "instalați aplicația și creați un cont,",
          "captați informații pentru o consultație medicală într-un mod structurat și le pregătiți opțional ca PDF,",
          "introduceți simptome prin chat text,",
          "selectați regiuni ale corpului pe harta corporală,",
          "încărcați imagini (de ex. fotografii ale pielii sau imagini medicale).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nu este un instrument de diagnostic sau tratament și nu înlocuiește examinarea sau sfatul medical. Aplicația sprijină pregătirea structurată și documentarea propriilor informații înainte de consultații medicale. Dacă generați un PDF exclusiv local fără transmitere, se aplică notele speciale descrise acolo.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Categorii de date cu caracter personal",
    blocks: [
      {
        type: "p",
        text:
          "În funcție de modul în care utilizați aplicația, pot fi prelucrate următoarele categorii de date cu caracter personal:",
      },
      {
        type: "ul",
        items: [
          "Date de cont: adresă de e-mail, eventual nume sau identificator utilizator, hash al parolei (nu parola în clar), setare limbă.",
          "Date legate de sănătate: intrări text despre simptome, răspunsuri în chatul de simptome, selecția regiunilor corporale pe hartă, informații legate de sănătate în câmpuri text libere.",
          "Date imagine: imagini pe care le încărcați (de ex. modificări ale pielii, fotografii ale regiunilor corpului sau alte zone legate de sănătate). MedScoutX folosește aceste imagini pentru a descrie constatări notabile, dar nu pentru diagnostic medical autonom.",
          "Date de utilizare și jurnal: marcaje temporale ale solicitărilor, jurnale tehnice de erori, eventual adresă IP trunchiată, informații despre browser/dispozitiv, sistem de operare, versiunea aplicației utilizată.",
          "Date de abonament și contract (dacă folosiți un abonament plătit): plan rezervat, durată, stare abonament, informații tehnice de achiziție (prin App Store / Play Store). Datele complete de plată (cum ar fi numerele de card) nu sunt stocate de MedScoutX, ci sunt prelucrate de serviciul de plată al platformei respective.",
          "Date locale pe dispozitivul dumneavoastră: de ex. istoric de chat stocat local sau setări (precum limbă, opțiuni de accesibilitate) în LocalStorage sau mecanisme similare.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Scopurile prelucrării",
    blocks: [
      {
        type: "ul",
        items: [
          "Furnizarea funcțiilor aplicației: autentificare, înregistrare, gestionarea contului și funcțiile principale MedScoutX.",
          "Chat simptome și întrebări ulterioare asistate de IA: prelucrarea intrării dumneavoastră text pentru a furniza întrebări și indicii de clarificare.",
          "Harta corpului: maparea regiunilor selectate la întrebări și indicii IA potrivite.",
          "Analiza imaginilor: prelucrarea imaginilor încărcate pentru a descrie constatări notabile și a sugera posibili pași următori (de ex. clarificare de către clinician). Nu se face diagnostic automat în sens medical-juridic.",
          "Stabilitate și securitate: analiza erorilor, detectarea abuzurilor, protejarea sistemelor și datelor.",
          "Cerințe legale: respectarea obligațiilor legale (de ex. documentarea măsurilor de securitate IT, perioade de păstrare).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Temeiuri legale (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "În funcție de situație, ne bazăm pe următoarele temeiuri legale pentru prelucrare:",
      },
      {
        type: "ul",
        items: [
          "Art. 6 alin. (1) lit. b GDPR – executarea contractului: pentru furnizarea funcțiilor tehnice ale aplicației, cum ar fi înregistrarea, autentificarea și gestionarea contului dumneavoastră de utilizator.",
          "Art. 6 alin. (1) lit. f GDPR – interese legitime: pentru asigurarea securității IT, analiza erorilor și detectarea abuzurilor.",
          "Art. 6 alin. (1) lit. c GDPR – obligație legală: acolo unde există obligații legale de păstrare (de ex. obligații fiscale în legătură cu abonamente).",
          "Art. 9 alin. (2) lit. a GDPR – consimțământ explicit: acesta este temeiul principal pentru prelucrarea datelor dumneavoastră de sănătate. Include simptomele pe care le introduceți voluntar în chatul text, selecțiile de regiuni pe harta corpului și încărcarea și analiza imaginilor. Înainte de prima utilizare a acestor funcții vi se va cere în mod explicit consimțământul (de ex. prin bifă și buton de confirmare). Puteți retrage consimțământul în orice moment cu efect pentru viitor.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Persoane împuternicite și divulgare către terți",
    blocks: [
      {
        type: "p",
        text:
          "Pentru anumite funcții MedScoutX folosește furnizori de servicii ca persoane împuternicite conform art. 28 GDPR. Principalele categorii sunt:",
      },
      {
        type: "ul",
        items: [
          "Furnizori de găzduire (UE): un furnizor european de cloud furnizează infrastructura pentru servere și baze de date (de ex. Render.com cu locație în UE).",
          "Furnizor IA – OpenAI (SUA): pentru prelucrarea asistată de IA a intrării dumneavoastră text, a datelor imagine și a informațiilor despre harta corpului, MedScoutX utilizează serviciile OpenAI LLC (San Francisco, SUA). Conținutul este transmis criptat către OpenAI, prelucrat acolo și șters după prelucrare.",
          "Furnizori de e-mail: se utilizează un furnizor tehnic pentru livrarea e-mailurilor de sistem (de ex. e-mailuri de verificare).",
        ],
      },
      {
        type: "p",
        text:
          "Toate persoanele împuternicite sunt obligate contractual conform art. 28 GDPR și prelucrează datele numai la instrucțiunile noastre. Nu există divulgare a datelor dumneavoastră în scopuri publicitare sau de marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Transferuri în țări terțe",
    blocks: [
      {
        type: "p",
        text:
          "La utilizarea funcțiilor IA MedScoutX, conținutul (de ex. text, simptome, date imagine) este transferat către furnizorul IA OpenAI LLC din SUA. Un astfel de transfer constituie un transfer în țară terță în sensul GDPR.",
      },
      {
        type: "p",
        text:
          "Pentru a asigura un nivel adecvat de protecție a datelor, transferul se bazează pe clauze contractuale standard ale UE (art. 46 GDPR) plus măsuri tehnice și organizatorice suplimentare (criptare în tranzit, durată scurtă de prelucrare, ștergere după răspunsul serviciului IA).",
      },
      {
        type: "p_link",
        before: "Informații suplimentare sunt disponibile în documentația OpenAI privind confidențialitatea: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
