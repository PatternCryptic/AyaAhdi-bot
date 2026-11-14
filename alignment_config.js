const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

function findHeaderRow(rows, aliases) {
  const allowed = new Set(aliases.map(norm));
  let bestIndex = -1;
  let bestScore = 0;
  rows.forEach((row, i) => {
    const score = row.filter(cell => allowed.has(norm(cell))).length;
    if (score >= bestScore && score > 0) { bestScore = score; bestIndex = i; }
  });
  return bestIndex;
}

function rowsAsObjects(rows, headerAliases) {
  const headerIndex = findHeaderRow(rows, headerAliases);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(norm);
  return rows.slice(headerIndex + 1).filter(row => row.some(cell => String(cell || '').trim()))
    .map(row => Object.fromEntries(headers.map((header, i) => [header, String(row[i] || '').trim()]).filter(([, v]) => v)));
}

async function loadAlignmentConfig(sheets, spreadsheetId) {
  if (!spreadsheetId) throw new Error('CONFIG_SPREADSHEET_ID ausente');
  const { data: metadata } = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const titleMap = new Map((metadata.sheets || []).map(s => [norm(s.properties.title), s.properties.title]));
  const findTab = (...names) => names.map(norm).map(n => titleMap.get(n)).find(Boolean);
  const tabs = {
    taxonomy: findTab('Taxonomia'),
    glossary: findTab('Glossario', 'Glossário'),
    combinations: findTab('Configurações', 'Maquina a ser alinhada / Drive Machine'),
    masterlist: findTab('masterlist', 'Navio')
  };
  const missing = Object.entries(tabs).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error('Abas de configuração ausentes: ' + missing.join(', '));
  const read = async name => {
    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${name.replace(/'/g, "''")}'!A1:Z2000` });
    return data.values || [];
  };
  const [taxonomyRows, glossaryRows, combinationRows, masterRows] = await Promise.all(Object.values(tabs).map(read));
  const taxonomy = rowsAsObjects(taxonomyRows, ['taxonomia', 'equipment class', 'classe do equipamento']);
  const glossary = rowsAsObjects(glossaryRows, ['glossario', 'glossary', 'termo', 'term', 'nome alternativo']);
  const combinations = rowsAsObjects(combinationRows, ['maquina a ser alinhada / drive machine', 'drive machine', 'maquina a ser alinhada']);
  const masterlist = rowsAsObjects(masterRows, ['nome', 'vessel', 'embarcacao', 'navio']);
  if (!taxonomy.length || !glossary.length || !masterlist.length) throw new Error('Uma ou mais abas de configuração não contêm cabeçalhos/dados reconhecíveis');
  return { taxonomy, glossary, combinations, masterlist };
}

module.exports = { norm, rowsAsObjects, loadAlignmentConfig };

