// Main-thread PSI entry point for the React demos.
//
// The protocol itself lives in psiCore.mjs (ristretto255 hash-to-group with
// unknown discrete log, BLAKE3 membership tags, no plaintext elements on the
// wire). This wrapper adapts unit objects ({x, y}) to element strings and
// feeds the wire payloads to the UI state setters so the demos can display
// exactly what travels between the parties.

import {
  convertToFlooredStrings,
  runPSIProtocolTags,
} from './psiCore.mjs';

const PSIProtocol = async (bobUnits, aliceUnits, setBobValues, setAliceValues, setAliceRandomValues, setResults) => {
  console.log('1. Starting PSI protocol (tag mode)');

  const bobElements = convertToFlooredStrings(bobUnits);
  const aliceElements = convertToFlooredStrings(aliceUnits);

  const { intersection, messages } = runPSIProtocolTags(bobElements, aliceElements);

  // What Bob sends: one fixed 32-byte membership tag per element.
  setBobValues(messages.bobTags.tags.map((tag) => ({ tag })));

  // What Alice sends and what Bob returns: blinded and transformed points,
  // correlated by index. No plaintext elements appear in either direction.
  setAliceValues(
    messages.aliceBlinded.blindedPoints.map((blindedPoint, i) => ({
      blindedPoint,
      transformedPoint: messages.bobTransformed.transformedPoints[i],
    }))
  );

  setResults(intersection);

  console.log(`2. PSI complete, found ${intersection.length} intersections`);
  return intersection;
};

export default PSIProtocol;
