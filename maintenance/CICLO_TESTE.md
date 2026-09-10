# Formulário → planilha de teste → site

## Situação verificada em 10/09/2026

A planilha de teste contém 25 respostas, incluindo uma resposta identificada pelo importador. Foram corrigidos os títulos duplicados de status/competências e e-mail sem alterar os valores das respostas. As abas auxiliares foram alinhadas à estrutura atual e a de juízes disponíveis passou a mostrar sete cadastros.

A origem permanece em `Respostas ao formulário 1`. A ordem atual é: A data/hora, B e-mail, C nome, D telefone, E cargo, F unidade, G processos, H orientações, I preferência de juiz, J quantidade, K matérias, L produtividade, M status, N e-mail adicional preservado, O observações de atendimento, P competências, Q juiz designado, R data de designação, S identificador de importação. A coluna extra foi preservada; não copie cabeçalhos de um modelo de 18 colunas sobre esta aba de 19 colunas.

## Atualização necessária na conta Google

1. No projeto separado de manutenção, substitua `FormularioTeste.gs` pelo arquivo completo deste repositório. Mantenha `PrepararPlanilha.gs`, inclusive a função `normalizarCabecalhoOrigem_`.
2. Preserve `TEST_FORM_ID` e as propriedades de destino existentes. Execute `prepararFormularioTeste` para atualizar a pergunta de cargo e as regras dos campos de texto no formulário existente.
3. Execute `diagnosticarFormularioTeste`. Confira a planilha, a aba, o gatilho e os totais de respostas.
4. Se houver pendências, execute `reprocessarRespostasFormularioTeste` e confira o resumo e os erros individuais.
5. Envie pelo navegador uma solicitação de unidade com nome fictício, telefone, e-mail e unidade. Quantidade é opcional para unidade. Depois envie uma disponibilidade de juiz leigo com uma capacidade positiva. O teste real depende das permissões de acesso/publicação do Forms.
6. Confirme novas linhas na origem, com identificadores diferentes, e atualize o site como gestor/administrador. Unidade aparece em Solicitações; juiz leigo aparece em Juízes e capacidade. Enviar um formulário não concede acesso ao site.
7. No diagnóstico de fonte do site, confira se o ID da planilha é o mesmo configurado na manutenção. Este repositório não tem acesso às propriedades da implantação real.

## Compatibilidade com o formulário oficial

O importador aceita o e-mail coletado pelo Google Forms e, quando indisponível, o campo de e-mail digitado. Os cargos oficiais e as quatro opções antigas são normalizados para os valores das abas auxiliares. Respostas de caixas de seleção são unidas em texto separado por vírgulas.

A unidade é obrigatória no importador para magistratura/assessoria, e a quantidade é opcional para esses cargos. Para juiz leigo, a unidade pode ficar em branco e a capacidade deve ser um inteiro positivo. O formulário de teste continua numa página: os campos de texto de unidade e quantidade são opcionais na interface, com instruções por perfil e validação condicional no importador. Para um fluxo visual com seções condicionais idêntico ao oficial, é necessário configurar as seções no Forms e fornecer a lista completa de unidades; as imagens não contêm essa lista.

O código atualiza os itens existentes sem apagar suas respostas. Não converte listas nem caixas de seleção existentes em outro tipo. Status inicial é Pendente e designação continua sendo feita pelo site. Respostas já importadas não são sobrescritas ao reprocessar.

## Separação das abas

O Forms pode manter uma aba de respostas brutas criada por ele; o gatilho do projeto de manutenção escreve na origem do site. Não renomeie a aba bruta para substituir a origem ou cole cabeçalhos sobre colunas de outro tipo. Isso pode duplicar títulos ou deslocar os significados dos dados. Não elimine nem reordene linhas da origem: o site usa seus números como identificadores de gestão.

## Verificação

Testes locais: `node tests/forms.js`, `node tests/maintenance.js`, `node tests/regression.js`, `node tests/smoke.js`, `node tests/startup.js`. Esses testes não substituem o envio pelo formulário nem comprovam qual versão está implantada no Apps Script.
