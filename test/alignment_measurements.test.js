const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compare } = require('../alignment_measurements');
const { verifyExtraction } = require('../gemini_conversation');
const tolerance = { kind: 'tolerance', direction: 'axial_horizontal', unit: 'mm', value: 0.03 };
const result = { kind: 'after', direction: 'axial_horizontal', unit: 'mm', value: 0.02 };

test('compara apenas resultado após ajuste com tolerância correspondente', () => {
  assert.equal(compare(tolerance, result), 'Dentro da tolerância');
  assert.equal(compare(tolerance, { ...result, value: -0.04 }), 'Fora da tolerância');
  assert.equal(compare(tolerance, { ...result, kind: 'before' }), 'Desconhecido');
  assert.equal(compare(tolerance, { ...result, direction: 'radial_horizontal' }), 'Desconhecido');
  assert.equal(compare(tolerance, { ...result, unit: 'cm' }), 'Desconhecido');
  assert.equal(compare(tolerance, { ...result, unit: '' }), 'Desconhecido');
  assert.equal(compare({ ...tolerance, value: -1 }, result), 'Desconhecido');
});

test('preserva campos comprovados mesmo se campos forem desconhecidos ao fechar sessão', () => {
  const transcript = [{ text: 'Vessel: Bongo, DG1; tolerância axial 0.03 mm' }];
  const result = verifyExtraction({
    status: 'incomplete',
    vessel: { value: 'Bongo', message: 1, quote: 'Vessel: Bongo' },
    equipment: { value: 'DG1', message: 1, quote: 'DG1' },
    fields: { axial_tolerance: { value: '0.03 mm', message: 1, quote: 'tolerância axial 0.03 mm' } }
  }, transcript);
  assert.equal(result.ok, true);
  assert.equal(result.fields['Axial tolerance'], '0.03 mm');
});

