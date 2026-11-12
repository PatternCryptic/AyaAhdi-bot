const fs = require('fs');

const DECISIONS = new Set(['related', 'unrelated', 'new_activity', 'uncertain']);
const FIELD_LABELS = {
  date: 'Data',
  motivation: 'Motivacao',
  executor: 'Executor',
  method: 'Metodo',
  axial_vertical: 'Axial vertical',
  axial_horizontal: 'Axial horizontal',
  radial_vertical: 'Radial vertical',
  radial_horizontal: 'Radial horizontal',
  coupling_gap: 'Coupling gap'
};

function createTracker({
  classify,
  finish,
  save,
  load = () => ({}),
  now = Date.now,
  timeoutMs = 15 * 60 * 1000,
  maxMessages = 80
}) {
  let sessions = load() || {};
  let queue = Promise.resolve();

  const enqueue = (fn) => {
    const next = queue.then(fn);
    queue = next.catch(() => {});
    return next;
  };

  async function persist() {
    await save(sessions);
  }

  async function close(group, reason) {
    const session = sessions[group];
    if (!session) return;
    await finish(session, reason);
    delete sessions[group];
    await persist();
  }

  async function expire(t) {
    for (const [group, session] of Object.entries(sessions)) {
      if (t - session.lastRelated >= timeoutMs) await close(group, 'inatividade');
    }
  }

  function newSession(msg, t) {
    return {
      group: msg.group,
      startedAt: msg.timestamp || new Date(t).toISOString(),
      lastRelated: t,
      messages: [msg]
    };
  }

  return {
    process: (msg) => enqueue(async () => {
      if (!msg?.group || !String(msg.text || '').trim()) return 'ignorada';
      const t = now();
      await expire(t);

      const session = sessions[msg.group];
      if (!session) {
        if (!/\balinhamento\b/i.test(msg.text)) return 'ignorada';
        sessions[msg.group] = newSession(msg, t);
        await persist();
        return 'aberta';
      }

      if (msg.id && session.messages.some((item) => item.id === msg.id)) return 'duplicada';
      if (session.messages.length >= maxMessages) {
        await close(msg.group, 'limite de mensagens');
        if (/\balinhamento\b/i.test(msg.text)) {
          sessions[msg.group] = newSession(msg, t);
          await persist();
          return 'aberta';
        }
        return 'limite atingido';
      }

      const decision = await classify(session.messages, msg);
      if (!DECISIONS.has(decision)) throw new Error('Classificação inválida do Gemini');
      if (decision === 'unrelated') return decision;

      if (decision === 'new_activity') {
        await close(msg.group, 'novo equipamento');
        sessions[msg.group] = newSession(msg, t);
      } else {
        session.messages.push(msg);
        if (decision === 'related') session.lastRelated = t;
      }
      await persist();
      return decision;
    }),
    tick: () => enqueue(() => expire(now())),
    snapshot: () => JSON.parse(JSON.stringify(sessions))
  };
}

function fileStore(file) {
  return {
    load: () => {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
      }
    },
    save: (state) => {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
      fs.chmodSync(tmp, 0o600);
      fs.renameSync(tmp, file);
      fs.chmodSync(file, 0o600);
    }
  };
}

async function geminiJson(apiKey, prompt, model = 'gemini-3.1-flash-lite') {
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent';
  const timeoutMs = 50000;
  const maxAttempts = 2;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const details = (await response.text()).slice(0, 500);
        const error = new Error('Gemini HTTP ' + response.status +
          (details ? ': ' + details : ''));
        error.status = response.status;
        throw error;
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
      if (!text) throw new Error('Gemini retornou resposta vazia');
      return JSON.parse(text);
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error('Tempo limite do Gemini após ' + Math.round(timeoutMs / 1000) + ' segundos')
        : error;
      const retryable = error.name === 'AbortError' ||
        error.name === 'TypeError' ||
        [408, 429, 500, 502, 503, 504].includes(error.status);

      if (!retryable || attempt + 1 >= maxAttempts) throw lastError;
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }

  throw lastError;
}

function makeGeminiFunctions({ apiKey, model, onExtract }) {
  async function classify(previousMessages, currentMessage) {
    const transcript = [...previousMessages, currentMessage].map((message, index) => ({
      n: index + 1,
      time: message.timestamp,
      sender: message.sender,
      text: message.text
    }));
    const result = await geminiJson(apiKey, [
      'Você classifica mensagens de um grupo de manutenção para registrar UMA atividade de alinhamento de eixo.',
      'Analise a conversa inteira e apenas a mensagem atual. A palavra inicial alinhamento abre a coleta.',
      'Responda somente JSON: {"decision":"related|unrelated|new_activity|uncertain"}.',
      'related: acrescenta, confirma ou corrige informação da mesma atividade/equipamento.',
      'unrelated: conversa paralela claramente sem relação com o alinhamento ativo.',
      'new_activity: há evidência clara de novo alinhamento ou equipamento distinto (por exemplo, troca explícita de DG2 para DG4).',
      'uncertain: não é seguro decidir. Não misture equipamentos, não deduza nem use conhecimento externo.',
      'Se ainda não foi identificado equipamento, dados de alinhamento podem ser related. Uma mensagem ambígua deve ser uncertain.',
      'CONVERSA: ' + JSON.stringify(transcript)
    ].join('\n'), model);
    return result?.decision;
  }

  async function finish(session, reason) {
    const transcript = session.messages.map((message, index) => ({
      n: index + 1,
      time: message.timestamp,
      sender: message.sender,
      text: message.text
    }));
    const result = await geminiJson(apiKey, [
      'Extraia um único registro de alinhamento de eixo a partir destas mensagens de um grupo de manutenção.',
      'Responda somente JSON no formato: {"status":"ready|ambiguous|incomplete","vessel":{"value":"texto literal","message":1,"quote":"trecho literal"},"equipment":{"value":"texto literal","message":1,"quote":"trecho literal"},"fields":{"date":{"value":"texto literal","message":1,"quote":"trecho literal"},"motivation":null,"executor":null,"method":null,"axial_vertical":null,"axial_horizontal":null,"radial_vertical":null,"radial_horizontal":null,"coupling_gap":null}}.',
      'Para vessel e equipment, extraia somente se estiverem explicitamente identificados nas mensagens. equipment é o equipamento alinhado, como DG2 ou DG4; não confunda com classe genérica de equipamento.',
      'Extraia apenas valores que as mensagens afirmam explicitamente. Não calcule, converta, complete, atribua autoria nem adivinhe dados ausentes.',
      'Cada valor não nulo precisa apontar para o número da mensagem e conter uma quote literal daquela mensagem que inclua o valor. Se houver dois equipamentos, conflito, troca incerta ou evidência insuficiente, marque ambiguous ou incomplete.',
      'Use status ready somente quando vessel, equipment e ao menos um campo de histórico estiverem claros. Use as grafias e unidades originais.',
      'MOTIVO DE FECHAMENTO: ' + reason,
      'MENSAGENS: ' + JSON.stringify(transcript)
    ].join('\n'), model);
    await onExtract(session, reason, result, transcript);
  }

  return { classify, finish };
}

function verifyExtraction(result, transcript) {
  if (!result || result.status !== 'ready') return { ok: false, reason: 'extração incompleta ou ambígua' };
  const verifiedValue = (item) => {
    if (!item || typeof item.value !== 'string' || !item.value.trim() ||
        !Number.isInteger(item.message) || item.message < 1 || item.message > transcript.length ||
        typeof item.quote !== 'string' || !item.quote.trim()) return null;
    const source = transcript[item.message - 1].text;
    const fold = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    if (!source.includes(item.quote) || !fold(item.quote).includes(fold(item.value))) return null;
    return item.value.trim();
  };

  const vessel = verifiedValue(result.vessel);
  const equipment = verifiedValue(result.equipment);
  if (!vessel || !equipment) return { ok: false, reason: 'embarcação ou equipamento sem evidência literal' };

  const fields = {};
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const value = verifiedValue(result.fields?.[key]);
    if (value) fields[label] = value;
  }
  if (!Object.keys(fields).length) return { ok: false, reason: 'nenhum campo de histórico comprovado' };

  const input = [`Vessel: ${vessel}`, `Equipment: ${equipment}`];
  for (const [label, value] of Object.entries(fields)) input.push(`${label}: ${value}`);
  return { ok: true, text: input.join('\n'), vessel, equipment, fields };
}

module.exports = { createTracker, fileStore, geminiJson, makeGeminiFunctions, verifyExtraction };
