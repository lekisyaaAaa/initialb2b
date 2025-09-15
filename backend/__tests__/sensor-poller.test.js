const { normalize } = require('../services/sensor-poller');

test('normalize temperature reading', () => {
  const raw = { id: 'esp32-1', type: 'temperature', value: '24.3', unit: 'C' };
  const n = normalize(raw);
  expect(n.sensorId).toBe('esp32-1');
  expect(n.type).toBe('temperature');
  expect(typeof n.timestamp).toBe('string');
  expect(n.value).toBeCloseTo(24.3);
});

test('normalize pH reading', () => {
  const raw = { id: 'esp32-1', type: 'ph', value: '6.5', unit: 'pH' };
  const n = normalize(raw);
  expect(n.sensorId).toBe('esp32-1');
  expect(n.type).toBe('ph');
  expect(n.value).toBeCloseTo(6.5);
});

test('normalize EC reading', () => {
  const raw = { id: 'esp32-1', type: 'ec', value: '2.1', unit: 'mS/cm' };
  const n = normalize(raw);
  expect(n.sensorId).toBe('esp32-1');
  expect(n.type).toBe('ec');
  expect(n.value).toBeCloseTo(2.1);
});

test('normalize NPK readings', () => {
  const rawN = { id: 'esp32-1', type: 'nitrogen', value: '45', unit: 'mg/kg' };
  const nN = normalize(rawN);
  expect(nN.type).toBe('nitrogen');
  expect(nN.value).toBeCloseTo(45);

  const rawP = { id: 'esp32-1', type: 'phosphorus', value: '18', unit: 'mg/kg' };
  const nP = normalize(rawP);
  expect(nP.type).toBe('phosphorus');
  expect(nP.value).toBeCloseTo(18);

  const rawK = { id: 'esp32-1', type: 'potassium', value: '120', unit: 'mg/kg' };
  const nK = normalize(rawK);
  expect(nK.type).toBe('potassium');
  expect(nK.value).toBeCloseTo(120);
});

test('normalize water level reading', () => {
  const raw = { id: 'esp32-1', type: 'waterLevel', value: '1', unit: '' };
  const n = normalize(raw);
  expect(n.sensorId).toBe('esp32-1');
  expect(n.type).toBe('waterLevel');
  expect(n.value).toBe(1);
});

test('normalize unknown type -> other', () => {
  const raw = { sensorId: 's1', m: 'light', v: 10 };
  const n = normalize(raw);
  expect(n.type).toBe('other');
  expect(n.sensorId).toBe('s1');
});
