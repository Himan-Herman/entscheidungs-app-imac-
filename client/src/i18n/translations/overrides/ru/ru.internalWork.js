/**
 * Фазы 5A–5C на русском — внутренние заметки, напоминания и центр уведомлений.
 *
 * «Напоминание», а не «наблюдение»: это рабочая пометка команды, а не
 * клиническое наблюдение, и слово не должно намекать на срочность.
 * «Учреждение» соответствует уже принятой терминологии.
 *
 * Счётчики оформлены как «Непрочитанных: {count}», чтобы избежать неверного
 * падежа числительного: одна формулировка верна для любого числа.
 */
export const ruInternalWork = {
  practiceInternalWork: {
    sectionTitle: "Внутренние заметки и напоминания",
    teamOnlyBadge: "Только для команды учреждения",
    teamOnlyExplainer:
      "Эти записи видит только ваша команда и только в рамках этой связи с пациентом. Пациенту они не показываются и не отправляются.",

    notesTitle: "Внутренние заметки",
    noteComposerLabel: "Написать внутреннюю заметку",
    noteComposerHint: "Пациенту не отправляется.",
    notePlaceholder: "напр. перезвонить, запросить заключение",
    notePlaceholderShort: "Внутренняя заметка",
    saveNote: "Сохранить заметку",
    editNote: "Изменить",
    edited: "изменено",
    notesEmpty: "Внутренних заметок пока нет.",
    unknownAuthor: "Команда учреждения",

    remindersTitle: "Напоминания",
    remindersHint:
      "Напоминание — это рабочая пометка для вашей команды. Текст не анализируется.",
    reminderTitleLabel: "Что нужно сделать?",
    reminderPlaceholder: "напр. проверить ещё раз 30.08",
    reminderDueLabel: "Срок",
    saveReminder: "Создать напоминание",
    remindersEmpty: "В этом представлении напоминаний нет.",
    dueOn: "Срок:",
    assignedTo: "Ответственный:",
    markDone: "Отметить как выполненное",
    statusOpen: "Открыто",
    statusDone: "Выполнено",
    filterLabel: "Фильтр напоминаний",
    filter_open: "Открытые",
    filter_completed: "Выполненные",
    filter_all: "Все",

    loading: "Загрузка…",
    saving: "Сохранение…",
    cancel: "Отмена",
    loadError: "Не удалось загрузить внутренние заметки и напоминания.",
    saveError: "Не удалось сохранить. Попробуйте ещё раз.",
  },

  notificationCenter: {
    toggleLabel: "Входящие",
    toggleAria: "Открыть входящие",
    toggleAriaWithCount: "Открыть входящие, непрочитанных: {count}",
    panelTitle: "Новое для вас",
    panelTitlePractice: "Новое в учреждении",
    unreadLabel: "Непрочитанных: {count}",
    newLabel: "Новых: {count}",
    unreadOne: "1 непрочитанное",
    newOne: "1 новое",
    empty: "Ничего нового.",
    emptyHint: "Новые сообщения появляются здесь и во входящих.",
    showAll: "Показать все уведомления",
    itemUnread: "Не прочитано",
    loading: "Загрузка…",
    error: "Не удалось загрузить.",
    retry: "Повторить",
    remindersHeading: "Открытые напоминания",
    remindersCount: "Открытых: {count}",
    remindersOne: "1 открытое",
    remindersLink: "Открыть в списке пациентов",
    remindersNone: "Открытых напоминаний нет",
  },

  practicePatients: {
    tabInternalWork: "Внутренние заметки",
    filterOpenReminders: "Открытые напоминания",
    filterOpenRemindersYes: "Только с открытыми",
    filterOpenRemindersNo: "Только без открытых",
    openRemindersBadge: "Открытых: {count}",
    openRemindersAria: "Открытых напоминаний: {count}",
    internalNotesBadge: "Заметок: {count}",
    internalNotesAria: "Внутренних заметок команды: {count}",
  },
};

export default ruInternalWork;
