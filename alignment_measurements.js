// Valores somente são comparáveis quando a natureza, direção e unidade estão explícitas.
const DIRECTIONS = new Set(['axial_horizontal', 'axial_vertical', 'radial_horizontal', 'radial_vertical']);
const UNITS = new Set(['mm', 'cm', 'µm', 'um']);

function compare(tolerance, measurement) {
  if (!tolerance || !measurement || tolerance.kind !== 'tolerance' || measurement.kind !== 'after' ||
      !DIRECTIONS.has(tolerance.direction) || tolerance.direction !== measurement.direction ||
      !UNITS.has(tolerance.unit) || tolerance.unit !== measurement.unit ||
      typeof tolerance.value !== 'number' || !Number.isFinite(tolerance.value) || tolerance.value < 0 ||
      typeof measurement.value !== 'number' || !Number.isFinite(measurement.value)) return 'Desconhecido';
  return Math.abs(measurement.value) <= tolerance.value ? 'Dentro da tolerância' : 'Fora da tolerância';
}

module.exports = { compare };

