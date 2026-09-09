# Revisão CONECTA JULES — 09/09/2026

## Resultado e limite da investigação

Revisão estática do código e testes automatizados com dados fictícios. Não houve acesso às propriedades privadas do Apps Script, respostas reais, navegador autenticado ou implantação em produção. Portanto, a origem exata do incidente dos seis registros ainda precisa ser confirmada na implantação.

O código não limita a leitura a seis: lê até a última linha da aba configurada. Há três causas verificáveis: formulário ligado a outra planilha/aba; classificação da resposta (juiz leigo é disponibilidade, magistrado/assessor é solicitação); painel antigo sem releitura. Cadastros de juízes concluídos/cancelados também ficam fora da lista ativa.

## Correções entregues

- Título solicitado no login, painel e título da página.
- Fonte dos dados visível somente para gestores/administradores: nome, ID, link, aba, contagens, funções e status não reconhecidos. A cópia de um formulário não é mesclada automaticamente.
- Propriedade opcional SOURCE_SHEET, mantendo o padrão anterior. Nenhuma propriedade real foi alterada.
- Leitura automática a cada minuto, sem interromper diálogos; falhas exibem aviso persistente de dados antigos. Busca de juízes e tutorial de diagnóstico.
- Classificação de juiz/juíza com normalização de acentos e espaços. Status conhecidos são normalizados; desconhecidos deixam de virar Pendente silenciosamente.
- Comandos públicos verificarConfiguracao() e instalarEstruturasAuxiliares() corrigidos: calculam o perfil administrativo e registram resultado no log.
- Prioridade, existência da aba auxiliar e validade real do prazo conferidas antes de alterar a resposta. Cabeçalhos auxiliares incompatíveis não são sobrescritos na aba afetada.
- Nomes duplicados de juízes ativos bloqueiam designação ambígua. Capacidade projetada corrigida ao reabrir registro encerrado.
- Token vinculado à conta Google atual; sessão expirada removida para permitir novo login. Falhas de armazenamento do navegador não derrubam a inicialização.
- Escape de atributos HTML, links seguros e proteção de fórmulas na exportação CSV.
- Alteração de usuários serializada; situação exige booleano; impedida remoção da própria permissão administrativa e alteração ineficaz de administradores fixos.
- Filtros rápidos limpam filtros conflitantes. Histórico atrasado não sobrescreve outra solicitação. Impedida designação com observações editadas ainda não salvas e cliques concorrentes de gestão na mesma tela.

As orientações de interface da skill Sites foram usadas para manter busca ampla, foco de teclado visível, diagnóstico legível e controles responsivos, preservando Apps Script e a identidade visual existente.

## Pontos de atenção ainda existentes

1. **Identidade por número de linha (alto):** gestão e histórico usam a posição da resposta. Não excluir, ordenar fisicamente ou mover linhas na origem. Use filtros no site. IDs permanentes exigem migração controlada e backup dos dados reais; não foi feita migração automática.
2. **Gravações em múltiplas abas (médio):** validações agora antecedem gravações, mas Sheets não oferece transação entre essas operações. Falhas de serviço podem deixar gravação parcial. Conferir histórico e planilha antes de repetir uma ação após timeout. Não há repetição automática de gravações.
3. **Concorrência entre pessoas (médio):** há bloqueio durante escrita, mas não comparação de versão da solicitação; outra pessoa pode salvar uma edição baseada em dados antigos. Reabra a solicitação antes de alterações importantes.
4. **Capacidade em texto livre (médio):** o parser numérico legado é aproximado. Padronizar formulário para números inteiros positivos; capacidade não numérica não é garantia de disponibilidade. Não foi alterado automaticamente o formulário real.
5. **Escala:** cada atualização relê a origem e abas auxiliares. Monitorar quotas e tempo de resposta conforme volume/usuários; a atualização automática pode ser desmarcada.
6. **Acesso:** contas fixas e usuários ativos em USUARIOS podem acessar conforme perfil. Se a política continuar sendo somente duas contas, conferir ambas as fontes de autorização; nenhum acesso foi concedido nesta revisão.

## Como colocar esta versão no ar

1. Faça backup do projeto e da planilha. Compare alterações locais ainda não presentes no GitHub antes de substituir arquivos.
2. Atualize **todos** os arquivos da pasta src no projeto Apps Script, mantendo os nomes. Se copiar manualmente, .gs são arquivos de script e .html são arquivos HTML. Alternativa: git pull e clasp push no projeto já configurado.
3. Confirme SPREADSHEET_ID nas propriedades. No formulário oficial, abra Respostas e o atalho do Sheets para verificar a planilha de destino. Confira também SOURCE_SHEET se a aba tiver outro nome. Não misture original e cópia sem uma decisão explícita sobre a origem oficial.
4. Com uma conta configurada em ADMIN_EMAILS, execute prepararProjetoNoEditor_ no seletor do editor, **com sublinhado final**. O comando privado usa a conta executora autorizada, instala e verifica a configuração. Veja o Registro de execução. O instalador cria/formata abas auxiliares, não importa respostas de outro formulário.
5. Em Implantar → Gerenciar implantações → Editar, escolha Nova versão e Implante. Atualizar GitHub não publica o Apps Script automaticamente.
6. Abra a URL /exec. Em Fonte dos dados, compare a planilha e a aba com o destino do formulário oficial.
7. Em ambiente de teste, envie uma resposta de juiz leigo: confira a nova linha na origem e o incremento em Juízes e capacidade após Atualizar dados ou até um minuto. Teste também pedido de assessor, perfil CONSULTA, ADMIN e conta não autorizada.

## Testes reproduzíveis

Na raiz do repositório, com Node.js:

```sh
node tests/smoke.js
node tests/regression.js
```

Cobertura adicional: crescimento de seis para sete juízes; classificação e status; diagnóstico restrito; aba configurável; data impossível sem escrita na origem; autorização administrativa; sessão de outra conta; cabeçalho incompatível; escape HTML, CSV, armazenamento indisponível e sessão expirada. São testes com mocks, não homologação no Google Workspace real.

Referências: [destino de respostas do Forms](https://support.google.com/docs/answer/2917686?hl=pt-BR) e [versões de implantação do Apps Script](https://developers.google.com/apps-script/concepts/deployments).
