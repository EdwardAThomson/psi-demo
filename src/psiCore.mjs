// PSI protocol core (ristretto255 + BLAKE3 membership tags).
//
// Shared by the main-thread demo (psiCalculation.js), the web worker
// (worker.js), and the node self-test (scripts/psi_selftest.mjs).
//
// This mirrors the C++ implementation in EdwardAThomson/Private-Set-Intersection:
//   H1: element bytes -> SHA-512 (64 uniform bytes) -> ristretto255 element
//       derivation (RFC 9496, the same construction as libsodium's
//       crypto_core_ristretto255_from_hash). The resulting point has an
//       UNKNOWN discrete log relative to the base point. Do not "simplify"
//       this back to H(x)*G: with a known discrete log, one protocol run
//       lets a participant recover b*G and enumerate the other party's set
//       offline (see the C++ repo's docs/security_hardening.md).
//   H2: first 32 bytes of SHA-512 over the 32-byte canonical point encoding.
//   Tag: BLAKE3 in derive-key mode, context "PSI-membership-tag-v1", over the
//        32-byte H2 key.
//
// Wire privacy: no message between the parties contains any input element in
// the clear. Messages carry only fixed-size 32-byte values (hex encoded):
// membership tags, blinded points, and transformed points. Correlation
// between Alice's blinded points and Bob's transformed replies is by index.

import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { blake3 } from '@noble/hashes/blake3.js';
import { randomBytes, bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { bytesToNumberBE } from '@noble/curves/utils.js';

const Point = ristretto255.Point;
const Fn = Point.Fn; // scalar field mod the ristretto255 group order

export const MEMBERSHIP_TAG_CONTEXT = 'PSI-membership-tag-v1';
const TAG_CONTEXT_BYTES = utf8ToBytes(MEMBERSHIP_TAG_CONTEXT);

// H1: hash an element to a ristretto255 group element with unknown discrete log.
export const hashToGroup = (element) =>
  ristretto255_hasher.deriveToCurve(sha512(utf8ToBytes(element)));

// H2: derive a 32-byte key from the canonical 32-byte point encoding.
export const hashPointToKey = (point) => sha512(point.toBytes()).slice(0, 32);

// One-way membership tag over a derived key. Domain-separated from H2 by
// using a different hash function and a fixed derive-key context.
export const keyToMembershipTag = (key) => blake3(key, { context: TAG_CONTEXT_BYTES });

// Uniform non-zero random scalar mod the group order.
export const randomScalar = () => {
  for (;;) {
    const wide = bytesToNumberBE(randomBytes(64));
    const scalar = Fn.create(wide);
    if (!Fn.is0(scalar)) return scalar;
  }
};

// Grid helpers: floor real coordinates to integer cell strings.
export const convertToPositionString = (x, y) => `${Math.floor(x)} ${Math.floor(y)}`;

export const convertToFlooredStrings = (units) =>
  units.map((unit) => convertToPositionString(unit.x, unit.y));

// Phase 1 (Bob): for each element y, compute K_y = H2(b * H1(y)) and send the
// one-way tag BLAKE3_derive("PSI-membership-tag-v1", K_y). Tags reveal nothing
// about y without solving CDH for b * H1(y).
export const bobCreateTagMessage = (bobElements) => {
  const privateScalar = randomScalar();
  const tags = bobElements.map((element) => {
    const sharedPoint = hashToGroup(element).multiply(privateScalar);
    return bytesToHex(keyToMembershipTag(hashPointToKey(sharedPoint)));
  });
  return {
    state: { privateScalar },
    message: { type: 'bob-tags', tags },
  };
};

// Phase 2 (Alice): blind each element with an independent random scalar r_i
// and send x_i = r_i * H1(v_i). Bob cannot invert the blinding.
export const aliceBlindElements = (aliceElements) => {
  const randomScalars = aliceElements.map(() => randomScalar());
  const blindedPoints = aliceElements.map((element, i) =>
    bytesToHex(hashToGroup(element).multiply(randomScalars[i]).toBytes())
  );
  return {
    state: { randomScalars, elements: aliceElements.slice() },
    message: { type: 'alice-blinded', blindedPoints },
  };
};

// Phase 3 (Bob): multiply each blinded point by his private scalar,
// preserving order so Alice can correlate by index.
export const bobTransformBlindedPoints = (aliceMessage, bobState) => {
  const transformedPoints = aliceMessage.blindedPoints.map((hex) =>
    bytesToHex(Point.fromBytes(hexToBytes(hex)).multiply(bobState.privateScalar).toBytes())
  );
  return { message: { type: 'bob-transformed', transformedPoints } };
};

// Phase 4 (Alice): unblind with the modular inverse of each r_i, recompute the
// key and tag, and check membership in Bob's tag set. A match at index i means
// Alice's OWN element i is in the intersection; she learns nothing about
// Bob's non-matching elements. O(|Alice|) hash lookups, no trial decryption.
export const aliceFinalizeIntersection = (bobTagMessage, bobResponse, aliceState) => {
  const bobTagSet = new Set(bobTagMessage.tags);
  const matchedTags = new Set();
  const intersection = [];

  bobResponse.transformedPoints.forEach((hex, i) => {
    if (i >= aliceState.randomScalars.length || i >= aliceState.elements.length) return;
    const rInverse = Fn.inv(aliceState.randomScalars[i]);
    const sharedPoint = Point.fromBytes(hexToBytes(hex)).multiply(rInverse);
    const key = hashPointToKey(sharedPoint);
    const tag = bytesToHex(keyToMembershipTag(key));

    if (bobTagSet.has(tag) && !matchedTags.has(tag)) {
      matchedTags.add(tag);
      intersection.push({ unit: aliceState.elements[i], index: i, key: bytesToHex(key) });
    }
  });

  return intersection;
};

// Run the full four-phase protocol on element strings. Returns the
// intersection (from Alice's point of view) plus the exact wire payloads.
export const runPSIProtocolTags = (bobElements, aliceElements) => {
  const bob = bobCreateTagMessage(bobElements);
  const alice = aliceBlindElements(aliceElements);
  const bobResponse = bobTransformBlindedPoints(alice.message, bob.state);
  const intersection = aliceFinalizeIntersection(bob.message, bobResponse.message, alice.state);

  return {
    intersection,
    messages: {
      bobTags: bob.message,
      aliceBlinded: alice.message,
      bobTransformed: bobResponse.message,
    },
  };
};
