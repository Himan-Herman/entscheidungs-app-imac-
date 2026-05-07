/** Secties 8–15 — samengevoegd in datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Bewaartermijnen",
    blocks: [
      {
        type: "p",
        text:
          "In principe slaat MedScoutX geen chatgeschiedenis, symptomen of afbeeldingen permanent op de server op. Gezondheidsgerelateerde inhoud wordt alleen lokaal op uw apparaat opgeslagen (bijv. in LocalStorage) en kan te allen tijde worden gewist.",
      },
      {
        type: "ul",
        items: [
          "Accountgegevens: e-mailadres, wachtwoordhash en taalinstelling worden bewaard zolang uw account bestaat. Na verwijdering van het account worden deze gegevens gewist of geanonimiseerd, tenzij wettelijke bewaarplichten dit verhinderen.",
          "Chat- en symptoomgegevens: worden niet op de server opgeslagen; ze blijven alleen op uw apparaat en worden volledig gewist bij „Nieuw gesprek” of „Geschiedenis wissen”.",
          "Afbeelding-uploads: worden kort verwerkt voor doorsturen naar de AI-dienst en daarna verwijderd; geen permanente opslag.",
          "Technische logs / serverlogs: voor bedrijfsvoering, beveiliging en foutanalyse slaan hostingdiensten automatisch technische logs op (bijv. tijd, ingekorte IP, foutdetails), doorgaans 14–30 dagen. Deze gegevens zijn niet gekoppeld aan uw profiel of inhoud en niet voor advertenties.",
          "Lokale gegevens (LocalStorage, app-opslag): chatgeschiedenis, instellingen (taal, toegankelijkheid) en geschiedenisitems staan alleen op uw apparaat en kunnen via „Geschiedenis wissen” of apparaatinstellingen worden verwijderd.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Beveiliging",
    blocks: [
      {
        type: "p",
        text:
          "We treffen passende technische en organisatorische maatregelen om uw gegevens te beschermen tegen verlies, wijziging, ongeoorloofde toegang of ander misbruik. Daartoe behoren met name:",
      },
      {
        type: "p",
        text:
          "Verwerking van uw gezondheidsgegevens gebeurt slechts nadat u bij eerste gebruik van de betreffende functies (symptoomchat, lichaamskaart, beeldanalyse) uitdrukkelijke toestemming hebt gegeven (selectievakje + bevestiging). Deze toestemming kunt u te allen tijde in de app-instellingen intrekken.",
      },
      {
        type: "ul",
        items: [
          "Transportversleuteling (TLS/HTTPS),",
          "toegangsbeperkingen en rol-/rechtensystemen,",
          "dataminimalisatie en waar mogelijk pseudonieme verwerking,",
          "regelmatige systeemupdates.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Kinderen en jongeren",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX richt zich niet op kinderen onder de 16 jaar. Minderjarigen mogen de app alleen met toestemming van hun wettelijke vertegenwoordigers gebruiken. Als we weten dat gegevens van een kind onder 16 zonder toestemming zijn verwerkt, wissen we die gegevens.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Uw rechten (rechten van betrokkenen)",
    blocks: [
      {
        type: "p",
        text:
          "Onder de AVG heeft u met name de volgende rechten:",
      },
      {
        type: "ul",
        items: [
          "Inzage (art. 15 AVG): u kunt vragen welke persoonsgegevens we over u verwerken.",
          "Rectificatie (art. 16 AVG): u kunt correctie van onjuiste gegevens of aanvulling van onvolledige gegevens vragen.",
          "Wissing (art. 17 AVG): u kunt verwijdering van uw persoonsgegevens vragen, tenzij wettelijke bewaarplicht dit verhindert.",
          "Beperking (art. 18 AVG): u kunt beperking van de verwerking vragen.",
          "Gegevensoverdraagbaarheid (art. 20 AVG): u kunt uw gegevens in een gestructureerd, gangbaar en machinaal leesbaar formaat vragen.",
          "Bezwaar (art. 21 AVG): waar we ons op gerechtvaardigde belangen baseren, kunt u bezwaar maken om redenen die verband houden met uw situatie.",
          "Intrekking van toestemming (art. 7 lid 3 AVG): gegeven toestemming, met name voor gezondheidsgegevens, kunt u te allen tijde met werking voor de toekomst intrekken.",
          "Klacht (art. 77 AVG): u heeft het recht een klacht in te dienen bij een toezichthoudende autoriteit, bijvoorbeeld waar u woont of waar wij gevestigd zijn.",
        ],
      },
      {
        type: "p",
        text:
          "Om uw rechten uit te oefenen kunt u ons te allen tijde bereiken via de bovenstaande contactgegevens.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies & LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX gebruikt geen trackingcookies voor reclame. Voor gemak kan lokale opslag op uw apparaat worden gebruikt, bijvoorbeeld:",
      },
      {
        type: "ul",
        items: [
          "opslag van uw taalvoorkeur,",
          "optionele opslag van chatgeschiedenis,",
          "toegankelijkheidsopties (bijv. lettergrootte).",
        ],
      },
      {
        type: "p",
        text:
          "U kunt deze informatie te allen tijde wissen via functies in de app of via uw apparaat- of browserinstellingen.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. App-machtigingen",
    blocks: [
      {
        type: "p",
        text:
          "Afhankelijk van het gebruik kan MedScoutX de volgende machtigingen op uw apparaat vragen:",
      },
      {
        type: "ul",
        items: [
          "Camera/bestandstoegang: om foto’s te maken of te kiezen voor beeldanalyse. Deze machtiging is optioneel en kan in de apparaatinstellingen worden ingetrokken.",
          "Opslagtoegang: voor het verwerken van beeldbestanden of tijdelijke gegevens.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX heeft geen toegang tot inhoud zonder uw handeling en stuurt geen achtergrondgegevens naar derden die niet nodig zijn voor de werking van de app.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Opmerkingen over AI-verwerking",
    blocks: [
      {
        type: "ul",
        items: [
          "Uw teksten en waar van toepassing afbeeldingen worden automatisch verwerkt om suggesties en hints te genereren.",
          "De AI kan fouten maken of situaties verkeerd inschatten. Beoordeel uitkomsten kritisch en gebruik ze alleen ter oriëntatie.",
          "Voer geen namen van derden of identificerende bijzonderheden in en vermijd onnodig uitgebreide persoonsgegevens.",
          "Gebruik van de app vervangt geen persoonlijk medisch advies, diagnose of behandeling door artsen of andere zorgverleners.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading:
      "15. Geen geautomatiseerde besluitvorming in de zin van art. 22 AVG",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX stelt geen diagnoses en neemt geen geautomatiseerde besluiten met rechtsgevolgen of vergelijkbare significante gevolgen. Door AI gegenereerde inhoud dient alleen ter oriëntatie en vervangt geen medisch advies. Bij medisch relevante situaties wordt u gewezen op contact met een arts.",
      },
    ],
  },
];
