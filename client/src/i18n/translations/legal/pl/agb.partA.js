/** §1–§4 — Regulamin (PL) */
export default [
  {
    id: "agb-1-geltungsbereich",
    heading: "§1 Zakres i dostawca",
    blocks: [
      {
        type: "html",
        html: `
<p>Niniejszy regulamin określa zasady korzystania z aplikacji mobilnej i internetowej <strong>MedScoutX</strong> («&nbsp;Aplikacja&nbsp;») przez prywatnych użytkowników końcowych.</p>
<p>Dostawcą Aplikacji jest:<br /><strong>MedScoutX Health Solutions – Himan Khorshidi</strong><br />Eisenstraße 64<br />40227 Düsseldorf<br />Niemcy<br />E-mail: <a href="mailto:contact@medscout.app">contact@medscout.app</a></p>
<p>Z Aplikacji mogą korzystać wyłącznie osoby pełnoletnie (<strong>ukończone 18 lat</strong>). Osobom niepełnoletnim korzystanie nie przysługuje.</p>
`.trim(),
      },
    ],
  },
  {
    id: "agb-2-zweck",
    heading: "§2 Cel Aplikacji i ostrzeżenie medyczne",
    blocks: [
      {
        type: "html",
        html: `
<p>MedScoutX to narzędzie informacyjne i orientacyjne w obszarze ochrony zdrowia wspierane przez AI. Aplikacja ma na celu zapewnienie użytkownikom wstępnego, uporządkowanego przeglądu możliwych przyczyn dolegliwości oraz potencjalnie istotnych specjalizacji medycznych.</p>
<p>MedScoutX <strong>nie jest wyrobem medycznym</strong> w rozumieniu rozporządzenia UE o wyrobach medycznych (MDR). W szczególności:</p>
<ul>
<li>Aplikacja <strong>nie stawia diagnoz</strong>,</li>
<li><strong>nie zaleca konkretnych terapii</strong> ani leków,</li>
<li><strong>nie zastępuje decyzji klinicznych</strong> ani leczenia.</li>
</ul>
<p>Korzystanie z Aplikacji nigdy nie zastępuje osobistego badania, konsultacji ani leczenia przez lekarzy lub inny personel medyczny. Decyzji dotyczących diagnostyki, terapii lub leków nie wolno podejmować wyłącznie na podstawie wyników AI.</p>
<p>W ostrych lub zagrażających życiu sytuacjach niezwłocznie zadzwoń pod odpowiedni numer alarmowy (np. UE: <strong>112</strong>, USA: <strong>911</strong>) lub skontaktuj się ze służbami ratunkowymi.</p>
`.trim(),
      },
    ],
  },
  {
    id: "agb-3-vertrag",
    heading: "§3 Warunki korzystania, rejestracja i konto",
    blocks: [
      {
        type: "html",
        html: `
<p>(1) Korzystanie z MedScoutX zasadniczo wymaga konta użytkownika. Rejestracja jest dostępna wyłącznie dla osób, które <strong>ukończyły 18 lat</strong>.</p>
<p>(2) Podczas rejestracji użytkownik wyraźnie potwierdza, że ma co najmniej 18 lat. Dostawca może żądać dowodu wieku lub zawiesić konta w razie uzasadnionych wątpliwości co do wieku.</p>
<p>(3) Użytkownik jest zobowiązany podać przy rejestracji prawdziwe i kompletne informacje oraz aktualizować je w razie zmian.</p>
<p>(4) Dane dostępu (np. hasło, token logowania) muszą być chronione i nie mogą być udostępniane osobom trzecim. Użytkownik odpowiada za działania dokonane przy użyciu jego danych dostępu w zakresie swojej winy.</p>
<p>(5) Zabronione jest korzystanie z Aplikacji w celach bezprawnych, analizowanie danych osób trzecich bez zgody, omijanie zabezpieczeń oraz zautomatyzowane masowe użycie (scraping, boty).</p>
`.trim(),
      },
    ],
  },
  {
    id: "agb-4-leistungen",
    heading: "§4 Usługi świadczone przez Aplikację",
    blocks: [
      {
        type: "html",
        html: `
<p>(1) MedScoutX świadczy w szczególności następujące funkcje:</p>
<ul>
<li>Analiza objawów wspierana przez AI w obszarze czatu,</li>
<li>Analiza obrazu wspierana przez AI,</li>
<li>Wybór regionów ciała za pomocą mapy ciała,</li>
<li>Zarządzanie kontem użytkownika i funkcje historii,</li>
<li>W razie zastosowania dodatkowe funkcje w ramach płatnych subskrypcji.</li>
</ul>
<p>(2) Zakres funkcji może zależeć od wersji aplikacji i wybranej subskrypcji. Nie przysługuje roszczenie do konkretnej funkcji, o ile nie została wyraźnie obiecana.</p>
<p>(3) Dostawca może dostosowywać, rozszerzać lub ograniczać funkcje, o ile jest to dla użytkownika uzasadnione i nie narusza istotnych obowiązków umownych.</p>
`.trim(),
      },
    ],
  },
];
