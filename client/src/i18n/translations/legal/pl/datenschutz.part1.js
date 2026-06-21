/** Sekcje 1–7 — scalane w datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Administrator danych",
    blocks: [
      {
        type: "p",
        text:
          "Niniejsza polityka prywatności wyjaśnia, w jaki sposób aplikacja MedScoutX przetwarza dane osobowe.",
      },
      {
        type: "address",
        lineStrong: "Administrator w rozumieniu RODO",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Niemcy",
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
    heading: "2. O czym jest ta informacja?",
    blocks: [
      {
        type: "p",
        text:
          "Ten dokument opisuje, w jaki sposób MedScoutX przetwarza Twoje dane osobowe, gdy:",
      },
      {
        type: "ul",
        items: [
          "instalujesz aplikację i zakładasz konto,",
          "w uporządkowany sposób zbierasz informacje na wizytę lekarską i opcjonalnie przygotowujesz je jako PDF,",
          "wprowadzasz objawy w czacie tekstowym,",
          "wybierasz obszary ciała na mapie ciała,",
          "przesyłasz obrazy (np. zdjęcia skóry lub obrazy medyczne).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nie jest narzędziem diagnostycznym ani terapeutycznym i nie zastępuje badania ani porady medycznej. Aplikacja wspiera uporządkowane przygotowanie i dokumentację własnych informacji przed wizytami u lekarza. Jeśli generujesz PDF wyłącznie lokalnie bez transmisji, mają zastosowanie szczególne uwagi tam opisane.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Kategorie danych osobowych",
    blocks: [
      {
        type: "p",
        text:
          "W zależności od sposobu korzystania z aplikacji mogą być przetwarzane następujące kategorie danych osobowych:",
      },
      {
        type: "ul",
        items: [
          "Dane konta: adres e-mail, ewentualnie imię lub nazwa użytkownika, skrót hasła (bez hasła jawnego), ustawienie języka.",
          "Dane zdrowotne: wpisy tekstowe o objawach, odpowiedzi w czacie objawów, wybór regionów ciała na mapie, informacje zdrowotne w polach tekstowych.",
          "Dane obrazu: przesłane przez Ciebie obrazy (np. zmiany skórne, zdjęcia partii ciała lub innych obszarów związanych ze zdrowiem). MedScoutX wykorzystuje te obrazy do opisu istotnych obserwacji, ale nie do samodzielnej diagnozy medycznej.",
          "Dane użytkowania i logi: znaczniki czasu żądań, techniczne logi błędów, ewentualnie obcięty adres IP, informacje o przeglądarce/urządzeniu, system operacyjny, wersja aplikacji.",
          "Dane subskrypcji i umowy (przy płatnej subskrypcji): wybrany plan, okres, status subskrypcji, techniczne informacje o zakupie (przez App Store / Play Store). Pełne dane płatnicze (np. numery kart) nie są przechowywane przez MedScoutX, lecz przetwarzane przez operatora płatności danej platformy.",
          "Dane lokalne na urządzeniu: np. lokalnie zapisana historia czatu lub ustawienia (język, opcje dostępności) w LocalStorage lub podobnym mechanizmie.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Cele przetwarzania",
    blocks: [
      {
        type: "ul",
        items: [
          "Świadczenie funkcji aplikacji: logowanie, rejestracja, zarządzanie kontem i główne funkcje MedScoutX.",
          "Czat objawów i pytania uzupełniające wspierane przez AI: przetwarzanie wpisów tekstowych w celu zadawania pytań i wskazówek do dalszego doprecyzowania.",
          "Mapa ciała: powiązanie wybranych obszarów z odpowiednimi pytaniami i wskazówkami AI.",
          "Analiza obrazu: przetwarzanie przesłanych obrazów w celu opisu istotnych obserwacji i sugestii dalszych kroków (np. wyjaśnienie przez lekarza). Nie jest dokonywana automatyczna diagnoza w sensie prawnomedycznym.",
          "Stabilność i bezpieczeństwo: analiza błędów, wykrywanie nadużyć, ochrona systemów i danych.",
          "Wymogi prawne: spełnianie obowiązków ustawowych (np. dokumentacja środków bezpieczeństwa IT, okresy przechowywania).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Podstawy prawne (RODO)",
    blocks: [
      {
        type: "p",
        text:
          "W zależności od sytuacji opieramy się na następujących podstawach prawnych przetwarzania:",
      },
      {
        type: "ul",
        items: [
          "Art. 6 ust. 1 lit. b RODO – wykonanie umowy: świadczenie funkcji technicznych aplikacji, takich jak rejestracja, logowanie i zarządzanie kontem.",
          "Art. 6 ust. 1 lit. f RODO – uzasadniony interes: zapewnienie bezpieczeństwa IT, analiza błędów i wykrywanie nadużyć.",
          "Art. 6 ust. 1 lit. c RODO – obowiązek prawny: gdy istnieją ustawowe obowiązki przechowywania (np. podatkowe w związku z subskrypcjami).",
          "Art. 9 ust. 2 lit. a RODO – wyraźna zgoda: podstawowe uzasadnienie prawne dla przetwarzania danych zdrowotnych, w tym objawów dobrowolnie wprowadzanych w czacie, wyboru regionów na mapie ciała oraz przesyłania i analizy obrazów. Przed pierwszym użyciem tych funkcji poprosimy o wyraźną zgodę (np. pole wyboru i przycisk potwierdzenia). Zgodę możesz w każdej chwili cofnąć ze skutkiem na przyszłość.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Procesorzy i udostępnianie osobom trzecim",
    blocks: [
      {
        type: "p",
        text:
          "W niektórych funkcjach MedScoutX korzysta z dostawców usług jako procesorów w rozumieniu art. 28 RODO. Główne kategorie to:",
      },
      {
        type: "ul",
        items: [
          "Dostawcy hostingu (UE): europejski dostawca chmury zapewnia infrastrukturę serwerów i baz danych (np. Render.com z lokalizacją w UE).",
          "Dostawca AI – OpenAI (USA): do przetwarzania tekstu, danych obrazu i informacji z mapy ciała z wykorzystaniem AI MedScoutX korzysta z usług OpenAI LLC (San Francisco, USA). Treść jest przesyłana szyfrowana do OpenAI, tam przetwarzana i usuwana po zakończeniu przetwarzania.",
          "Dostawcy poczty e-mail: wykorzystywany jest dostawca techniczny do wysyłki wiadomości systemowych (np. weryfikacja e-mail).",
        ],
      },
      {
        type: "p",
        text:
          "Wszyscy procesorzy są umownie związani zgodnie z art. 28 RODO i przetwarzają dane wyłącznie na nasze polecenie. Nie ma udostępniania danych w celach reklamy lub marketingu.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Przekazywanie do państw trzecich",
    blocks: [
      {
        type: "p",
        text:
          "Podczas korzystania z funkcji AI MedScoutX treść (np. tekst, objawy, dane obrazu) jest przekazywana do dostawcy AI OpenAI LLC w USA. Takie przekazanie stanowi transfer do państwa trzeciego w rozumieniu RODO.",
      },
      {
        type: "p",
        text:
          "Aby zapewnić odpowiedni poziom ochrony danych, transfer opiera się na standardowych klauzulach umownych UE (art. 46 RODO) oraz dodatkowych środkach technicznych i organizacyjnych (szyfrowanie podczas transmisji, krótki czas przetwarzania, usunięcie po odpowiedzi usługi AI).",
      },
      {
        type: "p_link",
        before: "Więcej informacji w dokumentacji prywatności OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
