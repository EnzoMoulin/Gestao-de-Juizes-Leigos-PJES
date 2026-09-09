function listarUsuarios_(usuarioAtual) {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.USERS_SHEET);
  const registros = {};
  if (aba && aba.getLastRow() > 1) {
    const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, JL_CONFIG.USER_HEADERS.length).getDisplayValues();
    linhas.forEach((linha, indice) => {
      const email = normalizarEmail_(linha[0]);
      if (!email) return;
      registros[email] = {
        email: email,
        nome: linha[1] || email.split("@")[0],
        perfil: String(linha[2] || JL_CONFIG.ROLES.VIEWER).toUpperCase(),
        ativo: valorAtivo_(linha[3]),
        ultimoAcesso: linha[4] || "",
        linha: indice + 2,
        acessoFixo: false
      };
    });
  }

  const fixos = Array.from(new Set(emailsPermitidos_().concat(emailsAdministradores_())));
  fixos.forEach(email => {
    if (!registros[email]) {
      registros[email] = {
        email: email,
        nome: email.split("@")[0],
        perfil: emailsAdministradores_().includes(email) ? JL_CONFIG.ROLES.ADMIN : JL_CONFIG.ROLES.VIEWER,
        ativo: true,
        ultimoAcesso: "",
        linha: null,
        acessoFixo: true
      };
    } else {
      registros[email].ativo = true;
      registros[email].acessoFixo = true;
      if (emailsAdministradores_().includes(email)) registros[email].perfil = JL_CONFIG.ROLES.ADMIN;
    }
  });

  return Object.keys(registros).map(email => registros[email]).sort((a, b) => {
    if (a.email === usuarioAtual.email) return -1;
    if (b.email === usuarioAtual.email) return 1;
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });
}

function salvarUsuario_(administrador, dados) {
  const email = normalizarEmail_(dados && dados.email);
  const nome = String(dados && dados.nome || "").trim();
  const perfil = String(dados && dados.perfil || "").trim().toUpperCase();
  if (typeof dados.ativo !== "boolean") throw new Error("Situação do usuário inválida.");
  const ativo = dados.ativo;
  const dominio = dominioInstitucional_();
  if (!/^[a-z0-9][a-z0-9._%+\-]*@[a-z0-9.\-]+$/.test(email) || !email.endsWith("@" + dominio)) throw new Error("Informe um e-mail institucional válido.");
  if (!nome || nome.length > 150) throw new Error("Informe um nome válido.");
  if (![JL_CONFIG.ROLES.VIEWER, JL_CONFIG.ROLES.MANAGER, JL_CONFIG.ROLES.ADMIN].includes(perfil)) throw new Error("Perfil inválido.");
  if (email === administrador.email && !ativo) throw new Error("Você não pode desativar o próprio acesso.");
  if ((emailsPermitidos_().includes(email) || emailsAdministradores_().includes(email)) && !ativo) {
    throw new Error("Esse usuário possui acesso fixo pelas propriedades do script e não pode ser desativado aqui.");
  }

  if (emailsAdministradores_().includes(email) && perfil !== JL_CONFIG.ROLES.ADMIN) throw new Error("O perfil deste administrador é definido em ADMIN_EMAILS.");
  if (email === administrador.email && perfil !== JL_CONFIG.ROLES.ADMIN) throw new Error("Você não pode remover sua própria permissão administrativa.");
  const planilha = abrirPlanilha_();
  const aba = planilha.getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!aba) throw new Error("Execute instalarEstruturasAuxiliares_ antes de administrar usuários.");
  const registro = registroUsuario_(email);
  const antes = registro ? {
    email: registro.valores[0], nome: registro.valores[1], perfil: registro.valores[2], ativo: registro.valores[3]
  } : null;
  const valores = [email, textoCelulaSeguro_(nome), perfil, ativo, registro ? registro.valores[4] : ""];
  if (registro) aba.getRange(registro.linha, 1, 1, valores.length).setValues([valores]);
  else aba.appendRow(valores);
  registrarAuditoria_(administrador, registro ? "ATUALIZAR_USUARIO" : "CRIAR_USUARIO", 0, antes, {
    email: email, nome: nome, perfil: perfil, ativo: ativo
  });
  return { ok: true };
}
