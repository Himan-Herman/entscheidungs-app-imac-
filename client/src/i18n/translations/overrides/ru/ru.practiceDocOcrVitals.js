/**
 * Структурирование документов и подключение устройств — русский.
 *
 * Оговорка MDR сохранена дословно по смыслу: пояснение служит ориентировке,
 * это не диагноз и не рекомендация по лечению.
 *
 * Названия платформ и устройств (Apple Health, Health Connect, Withings,
 * Fitbit, Garmin, Samsung Health, Wear OS) — имена продуктов, не переводятся.
 * Плейсхолдеры {provider} {n} {dup} {skip} {types} {when} сохранены.
 */
export const ruPracticeDocOcrVitals = {
  documentOcr: {
    structuredViewHeading: "Структурированный вид документа",
    structureDocument: "Структурировать документ",
    reviewResult: "Проверить результат",
    saveCorrection: "Сохранить исправление",
    discardResult: "Отклонить результат",
    shareWithPatient: "Открыть пациенту",
    labTableHeading: "Показать лабораторные значения таблицей",
    autoDetectedHint: "Текст распознан автоматически — проверьте его",
    aiOcrHint: "Автоматический результат — проверьте его",
    patientDisclaimer:
      "Здесь показаны сведения, автоматически структурированные из документа. MedScoutX не интерпретирует лабораторные значения и не ставит диагнозов.",
    unavailable: "Структурирование документов сейчас недоступно.",
    featureDisabled: "Структурирование документов сейчас отключено.",
    consentRequired: "Для этой функции не хватает необходимого согласия.",
    jobStatus: "Статус задачи",
    status_pending: "Ожидает",
    status_processing: "Идёт структурирование документа…",
    status_running: "Идёт структурирование документа…",
    structuringInProgress: "Идёт структурирование документа…",
    status_completed: "Завершено",
    status_failed: "Не удалось",
    status_cancelled: "Прервано",
    review_needs_review: "Требуется проверка",
    review_reviewed: "Проверено",
    review_shared: "Открыто",
    review_discarded: "Отклонено",
    colLabel: "Параметр",
    colValue: "Значение",
    colUnit: "Единица",
    colReference: "Референсный диапазон",
    unclear: "неясно",
    notProvided: "не указано",
    noEntries: "Структурированных записей не обнаружено.",
    selectFile: "Сначала загрузите файл.",
    loading: "Загрузка…",
    saved: "Сохранено.",
    shared: "Открыто пациенту.",
    discarded: "Результат отклонён.",
    sourcePractice: "Источник: документ учреждения",
    labExplainBtn: "Запросить пояснение",
    labExplainHeading: "Пояснение простым языком",
    labExplainLoading: "Готовим пояснение…",
    labExplainError: "Не удалось загрузить пояснение.",
    labExplainRateLimit: "Слишком много запросов. Повторите попытку позже.",
    labExplainDailyLimit: "Достигнут дневной лимит. Повторите попытку завтра.",
    labExplainNotShared: "Этот документ вам ещё не открыт.",
    labExplainInRange: "В пределах нормы",
    labExplainOutOfRange: "Вне пределов нормы",
    labExplainUnknownRange: "Диапазон неизвестен",
    labExplainMdrNote:
      "Пояснение служит ориентировке — это не диагноз и не рекомендация по лечению. Пожалуйста, обсудите его со своим врачом.",
    labExplainRetry: "Повторить",
  },

  vitals: {
    connect: {
      heading: "Подключить устройство",
      intro:
        "Носите умные часы или пользуетесь цифровым прибором? Подключите его один раз, а затем переносите свои значения сами кнопкой «Синхронизировать сейчас».",
      appleHealthScope:
        "Подключите Apple Health. Так можно переносить значения с Apple Watch, а также из совместимых приложений и приборов, которые пишут в Apple Health. Импорт никогда не начинается сам — вы запускаете его кнопкой «Синхронизировать сейчас».",
      healthConnectScope:
        "Подключите Health Connect. Так можно переносить, в частности, значения из Samsung Health, а также из совместимых приложений Wear OS и устройств, которые пишут в Health Connect. Импорт никогда не начинается сам — вы запускаете его кнопкой «Синхронизировать сейчас».",
      vendorViaPlatform:
        "Для Withings, Fitbit и Garmin прямого подключения нет. Их значения появятся здесь, как только приложение производителя запишет их в Apple Health или Health Connect.",
      loadError: "Не удалось загрузить подключения.",
      connectError: "Не удалось подключить. Повторите попытку.",
      disconnectError: "Не удалось отключить. Повторите попытку.",
      connect: "Подключить",
      disconnect: "Отключить",
      connected: "Подключено",
      working: "Подождите…",
      cancel: "Отмена",
      importedBadge: "Импортировано автоматически",
      consentTitle: "Согласие на импорт данных",
      consentBody:
        "Вы разрешаете MedScoutX переносить измеренные значения с устройства {provider} в вашу личную сводку. Импортируются только перечисленные ниже значения.",
      consentCheckbox:
        "Я согласен(на) на импорт моих данных о здоровье с подключённого устройства (ст. 9 GDPR).",
      consentConfirm: "Согласиться и подключить",
      syncNow: "Синхронизировать сейчас",
      syncing: "Синхронизация…",
      syncDone: "Новых перенесено: {n}, уже было: {dup}, пропущено: {skip}.",
      syncTruncated:
        "Обратите внимание: для {types} перенесены не все значения за период. Синхронизируйте ещё раз, чтобы загрузить остальные.",
      syncNothingNew: "Новых измерений не найдено.",
      syncOffline: "Нет соединения. Повторите попытку позже.",
      syncError: "Синхронизация не удалась. Повторите попытку позже.",
      lastSync: "Последняя синхронизация: {when}",
      neverSynced: "Синхронизации ещё не было",
      permissionAll: "Открыты все измерения",
      permissionPartial: "Открыто только: {types}",
      permissionNone: "Измерения не открыты",
      permissionDenied:
        "Доступ к данным о здоровье не предоставлен. Его можно изменить в системных настройках.",
      healthUnavailable: "На этом устройстве Apple Health недоступен.",
      healthConnectMissing:
        "На этом устройстве не настроен Health Connect. Установите или включите «Health Connect».",
      webOnlyHint:
        "Подключить устройство можно только в приложении MedScoutX для iPhone или Android. В браузере значения по-прежнему вносятся вручную.",
      devices: {
        apple_watch: "Apple Watch",
        iphone: "iPhone",
        samsung_watch: "Samsung Watch",
        manual_entry: "введено вручную",
      },
      providers: {
        apple_health: "Apple Health / Apple Watch",
        health_connect: "Health Connect (Samsung, Google и др.)",
        withings: "Withings",
        fitbit: "Fitbit",
        garmin: "Garmin",
      },
    },
  },
};

export default ruPracticeDocOcrVitals;
