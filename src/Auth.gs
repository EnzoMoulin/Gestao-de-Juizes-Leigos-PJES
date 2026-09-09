function normalizarEmail_(valor) {
  return String(valor || "").trim().toLowerCase();
}

function listaEmailsPropriedade_(nome) {
  return String(PropertiesService.getScriptProperties().getProperty(nome) || "")
    .split(/[;,\n]+/).map(normalizarEmail_).filter(Boolean);
}

function emailsPermitidos_() {
  return listaEmailsPropriedade_(JL_CONFIG.PROPERTIES.ALLOWED_EMAILS);
}

function emailsAdministradores_() {
  return listaEmailsPropriedade_(JL_CONFIG.PROPERTIES.ADMIN_EMAILS);
}

function valorAtivo_(valor) {
  return ["TRUE", "VERDADEIRO", "SIM", "1"].includes(String(valor || "").trim().toUpperCase());
}

function registroUsuario_(email) {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!aba || aba.getLastRow() < 2) return null;
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, JL_CONFIG.USER_HEADERS.length).getDisplayValues();
  for (let indice = 0; indice < linhas.length; indice++) {
    if (normalizarEmail_(linhas[indice][0]) === normalizarEmail_(email)) {
      return { linha: indice + 2, valores: linhas[indice] };
    }
  }
  return null;
}

function emailAutorizado_(email) {
  const normalizado = normalizarEmail_(email);
  if (emailsPermitidos_().includes(normalizado) || emailsAdministradores_().includes(normalizado)) return true;
  const registro = registroUsuario_(normalizado);
  return Boolean(registro && valorAtivo_(registro.valores[3]));
}

// A identidade vem da sessão do Google Workspace. A implantação continua
// restrita ao domínio e a aplicação aplica uma segunda camada de autorização.
function identidadeWorkspace_() {
  let email = "";
  try {
    email = normalizarEmail_(Session.getActiveUser().getEmail());
  } catch (erro) {
    email = "";
  }
  const dominio = dominioInstitucional_();
  if (!email) {
    throw new Error("Não foi possível identificar sua conta Google. Use a conta institucional e confira as permissões do navegador.");
  }
  if (!email.endsWith("@" + dominio)) {
    throw new Error("Use exclusivamente sua conta institucional @" + dominio + ".");
  }
  if (!emailAutorizado_(email)) {
    throw new Error("Sua conta institucional não está autorizada a acessar este sistema.");
  }
  const registro = registroUsuario_(email);
  const nome = registro && registro.valores[1] ? registro.valores[1] : email.split("@")[0];
  return { email: email, nome: nome };
}

function hashToken_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function perfilUsuario_(identidade) {
  const email = normalizarEmail_(identidade.email);
  if (emailsAdministradores_().includes(email)) return JL_CONFIG.ROLES.ADMIN;
  const registro = registroUsuario_(email);
  if (!registro || !valorAtivo_(registro.valores[3])) return JL_CONFIG.ROLES.VIEWER;
  const perfil = String(registro.valores[2] || "").trim().toUpperCase();
  return perfil === JL_CONFIG.ROLES.ADMIN ? JL_CONFIG.ROLES.ADMIN
    : perfil === JL_CONFIG.ROLES.MANAGER ? JL_CONFIG.ROLES.MANAGER
    : JL_CONFIG.ROLES.VIEWER;
}

function registrarUltimoAcesso_(usuario) {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!aba) return;
  const registro = registroUsuario_(usuario.email);
  if (registro) {
    aba.getRange(registro.linha, 5).setValue(new Date());
    return;
  }
  if (emailsPermitidos_().includes(usuario.email) || emailsAdministradores_().includes(usuario.email)) {
    aba.appendRow([usuario.email, usuario.nome, usuario.perfil, true, new Date()]);
  }
}

function criarSessao_(identidade) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const sessao = {
    email: normalizarEmail_(identidade.email),
    nome: identidade.nome,
    perfil: perfilUsuario_(identidade),
    emitidaEm: new Date().toISOString()
  };
  registrarUltimoAcesso_(sessao);
  CacheService.getScriptCache().put("sessao:" + hashToken_(token), JSON.stringify(sessao), JL_CONFIG.SESSION_SECONDS);
  return { token: token, usuario: sessao, expiresIn: JL_CONFIG.SESSION_SECONDS };
}

function exigirSessao_(token, perfisPermitidos) {
  const chave = "sessao:" + hashToken_(String(token || ""));
  const bruto = token ? CacheService.getScriptCache().get(chave) : null;
  if (!bruto) throw new Error("Sessão ausente ou expirada. Entre novamente.");
  const sessao = JSON.parse(bruto);
  const email = normalizarEmail_(sessao.email);
  if (normalizarEmail_(Session.getActiveUser().getEmail()) !== email) throw new Error("Sessão de outra conta. Entre novamente com sua conta institucional.");
  if (!email.endsWith("@" + dominioInstitucional_()) || !emailAutorizado_(email)) {
    CacheService.getScriptCache().remove(chave);
    throw new Error("Sessão inválida ou acesso revogado.");
  }
  const perfilAtual = perfilUsuario_({ email: email });
  sessao.perfil = perfilAtual;
  if (perfisPermitidos && !perfisPermitidos.includes(perfilAtual)) throw new Error("Seu perfil não autoriza esta operação.");
  return sessao;
}

function podeGerenciar_(usuario) {
  return usuario.perfil === JL_CONFIG.ROLES.MANAGER || usuario.perfil === JL_CONFIG.ROLES.ADMIN;
}

function podeAdministrar_(usuario) {
  return usuario.perfil === JL_CONFIG.ROLES.ADMIN;
}
