/**
 * Список пациентов учреждения — русская локализация.
 *
 * Терминология согласована с уже переведёнными разделами:
 *   «учреждение» — рабочая область персонала (header.switchPractice),
 *   «связь» — PracticePatientLink, «профиль» — PatientProfile, «аккаунт» —
 *   учётная запись пациента. Три разных объекта, три разных слова: смешивать
 *   их нельзя, иначе теряется смысл разграничения доступа.
 *   Статусы взяты из patientPracticeLinks: Активно / Приглашение / Отозвано /
 *   В архиве — пациент и учреждение должны видеть одно и то же слово.
 *
 * Никаких оценок срочности и никаких названий технологий: раздел
 * организационный, а «автоматическое предложение» описывает функцию, а не
 * инструмент.
 */
export const ruPracticePatients = {
  practicePatients: {
    pageTitle: "MedScoutX — Пациенты",
    recordPageTitle: "MedScoutX — Карта пациента",
    heading: "Пациенты",
    recordTitle: "Карта пациента",
    intro:
      "Обзор связанных аккаунтов пациентов вашего учреждения. Только организационные сведения — без медицинской оценки.",
    safetyNote:
      "Без диагнозов и рекомендаций по лечению. Показаны только статус связи и согласия.",

    selectPractice: "Профиль учреждения",
    selectPracticePlaceholder: "Выберите учреждение…",
    loading: "Загрузка…",
    loadError: "Не удалось загрузить список пациентов.",
    featureDisabled:
      "Связывание пациентов в этой среде пока не включено. Обратитесь к своему техническому специалисту.",
    empty: "Связанных пациентов пока нет.",
    emptyFiltered: "Пациенты не найдены",

    searchPatients: "Поиск пациентов",
    filtersHeading: "Фильтры",
    resetFilters: "Сбросить фильтры",
    showFilters: "Показать фильтры",
    hideFilters: "Скрыть фильтры",
    resultsCount: "Найдено: {count}",
    loadMore: "Показать ещё",

    filterProfileShared: "Передача профиля",
    filterProfileSharedYes: "Разрешена",
    filterProfileSharedNo: "Не разрешена",
    filterUnreadMessages: "Сообщения",
    filterUnreadYes: "Есть непрочитанные",
    filterUnreadNo: "Нет непрочитанных",
    filterDocuments: "Документы",
    filterDocumentsYes: "Есть документы",
    filterDocumentsNo: "Нет документов",
    filterMedication: "План лечения",
    filterMedicationYes: "Есть опубликованный план",
    filterMedicationNo: "Нет опубликованного плана",
    filterDataRequest: "Запросы по данным",
    filterDataRequestYes: "Есть открытый запрос",
    filterDataRequestNo: "Нет открытых запросов",

    sortLinkedOldest: "Сначала давние связи",
    sortLinkedNewest: "Сначала новые связи",
    sortStatus: "Статус",
    chipRemove: "Убрать фильтр: {label}",

    aiFilterButton: "Автоматическое предложение фильтра",
    aiFilterLabel: "Автоматическое предложение — проверьте его",
    aiFilterHint:
      "Помогает только с организационным поиском и фильтрами. Медицинское содержание не оценивается.",
    aiFilterLoading: "Готовим предложение…",
    aiFilterError: "Не удалось создать предложение.",

    recordSearchLabel: "Поиск по карте",
    recordSearchPlaceholder: "Название, тема, активность…",
    recordSearchEmpty: "В этой карте ничего не найдено.",
    recordSearchKindDocument: "Документ",
    recordSearchKindThread: "Сообщение",
    recordSearchKindMedication: "План лечения",
    recordSearchKindActivity: "Активность",
    recordSearchLoadError: "Не удалось выполнить поиск по карте.",

    notProvided: "не указано",
    unreadBadge: "Не прочитано",
    backHub: "Назад в область учреждения",
    backList: "Назад к списку",
    backDashboard: "Панель учреждения",

    colName: "Имя",
    colEmail: "Эл. почта",
    colStatus: "Статус",
    colLinkedAt: "Связь с",
    colUpdatedAt: "Обновлено",
    colLastActivity: "Последняя активность",
    colLastVisit: "Последний визит",
    colDocuments: "Документы",
    colMessages: "Сообщения",
    openDetail: "Открыть карту",
    openRecord: "Открыть карту",
    patientFallback: "Пациент",
    emailMissing: "—",

    statusInvited: "Приглашение",
    statusActive: "Активно",
    statusRevoked: "Отозвано",
    statusArchived: "В архиве",
    statusAria: "Статус: {status}",

    detailTitle: "Сведения о пациенте",
    detailSectionRelationship: "Связь",
    detailSectionPatient: "Пациент",
    detailLinkId: "ID связи",
    detailPracticeId: "ID учреждения",
    detailPatientUserId: "ID аккаунта",
    detailPatientProfileId: "ID профиля",
    detailStatus: "Статус",
    detailLinkedAt: "Связь с",
    detailUpdatedAt: "Обновлено",
    detailRevokedAt: "Отозвано",
    detailConsentVersion: "Версия согласия",
    detailConsentAcceptedAt: "Согласие от",
    detailConsentMissing: "Согласия пока нет",
    detailRelationLabel: "Отношение",
    loadDetailError: "Не удалось загрузить карту пациента.",

    listCaption: "Связанные пациенты",
    searchLabel: "Поиск",
    searchPlaceholder: "Имя, эл. почта, ID связи или ID аккаунта…",
    filterStatusLabel: "Статус",
    filterStatusAll: "Все статусы",
    sortLabel: "Сортировка",
    sortActivity: "Последняя активность",
    sortName: "Имя",
    sortCreated: "Связь с",

    recordTabsLabel: "Разделы карты пациента",
    recordTabSelect: "Выберите раздел",
    tabOverview: "Обзор",
    tabProfile: "Профиль пациента",
    tabPreVisits: "Подготовки к приёму",
    tabMedication: "План лечения",
    tabDocuments: "Документы и заключения",
    tabVitals: "Показатели",
    tabVaccinations: "Прививки",
    tabHealthHistory: "История здоровья",
    tabErezept: "Электронные рецепты",
    tabSosCard: "Карта экстренной помощи",
    tabMessages: "Сообщения",
    tabActivity: "Активность",

    patientProvidedHint: "Часть сведений предоставлена самим пациентом.",
    openDataRequestHint: "Есть открытый запрос по данным (например, на удаление).",

    overviewLastMessage: "Последнее сообщение",
    overviewLastDocument: "Последняя передача документа",
    overviewLastMedication: "Последний план лечения",
    overviewLastPreVisit: "Последняя подготовка к приёму",
    overviewProfileAccess: "Передача профиля",
    profileAccessOn: "Активна",
    profileAccessOff: "Неактивна",

    quickLinksLabel: "Быстрый доступ",
    openMessages: "Сообщения",
    openDocuments: "Документы",
    openPreVisits: "Подготовки",
    openDataRequests: "Запросы по данным",
    viewerReadOnly: "У вас доступ только для чтения (роль «Наблюдатель»).",

    activityIntro:
      "Хронологический обзор — только метаданные, без медицинского содержания.",
    activityEmpty: "Активность пока не зафиксирована.",
    activityLoadError: "Не удалось загрузить активность.",
    activityListLabel: "Журнал активности",
    activityDocumentShared: "Документ передан",
    activityDocumentRevoked: "Передача документа отозвана",
    activityDocumentArchived: "Документ отправлен в архив",
    activityDocumentDeleted: "Документ удалён",
    activityMessageSent: "Сообщение отправлено",
    activityProfileGranted: "Передача профиля включена",
    activityProfileRevoked: "Передача профиля отозвана",
    activityMedicationPublished: "План лечения опубликован",
    activityRelationshipArchived: "Связь отправлена в архив",
    activityRelationshipStatus: "Статус связи изменён",
    activityDataRequest: "Создан запрос на удаление",
    activityThreadCreated: "Создана переписка",
    activityThreadClosed: "Переписка закрыта",
    activityThreadArchived: "Переписка отправлена в архив",
    activityMessageReceived: "Сообщение получено",
    activityProfileViewed: "Профиль просмотрен",
    activityDataExport: "Запрошен экспорт",
    activityDataRequestUpdated: "Запрос по данным обработан",
    activityFilterType: "Тип",
    activityFilterSearch: "Поиск",
    activityFilterSearchPlaceholder: "Найти событие…",
    activityApplyFilters: "Обновить",
    activityAiButton: "Автоматическая сводка",
    activityAiHeading: "Автоматическая сводка — проверьте её",
    activityAiHint:
      "Формирует только организационные сводки технической активности.",
    activityAiLoading: "Формируем…",
    activityAiError: "Не удалось создать сводку.",
    activityAiNotConfigured: "Функция недоступна.",

    preVisitsIntro: "Подготовки этого пациента к приёму в вашем учреждении.",
    preVisitsEmpty: "Подготовок нет.",
    preVisitsLoadError: "Не удалось загрузить подготовки.",
    preVisitsListLabel: "Список подготовок",
    preVisitUntitled: "Без названия",
    preVisitStatus: "Статус",
    openPreVisitDetail: "Открыть подготовку",

    connect: {
      ctaButton: "Связать пациента",
      ctaSectionLabel: "Связать пациента",
      ctaHint:
        "Связь создаётся только по коду подключения, который пациент выдаёт добровольно.",
      redeemSuccess: "Пациент связан. Список обновлён.",
      redeemError:
        "Код недействителен, истёк или уже использован. Попросите пациента выдать новый код.",
      dialogTitle: "Ввести код подключения",
      dialogBody:
        "Введите код подключения, который сообщил вам пациент. Пациент сам решает, какие разделы будут открыты.",
      dialogHint:
        "Связь возможна только по коду, созданному пациентом. Без медицинской оценки.",
      inputLabel: "Код подключения",
      inputPlaceholder: "напр. ABCD-EFGH-JKLM",
      cancel: "Отмена",
      submit: "Подтвердить",
      submitting: "Проверяем код…",
    },

    linkRequest: {
      ctaButton: "Отправить запрос на связь",
      dialogTitle: "Отправить запрос на связь",
      dialogBody:
        "Введите адрес эл. почты пациента. Если аккаунт MedScoutX существует, он получит запрос на связь, который пациент должен подтвердить.",
      inputLabel: "Эл. почта пациента",
      inputPlaceholder: "name@example.com",
      dialogHint:
        "В целях защиты данных не показывается, существует ли аккаунт. Обмен данными начнётся только после подтверждения пациентом.",
      cancel: "Отмена",
      submit: "Отправить запрос",
      submitting: "Отправляем…",
      neutralSuccess:
        "Если аккаунт MedScoutX с этим адресом существует, запрос на связь отправлен.",
      error: "Не удалось отправить запрос.",
    },
  },
};

export default ruPracticePatients;
