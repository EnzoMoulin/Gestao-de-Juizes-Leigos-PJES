function doGet() {
  const template = HtmlService.createTemplateFromFile("index");
  template.appName = JL_CONFIG.APP_NAME;
  return template.evaluate()
    .setTitle(JL_CONFIG.APP_NAME)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function include_(nome) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(nome || ""))) throw new Error("Nome de arquivo inválido.");
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}
