function normalizarNome_(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function numeroQuantidade_(valor) {
  const texto = String(valor == null ? "" : valor).replace(/\./g, "").replace(",", ".");
  const encontrado = texto.match(/\d+(?:\.\d+)?/);
  return encontrado ? Number(encontrado[0]) : 0;
}

function dataIso_(valor) {
  if (!valor) return "";
  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return "";
  return Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function diasDesde_(valor) {
  if (!valor) return 0;
  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return 0;
  return Math.max(0, Math.floor((new Date().getTime() - data.getTime()) / 86400000));
}

function obterMetadadosGestao_() {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.MANAGEMENT_SHEET);
  const mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, JL_CONFIG.MANAGEMENT_HEADERS.length).getValues();
  linhas.forEach((linha, indice) => {
    const origem = Number(linha[0]);
    if (!Number.isInteger(origem) || origem < 2) return;
    mapa[origem] = {
      linhaGestao: indice + 2,
      prioridade: JL_CONFIG.PRIORITIES.includes(String(linha[1])) ? String(linha[1]) : "Normal",
      prazo: dataIso_(linha[2]),
      atualizadoEm: linha[3] instanceof Date ? linha[3].toISOString() : String(linha[3] || ""),
      atualizadoPor: normalizarEmail_(linha[4])
    };
  });
  return mapa;
}

function validarGestao_(prioridade, prazo) {
  if (!JL_CONFIG.PRIORITIES.includes(String(prioridade || "Normal").trim())) throw new Error("Prioridade inválida.");
  const texto = String(prazo || "").trim();
  if (texto) {
    const data = new Date(texto + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) throw new Error("Prazo inválido. Informe uma data existente.");
  }
  if (!abrirPlanilha_().getSheetByName(JL_CONFIG.MANAGEMENT_SHEET)) throw new Error("Execute instalarEstruturasAuxiliares() no editor antes de salvar.");
}

function salvarMetadadosGestao_(usuario, numeroLinha, prioridade, prazo) {
  validarGestao_(prioridade, prazo);
  const novaPrioridade = String(prioridade || "Normal").trim();
  if (!JL_CONFIG.PRIORITIES.includes(novaPrioridade)) throw new Error("Prioridade inválida.");
  const novoPrazo = String(prazo || "").trim();
  if (novoPrazo && !/^\d{4}-\d{2}-\d{2}$/.test(novoPrazo)) throw new Error("Prazo inválido.");
  const planilha = abrirPlanilha_();
  const aba = planilha.getSheetByName(JL_CONFIG.MANAGEMENT_SHEET);
  if (!aba) throw new Error("Execute instalarEstruturasAuxiliares_ para criar a gestão de prazos.");
  const existentes = obterMetadadosGestao_();
  const anterior = existentes[numeroLinha] || { prioridade: "Normal", prazo: "" };
  const valores = [numeroLinha, novaPrioridade, novoPrazo ? new Date(novoPrazo + "T12:00:00") : "", new Date(), usuario.email];
  if (anterior.linhaGestao) aba.getRange(anterior.linhaGestao, 1, 1, valores.length).setValues([valores]);
  else aba.appendRow(valores);
  return { antes: { prioridade: anterior.prioridade, prazo: anterior.prazo }, depois: { prioridade: novaPrioridade, prazo: novoPrazo } };
}

function listarHistorico_(numeroLinha) {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.AUDIT_SHEET);
  if (!aba || aba.getLastRow() < 2) return [];
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 7).getValues();
  return linhas.filter(linha => Number(linha[4]) === Number(numeroLinha)).map(linha => {
    let antes = {}, depois = {};
    try { antes = JSON.parse(String(linha[5] || "{}")); } catch (erro) {}
    try { depois = JSON.parse(String(linha[6] || "{}")); } catch (erro) {}
    return {
      data: linha[0] instanceof Date ? linha[0].toISOString() : String(linha[0] || ""),
      email: normalizarEmail_(linha[1]),
      perfil: String(linha[2] || ""),
      acao: String(linha[3] || ""),
      antes: antes,
      depois: depois
    };
  }).reverse();
}

function notificacoesAtivas_() {
  const valor = String(PropertiesService.getScriptProperties().getProperty(JL_CONFIG.PROPERTIES.SEND_NOTIFICATIONS) || "FALSE").toUpperCase();
  return ["TRUE", "VERDADEIRO", "SIM", "1"].includes(valor);
}

function enviarNotificacao_(destinatario, assunto, corpo) {
  const email = normalizarEmail_(destinatario);
  if (!notificacoesAtivas_()) return { enviada: false, motivo: "Notificações desativadas" };
  if (!email || !email.endsWith("@" + dominioInstitucional_())) return { enviada: false, motivo: "Destinatário institucional ausente" };
  try {
    MailApp.sendEmail({ to: email, subject: assunto, body: corpo, name: JL_CONFIG.APP_NAME });
    return { enviada: true, destinatario: email };
  } catch (erro) {
    return { enviada: false, motivo: "Falha ao enviar e-mail: " + erro.message };
  }
}

function notificarDesignacao_(solicitacao, juiz, administrador) {
  const assunto = "Nova designação — Solicitação #" + solicitacao.id;
  const corpo = [
    "Olá, " + (juiz.nome || ""),
    "",
    "Você foi designado(a) para uma solicitação no sistema de Gestão de Juízes Leigos — PJES.",
    "Solicitação: #" + solicitacao.id,
    "Unidade: " + (solicitacao.unidade || "Não informada"),
    "Quantidade: " + (solicitacao.quantidade || "Não informada"),
    "Competências: " + (solicitacao.competencias || "Não informadas"),
    "",
    "Designação realizada por: " + administrador.email
  ].join("\n");
  return enviarNotificacao_(juiz.email, assunto, corpo);
}

function notificarAtualizacao_(solicitacao, novoStatus, administrador) {
  const assunto = "Atualização da solicitação #" + solicitacao.id;
  const corpo = [
    "Olá, " + (solicitacao.solicitante || ""),
    "",
    "Sua solicitação foi atualizada no sistema de Gestão de Juízes Leigos — PJES.",
    "Solicitação: #" + solicitacao.id,
    "Unidade: " + (solicitacao.unidade || "Não informada"),
    "Novo status: " + novoStatus,
    "",
    "Atualização realizada por: " + administrador.email
  ].join("\n");
  return enviarNotificacao_(solicitacao.email, assunto, corpo);
}
