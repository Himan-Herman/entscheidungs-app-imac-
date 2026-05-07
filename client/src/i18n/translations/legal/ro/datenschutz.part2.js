/** Secțiunile 8–15 — unite în datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Perioade de păstrare",
    blocks: [
      {
        type: "p",
        text:
          "În regulă MedScoutX nu stochează permanent pe server istoricul chatului, simptomele sau imaginile. Conținutul legat de sănătate este stocat numai local pe dispozitivul dumneavoastră (de ex. în LocalStorage) și poate fi șters în orice moment.",
      },
      {
        type: "ul",
        items: [
          "Date de cont: adresa de e-mail, hash-ul parolei și setarea limbii sunt păstrate pe durata existenței contului. După ștergerea contului aceste date sunt eliminate sau anonimizate, cu excepția obligațiilor legale de păstrare.",
          "Date chat și simptome: nu sunt stocate pe server. Rămân numai pe dispozitivul dumneavoastră și sunt șterse complet când folosiți „Conversație nouă” sau „Șterge istoricul”.",
          "Încărcări de imagini: sunt prelucrate doar pe scurt pentru transmitere către serviciul IA, apoi eliminate. Nu există stocare permanentă.",
          "Jurnale tehnice / server: pentru operare, securitate și analiza erorilor, serviciile de găzduire stochează automat jurnale tehnice (de ex. timp, adresă IP trunchiată, detalii erori), de obicei 14–30 de zile. Aceste date nu sunt legate de profilul dumneavoastră sau de conținut și nu sunt folosite pentru publicitate.",
          "Date locale (LocalStorage, stocare aplicație): istoricul chatului, setările (de ex. limbă, accesibilitate) și intrările din istoric sunt stocate numai pe dispozitiv și pot fi eliminate în orice moment prin „Șterge istoricul” sau setările dispozitivului.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Securitate",
    blocks: [
      {
        type: "p",
        text:
          "Implementăm măsuri tehnice și organizatorice adecvate pentru a proteja datele împotriva pierderii, alterării, accesului neautorizat sau altor utilizări necorespunzătoare. Acestea includ în special:",
      },
      {
        type: "p",
        text:
          "Prelucrarea datelor dumneavoastră de sănătate are loc numai după ce dați consimțământ explicit la prima utilizare a funcțiilor relevante (chat simptome, hartă corp, analiză imagini) (bifă + confirmare). Puteți retrage acest consimțământ în orice moment în setările aplicației.",
      },
      {
        type: "ul",
        items: [
          "Criptare în tranzit (TLS/HTTPS),",
          "restricții de acces și sisteme de roluri/permisiuni,",
          "minimizarea datelor și prelucrare pseudonimă acolo unde este posibil,",
          "actualizări regulate ale sistemului.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Copii și tineri",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nu se adresează copiilor sub 16 ani. Minorii ar trebui să utilizeze aplicația numai cu acordul reprezentanților legali. Dacă aflăm că datele unui copil sub 16 ani au fost prelucrate fără acordul tutorelui, vom șterge aceste date.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Drepturile dumneavoastră (drepturile persoanei vizate)",
    blocks: [
      {
        type: "p",
        text:
          "În temeiul GDPR aveți în special următoarele drepturi:",
      },
      {
        type: "ul",
        items: [
          "Acces (art. 15 GDPR): puteți solicita informații despre ce date cu caracter personal prelucrăm despre dumneavoastră.",
          "Rectificare (art. 16 GDPR): puteți solicita corectarea datelor inexacte sau completarea celor incomplete.",
          "Ștergere (art. 17 GDPR): puteți solicita ștergerea datelor cu caracter personal, cu excepția cazurilor în care obligațiile legale de păstrare împiedică acest lucru.",
          "Restrângere (art. 18 GDPR): puteți solicita restrângerea prelucrării.",
          "Portabilitate (art. 20 GDPR): puteți solicita datele într-un format structurat, utilizat în mod curent și care poate fi citit automat.",
          "Opoziție (art. 21 GDPR): acolo unde ne bazăm pe interese legitime, vă puteți opune din motive legate de situația dumneavoastră particulară.",
          "Retragerea consimțământului (art. 7 alin. (3) GDPR): consimțământul acordat, în special pentru date de sănătate, poate fi retras în orice moment cu efect pentru viitor.",
          "Plângere (art. 77 GDPR): aveți dreptul de a depune o plângere la o autoritate de supraveghere, de ex. la locul reședinței dumneavoastră sau la sediul nostru.",
        ],
      },
      {
        type: "p",
        text:
          "Pentru a vă exercita drepturile ne puteți contacta oricând folosind datele de contact de mai sus.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookie-uri și LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nu folosește cookie-uri de urmărire pentru publicitate. Pentru confort poate fi utilizată stocarea locală pe dispozitivul dumneavoastră, de ex.:",
      },
      {
        type: "ul",
        items: [
          "stocarea preferinței de limbă,",
          "stocarea opțională a istoricului chatului,",
          "opțiuni de accesibilitate (de ex. dimensiune font).",
        ],
      },
      {
        type: "p",
        text:
          "Puteți șterge aceste informații în orice moment prin funcțiile din aplicație sau prin setările dispozitivului sau ale browserului.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Permisiuni ale aplicației",
    blocks: [
      {
        type: "p",
        text:
          "În funcție de utilizare, MedScoutX poate solicita următoarele permisiuni pe dispozitivul dumneavoastră:",
      },
      {
        type: "ul",
        items: [
          "Acces cameră/fișiere: pentru a face sau selecta imagini pentru analiza imaginilor. Această permisiune este opțională și poate fi revocată în setările dispozitivului.",
          "Acces stocare: pentru prelucrarea fișierelor imagine sau a datelor temporare.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nu accesează conținut fără acțiunea dumneavoastră și nu trimite în fundal către terți date care nu sunt necesare pentru funcționarea aplicației.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Note privind prelucrarea IA",
    blocks: [
      {
        type: "ul",
        items: [
          "Textele dumneavoastră și, după caz, imaginile sunt prelucrate automat pentru a genera sugestii și indicii.",
          "IA poate greși sau poate evalua greșit situații. Vă rugăm să examinați critic rezultatele și să le folosiți doar pentru orientare.",
          "Nu introduceți nume ale terților sau date identificabile și evitați date cu caracter personal inutile.",
          "Utilizarea aplicației nu înlocuiește sfatul medical personal, diagnosticul sau tratamentul de către medici sau alți profesioniști din sănătate.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading:
      "15. Fără luare automată a deciziilor în sensul art. 22 GDPR",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nu pune diagnostice și nu ia decizii automate care produc efecte juridice sau similare semnificativ asupra persoanei. Conținutul generat de IA servește numai orientării și nu înlocuiește sfatul medical. În situații medicale relevante vi se va recomanda să contactați un clinician.",
      },
    ],
  },
];
