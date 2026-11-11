const fs = require('fs');
const path = require('path');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const labels = {
  'embarcacao': 'vessel', vessel: 'vessel', navio: 'vessel',
  equipamento: 'equipment', 'equipment class': 'equipment',
  data: 'E', motivacao: 'F', executor: 'G', metodo: 'H',
  'axial vertical': 'I', 'axial horizontal': 'J',
  'radial vertical': 'K', 'radial horizontal': 'L',
  'coupling gap': 'M', 'gap': 'M', 'folga do acoplamento': 'M'
};

function parse(text) {
  const fields = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+):\s*(.*?)\s*$/);
    if (!match) continue;
    const key = labels[normalize(match[1])];
    if (!key || !match[2]) continue;
    if (fields[key] !== undefined) throw new Error('Campo duplicado: ' + match[1]);
    fields[key] = match[2];
  }
  return fields;
}

async function recordHistory(auth, spreadsheetId, text) {
  const fields = parse(text);
  if (!fields.vessel || !fields.equipment) return 'pendente: informe embarcação e equipamento';
  const columns = 'EFGHIJKLM'.split('').filter(c => fields[c] !== undefined);
  if (!columns.length) return 'pendente: nenhum campo de histórico identificado';
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId) + '/values/';
  const headers = {Authorization: 'Bearer ' + token.token, 'Content-Type': 'application/json'};
  const read = await fetch(base + encodeURIComponent("'Modelo alinhamento'!A3:M1000"), {headers});
  if (!read.ok) throw new Error('Falha ao ler modelo: HTTP ' + read.status);
  const {values = []} = await read.json();
  const matches = values.map((row, i) => ({row, number:i+3})).filter(({row}) => normalize(row[0]) === normalize(fields.vessel) && normalize(row[1]) === normalize(fields.equipment));
  if (matches.length !== 1) return 'pendente: cadastro ausente ou ambíguo';
  const {row, number} = matches[0];
  if (columns.some(c => String(row[c.charCodeAt(0)-65] || '').trim())) return 'pendente: histórico já preenchido';
  const data = columns.map(c => ({range: "'Modelo alinhamento'!" + c + number, values:[[fields[c]]]}));
  const write = await fetch(base + ':batchUpdate', {method:'POST',headers,body:JSON.stringify({valueInputOption:'RAW',data})});
  if (!write.ok) throw new Error('Falha ao gravar histórico: HTTP ' + write.status + ' ' + (await write.text()).slice(0,200));
  return 'histórico atualizado na linha ' + number;
}

module.exports = {parse, recordHistory};
