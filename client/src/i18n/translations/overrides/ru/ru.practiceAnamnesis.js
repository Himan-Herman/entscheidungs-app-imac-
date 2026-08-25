/**
 * Шаблоны анамнеза — русский.
 *
 * СЧЁТЧИКИ. Ключи *Count_one / *Count_other рассчитаны на две формы, а в
 * русском их три. Поэтому форма _other оформлена как «Шаблонов: {{count}}» —
 * она грамматически верна при любом числе, а _one сохраняет плейсхолдер,
 * чтобы при 21 или 31 не показалась единица. Плейсхолдер {{count}} — двойные
 * фигурные скобки, как в оригинале.
 *
 * lang_* — названия языков, на которые переводится анкета для пациента; это
 * не язык интерфейса (см. languageTabHint).
 */
export const ruPracticeAnamnesis = {
  practiceAnamnesis: {
    pageTitle: "MedScoutX — Анамнез",
    editorTitle: "MedScoutX — Шаблон анамнеза",
    heading: "Шаблоны анамнеза",
    intro:
      "Настраиваемые анкеты по разделам — многоязычные, доступные, удобные для учреждения.",
    featureDisabled: "Функция анамнеза для этого учреждения ещё не включена.",
    backHub: "К обзору учреждения",
    backList: "К списку",
    selectPractice: "Профиль учреждения",
    loading: "Загрузка…",
    loadError: "Не удалось загрузить шаблоны.",
    loadErrorDisabled:
      "Функция анамнеза для этого учреждения ещё не включена. Включите её в настройках учреждения или обратитесь в поддержку.",
    loadErrorUnauthorized: "Войдите в систему заново.",
    loadErrorServer:
      "Не удалось загрузить шаблоны из-за ошибки сервера. Повторите попытку.",
    noTemplatesHint:
      "Шаблонов анамнеза пока нет. Создайте новый шаблон или воспользуйтесь стандартным.",
    saveError: "Не удалось сохранить.",
    deleteError: "Не удалось удалить.",
    archiveError: "Не удалось отправить в архив.",
    newTemplate: "Новый шаблон",
    fromStandard: "Создать из стандартного шаблона",
    fromStandardCreating: "Создаём…",
    fromStandardError: "Не удалось создать стандартный шаблон.",
    noTemplates:
      "Шаблонов пока нет. Начните с пустого шаблона или со стандартного.",
    templateCount_one: "{{count}} шаблон",
    templateCount_other: "Шаблонов: {{count}}",
    statusActive: "Активен",
    statusArchived: "В архиве",
    openTemplate: "Открыть",
    editTemplate: "Изменить",
    archiveTemplate: "В архив",
    unarchiveTemplate: "Вернуть из архива",
    deleteTemplate: "Удалить",
    confirmDeleteTemplate:
      "Действительно удалить шаблон? Будут удалены все разделы и вопросы. Лучше отправить в архив, чем удалять.",
    confirmArchiveTemplate:
      "Отправить шаблон в архив? Его можно вернуть в любой момент.",
    viewLinks: "QR / ссылки",
    viewSubmissions: "Поступления",
    templateTitle: "Название шаблона",
    templateDescription: "Описание (необязательно)",
    templateTitlePlaceholder: "напр. первичный анамнез",
    editModeLabel: "Режим редактирования",
    editModeHint:
      "Изменения сохраняются только после нажатия «Сохранить».",
    startEditing: "Редактировать шаблон",
    save: "Сохранить",
    saving: "Сохранение…",
    saved: "Сохранено.",
    cancel: "Отмена",
    cancelEditConfirm:
      "Прервать редактирование? Несохранённые изменения будут потеряны.",
    sections: "Разделы",
    addSection: "Добавить раздел",
    sectionTitle: "Название раздела",
    sectionTitlePlaceholder: "напр. текущая жалоба",
    deleteSection: "Удалить раздел",
    confirmDeleteSection:
      "Удалить раздел? Все вопросы внутри него также будут удалены.",
    noSections: "Разделов пока нет. Добавьте первый раздел.",
    questions: "Вопросы",
    addQuestion: "Добавить вопрос",
    addStandardQuestion: "Вставить стандартный вопрос",
    noQuestions: "Вопросов пока нет. Добавьте вопрос.",
    questionLabel: "Вопрос / подпись",
    questionHint: "Подсказка / заполнитель (необязательно)",
    questionType: "Тип вопроса",
    questionRequired: "Обязательное поле",
    questionMaxLength: "Максимальное число символов",
    questionMaxLengthHint:
      "От 50 до 3000 символов. Пусто — значение по умолчанию (500 символов).",
    questionOptions: "Варианты ответа",
    addOption: "Добавить вариант",
    removeOption: "Удалить вариант",
    deleteQuestion: "Удалить вопрос",
    confirmDeleteQuestion:
      "Действительно удалить вопрос? Лучше отключить его или оставить пустым.",
    editQuestion: "Изменить вопрос",
    doneEditing: "Готово",
    moveUp: "Вверх",
    moveDown: "Вниз",
    requiredBadge: "Обязательно",
    type_text: "Короткий текст",
    type_textarea: "Свободный текст (несколько строк)",
    type_single_choice: "Один вариант",
    type_multi_choice: "Несколько вариантов",
    type_date: "Дата",
    type_number: "Число",
    type_yes_no: "Да / Нет",
    stdCatalogTitle: "Стандартные вопросы",
    stdQ_hauptbeschwerde: "Основная жалоба",
    stdQ_beschwerden_dauer: "Длительность жалоб",
    stdQ_schmerzstaerke: "Интенсивность боли (0–10)",
    stdQ_schmerzcharakter: "Характер боли",
    stdQ_vorerkrankungen: "Перенесённые и хронические заболевания",
    stdQ_operationen: "Перенесённые операции",
    stdQ_krankenhausaufenthalte: "Госпитализации",
    stdQ_medikamente: "Текущие лекарства",
    stdQ_allergien: "Аллергии и непереносимости",
    "stdQ_blutverdünner": "Антикоагулянты / средства против свёртывания",
    stdQ_schwangerschaft: "Беременность",
    stdQ_rauchen: "Курение",
    stdQ_alkohol: "Употребление алкоголя",
    stdQ_hinweise_praxis: "Примечания для команды учреждения",
    stdQ_dolmetscher: "Нужен переводчик?",
    lang_de: "Немецкий",
    lang_en: "Английский",
    lang_fr: "Французский",
    lang_it: "Итальянский",
    lang_es: "Испанский",
    languageTab: "Язык",
    languageTabHint:
      "Редактирование переводов вопросов — эти вкладки задают язык вопросов для пациента, а не язык приложения.",
    readOnly: "Только чтение — ваша роль не допускает редактирование.",
    cardAnamnesis: "Анамнез",
    sectionCount_one: "{{count}} раздел",
    sectionCount_other: "Разделов: {{count}}",
    questionCount_one: "{{count}} вопрос",
    questionCount_other: "Вопросов: {{count}}",
  },
};

export default ruPracticeAnamnesis;
