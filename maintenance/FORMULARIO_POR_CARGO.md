# Formulário de teste por cargo

No projeto separado de manutenção:

1. Substitua `FormularioTeste.gs` pela versão atual do repositório e mantenha `PrepararPlanilha.gs`.
2. Adicione `FormularioPorCargo.gs` como novo arquivo.
3. Execute `atualizarFormularioPorCargo`.
4. Teste os três cargos pelo link público do formulário. Cada caminho deve terminar em Enviar sem apresentar o outro caminho.
5. Execute `diagnosticarFormularioTeste` depois de enviar uma resposta fictícia e confira a aba do site.

A primeira parte mantém texto, configurações de e-mail, nome, telefone e apresentação existentes. Somente os destinos das três opções de Cargo ou Função são alterados. Magistratura e assessoria compartilham a mesma seção, porque as imagens apresentam os mesmos campos. A seção contém unidade obrigatória, processos opcionais, competências opcionais (três caixas de seleção), orientações opcionais e juiz preferido opcional. Juiz leigo vê quantidade obrigatória, matérias opcionais (três caixas de seleção) e observações opcionais.

Não há exclusão de perguntas com respostas. Itens de tipo diferente são mantidos numa seção histórica fora dos caminhos de resposta, com prefixo `[Histórico]`. O importador atualizado reconhece esses títulos ao reprocessar respostas antigas. Não remova essa seção manualmente. Colunas e respostas da planilha não são alteradas pelo atualizador.

## Limites das imagens

As capturas não mostram as opções da lista de unidades. Se o formulário já tiver essa lista, suas opções são preservadas. Se ainda for texto, continua como texto obrigatório até receber a lista oficial. Para convertê-lo, preencha a propriedade de script `TEST_FORM_UNIDADES_JSON` com um array JSON dos nomes oficiais e execute novamente. Não use uma lista parcial de respostas antigas como se fosse a lista oficial completa.

Tema, cor, coleta verificada de e-mail e recibos permanecem nas configurações existentes; o atualizador não promete reproduzir esses controles visuais das imagens. A seção comum evita duplicar perguntas na importação; a contagem de páginas pode diferir do formulário oficial.

## Retomada

Execute somente após a recuperação da integração por gatilho. O formulário é fechado durante as mudanças. Em falha parcial permanece fechado e a próxima execução retoma; confira o erro antes de reabrir manualmente. Em sucesso restaura o estado anterior de aceitação de respostas. Executar `prepararFormularioTeste` depois não desfaz a navegação por cargo.

A alteração no GitHub precisa ser copiada e executada no Apps Script. Nenhuma implantação Google é atualizada automaticamente.
