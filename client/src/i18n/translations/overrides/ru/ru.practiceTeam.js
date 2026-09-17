/**
 * Практика: команда и права — русская локализация.
 *
 * Организационная и клиническая роль различаются намеренно и переводятся
 * разными словами: «организационная роль» — права в системе, «клиническая
 * роль» — врачебная роль, подтверждённая внутри этого учреждения. Смешивать
 * их нельзя: на этом различии держится доступ к данным о здоровье.
 *
 * Плейсхолдер {name} сохранён во всех clinicalAria*.
 */
export const ruPracticeTeamNs = {
  practiceTeam: {
    pageTitle: "Команда и права — учреждение",
    heading: "Роли и права команды учреждения",
    intro:
      "Управляйте участниками команды, ролями и статусом доступа. Изменения вступают в силу на сервере немедленно.",
    backHub: "Назад к обзору учреждения",
    selectPractice: "Учреждение",
    loading: "Загрузка…",
    loadError: "Не удалось загрузить команду.",
    forbidden: "Нет прав на управление командой.",
    yourRole: "Ваша роль",
    searchLabel: "Поиск",
    searchPlaceholder: "Имя или эл. почта",
    filterRole: "Роль",
    filterStatus: "Статус",
    filterAll: "Все",
    inviteHeading: "Отправить приглашение",
    inviteEmail: "Эл. почта (существующий аккаунт)",
    inviteEmailPlaceholder: "name@practice.example",
    inviteRole: "Роль",
    inviteSubmit: "Отправить приглашение",
    inviteSuccess: "Приглашение отправлено.",
    inviteError: "Не удалось отправить приглашение.",
    roleOwner: "Владелец",
    roleAdmin: "Администратор",
    roleDoctor: "Врач",
    roleAssistant: "Ассистент",
    roleViewer: "Только чтение (наблюдатель)",
    roleSecretary: "Регистратура",
    rolePracticeManager: "Управляющий практикой",
    statusInvited: "Приглашение",
    statusActive: "Активно",
    statusRevoked: "Отозвано",
    colName: "Сотрудник",
    colEmail: "Эл. почта",
    colRole: "Роль",
    colStatus: "Статус",
    colOrganizationalRole: "Организационная роль",
    colClinicalRole: "Клиническая роль",
    clinicalRoleNone: "Нет",
    clinicalRoleDoctor: "Врач",
    clinicalStatusPending: "Запрошена",
    clinicalStatusActive: "Подтверждена в учреждении",
    clinicalStatusRejected: "Отклонена",
    clinicalStatusRevoked: "Отозвана",
    clinicalActionRequest: "Запросить роль врача",
    clinicalActionApprove: "Подтвердить",
    clinicalActionReject: "Отклонить",
    clinicalActionRevoke: "Отозвать",
    clinicalAriaRequest: "Запросить клиническую роль врача для {name}",
    clinicalAriaApprove: "Подтвердить клиническую роль врача для {name} в этом учреждении",
    clinicalAriaReject: "Отклонить запрос на клиническую роль врача для {name}",
    clinicalAriaRevoke: "Отозвать клиническую роль врача у {name}",
    clinicalAwaitingApproval:
      "Ожидает подтверждения другим уполномоченным сотрудником. Подтвердить свою роль самому нельзя.",
    clinicalRevokeConfirm:
      "Действительно отозвать клиническую роль? Доступ к данным о здоровье прекратится немедленно.",
    clinicalSuccess_request:
      "Запрос отправлен. Его должен подтвердить другой уполномоченный сотрудник.",
    clinicalSuccess_approve: "Клиническая роль подтверждена в этом учреждении.",
    clinicalSuccess_reject: "Запрос отклонён.",
    clinicalSuccess_revoke: "Клиническая роль отозвана.",
    clinicalHint:
      "Организационная и клиническая роли разделены. Клиническая роль подтверждается внутри этого учреждения и действует только здесь — это не внешнее подтверждение квалификации.",
    colActions: "Действия",
    actionChangeRole: "Изменить роль",
    actionRevoke: "Отозвать доступ",
    ownerBadge: "Владелец учреждения",
    readOnlyHint:
      "У вас доступ только для чтения. Управлять командой могут владелец и администратор.",
    revokeConfirm:
      "Действительно отозвать доступ? Сотрудник потеряет доступ немедленно.",
    revokeSuccess: "Доступ отозван.",
    roleChangeSuccess: "Роль обновлена.",
    saveError: "Не удалось выполнить действие.",
    pendingInvitesHeading: "Открытые приглашения для вас",
    acceptInvite: "Принять приглашение",
    acceptSuccess: "Приглашение принято.",
    aiHeading: "Автоматический обзор прав (организационный)",
    aiFocusRole: "Роль для подсказок",
    aiRun: "Создать сводку",
    aiLoading: "Создаём сводку…",
    aiError: "Автоматическая сводка недоступна.",
    aiSuggestionLabel: "Автоматическое предложение — проверьте его",
    aiDisclaimer:
      "Помогает только организационно — в обзорах ролей и прав.",
    notProvided: "не указано",
    membersEmpty: "Других участников команды пока нет.",
    overviewHeading: "Обзор команды",
    groupTreaters: "Врачи",
    groupAdministration: "Администрация",
    groupSupport: "Ассистенты и регистратура",
    groupOther: "Прочие",
    groupOpenInvitations: "Открытые приглашения",
    overviewGroupEmpty: "Нет",
    overviewNoInvites: "Открытых приглашений нет",
    errors: {
      validation_required: "Заполните все обязательные поля.",
      email_invalid: "Некорректный адрес эл. почты.",
      user_not_found: "Аккаунт с этим адресом не найден.",
      role_invalid: "Недопустимая роль.",
      forbidden: "Нет прав.",
      forbidden_role_escalation: "Эту роль назначать нельзя.",
      cannot_revoke_practice_owner: "Доступ владельца отозвать нельзя.",
      cannot_revoke_self: "Собственный доступ здесь отозвать нельзя.",
      cannot_change_practice_owner: "Роль владельца здесь изменить нельзя.",
      member_not_found: "Участник не найден.",
      ai_not_configured: "Функция не настроена.",
    },
  },
};

export default ruPracticeTeamNs;
