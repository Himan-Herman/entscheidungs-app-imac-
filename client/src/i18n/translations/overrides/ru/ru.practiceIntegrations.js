/**
 * Интеграции (PVS / FHIR / HL7) — русский.
 *
 * Технические имена стандартов и систем (FHIR, HL7 v2, PVS, KIS, API) —
 * термины отрасли и не переводятся.
 *
 * `aiMarkedEn` намеренно остаётся английским: суффикс En в имени ключа
 * означает, что это английская пометка рядом с немецкой `aiMarkedDe`.
 * Значение задано здесь явно, чтобы ключ не зависел от запасного языка.
 */
export const ruPracticeIntegrations = {
  practiceIntegrations: {
    pageTitle: "MedScoutX — Интеграции",
    sandboxPageTitle: "MedScoutX — Песочница интеграций",
    heading: "Интеграции (PVS / FHIR / HL7)",
    sandboxHeading: "Песочница интеграций",
    intro:
      "Модульный слой подключения для будущих интерфейсов PVS/FHIR/HL7. В MVP доступен только тестовый режим и песочница — без продуктивной автоматической синхронизации.",
    sandboxIntro:
      "Режим песочницы: реальные данные во внешние системы не передаются.",
    backHub: "К обзору учреждения",
    backIntegrations: "Назад к интеграциям",
    selectPractice: "Профиль учреждения",
    loading: "Загрузка интеграций…",
    loadError: "Не удалось загрузить интеграции.",
    featureDisabled: "Функции интеграции сейчас отключены.",
    forbidden: "Доступ есть только у владельцев и администраторов.",
    sectionStatus: "Статус интеграций",
    sectionConnectors: "Доступные коннекторы",
    sectionConnections: "Подключения",
    sectionJobs: "Задачи импорта и экспорта",
    sectionMappings: "Обзор сопоставлений",
    sectionSecurity: "Безопасность и согласия",
    sectionSandbox: "Тест в песочнице",
    flagIntegrations: "Интеграции (главный переключатель)",
    flagFhir: "FHIR",
    flagHl7: "HL7 v2",
    flagSandbox: "Песочница PVS",
    flagProduction: "Продуктивный режим (выкл.)",
    statusOn: "активно",
    statusOff: "выкл.",
    connectionStatus: "Статус",
    connectionType: "Тип",
    connectorKey: "Коннектор",
    vendorName: "Поставщик",
    noConnections: "Подключений пока не настроено.",
    noJobs: "Задачи ещё не выполнялись.",
    btnTestIntegration: "Проверить интеграцию",
    btnOpenSandbox: "Открыть песочницу",
    btnViewMapping: "Показать сопоставление",
    btnDisableConnection: "Отключить подключение",
    btnCreateSandbox: "Создать подключение в песочнице",
    btnRunTestJob: "Запустить тестовую задачу",
    btnFhirPreview: "Предпросмотр FHIR (песочница)",
    btnHl7Parse: "Проверить HL7",
    testing: "Идёт проверка…",
    testOk: "Проверка подключения прошла успешно (песочница).",
    testFailed: "Проверка подключения не удалась.",
    disabled: "Подключение отключено.",
    jobStarted: "Задача завершена.",
    securityNote:
      "Экспорт требует активной связи с пациентом и согласия на экспорт данных. Токены и ключи API в браузере не хранятся. Продуктивное подключение PVS возможно только после договора с поставщиком, тестовой системы, договора об обработке данных и проверки безопасности.",
    consentNote:
      "Без соответствующего согласия экспорт блокируется и протоколируется.",
    productionWarning:
      "Продуктивная синхронизация по умолчанию отключена (ENABLE_PVS_PRODUCTION=false).",
    aiMarkedDe: "Умная подсказка — проверьте её",
    aiMarkedEn: "AI note – please review",
    aiDisclaimer:
      "Помогает только с техническим и организационным пояснением интеграции. Медицинское содержание не интерпретируется.",
    btnAiMapping: "Пояснить сопоставление",
    btnAiError: "Пояснить ошибку",
    aiLoading: "Готовим ответ…",
    mappingPreview: "Предпросмотр сопоставления",
    sandboxSamples: "Примеры данных",
    hl7Result: "Результат разбора HL7",
    fhirResult: "Предпросмотр FHIR",
    jobType: "Тип задачи",
    jobStatus: "Статус",
    jobDirection: "Направление",
    jobCreated: "Создано",
    enterprisePathwayNote:
      "Интеграции PVS/FHIR/KIS подготовлены как корпоративный сценарий. Продуктивное включение требует проверенного пилотного проекта, договора с поставщиком или на использование API и проверки защиты данных. Сейчас ни один коннектор в продуктивном режиме не включён.",
    sectionVendors: "Доступные системы PVS",
    vendorCatalogueNote:
      "Включение требует договора с поставщиком или на использование API, проверенной тестовой системы и технической приёмки. Ни одно из этих подключений сейчас не доступно в продуктивном режиме.",
    vendorStatusComingSoon: "Запланировано",
    vendorStatusPilotRequired: "Требуется пилот",
    vendorStatusSandboxReady: "Песочница готова",
    vendorStatusActive: "Активно",
    vendorTypePvs: "PVS",
    btnExpressInterest: "Сообщить об интересе",
    errors: {
      integrations_disabled: "Интеграции отключены.",
      integration_consent_missing:
        "Для этой интеграции не хватает необходимого согласия.",
      sandbox_disabled: "Песочница отключена.",
      forbidden: "Нет прав.",
      feature_disabled: "Функция отключена.",
      production_sync_disabled: "Продуктивная синхронизация не активирована.",
      auto_sync_disabled: "Автоматическая синхронизация в MVP отключена.",
      ai_not_configured: "Функция не настроена.",
    },
  },
};

export default ruPracticeIntegrations;
