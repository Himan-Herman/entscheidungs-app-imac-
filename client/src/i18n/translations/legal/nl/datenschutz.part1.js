/** Secties 1–7 — samengevoegd in datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Verwerkingsverantwoordelijke",
    blocks: [
      {
        type: "p",
        text:
          "Dit privacybeleid beschrijft hoe de MedScoutX-app persoonsgegevens verwerkt.",
      },
      {
        type: "address",
        lineStrong: "Verwerkingsverantwoordelijke in de zin van de AVG",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Duitsland",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-mail", dd: "contact@medscoutx.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Telefoon", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Waar gaat dit over?",
    blocks: [
      {
        type: "p",
        text:
          "Deze informatie beschrijft hoe MedScoutX uw persoonsgegevens verwerkt wanneer u:",
      },
      {
        type: "ul",
        items: [
          "de app installeert en een account aanmaakt,",
          "gestructureerd informatie voor een artsenbezoek vastlegt en deze desgewenst als PDF voorbereidt,",
          "symptomen via de tekstchat invoert,",
          "lichaamsregio’s via de lichaamskaart selecteert,",
          "afbeeldingen uploadt (bijv. huidfoto’s of medische beelden).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX is geen diagnose- of behandelinstrument en vervangt geen medisch onderzoek of advies. De applicatie ondersteunt gestructureerde voorbereiding en documentatie van uw eigen gegevens vóór consulten. Als u puur lokaal een PDF genereert zonder verzending, gelden de daar beschreven bijzondere opmerkingen.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Categorieën persoonsgegevens",
    blocks: [
      {
        type: "p",
        text:
          "Afhankelijk van uw gebruik kunnen de volgende categorieën persoonsgegevens worden verwerkt:",
      },
      {
        type: "ul",
        items: [
          "Accountgegevens: e-mailadres, eventueel naam of gebruikersnaam, wachtwoordhash (geen wachtwoord in klare tekst), taalinstelling.",
          "Gezondheidsgegevens: tekstinvoer over symptomen, antwoorden in de symptoomchat, selectie van lichaamsregio’s op de kaart, gezondheidsgerelateerde informatie in vrije tekstvelden.",
          "Beeldgegevens: door u geüploade afbeeldingen (bijv. huidveranderingen, foto’s van lichaamsregio’s of andere gezondheidsgerelateerde gebieden). MedScoutX gebruikt deze om opvallende bevindingen te beschrijven, niet voor zelfstandige medische diagnose.",
          "Gebruiks- en loggegevens: tijdstempels van verzoeken, technische foutlogboeken, eventueel ingekorte IP-adres, browser-/apparaatinformatie, besturingssysteem, gebruikte app-versie.",
          "Abonnements- en contractgegevens (bij betaald abonnement): gekozen plan, looptijd, abonnementsstatus, technische aankoopinformatie (via App Store / Play Store). Volledige betalingsgegevens (zoals creditcardnummers) worden niet door MedScoutX opgeslagen maar door het betalingsplatform van de store verwerkt.",
          "Lokale gegevens op uw apparaat: bijv. lokaal opgeslagen chatgeschiedenis of instellingen (zoals taal, toegankelijkheid) in LocalStorage of vergelijkbare opslag.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Verwerkingsdoeleinden",
    blocks: [
      {
        type: "ul",
        items: [
          "Leveren van appfuncties: inloggen, registratie, accountbeheer en kernfuncties van MedScoutX.",
          "Symptoomchat & AI-ondersteunde vervolgvragen: verwerking van uw tekstinvoer om vragen en hints voor nadere verduidelijking te geven.",
          "Lichaamskaart: koppeling van gekozen regio’s aan passende AI-vervolgvragen en hints.",
          "Beeldanalyse: verwerking van geüploade afbeeldingen om opvallende bevindingen te beschrijven en mogelijke vervolgstappen voor te stellen (bijv. verduidelijking door een arts). Er wordt geen automatische diagnose in medisch-juridische zin gesteld.",
          "Stabiliteit & veiligheid: foutanalyse, misbruikdetectie, bescherming van systemen en gegevens.",
          "Wettelijke verplichtingen: naleving van wettelijke plichten (bijv. documentatie van IT-beveiligingsmaatregelen, bewaartermijnen).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Rechtsgrondslagen (AVG)",
    blocks: [
      {
        type: "p",
        text:
          "Afhankelijk van de situatie steunen we op de volgende rechtsgrondslagen:",
      },
      {
        type: "ul",
        items: [
          "Art. 6 lid 1 onder b AVG – uitvoering overeenkomst: voor technische appfuncties zoals registratie, inloggen en beheer van uw gebruikersaccount.",
          "Art. 6 lid 1 onder f AVG – gerechtvaardigde belangen: voor IT-beveiliging, foutanalyse en misbruikdetectie.",
          "Art. 6 lid 1 onder c AVG – wettelijke verplichting: waar wettelijke bewaarplichten gelden (bijv. fiscale verplichtingen in verband met abonnementen).",
          "Art. 9 lid 2 onder a AVG – uitdrukkelijke toestemming: dit is de primaire grondslag voor het verwerken van uw gezondheidsgegevens. Daartoe behoren vrijwillig ingevoerde symptomen in de tekstchat, keuzes op de lichaamskaart en het uploaden en analyseren van afbeeldingen. Vóór eerste gebruik vragen we uitdrukkelijk toestemming (bijv. via een selectievakje en bevestigingsknop). U kunt toestemming te allen tijde met werking voor de toekomst intrekken.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Verwerkers & doorgeven aan derden",
    blocks: [
      {
        type: "p",
        text:
          "Voor bepaalde functies gebruikt MedScoutX dienstverleners als verwerkers in de zin van art. 28 AVG. De belangrijkste categorieën zijn:",
      },
      {
        type: "ul",
        items: [
          "Hostingproviders (EU): een Europese cloudprovider levert infrastructuur voor servers en databases (bijv. Render.com met EU-locatie).",
          "AI-provider – OpenAI (VS): voor AI-verwerking van uw tekstinvoer, beeldgegevens en kaartinformatie gebruikt MedScoutX diensten van OpenAI LLC (San Francisco, VS). Inhoud wordt versleuteld naar OpenAI verzonden, daar verwerkt en na verwerking verwijderd.",
          "E-mailproviders: een technische dienstverlener wordt gebruikt voor systeemberichten (bijv. verificatie-e-mails).",
        ],
      },
      {
        type: "p",
        text:
          "Alle verwerkers zijn contractueel gebonden onder art. 28 AVG en verwerken gegevens alleen op onze instructie. Er is geen doorgeven van uw gegevens voor reclame of marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Doorgifte naar derde landen",
    blocks: [
      {
        type: "p",
        text:
          "Bij gebruik van MedScoutX-AI-functies wordt inhoud (bijv. tekst, symptomen, beeldgegevens) doorgestuurd naar AI-provider OpenAI LLC in de VS. Dit vormt een doorgifte naar een derde land in de zin van de AVG.",
      },
      {
        type: "p",
        text:
          "Om een passend beschermingsniveau te waarborgen, steunt de doorgifte op EU-standaardcontractbepalingen (art. 46 AVG) plus aanvullende technische en organisatorische maatregelen (versleuteling tijdens transport, korte verwerkingstijd, verwijdering na het AI-antwoord).",
      },
      {
        type: "p_link",
        before: "Meer informatie staat in de privacydocumentatie van OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
