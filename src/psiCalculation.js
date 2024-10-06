
import elliptic from 'elliptic';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { hash, load } from 'blake3';

const EC = elliptic.ec;
const ec = new EC('p256'); // not ideal, but was fine for initial tests

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
  const nonce = nacl.randomBytes(24); // Generate a random 24-byte nonce (fix from 12-byte)
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
    convertToPositionString(bobUnit.x, bobUnit.y) // Return the string directly
  );
};

// Floor positions (Reals -> Integers)
const convertToPositionString = (x, y) => {
  return `${Math.floor(x)} ${Math.floor(y)}`;
};

// function for pulling IDs out
const getIdArray = (units) => {
  return units.map(unit => unit.id);
};

// function for pulling positions out
const getPositionArray = (units) => {
  return units.map(unit => ({ x: unit.x, y: unit.y }));
};

// use Blake3 for fast generation for PRNG
// declare async so we can await for the Wasm to load
// TODO: this is a future upgrade. Not yet finished.
const deriveRandomValues = async (numValues, randomValue) => {
    // Load Blake3 Wasm before using any hash functions
  await load();

  const randomValues = [];
  let currentValue = randomValue;

  console.log("numValues", numValues);
  console.log("currentValue", currentValue);

  for (let i = 0; i < numValues; i++) {
    currentValue = hash(currentValue);  // Hash the current value using Blake3
    randomValues.push(currentValue);  // Store as random value
  }

  console.log(randomValue);

  return randomValues;
};


const PSIProtocol = async (bobUnits, aliceUnits,  setBobValues, setAliceValues, setAliceRandomValues, setResults) => {
  // must be async as the hashing function is async

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
  setBobValues(bobEncryptedUnits);

  // Alice's initial setup
  // Generate a separate array for Alice's floored string positions for PSI
  const aliceUnitsFlooredStrings = convertToFlooredStrings(aliceUnits);
  // console.log('aliceUnitsFlooredStrings: ', aliceUnitsFlooredStrings);


  // generate random values at all of Alice's positions (all are EC private keys).
  // inefficient
  const aliceRandomValues = aliceUnitsFlooredStrings.map(() => ec.genKeyPair().getPrivate());
  setAliceRandomValues(aliceRandomValues); // Update the state with Alice's random values // -- duplicate/ redundant



  // Alice sends x_v = H1(v)^r to Bob
  const aliceSentValues = aliceUnitsFlooredStrings.map((unit, index) => {
    const x_v = hashToGroup(unit).mul(aliceRandomValues[index]); // x_v = H1(v)^r
    return { unit, x_v };
  });
  setAliceValues(aliceSentValues); // duplicate / redundant ??

  // Bob receives and computes y_v = (x_v)^k = H1(v)^(r * k)
  const bobSentValues = aliceSentValues.map(({ unit, x_v }) => {
    const y_v = x_v.mul(bobPrivateKey); // y_v = (x_v)^k = H1(v)^(r*k)
    return { unit, y_v };
  });

  // Alice receives y_v and computes o_k(v) = y_v^(r^-1)
  const decryptedUnits = [];
  const usedKeys = new Set(); // Keep track of which keys have been used successfully

  bobSentValues.forEach(({ unit: bobUnit, y_v }) => {
    aliceRandomValues.forEach((rValue, index) => {
      const rInv = rValue.invm(ec.curve.n); // Compute r^-1 mod n
      const o_k_v = y_v.mul(rInv); // o_k(v) = y_v^r^-1
      const k_v = H2(o_k_v); // k_v = H2(o_k(v))

      // If this key was already used successfully, skip it
      if (usedKeys.has(naclUtil.encodeBase64(k_v))) {
        return;
      }

      // Try to decrypt all Bob's encrypted units with k_v
      for (const { unit: encryptedUnit, ciphertext, nonce } of bobEncryptedUnits) {
        const decryptedUnit = decryptWithChaCha20(k_v, ciphertext, nonce);
        if (decryptedUnit) { // if decryption is successful then this value is not zero / null / falsy
          decryptedUnits.push({ unit: decryptedUnit, k_v });
          usedKeys.add(naclUtil.encodeBase64(k_v)); // Mark the key as used
          break; // Exit the loop early since the decryption succeeded
        }
      }
    });
  });

  setResults(decryptedUnits);
  console.log('finishing PSI calculation')
  console.log('decrypted units: ', decryptedUnits);
  return (decryptedUnits);
};

export default PSIProtocol;