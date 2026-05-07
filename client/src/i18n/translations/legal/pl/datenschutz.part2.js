/** Sekcje 8–15 — scalane w datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Okresy przechowywania",
    blocks: [
      {
        type: "p",
        text:
          "Zasadniczo MedScoutX nie przechowuje na serwerze na stałe historii czatu, objawów ani obrazów. Treści związane ze zdrowiem są przechowywane wyłącznie lokalnie na Twoim urządzeniu (np. w LocalStorage) i można je w każdej chwili usunąć.",
      },
      {
        type: "ul",
        items: [
          "Dane konta: adres e-mail, skrót hasła i ustawienie języka są przechowywane przez czas istnienia konta. Po usunięciu konta dane te są usuwane lub anonimizowane, o ile nie obowiązują ustawowe obowiązki przechowywania.",
          "Dane czatu i objawów: nie są przechowywane na serwerze; pozostają wyłącznie na urządzeniu i są w pełni usuwane przy „Nowa rozmowa” lub „Usuń historię”.",
          "Przesłane obrazy: przetwarzane krótkotrwale w celu przekazania do usługi AI, następnie usuwane; brak stałego przechowywania.",
          "Logi techniczne / serwerowe: przy działaniu, bezpieczeństwie i analizie błędów usługi hostingowe automatycznie zapisują logi techniczne (np. czas, obcięty IP, szczegóły błędów), zwykle przez 14–30 dni. Dane te nie są powiązane z Twoim profilem ani treścią i nie służą reklamie.",
          "Dane lokalne (LocalStorage, pamięć aplikacji): historia czatu, ustawienia (np. język, dostępność) i wpisy historii są zapisane wyłącznie na urządzeniu i można je usunąć przez „Usuń historię” lub ustawienia urządzenia.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Bezpieczeństwo",
    blocks: [
      {
        type: "p",
        text:
          "Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony danych przed utratą, zmianą, nieuprawnionym dostępem lub innym nadużyciem. Należą do nich w szczególności:",
      },
      {
        type: "p",
        text:
          "Przetwarzanie danych zdrowotnych następuje dopiero po wyrażeniu przez Ciebie wyraźnej zgody przy pierwszym użyciu odpowiednich funkcji (czat objawów, mapa ciała, analiza obrazu) (pole wyboru + potwierdzenie). Zgodę możesz w każdej chwili cofnąć w ustawieniach aplikacji.",
      },
      {
        type: "ul",
        items: [
          "Szyfrowanie transmisji (TLS/HTTPS),",
          "ograniczenia dostępu oraz systemy ról/uprawnień,",
          "minimalizacja danych i pseudonimizacja tam, gdzie to możliwe,",
          "regularne aktualizacje systemów.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Dzieci i młodzież",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nie jest skierowany do dzieci poniżej 16 lat. Nieletni powinni korzystać z aplikacji wyłącznie za zgodą przedstawicieli prawnych. Jeśli dowiemy się o przetwarzaniu danych dziecka poniżej 16 lat bez zgody opiekuna, usuniemy te dane.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Twoje prawa (prawa osoby, której dane dotyczą)",
    blocks: [
      {
        type: "p",
        text:
          "Na podstawie RODO przysługują Ci w szczególności następujące prawa:",
      },
      {
        type: "ul",
        items: [
          "Dostęp (art. 15 RODO): możesz żądać informacji, które dane osobowe przetwarzamy.",
          "Sprostowanie (art. 16 RODO): możesz żądać poprawienia nieprawidłowych danych lub uzupełnienia niekompletnych.",
          "Usunięcie (art. 17 RODO): możesz żądać usunięcia danych, o ile nie stoją na przeszkodzie ustawowe obowiązki przechowywania.",
          "Ograniczenie (art. 18 RODO): możesz żądać ograniczenia przetwarzania.",
          "Przenoszenie (art. 20 RODO): możesz żądać danych w ustrukturyzowanym, powszechnie używanym formacie nadającym się do odczytu maszynowego.",
          "Sprzeciw (art. 21 RODO): gdy opieramy się na uzasadnionym interesie, możesz wnieść sprzeciw ze względu na szczególną sytuację.",
          "Cofnięcie zgody (art. 7 ust. 3 RODO): zgoda, w szczególności na dane zdrowotne, może być cofnięta w każdej chwili ze skutkiem na przyszłość.",
          "Skarga (art. 77 RODO): masz prawo złożyć skargę do organu nadzorczego, np. w miejscu zamieszkania lub u naszej siedziby.",
        ],
      },
      {
        type: "p",
        text:
          "Aby skorzystać z praw, możesz w każdej chwili skontaktować się z nami, korzystając z danych kontaktowych podanych powyżej.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Pliki cookie i LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nie używa plików cookie śledzących do reklamy. Dla wygody może być używana pamięć lokalna na urządzeniu, np.:",
      },
      {
        type: "ul",
        items: [
          "zapisywanie preferencji języka,",
          "opcjonalne przechowywanie historii czatu,",
          "opcje dostępności (np. rozmiar czcionki).",
        ],
      },
      {
        type: "p",
        text:
          "Te informacje możesz w każdej chwili usunąć za pomocą funkcji w aplikacji lub ustawień urządzenia lub przeglądarki.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Uprawnienia aplikacji",
    blocks: [
      {
        type: "p",
        text:
          "W zależności od użycia MedScoutX może żądać na urządzeniu następujących uprawnień:",
      },
      {
        type: "ul",
        items: [
          "Dostęp do aparatu/plików: aby zrobić lub wybrać zdjęcia do analizy obrazu. Uprawnienie jest opcjonalne i można je cofnąć w ustawieniach urządzenia.",
          "Dostęp do pamięci: do przetwarzania plików obrazów lub danych tymczasowych.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX nie uzyskuje dostępu do treści bez Twojej czynności i nie wysyła w tle do osób trzecich danych niepotrzebnych do działania aplikacji.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Uwagi dotyczące przetwarzania AI",
    blocks: [
      {
        type: "ul",
        items: [
          "Twoje teksty oraz w razie potrzeby obrazy są przetwarzane automatycznie w celu wygenerowania sugestii i wskazówek.",
          "AI może się mylić lub błędnie ocenić sytuację. Prosimy o krytyczną ocenę wyników i używanie ich wyłącznie do orientacji.",
          "Nie podawaj nazwisk osób trzecich ani danych identyfikujących i unikaj niepotrzebnie rozległych danych osobowych.",
          "Korzystanie z aplikacji nie zastępuje osobistej porady medycznej, diagnozy ani leczenia przez lekarzy lub inny personel medyczny.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Brak zautomatyzowanego podejmowania decyzji w rozumieniu art. 22 RODO",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX nie stawia diagnoz ani nie podejmuje zautomatyzowanych decyzji wywołujących skutki prawne lub w istotny sposób na Ciebie wpływających. Treści generowane przez AI służą wyłącznie orientacji i nie zastępują porady medycznej. W sytuacjach medycznie istotnych zostaniesz poproszony o kontakt z lekarzem.",
      },
    ],
  },
];
