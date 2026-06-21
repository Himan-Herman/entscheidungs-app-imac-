/** Secções 1–7 */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Responsável pelo tratamento",
    blocks: [
      {
        type: "p",
        text:
          "Esta política de privacidade explica como a app MedScoutX trata os dados pessoais.",
      },
      {
        type: "address",
        lineStrong: "Responsável pelo tratamento ao abrigo do GDPR",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Alemanha",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-mail", dd: "contact@medscoutx.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Telefone", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Sobre o quê se trata?",
    blocks: [
      {
        type: "p",
        text:
          "Este aviso descreve como o MedScoutX trata os seus dados pessoais quando:",
      },
      {
        type: "ul",
        items: [
          "instala a app e cria uma conta,",
          "recolhe de forma estruturada informação para uma consulta médica e a prepara opcionalmente como PDF,",
          "introduz sintomas através do chat de texto,",
          "seleciona regiões corporais no mapa corporal,",
          "carrega imagens (por exemplo fotos da pele ou imagens médicas).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX não é uma ferramenta de diagnóstico ou tratamento e não substitui exame ou aconselhamento médico. A aplicação apoia a preparação e documentação estruturadas das suas próprias informações antes de consultas médicas. Se gerar um PDF apenas localmente sem transmissão, aplicam-se as notas especiais aí descritas.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Categorias de dados pessoais",
    blocks: [
      {
        type: "p",
        text:
          "Dependendo da utilização da app, podem ser tratadas as seguintes categorias de dados pessoais:",
      },
      {
        type: "ul",
        items: [
          "Dados de conta: endereço de e-mail, eventualmente nome ou nome de utilizador, hash da palavra-passe (sem palavra-passe em texto simples), definição de idioma.",
          "Dados relacionados com saúde: entradas de texto sobre sintomas, respostas no chat de sintomas, seleção de regiões corporais no mapa, informação relacionada com saúde em campos de texto livre.",
          "Dados de imagem: imagens que carrega (por exemplo alterações cutâneas, fotos de regiões corporais ou outras áreas relacionadas com saúde). O MedScoutX usa estas imagens para descrever achados relevantes, não para diagnóstico médico isolado.",
          "Dados de utilização e registos: carimbos temporais dos pedidos, registos técnicos de erro, eventualmente endereço IP truncado, informação do browser/dispositivo, sistema operativo, versão da app utilizada.",
          "Dados de subscrição e contrato (com subscrição paga): plano, prazo, estado da subscrição, informação técnica de compra (via App Store / Play Store). Os dados de pagamento completos (por exemplo números de cartão) não são armazenados pelo MedScoutX mas tratados pelo serviço de pagamento da plataforma.",
          "Dados locais no seu dispositivo: por exemplo histórico de chat ou definições (idioma, acessibilidade) em LocalStorage ou armazenamento comparável.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Finalidades do tratamento",
    blocks: [
      {
        type: "ul",
        items: [
          "Prestação das funções da app: início de sessão, registo, gestão de conta e funções principais do MedScoutX.",
          "Chat de sintomas e perguntas de seguimento assistidas por IA: tratamento do seu texto para perguntas e sugestões de esclarecimento.",
          "Mapa corporal: associação das regiões selecionadas a perguntas e sugestões de IA adequadas.",
          "Análise de imagens: tratamento das imagens carregadas para descrever achados relevantes e sugerir possíveis próximos passos (por exemplo esclarecimento por um clínico). Não é efetuado diagnóstico automático em sentido médico-jurídico.",
          "Estabilidade e segurança: análise de erros, deteção de abusos, proteção de sistemas e dados.",
          "Requisitos legais: cumprimento de obrigações legais (por exemplo documentação de medidas de segurança informática, prazos de conservação).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Bases jurídicas (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "Conforme a situação, fundamentamos o tratamento nas seguintes bases jurídicas:",
      },
      {
        type: "ul",
        items: [
          "Art.º 6 n.º 1 alínea b) GDPR – execução do contrato: para funções técnicas da app como registo, início de sessão e gestão da conta.",
          "Art.º 6 n.º 1 alínea f) GDPR – interesses legítimos: segurança informática, análise de erros e deteção de abusos.",
          "Art.º 6 n.º 1 alínea c) GDPR – obrigação legal: onde existem obrigações legais de conservação (por exemplo obrigações fiscais relacionadas com subscrições).",
          "Art.º 9 n.º 2 alínea a) GDPR – consentimento explícito: base principal para dados de saúde que introduz voluntariamente (chat de sintomas, mapa corporal, carregamento e análise de imagens). Antes da primeira utilização solicitamos consentimento explícito (por exemplo caixa de seleção e confirmação). Pode retirar o consentimento a qualquer momento com efeitos para o futuro.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Subcontratantes e comunicação a terceiros",
    blocks: [
      {
        type: "p",
        text:
          "Para determinadas funções o MedScoutX utiliza prestadores como subcontratantes nos termos do art.º 28.º GDPR. As principais categorias são:",
      },
      {
        type: "ul",
        items: [
          "Fornecedores de alojamento (UE): infraestrutura para servidores e bases de dados (por exemplo Render.com com localização na UE).",
          "Fornecedor de IA – OpenAI (EUA): para processamento baseado em IA do texto, imagens e informação do mapa corporal, o conteúdo é transmitido de forma encriptada à OpenAI LLC (San Francisco, EUA), processado e eliminado após o processamento.",
          "Fornecedores de correio eletrónico: envio de e-mails do sistema (por exemplo verificação de conta).",
        ],
      },
      {
        type: "p",
        text:
          "Todos os subcontratantes estão contratualmente vinculados (art.º 28.º GDPR) e tratam dados apenas sob as nossas instruções. Não há comunicação dos seus dados para publicidade ou marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Transferências para países terceiros",
    blocks: [
      {
        type: "p",
        text:
          "Ao utilizar as funções de IA do MedScoutX, o conteúdo (texto, sintomas, dados de imagem) pode ser transferido para o fornecedor de IA OpenAI LLC nos EUA. Isto constitui uma transferência para um país terceiro nos termos do GDPR.",
      },
      {
        type: "p",
        text:
          "Para garantir um nível adequado de proteção, a transferência baseia-se nas cláusulas contratuais-tipo da UE (art.º 46.º GDPR) e em medidas técnicas e organizacionais adicionais (encriptação em trânsito, duração curta do processamento, eliminação após a resposta do serviço de IA).",
      },
      {
        type: "p_link",
        before: "Mais informações na documentação de privacidade da OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
