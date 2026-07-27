// Standalone self-test for the PSI protocol core.
// Run with: node scripts/psi_selftest.mjs
//
// Asserts:
//   1. The full four-phase protocol finds the correct intersection.
//   2. Disjoint sets produce an empty intersection.
//   3. No input element string appears in any serialized message payload.

import assert from 'node:assert/strict';
import {
  convertToFlooredStrings,
  runPSIProtocolTags,
} from '../src/psiCore.mjs';

const serializeMessages = (messages) =>
  [messages.bobTags, messages.aliceBlinded, messages.bobTransformed].map((m) =>
    JSON.stringify(m)
  );

const assertNoPlaintextOnWire = (messages, elements, label) => {
  const payloads = serializeMessages(messages);
  for (const payload of payloads) {
    for (const element of elements) {
      assert.ok(
        !payload.includes(element),
        `${label}: input element "${element}" leaked into wire payload: ${payload.slice(0, 120)}...`
      );
    }
  }
};

// Test 1: overlapping sets
{
  const bobUnits = [
    { x: 100.7, y: 100.2 },
    { x: 200.1, y: 200.9 },
    { x: 450.5, y: 450.5 },
  ];
  const aliceUnits = [
    { x: 150.3, y: 150.3 },
    { x: 450.9, y: 450.1 },
    { x: 200.5, y: 200.5 },
    { x: 350.0, y: 350.0 },
  ];

  const bobElements = convertToFlooredStrings(bobUnits);
  const aliceElements = convertToFlooredStrings(aliceUnits);
  const { intersection, messages } = runPSIProtocolTags(bobElements, aliceElements);

  const found = intersection.map((r) => r.unit).sort();
  assert.deepEqual(found, ['200 200', '450 450'], 'expected intersection {200 200, 450 450}');

  // Intersection indices must point at Alice's own elements.
  for (const r of intersection) {
    assert.equal(aliceElements[r.index], r.unit, 'index must reference Alice input');
  }

  // Every wire entry is a fixed 32-byte (64 hex char) value.
  for (const tag of messages.bobTags.tags) assert.match(tag, /^[0-9a-f]{64}$/);
  for (const p of messages.aliceBlinded.blindedPoints) assert.match(p, /^[0-9a-f]{64}$/);
  for (const p of messages.bobTransformed.transformedPoints) assert.match(p, /^[0-9a-f]{64}$/);

  assertNoPlaintextOnWire(messages, [...bobElements, ...aliceElements], 'overlap test');
  console.log(`PASS: overlap test found ${intersection.length} intersections: ${found.join(', ')}`);
}

// Test 2: disjoint sets
{
  const bobElements = ['1 1', '2 2', '3 3'];
  const aliceElements = ['10 10', '20 20', '30 30', '40 40'];
  const { intersection, messages } = runPSIProtocolTags(bobElements, aliceElements);

  assert.equal(intersection.length, 0, 'disjoint sets must produce empty intersection');
  assertNoPlaintextOnWire(messages, [...bobElements, ...aliceElements], 'disjoint test');
  console.log('PASS: disjoint test found empty intersection');
}

// Test 3: identical sets and duplicate elements
{
  const bobElements = ['5 5', '6 6', '5 5'];
  const aliceElements = ['5 5', '6 6'];
  const { intersection, messages } = runPSIProtocolTags(bobElements, aliceElements);

  const found = intersection.map((r) => r.unit).sort();
  assert.deepEqual(found, ['5 5', '6 6'], 'expected full intersection despite duplicates');
  assertNoPlaintextOnWire(messages, [...bobElements, ...aliceElements], 'duplicate test');
  console.log('PASS: duplicate/identical test found full intersection');
}

console.log('All PSI self-tests passed.');
