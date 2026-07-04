export default {
  language: {
    pageTitle: "MedScoutX — Preparação da consulta",
    eyebrow: "Pré-consulta",
    title: "Preparação da consulta médica",
    explanation:
      "Esta ferramenta ajuda-o a estruturar as suas preocupações e perguntas para uma consulta médica. Não fornece diagnósticos nem recomendações médicas.",
    trust: "Toda a informação baseia-se apenas no que indicar.",
    valueProp:
      "Prepare sintomas, medicamentos, documentos e perguntas de forma estruturada — no seu idioma.",
    languageLabel: "Idioma que pretende usar com o MedScoutX",
    languageHint:
      "Pode introduzir a informação no idioma em que se sente mais confortável.",
    continue: "Continuar",
  },
  chrome: {
    backHome: "Voltar ao início do MedScoutX",
    backPatientHub: "Voltar à área do paciente",
    moduleLabel: "Preparação da consulta médica",
    libraryModuleLabel: "As minhas preparações",
    safety:
      "Este módulo serve apenas para preparar e documentar a sua informação. Não substitui o parecer médico.",
    librarySafety:
      "Gerir aqui as preparações guardadas. Nada é sincronizado automaticamente — nesta biblioteca aparecem apenas os itens que guardou explicitamente.",
    navAria: "Navegação de pré-consulta",
  },
  chat: {
    pageTitle: "MedScoutX — Recolha pré-consulta",
    progressTemplate: "Passo {{current}} de {{total}}",
    answerPlaceholder: "A sua resposta…",
    next: "Continuar",
    back: "Voltar",
    changeLanguage: "Alterar idioma de entrada",
    sectionLabelQuestion: "Pergunta",
    sectionLabelAnswer: "A sua resposta",
    devInsertDemo: "Inserir dados de demonstração",
    devOnlyNote: "Visível apenas em desenvolvimento local.",
  },
  review: {
    pageTitle: "MedScoutX — Resumo pré-consulta",
    title: "Resumo das suas respostas",
    intro:
      "Assim serão utilizadas as suas respostas para preparar a consulta. Ainda pode fazer alterações.",
    empty: "não indicado",
    edit: "Editar",
    clearField: "Eliminar entrada",
    trustBeforeActions:
      "Pode rever, editar ou eliminar a sua informação a qualquer momento antes de criar o documento.",
    newSession: "Iniciar nova sessão",
    wipeSession: "Eliminar sessão por completo",
    prepareDocument: "Preparar documento",
  },
  document: {
    pageTitle: "MedScoutX — Pré-visualização do documento",
    title: "Preparar documento para o médico",
    explanation:
      "O PDF para o médico é criado em alemão. As suas declarações originais permanecem também anexadas no seu idioma.",
    doctorLangLabel: "Idioma da versão para o médico",
    doctorLangHint:
      "A versão estruturada para o médico e o PDF enviado à unidade são criados em alemão.",
    patientMetaSection: "Informações opcionais do utente",
    patientMetaNote:
      "Estas informações são opcionais e ajudam a unidade a identificar o documento.",
    patientNameLabel: "Nome",
    patientDateOfBirthLabel: "Data de nascimento",
    patientEmailLabel: "E-mail",
    patientPhoneLabel: "Telefone (opcional)",
    patientGenderOrSalutationLabel: "Género / tratamento",
    sectionStructured: "Versão estruturada para o médico",
    sectionOriginal: "Declarações originais do utente",
    disclaimer:
      "A versão para o médico baseia-se apenas nas declarações do utente. Não são criados diagnósticos, recomendações nem avaliações de urgência.",
    empty: "não indicado",
    backReview: "Voltar ao resumo",
    pdfDisabled: "Criar PDF",
    pdfLocalNote:
      "O ficheiro PDF é criado localmente no seu navegador. Não são transmitidos dados.",
    consentCheckbox:
      "Quero guardar esta sessão localmente neste navegador para a poder consultar mais tarde.",
    consentExpl:
      "A sessão é guardada apenas localmente neste navegador. Não são enviados dados para o MedScoutX.",
    saveLocal: "Guardar sessão localmente",
    saveSuccess: "A sessão foi guardada localmente.",
    archiveNote:
      "Pode eliminar sessões guardadas mais tarde. Esta função não substitui o registo clínico.",
    historyLink: "Ver sessões guardadas",
    consentSectionTitle: "Cópia local opcional",
    createDoctorVersion: "Criar versão para o médico",
    creatingDoctorVersion: "A criar versão para o médico…",
    aiError:
      "Não foi possível criar a versão para o médico agora. Ainda pode usar a pré-visualização PDF local.",
    aiSuccessStatus:
      "A versão para o médico foi criada com base nas suas declarações.",
    accountSectionTitle: "Guardar na minha conta",
    accountConsentCheckbox:
      "Quero guardar esta preparação na minha conta MedScoutX.",
    accountConsentExpl:
      "Esta gravação é opcional. Pode ver ou eliminar preparações guardadas mais tarde.",
    saveToAccount: "Guardar na conta",
    accountLoginHint:
      "Inicie sessão para guardar preparações na sua conta.",
    accountLoginLink: "Iniciar sessão",
    accountSaveSuccess:
      "A preparação foi guardada na sua conta.",
    accountSaveError:
      "Não foi possível guardar a preparação agora.",
    emailPdfConsent:
      "Confirmo que este documento pode conter dados pessoais de saúde e que pode ser enviado à unidade / ao médico selecionado.",
    sessionTitleDe: "Vorbereitung Arztgespräch",
    sessionTitleEn: "Doctor visit preparation",
    sessionTitlePt: "Preparação da consulta médica",
    viewMyPreparations: "Ver as minhas preparações",
    mainNavAria:
      "Versão para o médico, exportar PDF, voltar ao resumo",
    structuredRowLabels: {
      appointmentReason: "Motivo atual da consulta",
      symptomsOwnWords: "Sintomas com palavras do utente",
      onsetAndCourse: "Início e evolução ao longo do tempo",
      medications: "Medicação atual",
      preExistingConditions: "Doenças pré-existentes conhecidas",
      relevantDocuments: "Documentos relevantes",
      patientQuestions: "Perguntas para o médico",
    },
    assistantQuestions: {
      sectionTitle: "Perguntas de orientação para a consulta",
      intro:
        "Com base nas suas informações sobre sintomas, evolução e preparação, a IA sugere algumas perguntas estruturantes. Servem apenas para a sua própria preparação e não incluem avaliação médica.",
      noAiAnswersNote:
        "São sugeridas apenas perguntas. As suas respostas permanecem parte da sua preparação pessoal e não são enviadas ao médico como um bloco separado de perguntas.",
      generateButton: "Criar perguntas de orientação",
      generating: "A preparar perguntas…",
      successStatus:
        "As perguntas de orientação foram criadas com base nas suas informações.",
      error:
        "Não foi possível criar as perguntas de orientação neste momento. Pode continuar ou tentar novamente mais tarde.",
      staleHint:
        "As suas informações mudaram. Gere novamente as perguntas para que correspondam ao estado atual.",
      emptyState:
        "Ainda não existem perguntas de orientação. Pode criá-las opcionalmente para se preparar para a conversa.",
      questionCounter: "Pergunta {{current}} de {{total}}",
      doctorVersionLabel: "Formulação para o médico",
      answerLabel: "A sua resposta",
      answerPlaceholder:
        "A sua resposta nas suas próprias palavras — apenas sua, não da IA…",
      previewSectionTitle: "Perguntas de orientação para a sua preparação",
      pdfSectionHeading: "Perguntas de orientação (respostas do utente)",
      pdfPatientQuestionLabel: "Pergunta (utente)",
      pdfDoctorQuestionLabel: "Pergunta (médico)",
      pdfPatientAnswerLabel: "Resposta do utente",
    },
  },
  localHistory: {
    pageTitle: "Sessões guardadas — Pré-consulta — MedScoutX",
    title: "Sessões guardadas localmente",
    expl:
      "Estas sessões estão apenas neste navegador. Não foram enviadas para o MedScoutX.",
    privacyNote:
      "As sessões locais permanecem apenas neste dispositivo e navegador.",
    empty: "Não há sessões guardadas localmente.",
    patientLang: "Idioma do utente",
    doctorLang: "Idioma do médico",
    savedAt: "Guardado",
    view: "Ver",
    delete: "Eliminar",
    clearAll: "Eliminar todas as sessões guardadas",
    clearConfirm:
      "Eliminar permanentemente todas as sessões locais? Não é possível anular.",
    listAriaLabel: "Sessões guardadas",
  },
  accountHistory: {
    pageTitle: "MedScoutX — As minhas preparações",
    title: "As minhas preparações",
    subtitle:
      "Aqui vê as preparações que guardou explicitamente na sua conta MedScoutX.",
    loginHint: "Inicie sessão para ver preparações guardadas.",
    loginCta: "Iniciar sessão",
    loading: "A carregar…",
    loadError:
      "Não foi possível carregar a lista agora. Tente mais tarde.",
    empty: "Ainda não há preparações guardadas na sua conta.",
    patientLang: "Idioma do utente",
    doctorLang: "Idioma do médico",
    created: "Criado",
    statusLabel: "Estado",
    open: "Abrir",
    deleteOne: "Eliminar",
    deleteAll: "Eliminar todas as preparações",
    confirmDeleteAll:
      "Eliminar todas as preparações guardadas na sua conta? Não é possível anular.",
    privacyNote:
      "Pode eliminar preparações guardadas a qualquer momento. Esta função não substitui o registo clínico.",
    defaultTitle: "Preparação da consulta médica",
    deleteError: "Não foi possível eliminar a preparação agora.",
    deleteAllError: "Não foi possível eliminar as preparações agora.",
    statusDraft: "Rascunho",
    statusPdfCreated: "PDF criado",
    statusCompleted: "Concluído",
    linkCases: "Abrir os meus casos",
    startNewPrep: "Iniciar nova preparação",
    retryLoad: "Tentar novamente",
    listAriaLabel: "Preparações guardadas",
  },
};
