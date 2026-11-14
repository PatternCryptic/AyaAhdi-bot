const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rowsAsObjects } = require('../alignment_config');

test('finds the masterlist header after its merged title row', () => {
  const rows = [['', 'Navio'], ['Nome', 'Operação', 'Design', 'ID'], ['Vessel A', 'PSV', 'Model X', '123']];
  assert.deepEqual(rowsAsObjects(rows, ['nome', 'vessel', 'navio']), [
    { nome: 'Vessel A', operacao: 'PSV', design: 'Model X', id: '123' }
  ]);
});

