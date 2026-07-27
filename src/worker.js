// Web worker for PSI calculations.
/* eslint-disable no-restricted-globals */

// The protocol core (ristretto255 hash-to-group, BLAKE3 membership tags,
// no plaintext elements on the wire) is shared with the main thread.
import {
  convertToFlooredStrings,
  bobCreateTagMessage,
  aliceBlindElements,
  bobTransformBlindedPoints,
  aliceFinalizeIntersection,
} from './psiCore.mjs';

// Main PSI function
const runPSIProtocol = (data) => {
  const { bobUnits, aliceUnits } = data;

  const startTime = performance.now();

  console.log(`[Worker] Starting PSI calculation with ${bobUnits.length} Bob units and ${aliceUnits.length} Alice units`);

  // Phase 1: Bob derives a key per element and sends one-way membership tags.
  const bobElements = convertToFlooredStrings(bobUnits);
  const bob = bobCreateTagMessage(bobElements);

  const phase1Time = performance.now();
  console.log(`[Worker] Bob's tag setup completed in ${phase1Time - startTime}ms`);

  // Phase 2: Alice blinds her elements with independent random scalars.
  // Phase 3: Bob multiplies each blinded point by his private scalar.
  const aliceElements = convertToFlooredStrings(aliceUnits);
  const alice = aliceBlindElements(aliceElements);
  const bobResponse = bobTransformBlindedPoints(alice.message, bob.state);

  const phase2Time = performance.now();
  console.log(`[Worker] Blinding and transformation completed in ${phase2Time - phase1Time}ms`);

  // Phase 4: Alice unblinds, recomputes tags, and checks membership.
  // O(|Alice|) hash lookups; no trial decryption.
  const intersection = aliceFinalizeIntersection(bob.message, bobResponse.message, alice.state);

  const phase3Time = performance.now();
  const totalTime = phase3Time - startTime;

  console.log(`[Worker] Intersection calculation completed in ${phase3Time - phase2Time}ms`);
  console.log(`[Worker] Total PSI time: ${totalTime}ms`);
  console.log(`[Worker] Found ${intersection.length} intersections from ${aliceElements.length} tag checks`);

  return {
    results: intersection,
    // Exact wire payloads (fixed 32-byte hex values only), for display.
    bobValues: bob.message.tags.map((tag) => ({ tag })),
    aliceValues: alice.message.blindedPoints.map((blindedPoint, i) => ({
      blindedPoint,
      transformedPoint: bobResponse.message.transformedPoints[i],
    })),
    performance: {
      totalTime,
      bobSetupTime: phase1Time - startTime,
      keyExchangeTime: phase2Time - phase1Time,
      intersectionTime: phase3Time - phase2Time,
      inverseOperations: aliceElements.length,
      tagChecks: aliceElements.length,
      tagMatches: intersection.length,
    },
  };
};

// Set up message handler
self.onmessage = (e) => {
  try {
    const result = runPSIProtocol(e.data);
    self.postMessage({
      type: 'success',
      ...result,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message || 'An error occurred during PSI calculation',
    });
  }
};

/* eslint-enable no-restricted-globals */
