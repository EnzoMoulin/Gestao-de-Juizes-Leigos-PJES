# Preparação em projeto separado

Use esta alternativa quando o comando privado não aparecer no seletor do editor.

1. Crie um **novo projeto** em https://script.google.com usando a conta institucional. Nome sugerido: CONECTA JULES — Manutenção.
2. Copie todo o arquivo PrepararPlanilha.gs desta pasta para Código.gs do novo projeto. Não copie para o projeto do site e não implante este projeto.
3. Nas propriedades do **novo projeto**, copie SPREADSHEET_ID e ADMIN_EMAILS do projeto do site. Se SOURCE_SHEET ou INSTITUTIONAL_DOMAIN tiverem valores personalizados, copie também. Propriedades não são compartilhadas entre projetos.
4. Salve e selecione prepararPlanilha (sem sublinhado). Execute e autorize com uma conta de ADMIN_EMAILS que tenha edição na planilha.
5. O comando verifica os cabeçalhos de origem e prepara USUARIOS, AUDITORIA e GESTAO_SOLICITACOES sem apagar respostas ou usuários. A planilha precisa ter os cabeçalhos esperados pelo site.
6. Volte ao projeto do site para publicar sua versão atualizada. Esta ferramenta não verifica a implantação nem resolve uma eventual identidade vazia no login do site.

Esta separação permite usar a identidade executora para manutenção sem disponibilizar uma função com os privilégios do proprietário aos visitantes do Web App. Não renomeie o comando privado do projeto do site para torná-lo público.

Testes locais: node tests/maintenance.js. Não houve execução na planilha real.

## Formulário de teste: formulário → planilha → site

O arquivo `FormularioTeste.gs` cria um **novo formulário compatível** com os campos do sistema. Não é uma cópia visual do formulário original, cujo link não foi fornecido. Atende às entradas de magistrado/assessor (solicitação da unidade) e juiz leigo (disponibilidade).

### Instalação na conta Google

1. No projeto **separado de manutenção**, mantenha `PrepararPlanilha.gs` e adicione `FormularioTeste.gs`. Não copie esses arquivos para `src` nem publique a manutenção como Web App.
2. Configure `SPREADSHEET_ID`, `SOURCE_SHEET`, `ADMIN_EMAILS` e, se necessário, `INSTITUTIONAL_DOMAIN`, com os mesmos valores do site. Para homologação, utilize a planilha de teste já lida pelo site de teste.
3. Execute `prepararPlanilha` para validar a estrutura e as abas auxiliares.
4. Execute `prepararFormularioTeste` com uma única conta administradora que tenha edição na planilha. Autorize o acesso a Forms, Sheets e gerenciamento de gatilhos. Deixe o Apps Script detectar os escopos neste projeto separado; o manifesto de `src` não inclui Forms e não deve ser copiado para manutenção.
5. O registro de execução mostrará `formulario` (link para responder), `editar` (link administrativo), `planilha` e `abaDoSite`. Confira se a planilha e a aba correspondem ao diagnóstico de fonte exibido no site.
6. Abra o link de edição, confira as perguntas, configure o acesso dos respondentes para as contas institucionais de teste, publique o formulário se solicitado pelo Google Forms e habilite **Aceitar respostas**. O instalador cria o formulário fechado para essa revisão. Não compartilhe o link de edição com respondentes.
7. Em **Gatilhos**, confira `receberRespostaFormulario`, com origem no formulário e evento de envio. O gatilho executa com a conta que o instalou; mantenha essa conta em `ADMIN_EMAILS`.
8. Use o link `formulario` para fazer um envio real pelo navegador. Um envio programático não substitui a verificação do gatilho real.

Não é necessário alterar a versão do site para este recurso: o leitor atual já reconhece os dados importados. O código do repositório, sozinho, não cria o formulário na conta Google.

### Como os dados chegam ao site

O Forms mantém suas respostas em uma nova aba bruta na mesma planilha. O gatilho importa cada envio para a aba `SOURCE_SHEET`, usando os títulos dos cabeçalhos, e define `Pendente` como situação inicial. Essa separação preserva as linhas existentes e as referências usadas pela gestão e auditoria. Não altere `SOURCE_SHEET` para a aba bruta criada pelo Forms.

A coluna adicional `FORM_RESPONSE_ID` evita importar o mesmo envio duas vezes. Não a remova nem preencha manualmente. Não renomeie os títulos das perguntas ou os cabeçalhos da origem. A instalação repetida reutiliza o formulário registrado nas propriedades e verifica o gatilho da conta executora; execute sempre pela mesma conta, pois gatilhos de outros proprietários não são listados.

Não são recebidos do formulário status, designação, data de designação ou observações administrativas. Esses campos continuam sob gestão do site. O e-mail é digitado pelo respondente para os testes; não representa identidade autenticada. O acesso ao formulário deve ser revisado no Forms e o envio não concede acesso ao site.

### Roteiro de homologação

| Teste | Ação | Resultado esperado |
|---|---|---|
| Unidade | Envie como `Magistrado(a)` ou `Assessor(a)`, com nome `TESTE UNIDADE`, unidade e quantidade 12 | Resposta na aba bruta e nova linha na origem; solicitação pendente no site |
| Juiz leigo | Envie como `Juiz Leigo` ou `Juíza Leiga`, com nome `TESTE JUIZ` e capacidade 20 | Juiz disponível no site com capacidade 20 |
| Ciclo completo | No site, designe `TESTE JUIZ` à solicitação de 12 minutas | Origem atualizada, status em atendimento, carga 12 e saldo 8 |
| Atualização | Mantenha o site visível sem editar, ou clique em atualizar | Novos dados aparecem na leitura seguinte; atualização automática a cada minuto após o processamento do gatilho |
| Entrada manual | Acrescente uma linha ao final de `SOURCE_SHEET`, preservando cabeçalhos, com cargo reconhecido, nome, e-mail, unidade e quantidade | Registro aparece no site mesmo sem envio do formulário |
| Recuperação | Execute `reprocessarRespostasFormularioTeste` após envios já importados | Nenhuma duplicação; o resumo informa importações e falhas |

Use um usuário `GESTOR` ou `ADMIN` no site para ver ambos os tipos de entrada. Um usuário `CONSULTA` só vê solicitações vinculadas ao próprio e-mail. Remova filtros que ocultem o registro de teste.

### Diagnóstico e limites

- Se há resposta bruta, mas não há linha na origem, confira **Execuções** no projeto de manutenção, as permissões da conta do gatilho e os cabeçalhos. Depois de corrigir a causa, execute `reprocessarRespostasFormularioTeste`.
- O reprocessamento lê os envios do formulário e recupera apenas os ainda não importados. Alterar uma resposta já importada ou editar a aba bruta não atualiza a origem. Para ajustes após a importação, use a gestão do site ou a própria origem.
- Se a linha já existe na origem, confira a planilha/aba no diagnóstico do site, o cargo, o perfil de acesso e os filtros; atualize a página.
- Não ordene fisicamente, remova ou mova linhas da origem: o sistema atual usa o número da linha como identificador. Para cancelar uma solicitação de teste já designada, use a interface de gestão.
- Se houver mensagem de criação incompleta, consulte o `TEST_FORM_ID` salvo e o erro nas Execuções. Não apague propriedades e repita sem inspecionar o formulário parcial e eventuais gatilhos. A instalação interrompida não é automaticamente descartada.
- `TEST_FORM_ID`, `TEST_FORM_SPREADSHEET_ID`, `TEST_FORM_SOURCE_SHEET` e `TEST_FORM_READY` são propriedades geradas pela instalação. O destino fica vinculado à configuração inicial, impedindo redirecionamento acidental por mudança de propriedades.
- O reprocessamento percorre todas as respostas; destina-se ao piloto. Grandes volumes podem atingir limites de execução do Apps Script.

Validação local: `node tests/forms.js`, `node tests/maintenance.js`, `node tests/smoke.js` e `node tests/regression.js`. Os testes usam simulações de serviços Google; o envio real, a publicação e as permissões precisam ser homologados na conta institucional.

### Conferência no site e diagnóstico de envios

Após atualizar os arquivos do site (incluindo `src/FormIntegration.gs`) e publicar uma nova versão do Web App, execute novamente `prepararFormularioTeste` no projeto de manutenção atualizado. O instalador registra o link para respondentes e a fonte na aba auxiliar `JL_FORMULARIO`, sem depender de propriedades compartilhadas entre projetos.

No site, abra **Fonte dos dados · de onde vêm as respostas?** com perfil gestor ou administrador. O painel informa o formulário configurado, oferece o link para responder e mostra quantas linhas da origem possuem identificador de importação. A mensagem de formulário configurado não confirma publicação, permissões ou funcionamento do gatilho: faça um envio real para essa verificação.

Execute `diagnosticarFormularioTeste` na manutenção para conferir o destino, se o formulário aceita respostas, a quantidade de gatilhos da conta executora e os totais de respostas importadas e pendentes. Se houver pendências, consulte as Execuções e use `reprocessarRespostasFormularioTeste` após corrigir a causa. Esse diagnóstico não testa o login no formulário nem a implantação do site.

O título visível do site passa a usar o mesmo nome completo configurado para a página: **PJES - CONECTA JULES - Gestão de Juízes Leigos**.

### Modelo original com minutas na coluna G

A ordem de referência é: A data/hora; B e-mail; C nome; D telefone; E cargo; F unidade; G minutas; H processos; I orientações; J preferência de juiz; K matérias; L produtividade; M status; N observações do atendimento; O competências; P juiz designado; Q data da designação; R identificador do envio.

O instalador já apresenta as perguntas nessa sequência relativa, sem pedir ao respondente os campos administrativos. Carimbo de data/hora e identificador são automáticos; o status inicial é Pendente; designação e observações administrativas ficam sob gestão do site. O importador escreve pelos cabeçalhos da aba de origem, preservando a ordem física existente mesmo que a aba bruta do Forms tenha outra disposição.

Para compatibilidade com o modelo enviado, o título `Competências necessárias — coluna duplicada (revisar)` é reconhecido como alias de `Status do Atendimento:`. A coluna continua sendo status e seus valores existentes são preservados. `Competências necessárias (opcional):` continua sendo o campo de competências, separado do status. Se ambos os títulos de status existirem ao mesmo tempo, a leitura interrompe por ambiguidade. Não se deve criar uma segunda coluna de status.

Não é necessário recriar o formulário para essa compatibilidade. Atualize `Config.gs` e `Data.gs` no projeto do site e publique uma nova versão. No projeto de manutenção, atualize `PrepararPlanilha.gs` e `FormularioTeste.gs`. Não copie a configuração da manutenção para o projeto do site.

O código não move valores de respostas antigas: links ou nomes que já estejam sob um título inadequado precisam de revisão individual na planilha. A compatibilidade de cabeçalhos não corrige dados históricos deslocados.
