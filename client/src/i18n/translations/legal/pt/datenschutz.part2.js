/** Secções 8–15 */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Prazos de conservação",
    blocks: [
      {
        type: "p",
        text:
          "Em regra o MedScoutX não armazena permanentemente históricos de chat, sintomas ou imagens no servidor. Conteúdos relacionados com saúde ficam apenas localmente no seu dispositivo (por exemplo LocalStorage) e podem ser eliminados a qualquer momento.",
      },
      {
        type: "ul",
        items: [
          "Dados de conta: e-mail, hash da palavra-passe e idioma durante a vida da conta; após eliminação são apagados ou anonimizados salvo obrigações legais de conservação.",
          "Dados de chat e sintomas: não são armazenados no servidor; ficam apenas no dispositivo e são totalmente eliminados com «Nova conversa» ou «Eliminar histórico».",
          "Carregamentos de imagem: processados brevemente para envio ao serviço de IA, depois eliminados; sem armazenamento permanente.",
          "Registos técnicos / servidor: para operações, segurança e análise de erros os serviços de alojamento guardam registos técnicos (por exemplo hora, IP truncado, detalhes de erro), tipicamente 14–30 dias; não estão ligados ao seu perfil nem usados para publicidade.",
          "Dados locais (LocalStorage, armazenamento da app): histórico de chat, definições e entradas de histórico apenas no dispositivo; removíveis com «Eliminar histórico» ou definições do dispositivo.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Segurança",
    blocks: [
      {
        type: "p",
        text:
          "Implementamos medidas técnicas e organizacionais adequadas para proteger os seus dados contra perda, alteração, acesso não autorizado ou outro uso indevido, em particular:",
      },
      {
        type: "p",
        text:
          "O tratamento dos seus dados de saúde ocorre apenas após consentimento explícito na primeira utilização das funções relevantes (chat de sintomas, mapa corporal, análise de imagens) (caixa de seleção + confirmação). Pode retirar este consentimento nas definições da app.",
      },
      {
        type: "ul",
        items: [
          "Encriptação de transporte (TLS/HTTPS),",
          "restrições de acesso e sistemas de funções/permissões,",
          "minimização de dados e pseudonimização quando possível,",
          "atualizações regulares dos sistemas.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Crianças e jovens",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX não se dirige a crianças com menos de 16 anos. Os menores devem usar a app apenas com consentimento dos titulares do poder parental. Se soubermos que dados de uma criança com menos de 16 anos foram tratados sem esse consentimento, eliminaremos esses dados.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Os seus direitos (direitos do titular dos dados)",
    blocks: [
      {
        type: "p",
        text: "Ao abrigo do GDPR tem em particular os seguintes direitos:",
      },
      {
        type: "ul",
        items: [
          "Acesso (art.º 15.º GDPR): solicitar informações sobre que dados pessoais tratamos sobre si.",
          "Retificação (art.º 16.º GDPR): solicitar correção de dados inexatos ou complementação.",
          "Apagamento (art.º 17.º GDPR): solicitar apagamento salvo obrigações legais de conservação.",
          "Limitação (art.º 18.º GDPR): solicitar limitação do tratamento.",
          "Portabilidade (art.º 20.º GDPR): solicitar os seus dados num formato estruturado e de uso corrente.",
          "Oposição (art.º 21.º GDPR): onde nos baseamos em interesses legítimos, opor-se por motivos relacionados com a sua situação particular.",
          "Retirada do consentimento (art.º 7.º n.º 3 GDPR): retirar o consentimento dado, em particular para dados de saúde, a qualquer momento com efeitos para o futuro.",
          "Reclamação (art.º 77.º GDPR): direito de apresentar reclamação a uma autoridade de controlo, por exemplo no seu local de residência ou na nossa sede.",
        ],
      },
      {
        type: "p",
        text:
          "Para exercer os seus direitos pode contactar-nos a qualquer momento pelos dados indicados acima.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies e LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX não utiliza cookies de rastreamento para publicidade. Para conveniência pode ser usado armazenamento local no dispositivo, por exemplo:",
      },
      {
        type: "ul",
        items: [
          "guardar a sua preferência de idioma,",
          "armazenamento opcional do histórico de chat,",
          "opções de acessibilidade (por exemplo tamanho da letra).",
        ],
      },
      {
        type: "p",
        text:
          "Pode eliminar estas informações através de funções na app ou das definições do dispositivo ou browser.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Permissões da app",
    blocks: [
      {
        type: "p",
        text:
          "Dependendo da utilização o MedScoutX pode solicitar as seguintes permissões no dispositivo:",
      },
      {
        type: "ul",
        items: [
          "Câmara/acesso a ficheiros: para tirar ou selecionar imagens para análise de imagem. Opcional; pode ser revogada nas definições do dispositivo.",
          "Acesso ao armazenamento: para processar ficheiros de imagem ou dados temporários.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX não acede a conteúdos sem a sua ação e não envia dados em segundo plano a terceiros que não sejam necessários ao funcionamento da app.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Notas sobre processamento por IA",
    blocks: [
      {
        type: "ul",
        items: [
          "Os seus textos e, quando aplicável, imagens são processados automaticamente para gerar sugestões e indicações.",
          "A IA pode errar ou avaliar mal situações; reveja criticamente os resultados e use-os apenas para orientação.",
          "Não envie nomes ou dados identificativos de terceiros e evite dados pessoais desnecessários.",
          "A utilização da app não substitui aconselhamento, diagnóstico ou tratamento médico pessoal.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Sem tomada de decisão automatizada nos termos do art.º 22.º GDPR",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX não faz diagnósticos nem decisões automatizadas com efeitos jurídicos ou analogamente significativos. O conteúdo gerado por IA serve apenas para orientação e não substitui aconselhamento médico. Em situações clinicamente relevantes será solicitado que contacte um profissional de saúde.",
      },
    ],
  },
];
