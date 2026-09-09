// Use em um NOVO projeto Apps Script de manutenção, nunca no projeto do site.
// Não implante este projeto. Configure SPREADSHEET_ID e ADMIN_EMAILS nas propriedades.
// `var` é intencional: o Apps Script carrega vários arquivos .gs no mesmo
// projeto, e uma variável global `var` é mais compatível com projetos criados
// manualmente no editor, independentemente da ordem dos arquivos.
var JL_CONFIG = Object.freeze({
  APP_NAME: "PJES - CONECTA JULES - Gestão de Juízes Leigos",
  SOURCE_SHEET: "Respostas ao formulário 1",
  USERS_SHEET: "USUARIOS",
  AUDIT_SHEET: "AUDITORIA",
  MANAGEMENT_SHEET: "GESTAO_SOLICITACOES",
  SESSION_SECONDS: 21600,
  PROPERTIES: Object.freeze({
    SPREADSHEET_ID: "SPREADSHEET_ID",
    ALLOWED_EMAILS: "ALLOWED_EMAILS",
    ADMIN_EMAILS: "ADMIN_EMAILS",
    SEND_NOTIFICATIONS: "SEND_NOTIFICATIONS",
    DOMAIN: "INSTITUTIONAL_DOMAIN"
  }),
  DEFAULT_DOMAIN: "tjes.jus.br",
  ROLES: Object.freeze({ VIEWER: "CONSULTA", MANAGER: "GESTOR", ADMIN: "ADMIN" }),
  STATUS: Object.freeze(["Pendente", "Em atendimento", "Concluído", "Cancelado"]),
  PRIORITIES: Object.freeze(["Normal", "Alta", "Urgente"]),
  USER_HEADERS: Object.freeze(["EMAIL", "NOME", "PERFIL", "ATIVO", "ULTIMO_ACESSO"]),
  MANAGEMENT_HEADERS: Object.freeze(["LINHA_ORIGEM", "PRIORIDADE", "PRAZO", "ATUALIZADO_EM", "ATUALIZADO_POR"]),
  HEADERS: Object.freeze({
    TIMESTAMP: "Carimbo de data/hora",
    EMAIL: "Endereço de e-mail",
    NAME: "Nome do solicitante:",
    PHONE: "Telefone para contato:",
    FUNCTION: "Cargo ou Função:",
    UNIT: "Unidade Judiciária que receberá o auxílio da Juíza Leiga ou do Juiz Leigo:",
    CASES: "Número(s) do(s) Processo(s) - um por linha (opcional - preencher apenas se desejar a análise de processos específicos):",
    GUIDANCE: "Orientações sobre a elaboração das minutas (opcional - caso deseje compartilhar modelos de documentos ou prompts, anexar o link do documento ou pasta do Google Drive):",
    PREFERRED_JUDGE: "Deseja indicar alguma Juíza ou Juiz Leigo de sua preferência? (A indicação não é vinculante e dependerá da disponibilidade e prioridade de atendimento)",
    CAPACITY: "Número de minutas em que necessita trabalhar no mês atual:",
    SUBJECTS: "Preferência por matérias (opcional):",
    PRODUCTIVITY: "Observações sobre a atuação e meta de produtividade:",
    STATUS: "Status do Atendimento:",
    NOTES: "Observações sobre a demanda e atendimento:",
    SKILLS: "Competências necessárias (opcional):",
    ASSIGNED_JUDGE: "Juiz Leigo Designado",
    ASSIGNED_AT: "Data da Designação"
  })
});

function propriedadeObrigatoria_(nome) {
  const valor = String(PropertiesService.getScriptProperties().getProperty(nome) || "").trim();
  if (!valor) throw new Error("Configuração ausente: " + nome + ".");
  return valor;
}

function dominioInstitucional_() {
  return String(PropertiesService.getScriptProperties().getProperty(JL_CONFIG.PROPERTIES.DOMAIN) || JL_CONFIG.DEFAULT_DOMAIN)
    .trim().toLowerCase();
}

function prepararPlanilha() {
  const email = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase();
  const admins = propriedadeObrigatoria_("ADMIN_EMAILS").split(/[;,\n]+/).map(item => item.trim().toLowerCase());
  if (!email || !email.endsWith("@" + dominioInstitucional_()) || !admins.includes(email)) {
    throw new Error("A conta executora deve ser institucional e estar em ADMIN_EMAILS neste projeto de manutenção.");
  }
  const planilha = SpreadsheetApp.openById(propriedadeObrigatoria_("SPREADSHEET_ID"));
  const nomeFonte = String(PropertiesService.getScriptProperties().getProperty("SOURCE_SHEET") || JL_CONFIG.SOURCE_SHEET).trim();
  const fonte = planilha.getSheetByName(nomeFonte);
  if (!fonte || fonte.getLastColumn() === 0) throw new Error("Aba de respostas ausente ou vazia: " + nomeFonte);
  const cabecalhos = fonte.getRange(1, 1, 1, fonte.getLastColumn()).getDisplayValues()[0].map(String).map(item => item.trim());
  Object.values(JL_CONFIG.HEADERS).forEach(titulo => {
    if (!cabecalhos.includes(titulo)) throw new Error("Cabeçalho obrigatório ausente na origem: " + titulo);
    if (cabecalhos.indexOf(titulo) !== cabecalhos.lastIndexOf(titulo)) throw new Error("Cabeçalho duplicado na origem: " + titulo);
  });
  const estruturas = [
    [JL_CONFIG.USERS_SHEET, JL_CONFIG.USER_HEADERS],
    [JL_CONFIG.AUDIT_SHEET, ["DATA_HORA", "EMAIL", "PERFIL", "ACAO", "LINHA_ORIGEM", "ANTES", "DEPOIS"]],
    [JL_CONFIG.MANAGEMENT_SHEET, JL_CONFIG.MANAGEMENT_HEADERS]
  ];
  // Verificar todas as abas antes da primeira alteração.
  estruturas.forEach(([nome, titulos]) => {
    const aba = planilha.getSheetByName(nome);
    if (aba && aba.getLastRow() > 0) {
      const atuais = aba.getRange(1, 1, 1, Math.min(aba.getLastColumn(), titulos.length)).getDisplayValues()[0];
      if (atuais.some((valor, i) => String(valor).trim() !== titulos[i])) throw new Error("Cabeçalhos incompatíveis: " + nome + ". Nenhuma aba foi alterada.");
    }
  });
  estruturas.forEach(([nome, titulos]) => {
    const aba = planilha.getSheetByName(nome) || planilha.insertSheet(nome);
    if (aba.getMaxColumns() < titulos.length) aba.insertColumnsAfter(aba.getMaxColumns(), titulos.length - aba.getMaxColumns());
    aba.getRange(1, 1, 1, titulos.length).setValues([titulos]);
    aba.setFrozenRows(1);
  });
  SpreadsheetApp.flush();
  const mensagem = "Planilha preparada: " + planilha.getName() + " | Origem: " + nomeFonte + " | Abas auxiliares verificadas. As permissões e a implantação do site não foram alteradas.";
  console.log(mensagem);
  return mensagem;
}
