/**
 * Панель учреждения и вложение показателей в подготовку — русский.
 *
 * Названия устройств и платформ (Apple Health, Health Connect, Apple Watch,
 * iPhone, Samsung Watch) — имена продуктов и остаются как есть.
 * Формулировки о самостоятельно измеренных значениях сохраняют оговорку:
 * это не официальное медицинское измерение и не диагноз.
 */
export const ruPracticeMisc = {
  practiceDashboard: {
    navHub: "Область учреждения",
    resultsHeading: "Входящие подготовки",
    resultsCount: "Записей: {count}",
    clearFilters: "Сбросить фильтры",
    emptyBody:
      "Как только пациенты отправят подготовку к приёму — в том числе извне, по QR-коду или ссылке без аккаунта, — она появится здесь автоматически.",
    emptyFilteredTitle: "Совпадений нет",
    emptyFilteredBody:
      "Ни одна подготовка не подходит под текущие фильтры. Сбросьте фильтры, чтобы увидеть все записи.",
    noPracticeTitle: "Выберите профиль учреждения",
    noPracticeBody:
      "Выберите профиль учреждения выше, чтобы увидеть входящие подготовки.",
    cardReason: "Причина обращения",
    navPatients: "Пациенты",
  },

  preVisit: {
    document: {
      vitalsAttach: {
        heading: "Приложить мои показатели",
        intro:
          "Вы записывали показатели в MedScoutX. Самое свежее значение по каждому из них можно автоматически приложить к этому документу.",
        consent:
          "Я согласен(на), что мои текущие показатели будут приложены к этому документу и переданы вместе с ним в учреждение.",
        previewTitle: "Будут приложены эти значения",
        minimisationNote:
          "Передаётся только самое свежее значение по каждому показателю за последние 90 дней — без ваших заметок. Отменить выбор можно в любой момент.",
        importedLabel: "с устройства",
        attachError: "Не удалось приложить показатели.",
        attachedHint: "Ваши показатели будут включены в этот PDF.",
      },
    },
    pdf: {
      vitalsSectionHeading: "Показатели, записанные пациентом (необязательно)",
      vitalsSectionNote:
        "Включено только по выбору пациента. Значения записаны самостоятельно — это не официальное медицинское измерение, не диагноз и не оценка. По каждому показателю приведено самое свежее значение.",
      vitalsImportedLabel: "с устройства",
      vitalsMeasuredAtWord: "Измерено",
      vitalsSourceWord: "Источник",
      vitalsOriginLabels: {
        manual: "Ручной ввод",
        apple_health: "Apple Health",
        health_connect: "Health Connect",
        apple_watch: "Apple Watch",
        iphone: "iPhone",
        samsung_watch: "Samsung Watch",
        manual_entry: "введено вручную",
      },
      vitalsTypeLabels: {
        blood_pressure: "Артериальное давление",
        heart_rate: "Пульс / частота сердечных сокращений",
        glucose: "Глюкоза крови",
        weight: "Вес",
        oxygen: "Насыщение кислородом",
        temperature: "Температура тела",
      },
    },
  },
};

export default ruPracticeMisc;
