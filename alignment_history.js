const fs = require('fs');

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const INPUT_ALIASES = {
  vessel: ['vessel', 'embarcacao', 'navio', 'barco'],
  equipment: [
    'equipment', 'equipamento', 'equipment id', 'equipment tag',
    'equipment / tag', 'asset tag', 'tag', 'tag do equipamento',
    'identificacao do equipamento'
  ],
  date: ['data', 'date'],
  motivation: ['motivacao', 'motivation', 'motivo', 'causa', 'reason', 'purpose'],
  executor: ['executor', 'responsavel', 'tecnico', 'performer', 'executed by', 'quem executou'],
  method: ['metodo', 'method', 'tecnica', 'procedure', 'procedimento'],
  axial_vertical: ['axial vertical', 'vertical axial', 'axial v'],
  axial_horizontal: ['axial horizontal', 'horizontal axial', 'axial h'],
  radial_vertical: ['radial vertical', 'vertical radial', 'radial v'],
  radial_horizontal: ['radial horizontal', 'horizontal radial', 'radial h'],
  coupling_gap: ['coupling gap', 'gap', 'folga do acoplamento']
};

const SHEET_HEADERS = {
  vessel: ['vessel', 'embarcacao', 'navio'],
  equipment: ['equipment / tag', 'equipment tag', 'equipment id', 'asset tag', 'tag do equipamento', 'equipment', 'equipamento'],
  history: {
    date: ['data', 'date'],
    motivation: ['motivacao', 'motivation', 'motivo', 'causa', 'reason'],
    executor: ['executor', 'responsavel', 'tecnico', 'performer'],
    method: ['metodo', 'method', 'tecnica', 'procedure'],
    axial_vertical: ['axial vertical', 'vertical axial', 'axial v'],
    axial_horizontal: ['axial horizontal', 'horizontal axial', 'axial h'],
    radial_vertical: ['radial vertical', 'vertical radial', 'radial v'],
    radial_horizontal: ['radial horizontal', 'horizontal radial', 'radial h'],
    coupling_gap: ['coupling gap', 'gap', 'folga do acoplamento']
  }
};

const aliasToField = new Map(
  Object.entries(INPUT_ALIASES).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalize(alias), field])
  )
);

function parse(text) {
  const fields = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+):\s*(.*?)\s*$/);
    if (!match) continue;
    const key = aliasToField.get(normalize(match[1]));
    if (!key || !match[2]) continue;
    if (fields[key] !== undefined) throw new Error('Campo duplicado: ' + match[1]);
    fields[key] = match[2];
  }
  return fields;
}

function columnLetter(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function findHeader(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalize(header)));
}

async function recordHistory(auth, spreadsheetId, text) {
  const fields = parse(text);
  if (!fields.vessel || !fields.equipment) {
    return 'pendente: informe embarcação e identificação do equipamento';
  }

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(spreadsheetId) + '/values/';
  const headers = {
    Authorization: 'Bearer ' + token.token,
    'Content-Type': 'application/json'
  };

  const read = await fetch(
    base + encodeURIComponent("'Modelo alinhamento'!A2:X1000"),
    { headers }
  );
  if (!read.ok) throw new Error('Falha ao ler modelo: HTTP ' + read.status);

  const { values = [] } = await read.json();
  const sheetHeaders = values[0] || [];
  const vesselIndex = findHeader(sheetHeaders, SHEET_HEADERS.vessel);
  const equipmentIndex = findHeader(sheetHeaders, SHEET_HEADERS.equipment);
  if (vesselIndex < 0 || equipmentIndex < 0) {
    return 'pendente: faltam os cabeçalhos Vessel e Equipment / Tag';
  }

  const historyColumns = Object.entries(SHEET_HEADERS.history)
    .map(([field, aliases]) => ({
      field,
      index: findHeader(sheetHeaders, aliases)
    }))
    .filter(({ field, index }) => fields[field] !== undefined && index >= 0);

  const unmatchedFields = Object.keys(fields).filter((field) =>
    Object.hasOwn(SHEET_HEADERS.history, field) &&
    fields[field] !== undefined &&
    !historyColumns.some((column) => column.field === field)
  );
  if (!historyColumns.length) {
    return unmatchedFields.length
      ? 'pendente: colunas do histórico não encontradas'
      : 'pendente: nenhum campo de histórico identificado';
  }

  const matches = values.slice(1)
    .map((row, index) => ({ row, number: index + 3 }))
    .filter(({ row }) =>
      normalize(row[vesselIndex]) === normalize(fields.vessel) &&
      normalize(row[equipmentIndex]) === normalize(fields.equipment)
    );

  if (matches.length !== 1) return 'pendente: cadastro ausente ou ambíguo';

  const { row, number } = matches[0];
  if (historyColumns.some(({ index }) => String(row[index] || '').trim())) {
    return 'pendente: histórico já preenchido';
  }

  const data = historyColumns.map(({ field, index }) => ({
    range: "'Modelo alinhamento'!" + columnLetter(index) + number,
    values: [[fields[field]]]
  }));

  const write = await fetch(base + ':batchUpdate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ valueInputOption: 'RAW', data })
  });
  if (!write.ok) {
    throw new Error('Falha ao gravar histórico: HTTP ' + write.status +
      ' ' + (await write.text()).slice(0, 200));
  }
  return 'histórico atualizado na linha ' + number;
}

module.exports = { parse, recordHistory };
