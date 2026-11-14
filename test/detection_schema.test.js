const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTracker, makeGeminiFunctions } = require('../gemini_conversation');
const { getRecordSchema } = require('../alignment_history');

test('inicia sessão com detecção contextual e ignora conversa sem relação', async () => {
  const tracker = createTracker({ detect: async m => m.text.includes('alinhar o eixo'), classify: async () => 'related',
    finish: async () => {}, save: async () => {} });
  assert.equal(await tracker.process({group:'a', text:'Vamos almoçar?'}), 'ignorada');
  assert.equal(await tracker.process({group:'a', text:'Vamos alinhar o eixo da bomba'}), 'aberta');
  assert.equal(tracker.snapshot().a.messages.length, 1);
});

test('lê títulos atuais com grupos e informa ao Gemini o esquema', async () => {
  const sheets = { spreadsheets: { values: { get: async () => ({data:{values:[['', 'Drive Machine'], ['', 'Vessel', 'Equipment / Tag', 'Maker', 'Comments']]}}) } } };
  const schema = await getRecordSchema(sheets, 'test');
  assert.equal(schema[0].title, 'Vessel');
  assert.deepEqual(schema.find(c => c.title === 'Maker').mappedAs, []);
  const original = global.fetch;
  let prompt;
  global.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text;
    return {ok:true, json:async () => ({candidates:[{content:{parts:[{text:'{"known":[],"missing":["Vessel"],"question":"Embarcação?"}'}]}}]})};
  };
  try {
    const gemini = makeGeminiFunctions({apiKey:'test', config:{}, getRecordSchema:async () => schema});
    await gemini.ask({messages:[]});
    assert.match(prompt, /Drive Machine/);
    assert.match(prompt, /Vessel/);
    assert.match(prompt, /mappedAs/);
  } finally { global.fetch = original; }
});

