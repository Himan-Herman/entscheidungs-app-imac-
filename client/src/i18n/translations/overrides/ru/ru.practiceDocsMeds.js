/**
 * План лечения и передача документов — русский.
 *
 * В sectionIntro технология названа намеренно и в отрицании: план исходит от
 * учреждения, а не от ИИ. Такое упоминание не рекламирует функцию, а
 * ограничивает её, и потому сохраняется.
 *
 * Плейсхолдеры {version}, {status}, {date}, {document}, {practice} сохранены.
 */
export const ruPracticeDocsMeds = {
  practiceMedicationPlan: {
    sectionTitle: "План лечения",
    sectionIntro:
      "Сведения о лекарствах, которые предоставляет ваше учреждение, — без рекомендаций ИИ и без автоматических дозировок.",
    loading: "Загрузка…",
    loadError: "Не удалось загрузить планы лечения.",
    featureDisabled: "План лечения v2 в этой среде пока не включён.",
    empty: "Планов лечения пока нет.",
    newDraft: "Создать новый черновик",
    planListCaption: "Планы лечения",
    selectPlan: "Выберите план",
    versionLabel: "Версия {version}",
    statusDraft: "Черновик",
    statusPublished: "Опубликован",
    statusArchived: "В архиве",
    statusAria: "Статус: {status}",
    titleLabel: "Название (необязательно)",
    titlePlaceholder: "напр. план лечения после контроля",
    medicationNameLabel: "Лекарство",
    medicationNamePlaceholder: "Название лекарства",
    dosageLabel: "Дозировка (необязательно)",
    dosagePlaceholder: "напр. 1 таблетка",
    frequencyLabel: "Частота (необязательно)",
    frequencyPlaceholder: "напр. утром",
    routeLabel: "Способ приёма (необязательно)",
    routePlaceholder: "напр. внутрь",
    scheduleLabel: "Время приёма (необязательно)",
    schedulePlaceholder: "напр. после еды",
    startDateLabel: "Дата начала (необязательно)",
    endDateLabel: "Дата окончания (необязательно)",
    instructionsLabel: "Примечания (необязательно)",
    instructionsPlaceholder: "Дополнительные указания учреждения…",
    addMedication: "Добавить лекарство",
    removeMedication: "Удалить лекарство",
    saveDraft: "Сохранить черновик",
    publish: "Опубликовать",
    archive: "В архив",
    saved: "Черновик сохранён.",
    published: "План опубликован. Пациент получит нейтральное уведомление.",
    archived: "План отправлен в архив.",
    saveError: "Не удалось сохранить.",
    publishError: "Не удалось опубликовать.",
    archiveError: "Не удалось отправить в архив.",
    createError: "Не удалось создать черновик.",
    validationMedication:
      "Для публикации нужно хотя бы одно лекарство с названием.",
    readOnlyHint:
      "Опубликованные и архивные планы здесь редактировать нельзя.",
    publishedAt: "Опубликовано {date}",
    noteLabel: "Примечание учреждения (необязательно)",
    notePlaceholder: "Внутреннее примечание к плану…",
    delete: "Удалить план",
    deleteConfirmTitle: "Удалить план лечения?",
    deleteConfirmHint:
      "Это действие убирает план лечения из активного представления. В журнал аудита будет внесена отметка.",
    deleteConfirmButton: "Да, удалить окончательно",
    deleteCancel: "Отмена",
    deleted: "План удалён.",
    deleteError: "Не удалось удалить.",
    aiFormat: "Структурировать (черновик с подсказкой)",
    aiBusy: "Создаём черновик…",
    aiError: "Не удалось создать черновик.",
    aiNotConfigured: "Эта функция в данной среде недоступна.",
    aiDraftLabel: "Черновик с подсказкой — проверьте его",
    aiDisclaimer:
      "Структурирует только имеющиеся сведения. Без рекомендаций по дозировке и лечению.",
  },

  documentSharing: {
    sharedData: {
      title: "Переданные данные",
      description:
        "Документы, которые вы целенаправленно открыли другому учреждению. Любую передачу можно отозвать в любой момент.",
      empty: "Вы пока не открывали ни одного документа другому учреждению.",
      listLabel: "Ваши передачи документов",
      loading: "Загрузка передач…",
      loadError: "Не удалось загрузить ваши передачи.",
      retry: "Повторить",
    },
    fields: {
      document: "Документ",
      sourcePractice: "Учреждение-источник",
      targetPractice: "Учреждение-получатель",
      status: "Статус",
      grantedAt: "Открыт",
      revokedAt: "Отозван",
      expiresAt: "Действует до",
    },
    status: {
      active: "Активно",
      revoked: "Отозвано",
      expired: "Истекло",
    },
    share: {
      action: "Поделиться с учреждением",
      dialogTitle: "Поделиться документом с учреждением",
      selectPractice: "Выберите учреждение",
      selectPlaceholder: "Выберите",
      readOnlyNotice:
        "Выбранное учреждение получит доступ к этому документу только для чтения. Оно не сможет изменить, удалить или передать его дальше.",
      readOnly: "Только чтение",
      confirm: "Открыть доступ",
      cancel: "Отмена",
      submitting: "Открываем доступ…",
      success: "Доступ открыт.",
      noOtherPractice:
        "Нет другого активного учреждения, которому можно было бы передать этот документ.",
      alreadyShared: "Этот документ уже передан этому учреждению.",
      ariaLabel: "Передать документ {document} учреждению {practice}",
    },
    revoke: {
      action: "Отозвать доступ",
      dialogTitle: "Отозвать доступ",
      confirm: "Отозвать",
      cancel: "Отмена",
      submitting: "Отзываем…",
      success: "Доступ отозван.",
      notice:
        "После отзыва учреждение-получатель больше не сможет открыть или скачать документ через MedScoutX.",
      externalCopies:
        "Копии, уже сохранённые за пределами MedScoutX, технически отозвать автоматически невозможно.",
      ariaLabel: "Отозвать доступ к документу {document} для {practice}",
    },
    practiceView: {
      sharedByPatient: "Открыто пациентом",
      origin: "Источник: {practice}",
      readOnlyHint:
        "Только чтение. Этот документ принадлежит другому учреждению и был открыт пациентом.",
    },
    errors: {
      document_not_found: "Документ недоступен.",
      link_not_found: "Эта связь с учреждением недоступна.",
      link_not_active: "Эта связь с учреждением неактивна.",
      document_already_available_to_practice:
        "Этот документ и так исходит из этого учреждения.",
      share_already_active: "Этот документ уже передан этому учреждению.",
      grant_not_found: "Эта передача недоступна.",
      unsupported_field: "Запрос содержал неожиданные данные.",
      forbidden: "Для этого у вас нет прав.",
      server_error: "Произошла ошибка. Повторите попытку позже.",
    },
  },
};

export default ruPracticeDocsMeds;
