const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const P = require('pino');

const spreadsheetId = process.env.SPREADSHEET_ID;
const sheetRange = process.env.SHEETS_RANGE || 'Página1!A:H';
const allowedGroups = (process.env.ALLOWED_GROUP_JIDS || '')
  .split(',')
  .map((jid) => jid.trim())
  .filter(Boolean);

if (!spreadsheetId) {
  throw new Error('Configure SPREADSHEET_ID no ambiente antes de iniciar.');
}

// ADC uses the VM's attached service account on Compute Engine.
// No downloaded service-account private key is needed.
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const seenFile = path.join(__dirname, 'processed-message-ids.json');
let seenIds = new Set();
try {
  seenIds = new Set(JSON.parse(fs.readFileSync(seenFile, 'utf8')));
} catch {
  // Primeira execução: ainda não há IDs processados.
}

function saveSeenIds() {
  fs.writeFileSync(seenFile, JSON.stringify([...seenIds].slice(-10000), null, 2));
}

function unwrapMessage(message) {
  let current = message;
  while (current?.ephemeralMessage?.message || current?.viewOnceMessage?.message ||
         current?.viewOnceMessageV2?.message || current?.documentWithCaptionMessage?.message) {
    current = current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.documentWithCaptionMessage?.message;
  }
  return current || {};
}

function getMessageText(message) {
  const content = unwrapMessage(message);
  return content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    '';
}

function findMeasurements(text) {
  // Registra somente medidas explicitamente escritas com unidade; não deduz valores.
  return [...text.matchAll(/\b-?\d+(?:[.,]\d+)?\s*(?:mm|milímetros?|cm|centímetros?|µm|μm|micrômetros?)\b/gi)]
    .map((match) => match[0].trim())
    .join('; ');
}

async function appendAlignment(sock, msg, text) {
  const groupJid = msg.key.remoteJid;
  const senderJid = msg.key.participant || '';
  const timestamp = msg.messageTimestamp
    ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString();
  let groupName = '';
  try {
    groupName = (await sock.groupMetadata(groupJid)).subject || '';
  } catch {
    // O ID do grupo continua sendo registrado caso os metadados não estejam disponíveis.
  }
  const messageId = msg.key.id || '';

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[
        timestamp,
        groupName,
        groupJid,
        msg.pushName || '',
        senderJid,
        findMeasurements(text),
        text,
        messageId
      ]]
    }
  });
}

async function handleMessage(sock, msg) {
  const groupJid = msg.key.remoteJid || '';
  if (!groupJid.endsWith('@g.us') || msg.key.fromMe) return;
  if (allowedGroups.length && !allowedGroups.includes(groupJid)) return;

  const text = getMessageText(msg.message).trim();
  if (!text || !/\balinhamento\b/i.test(text)) return;

  const messageId = msg.key.id;
  if (messageId && seenIds.has(messageId)) return;

  await appendAlignment(sock, msg, text);
  if (messageId) {
    seenIds.add(messageId);
    saveSeenIds();
  }
  console.log('Mensagem de alinhamento registrada:', groupJid, messageId || '(sem ID)');
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['Alignment Collector', 'Chrome', '1.0.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('Escaneie o QR Code com o WhatsApp que ficará conectado ao grupo:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('Coletor conectado. Ele não envia mensagens.');
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(startBot, 3000);
      else console.error('Sessão desconectada. Reinicie e escaneie um novo QR Code.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      try {
        await handleMessage(sock, msg);
      } catch (error) {
        console.error('Falha ao registrar mensagem:', error.message);
      }
    }
  });
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.log('Iniciando coletor silencioso de mensagens de alinhamento...');
startBot().catch((error) => {
  console.error('Não foi possível iniciar o coletor:', error.message);
  process.exit(1);
});
