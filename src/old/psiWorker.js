// PSI Worker - Runs PSI calculations in a separate thread

// Import all necessary dependencies
import elliptic from 'elliptic';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { hash, load } from 'blake3';
import BN from 'bn.js';

const EC = elliptic.ec;
const ec = new EC('p256');

// Define the hash function H1 (for simplicity, we are using SHA-256)
const hashToGroup = (message) => {
  const hash = naclUtil.decodeUTF8(message);
  return ec.keyFromPrivate(nacl.hash(hash).slice(0, 32)).getPublic();
};

// Define the H2 function (hashes elliptic curve point to fixed-size key)
const H2 = (point) => {
  const pointBytes = point.encode('hex');
  const key = nacl.hash(naclUtil.decodeUTF8(pointBytes)).slice(0, 32); // Get a 32-byte key
  return key;
};

// ChaCha20-Poly1305 encryption function using TweetNaCl
const encryptWithChaCha20 = (key, message) => {
  const nonce = nacl.randomBytes(24); // Generate a random 24-byte nonce
  const keyUint8 = new Uint8Array(key);
  const messageUint8 = naclUtil.decodeUTF8(message);
  const ciphertext = nacl.secretbox(messageUint8, nonce, keyUint8);
  return { ciphertext: naclUtil.encodeBase64(ciphertext), nonce: naclUtil.encodeBase64(nonce) };
};

// ChaCha20-Poly1305 decryption function using TweetNaCl
const decryptWithChaCha20 = (key, ciphertext, nonce) => {
  const keyUint8 = new Uint8Array(key);
  const ciphertextUint8 = naclUtil.decodeBase64(ciphertext);
  const nonceUint8 = naclUtil.decodeBase64(nonce);
  const decrypted = nacl.secretbox.open(ciphertextUint8, nonceUint8, keyUint8);
  return decrypted ? naclUtil.encodeUTF8(decrypted) : null;
};

const convertToFlooredStrings = (bobUnits) => {
  return bobUnits.map(bobUnit =>
    convertToPositionString(bobUnit.x, bobUnit.y)
  );
};

// Floor positions (Reals -> Integers)
const convertToPositionString = (x, y) => {
  return `${Math.floor(x)} ${Math.floor(y)}`;
};

// Use Blake3 for fast generation for PRNG
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
  
  console.log("Worker: Starting PSI Protocol");
  
  // Initialize Blake3
  await load();
  
  // Bob's initial setup
  const bobPrivateKey = ec.genKeyPair().getPrivate();
  
  // Generate a separate array for Bob's floored string positions for PSI
  const bobUnitsFlooredStrings = convertToFlooredStrings(bobUnits);
  
  const bobEncryptedUnits = bobUnitsFlooredStrings.map(unit => {
    const o_k = hashToGroup(unit).mul(bobPrivateKey); // H1(unit)^k
    const k_u = H2(o_k); // k_u = H2(o_k)
    
    // Encrypt the unit position using ChaCha20
    const { ciphertext, nonce } = encryptWithChaCha20(k_u, unit);
    return { unit, k_u, o_k, ciphertext, nonce }; // Store the ciphertext and nonce
  });
  
  // Alice's initial setup
  const aliceUnitsFlooredStrings = convertToFlooredStrings(aliceUnits);
  
  // Generate one random value then use Blake3 to make more RVs
  const randomValue = ec.genKeyPair().getPrivate();
  const aliceRandomValues = deriveRandomValues(aliceUnitsFlooredStrings.length, randomValue);
  
  // Alice sends x_v = H1(v)^r to Bob
  const aliceSentValues = aliceUnitsFlooredStrings.map((unit, index) => {
    const x_v = hashToGroup(unit).mul(aliceRandomValues[index]); // x_v = H1(v)^r
    return { unit, x_v };
  });
  
  // Bob receives and computes y_v = (x_v)^k = H1(v)^(r * k)
  const bobSentValues = aliceSentValues.map(({ unit, x_v }) => {
    const y_v = x_v.mul(bobPrivateKey); // y_v = (x_v)^k = H1(v)^(r*k)
    return { unit, y_v };
  });
  
  // Alice receives y_v and computes o_k(v) = y_v^(r^-1)
  const decryptedUnits = [];
  const usedKeys = new Set(); // Keep track of which keys have been used successfully
  
  console.log("Worker: Starting nested for loop calculations");
  let loopCounter = 0;
  
  bobSentValues.forEach(({ unit: bobUnit, y_v }) => {
    aliceRandomValues.forEach((rValue, index) => {
      loopCounter++;
      
      const rInv = rValue.invm(ec.curve.n); // Compute r^-1 mod n
      const o_k_v = y_v.mul(rInv); // o_k(v) = y_v^r^-1
      const k_v = H2(o_k_v); // k_v = H2(o_k(v))
      
      // If this key was already used successfully, skip it
      if (usedKeys.has(naclUtil.encodeBase64(k_v))) {
        return;
      }
      
      // Decryption - Try to decrypt all Bob's encrypted units with k_v
      for (const { unit: encryptedUnit, ciphertext, nonce } of bobEncryptedUnits) {
        const decryptedUnit = decryptWithChaCha20(k_v, ciphertext, nonce);
        if (decryptedUnit) { // if decryption is successful
          decryptedUnits.push({ unit: decryptedUnit, k_v });
          usedKeys.add(naclUtil.encodeBase64(k_v)); // Mark the key as used
          break; // Exit the loop early since the decryption succeeded
        }
      }
    });
  });
  
  console.log(`Worker: Finished PSI calculation - ${loopCounter} loop iterations`);
  console.log(`Worker: Found ${decryptedUnits.length} intersections`);
  
  // Send results back to the main thread
  return {
    results: decryptedUnits,
    bobValues: bobEncryptedUnits,
    aliceValues: aliceSentValues
  };
};

// Set up the worker message handler
/* eslint-disable no-restricted-globals */
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