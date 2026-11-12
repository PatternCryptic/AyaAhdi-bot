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
const geminiEnabled = process.env.GEMINI_CONVERSATION_ENABLED === 'true';

if (!spreadsheetId) {
  throw new Error('Configure SPREADSHEET_ID no ambiente antes de iniciar.');
}
if (geminiEnabled && !process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_CONVERSATION_ENABLED requer GEMINI_API_KEY.');
}
if (geminiEnabled && !allowedGroups.length) {
  throw new Error('Configure ALLOWED_GROUP_JIDS antes de habilitar a leitura de conversas pelo Gemini.');
}

// ADC uses the VM's attached service account on Compute Engine.
// No downloaded service-account private key is needed.
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const seenFile = path.join(__dirname, 'processed-message-ids.json');
const sessionsFile = path.join(__dirname, 'alignment-sessions.json');
const pendingFile = path.join(__dirname, 'pending-alignment.jsonl');
let seenIds = new Set();
try {
  seenIds = new Set(JSON.parse(fs.readFileSync(seenFile, 'utf8')));
} catch {
  // Primeira execução: ainda não há IDs processados.
}

function saveSeenIds() {
  fs.writeFileSync(seenFile, JSON.stringify([...seenIds].slice(-10000), null, 2));
}

function appendPending(entry) {
  fs.appendFileSync(pendingFile, JSON.stringify(entry) + '\n', { mode: 0o600 });
  fs.chmodSync(pendingFile, 0o600);
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

let alignmentTracker = null;
if (geminiEnabled) {
  const { createTracker, fileStore, makeGeminiFunctions, verifyExtraction } = require('./gemini_conversation');
  const history = require('./alignment_history');
  const store = fileStore(sessionsFile);
  const gemini = makeGeminiFunctions({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    onExtract: async (session, reason, extraction, transcript) => {
      const checked = verifyExtraction(extraction, transcript);
      if (!checked.ok) {
        appendPending({
          groupJid: session.group,
          startedAt: session.startedAt,
          closedAt: new Date().toISOString(),
          reason: checked.reason,
          messages: session.messages
        });
        console.log('Alinhamento mantido para revisão:', checked.reason);
        return;
      }

      const result = await history.recordHistory(auth, spreadsheetId, checked.text);
      if (result.startsWith('pendente:')) {
        appendPending({
          groupJid: session.group,
          startedAt: session.startedAt,
          closedAt: new Date().toISOString(),
          reason: result,
          messages: session.messages
        });
      }
      console.log('Histórico de alinhamento:', result);
    }
  });

  alignmentTracker = createTracker({
    classify: async (previous, current) => {
      try {
        return await gemini.classify(previous, current);
      } catch (error) {
        console.error('Falha de classificação Gemini; mantendo mensagem pendente:', error.message);
        return 'uncertain';
      }
    },
    finish: async (session, reason) => {
      try {
        await gemini.finish(session, reason);
      } catch (error) {
        appendPending({
          groupJid: session.group,
          startedAt: session.startedAt,
          closedAt: new Date().toISOString(),
          reason: 'falha ao finalizar com Gemini: ' + error.message,
          messages: session.messages
        });
        console.error('Sessão salva para revisão após falha do Gemini:', error.message);
      }
    },
    save: (state) => store.save(state),
    load: () => store.load(),
    timeoutMs: 15 * 60 * 1000
  });

  setInterval(() => {
    alignmentTracker.tick().catch((error) => {
      console.error('Falha ao encerrar sessão de alinhamento:', error.message);
    });
  }, 30 * 1000).unref();
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

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(sheetRange) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[timestamp, groupName, groupJid, msg.pushName || '', senderJid, findMeasurements(text), text, messageId]] })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error('Sheets HTTP ' + response.status + ': ' + body.slice(0, 300));
  }
}

async function handleMessage(sock, msg) {
  const groupJid = msg.key.remoteJid || '';
  if (!groupJid.endsWith('@g.us') || msg.key.fromMe) return;
  if (allowedGroups.length && !allowedGroups.includes(groupJid)) return;

  const text = getMessageText(msg.message).trim();
  if (!text) return;

  const messageId = msg.key.id;
  if (messageId && seenIds.has(messageId)) return;

  if (geminiEnabled) {
    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();
    const outcome = await alignmentTracker.process({
      group: groupJid,
      id: messageId || '',
      timestamp,
      sender: msg.pushName || '',
      text
    });
    if (outcome !== 'ignorada' && messageId) {
      seenIds.add(messageId);
      saveSeenIds();
    }
    if (outcome !== 'ignorada') console.log('Coleta de alinhamento:', outcome, groupJid);
    return;
  }

  if (!/\balinhamento\b/i.test(text)) return;

  let result;
  try {
    result = await require('./alignment_history').recordHistory(auth, spreadsheetId, text);
  } catch (error) {
    result = 'pendente: ' + error.message;
  }
  if (result.startsWith('pendente:')) {
    fs.appendFileSync(path.join(__dirname, 'pending-alignment.jsonl'), JSON.stringify({ messageId, groupJid, text, reason: result }) + '\n', { mode: 0o600 });
  }
  console.log('Histórico de alinhamento:', result);
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
