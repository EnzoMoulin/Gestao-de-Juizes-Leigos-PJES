# PJES - CONECTA JULES - Gestão de Juízes Leigos

Aplicativo institucional em Google Apps Script para acompanhar solicitações, disponibilidade e capacidade de juízes leigos. A aplicação lê a planilha de respostas do formulário, mantém dados de gestão em abas auxiliares e registra todas as alterações administrativas.

## Funcionalidades

- Autenticação pela sessão Google Workspace e lista privada de contas autorizadas.
- Perfis `CONSULTA`, `GESTOR` e `ADMIN`.
- Indicadores e alertas de solicitações atrasadas, antigas ou sem juiz.
- Busca, filtros avançados, ordenação e exportação CSV.
- Tela completa de detalhes e histórico de alterações.
- Prioridade (`Normal`, `Alta`, `Urgente`) e prazo por solicitação.
- Designação e redesignação de juiz com confirmação.
- Cálculo de carga, saldo e percentual de ocupação dos juízes.
- Justificativa obrigatória para exceder capacidade, concluir ou cancelar.
- Notificações institucionais por e-mail, configuráveis.
- Administração de usuários dentro do site.
- Auditoria de designações, atualizações e alterações de usuários.
- Tutorial e visita guiada sob demanda.
- Atualização automática a cada minuto, pausada durante edição ou com a página oculta.
- Diagnóstico da fonte para gestores: planilha, aba, contagens e registros não reconhecidos.
- Busca de juízes por nome, matéria e observação.

## Arquitetura e segurança

O Web App deve ser implantado por uma conta Google Workspace do TJES para **executar como o proprietário**, com acesso restrito ao domínio. O sistema identifica a conta por `Session.getActiveUser()`, valida o domínio e aplica uma segunda camada de autorização.

As respostas originais do formulário permanecem na aba `Respostas ao formulário 1`. Informações adicionais são mantidas em:

- `USUARIOS`: perfis, situação e último acesso.
- `AUDITORIA`: alterações com usuário, data, valores anteriores e novos.
- `GESTAO_SOLICITACOES`: prioridade, prazo e última atualização.

Contas definidas em `ALLOWED_EMAILS` ou `ADMIN_EMAILS` são acessos fixos de recuperação e não podem ser desativadas pela interface.

## Propriedades do script

Em **Configurações do projeto → Propriedades do script**, configure:

| Propriedade | Finalidade | Exemplo |
|---|---|---|
| `SPREADSHEET_ID` | ID da planilha de respostas | ID encontrado na URL da planilha |
| `SOURCE_SHEET` | Nome exato da aba de respostas (opcional) | Padrão: `Respostas ao formulário 1` |
| `ALLOWED_EMAILS` | Contas fixas autorizadas, separadas por vírgula | `usuario1@dominio,usuario2@dominio` |
| `ADMIN_EMAILS` | Administradores fixos, separados por vírgula | `administrador@dominio` |
| `INSTITUTIONAL_DOMAIN` | Domínio institucional permitido | `tjes.jus.br` |
| `SEND_NOTIFICATIONS` | Envia e-mails em designações e mudanças de status | `TRUE` ou `FALSE` |

Não publique os valores reais dessas propriedades no GitHub.

## Instalação e atualização

O arquivo `.clasp.json` local deve apontar para o projeto correto:

```json
{
  "scriptId": "ID_DO_PROJETO_APPS_SCRIPT",
  "rootDir": "src"
}
```

Atualize o projeto:

```bash
git pull
clasp push
```

No editor do Apps Script:

1. Configure primeiro `ALLOWED_EMAILS` e `ADMIN_EMAILS` nas propriedades do script.
2. Salve o projeto. No menu de funções do editor, selecione `prepararProjetoNoEditor_` (com o `_` final), clique em Executar e autorize com a conta institucional configurada em `ADMIN_EMAILS`.
3. Esse comando instala as abas auxiliares e verifica a configuração. Confira as mensagens no Registro de execução. Ele usa a conta executora do editor e não pode ser chamado pelo site. Se não aparecer no seletor, abra `API.gs`, confira se o código foi copiado por completo, salve e recarregue o editor.

Os comandos públicos antigos continuam exigindo a identidade ativa; não substitua essa verificação por `getEffectiveUser()` no login ou em endpoints públicos, pois no Web App essa conta pode ser a do proprietário.

4. Acesse **Implantar → Gerenciar implantações → Editar**.
5. Escolha **Nova versão** e clique em **Implantar**.
6. Use a URL terminada em `/exec`.

Configuração da implantação:

- **Executar como:** proprietário do projeto.
- **Quem tem acesso:** usuários do domínio TJES.

Após esta atualização, uma nova autorização será solicitada porque o aplicativo pode usar `MailApp` para notificações. Para manter os e-mails desativados, configure `SEND_NOTIFICATIONS` como `FALSE`; a autorização do escopo ainda pode aparecer devido ao manifesto.

## Perfis

| Perfil | Permissões |
|---|---|
| `CONSULTA` | Visualiza somente solicitações vinculadas ao próprio e-mail |
| `GESTOR` | Visualiza todas as solicitações, designa juízes e atualiza andamento |
| `ADMIN` | Possui as permissões de gestão e administra usuários |

## Fluxo recomendado

1. Localize uma solicitação e abra os detalhes.
2. Defina prioridade e prazo.
3. Consulte a capacidade dos juízes.
4. Faça a designação; o status muda para `Em atendimento`.
5. Registre o andamento nas observações.
6. Marque como `Concluído` ou `Cancelado` com uma justificativa.
7. Consulte o histórico para verificar todas as alterações.

## Observações

- A capacidade é calculada usando a quantidade de minutas das solicitações ativas designadas pelo nome do juiz.
- Valores de capacidade e quantidade precisam conter um número para o cálculo automático.
- Designações acima da capacidade continuam possíveis, mas exigem confirmação e justificativa.
- Notificações são enviadas apenas para endereços do domínio institucional.
- O sistema espera os 17 cabeçalhos originais da planilha fornecida.
- Links permanecem no navegador; nenhuma chave do AppSheet é usada ou exposta.
- Antes da produção, realize um piloto com dados não sensíveis e submeta o sistema à TI/Segurança da Informação do TJES.

## Entrada pelo formulário e teste do ciclo completo

Para criar um formulário de homologação conectado à planilha usada pelo site, siga [a instalação e o roteiro de teste](maintenance/README.md#formulário-de-teste-formulário--planilha--site). O instalador fica no projeto separado de manutenção e contempla solicitações de unidades e disponibilidade de juízes leigos, com importação por gatilho e proteção contra duplicação. Também é possível testar a leitura do site acrescentando registros manualmente ao final da aba de origem.

## Se a página ficar em “Carregando dados”

Um `SyntaxError` no console impede que `App.html` execute até mesmo o login. Atualize o conteúdo completo dos arquivos; não misture trechos de versões diferentes. A proteção `src/Startup.html`, incluída antes de `App.html`, mostra falhas de inicialização na tela, inclusive quando o script principal não consegue iniciar.

Para esta atualização, envie todo o diretório `src` com `clasp push`, ou copie os arquivos completos no editor, incluindo o novo arquivo HTML `Startup`. Depois publique **Nova versão** em **Implantar → Gerenciar implantações → Editar** e reabra a URL `/exec`. Apenas salvar no editor ou atualizar o GitHub não muda uma implantação versionada.

Se o console continuar mostrando `Unexpected identifier 'input'`, abra o link da linha do erro (por exemplo `VM42:98`) e confira o código efetivamente entregue ao navegador. O número da linha do script gerado pode diferir do arquivo no repositório. O erro 403 em `/wardeninit` precisa ser investigado separadamente se persistir; este código não chama esse endpoint.

Teste local da inicialização: `node tests/startup.js`.
