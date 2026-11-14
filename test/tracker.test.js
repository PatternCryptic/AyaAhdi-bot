const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTracker } = require('../gemini_conversation');

test('isola grupos e reconhece início em inglês', async () => {
  const closed = [];
  let clock = 0;
  const tracker = createTracker({ classify: async () => 'related', finish: async s => closed.push(s),
    save: async () => {}, now: () => clock, timeoutMs: 900000 });
  await tracker.process({ group: 'a', text: 'alignment', id: '1' });
  await tracker.process({ group: 'b', text: 'alinhamento', id: '2' });
  await tracker.process({ group: 'a', text: 'resultado', id: '3' });
  clock = 900000;
  await tracker.tick();
  assert.deepEqual(closed.map(s => [s.group, s.messages.map(m => m.id)]), [['a', ['1', '3']], ['b', ['2']]]);
});

