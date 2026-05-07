/** Seksionet 8–15 — bashkohen në datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Periudhat e ruajtjes",
    blocks: [
      {
        type: "p",
        text:
          "Si rregull MedScoutX nuk ruan përgjithmonë në server historikët e bisedës, simptomat ose imazhet. Përmbajtja e lidhur me shëndetin ruhet vetëm lokalisht në pajisjen tuaj (p.sh. në LocalStorage) dhe mund të fshihet në çdo kohë.",
      },
      {
        type: "ul",
        items: [
          "Të dhënat e llogarisë: adresa email, hash i fjalëkalimit dhe cilësimi i gjuhës ruhen për jetëgjatësinë e llogarisë suaj. Pas fshirjes së llogarisë këto të dhëna fshihen ose anonimizohen përveçse kur zbatohen detyrime ligjore ruajtjeje.",
          "Të dhënat e bisedës dhe simptomave: nuk ruhen në server; mbeten vetëm në pajisjen tuaj dhe fshihen plotësisht kur përdorni \"Bisedë e re\" ose \"Fshi historikun\".",
          "Ngarkimet e imazheve: përpunohen vetëm përkohësisht për kalimin te shërbimi IA, pastaj hidhen; nuk ka ruajtje të përhershme.",
          "Regjistrat teknikë / serverë: për operacion, siguri dhe analizë gabimesh, shërbimet e strehimit ruajnë automatikisht regjistra teknikë (p.sh. kohë, IP e shkurtuar, detaje gabimesh), zakonisht për 14–30 ditë. Këto të dhëna nuk lidhen me profilin tuaj ose përmbajtjen dhe nuk përdoren për reklamë.",
          "Të dhëna lokale (LocalStorage, ruajtje aplikacioni): historikët e bisedës, cilësimet (p.sh. gjuhë, aksesibilitet) dhe hyrjet e historikut ruhen vetëm në pajisje dhe mund të hiqen përmes \"Fshi historikun\" ose cilësimeve të pajisjes.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Siguria",
    blocks: [
      {
        type: "p",
        text:
          "Zbatojmë masa të përshtatshme teknike dhe organizative për të mbrojtur të dhënat tuaja nga humbja, ndryshimi, aksesi i paautorizuar ose keqpërdime të tjera. Këto përfshijnë në veçanti:",
      },
      {
        type: "p",
        text:
          "Përpunimi i të dhënave tuaja shëndetësore ndodh vetëm pasi të jepni pëlqim të qartë në përdorimin e parë të funksioneve përkatëse (bisedë simptomash, hartë trupi, analizë imazhi) (kutizë + konfirmim). Këtë pëlqim mund ta tërhiqni në çdo kohë në cilësimet e aplikacionit.",
      },
      {
        type: "ul",
        items: [
          "Fshehtëzim transporti (TLS/HTTPS),",
          "kufizime aksesi dhe sisteme rolesh/lejesh,",
          "minimalizim të dhënash dhe përpunim pseudonim kur është e mundur,",
          "përditësime të rregullta sistemi.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Fëmijë dhe të rinj",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nuk adresohet fëmijëve nën 16 vjeç. Të miturit duhet të përdorin aplikacionin vetëm me pëlqimin e kujdestarëve ligjorë. Nëse mësojmë se janë përpunuar të dhëna të një fëmije nën 16 pa pëlqim kujdestari, i fshijmë ato të dhëna.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Të drejtat tuaja (subjekti i të dhënave)",
    blocks: [
      {
        type: "p",
        text:
          "Sipas GDPR ju keni në veçanti këto të drejta:",
      },
      {
        type: "ul",
        items: [
          "Qasje (neni 15 GDPR): mund të kërkoni informacion se cilë të dhëna personale përpunojmë për ju.",
          "Rectifikim (neni 16 GDPR): mund të kërkoni korrigjimin e të dhënave të pasakta ose plotësimin e të paplota.",
          "Fshirje (neni 17 GDPR): mund të kërkoni fshirjen e të dhënave personale përveçse kur detyrimet ligjore ruajtjeje e pengojnë.",
          "Kufizim (neni 18 GDPR): mund të kërkoni kufizimin e përpunimit.",
          "Portabilitet (neni 20 GDPR): mund të kërkoni të dhënat tuaja në një format të strukturuar, të përdorur zakonisht dhe të lexueshëm nga makina.",
          "Kundërshtim (neni 21 GDPR): kur mbështetemi në interesa të ligjshme, mund të kundërshtoni për arsye që lidhen me situatën tuaj të veçantë.",
          "Tërheqje e pëlqimit (neni 7(3) GDPR): pëlqimi i dhënë, veçanërisht për të dhëna shëndetësore, mund të tërhiqet në çdo kohë me efekt për të ardhmen.",
          "Ankesë (neni 77 GDPR): keni të drejtë të parashtroni ankesë te një autoritet mbikëqyrës, p.sh. në vendbanimin tuaj ose në vendndodhjen tonë.",
        ],
      },
      {
        type: "p",
        text:
          "Për të ushtruar të drejtat mund të na kontaktoni në çdo kohë duke përdorur të dhënat e kontaktit më sipër.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies dhe LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nuk përdor cookies gjurmimi për reklamë. Për komoditet mund të përdoret ruajtje lokale në pajisjen tuaj, p.sh.:",
      },
      {
        type: "ul",
        items: [
          "ruajtja e preferencës së gjuhës,",
          "ruajtje opsionale e historikut të bisedës,",
          "opsione aksesibiliteti (p.sh. madhësia e shkronjave).",
        ],
      },
      {
        type: "p",
        text:
          "Këtë informacion mund ta fshini në çdo kohë përmes funksioneve në aplikacion ose cilësimeve të pajisjes ose shfletuesit.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Lejet e aplikacionit",
    blocks: [
      {
        type: "p",
        text:
          "Varësisht nga përdorimi, MedScoutX mund të kërkojë lejet e mëposhtme në pajisjen tuaj:",
      },
      {
        type: "ul",
        items: [
          "Qasje në kamerë/skedarë: për të bërë ose zgjedhur imazhe për analizën e imazhit. Leja është opsionale dhe mund të tërhiqet në cilësimet e pajisjes.",
          "Qasje në ruajtje: për të përpunuar skedarë imazhesh ose të dhëna të përkohshme.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nuk akseson përmbajtje pa veprimin tuaj dhe nuk dërgon në sfond të dhëna për palë të treta që nuk janë të nevojshme për funksionimin e aplikacionit.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Shënime për përpunimin IA",
    blocks: [
      {
        type: "ul",
        items: [
          "Tekstet tuaja dhe, kur është e aplikueshme, imazhet përpunohen automatikisht për të gjeneruar sugjerime dhe ndihmëza.",
          "IA mund të gabojë ose të vlerësojë gabim situatat. Ju lutemi shqyrtoni kritikisht rezultatet dhe përdorini vetëm për orientim.",
          "Mos parashtroni emra palësh të treta ose të dhëna identifikuese dhe shmangni të dhëna personale të tepërta.",
          "Përdorimi i aplikacionit nuk zëvendëson këshillën personale mjekësore, diagnozën ose trajtimin nga mjekët ose profesionistë të tjerë shëndetësorë.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Pa vendimmarrje të automatizuar sipas nenit 22 GDPR",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nuk bën diagnoza ose vendime të automatizuara që prodhojnë efekte ligjore ose të ngjashme në ju. Përmbajtja e gjeneruar nga IA shërben vetëm për orientim dhe nuk zëvendëson këshillën mjekësore. Në situata mjekësore relevante do të nxirreni në kontakt me një klinicist.",
      },
    ],
  },
];
