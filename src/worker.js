// This is a wrapper file to load our worker with the right context
/* eslint-disable no-restricted-globals */

// Import all necessary dependencies first
import elliptic from 'elliptic';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { hash, load } from 'blake3';
import BN from 'bn.js';

// Create EC context
const EC = elliptic.ec;
const ec = new EC('p256');

// Define hashToGroup function
const hashToGroup = (message) => {
  const hash = naclUtil.decodeUTF8(message);
  return ec.keyFromPrivate(nacl.hash(hash).slice(0, 32)).getPublic();
};

// Define H2 function
const H2 = (point) => {
  const pointBytes = point.encode('hex');
  const key = nacl.hash(naclUtil.decodeUTF8(pointBytes)).slice(0, 32); // Get a 32-byte key
  return key;
};

// ChaCha20-Poly1305 encryption function
const encryptWithChaCha20 = (key, message) => {
  const nonce = nacl.randomBytes(24); 
  const keyUint8 = new Uint8Array(key);
  const messageUint8 = naclUtil.decodeUTF8(message);
  const ciphertext = nacl.secretbox(messageUint8, nonce, keyUint8);
  return { ciphertext: naclUtil.encodeBase64(ciphertext), nonce: naclUtil.encodeBase64(nonce) };
};

// ChaCha20-Poly1305 decryption function
const decryptWithChaCha20 = (key, ciphertext, nonce) => {
  const keyUint8 = new Uint8Array(key);
  const ciphertextUint8 = naclUtil.decodeBase64(ciphertext);
  const nonceUint8 = naclUtil.decodeBase64(nonce);
  const decrypted = nacl.secretbox.open(ciphertextUint8, nonceUint8, keyUint8);
  return decrypted ? naclUtil.encodeUTF8(decrypted) : null;
};

// Position string conversion
const convertToPositionString = (x, y) => `${Math.floor(x)} ${Math.floor(y)}`;

const convertToFlooredStrings = (units) => 
  units.map(unit => convertToPositionString(unit.x, unit.y));

// PRNG with Blake3
const deriveRandomValues = (numValues, randomValue) => {
  const randomValues = [];
  let currentValue = randomValue;

  for (let i = 0; i < numValues; i++) {
    currentValue = hash(currentValue);
    const rValueBN = new BN(currentValue);
    randomValues.push(rValueBN);
  }
  return randomValues;
};

// Main PSI function
const runPSIProtocol = async (data) => {
  const { bobUnits, aliceUnits } = data;
  
  // Start performance measurement
  const startTime = performance.now();
  let phase1Time, phase2Time, phase3Time;
  
  // Initialize Blake3
  await load();
  
  console.log(`[Worker] Starting PSI calculation with ${bobUnits.length} Bob units and ${aliceUnits.length} Alice units`);
  
  // Bob's setup
  const bobPrivateKey = ec.genKeyPair().getPrivate();
  const bobUnitsFlooredStrings = convertToFlooredStrings(bobUnits);
  
  const bobEncryptedUnits = bobUnitsFlooredStrings.map(unit => {
    const o_k = hashToGroup(unit).mul(bobPrivateKey);
    const k_u = H2(o_k);
    const { ciphertext, nonce } = encryptWithChaCha20(k_u, unit);
    return { unit, k_u, o_k, ciphertext, nonce };
  });
  
  phase1Time = performance.now();
  console.log(`[Worker] Bob's setup completed in ${phase1Time - startTime}ms`);
  
  // Alice's setup
  const aliceUnitsFlooredStrings = convertToFlooredStrings(aliceUnits);
  const randomValue = ec.genKeyPair().getPrivate();
  const aliceRandomValues = deriveRandomValues(aliceUnitsFlooredStrings.length, randomValue);
  
  // Alice sends x_v to Bob
  const aliceSentValues = aliceUnitsFlooredStrings.map((unit, index) => {
    const x_v = hashToGroup(unit).mul(aliceRandomValues[index]);
    return { unit, x_v };
  });
  
  // Bob computes y_v
  const bobSentValues = aliceSentValues.map(({ unit, x_v }) => {
    const y_v = x_v.mul(bobPrivateKey);
    return { unit, y_v };
  });
  
  phase2Time = performance.now();
  console.log(`[Worker] Alice's setup and key exchange completed in ${phase2Time - phase1Time}ms`);
  
  // Alice computes the intersection
  const decryptedUnits = [];
  const usedKeys = new Set();
  
  // Count operations for performance analysis
  let decryptOperations = 0;
  let inverseOperations = 0;
  let successfulDecryptions = 0;
  
  bobSentValues.forEach(({ unit: bobUnit, y_v }) => {
    aliceRandomValues.forEach((rValue, index) => {
      inverseOperations++;
      const rInv = rValue.invm(ec.curve.n);
      const o_k_v = y_v.mul(rInv);
      const k_v = H2(o_k_v);
      
      if (usedKeys.has(naclUtil.encodeBase64(k_v))) return;
      
      for (const { ciphertext, nonce } of bobEncryptedUnits) {
        decryptOperations++;
        const decryptedUnit = decryptWithChaCha20(k_v, ciphertext, nonce);
        if (decryptedUnit) {
          successfulDecryptions++;
          decryptedUnits.push({ unit: decryptedUnit, k_v });
          usedKeys.add(naclUtil.encodeBase64(k_v));
          break;
        }
      }
    });
  });
  
  phase3Time = performance.now();
  
  // Calculate total processing time
  const totalTime = phase3Time - startTime;
  
  console.log(`[Worker] Intersection calculation completed in ${phase3Time - phase2Time}ms`);
  console.log(`[Worker] Total PSI time: ${totalTime}ms`);
  console.log(`[Worker] Performed ${inverseOperations} inverse operations and ${decryptOperations} decryption attempts`);
  console.log(`[Worker] Found ${decryptedUnits.length} intersections with ${successfulDecryptions} successful decryptions`);
  
  return {
    results: decryptedUnits,
    bobValues: bobEncryptedUnits,
    aliceValues: aliceSentValues,
    performance: {
      totalTime,
      bobSetupTime: phase1Time - startTime,
      keyExchangeTime: phase2Time - phase1Time,
      intersectionTime: phase3Time - phase2Time,
      inverseOperations,
      decryptOperations,
      successfulDecryptions
    }
  };
};

// Set up message handler
self.onmessage = async (e) => {
  try {
    const result = await runPSIProtocol(e.data);
    self.postMessage({
      type: 'success',
      ...result
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message || 'An error occurred during PSI calculation'
    });
  }
};

/* eslint-enable no-restricted-globals */