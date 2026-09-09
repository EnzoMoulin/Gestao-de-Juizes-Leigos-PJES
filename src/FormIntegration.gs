// Metadados compartilhados com o projeto separado de manutenção.
function diagnosticoFormulario_(planilha, fonte) {
  const sheet = planilha.getSheetByName('JL_FORMULARIO');
  if (!sheet || sheet.getLastRow() < 2) return { configurado: false };
  const rows = sheet.getRange(1, 1, sheet.getLastRow(), 2).getDisplayValues();
  if (rows[0][0] !== 'CHAVE' || rows[0][1] !== 'VALOR') return { configurado: false };
  const values = {};
  rows.slice(1).forEach(row => { values[row[0]] = row[1]; });
  const url = String(values.FORM_URL || '');
  const valido = /^https:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?[\w-]+\/viewform(?:\?[^\s<>"']*)?$/.test(url);
  if (!valido || values.SOURCE_SHEET !== fonte.getName() || values.SPREADSHEET_ID !== planilha.getId()) {
    return { configurado: false, aviso: 'A configuração do formulário não corresponde à fonte atual. Execute novamente prepararFormularioTeste na manutenção.' };
  }
  return {configurado: true, url: url};
}
