
import elliptic from 'elliptic';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { hash, load } from 'blake3';
import BN from 'bn.js'; // BigNumbers

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

// use Blake3 for fast generation for PRNG
// -- uses Wasm so need to do async await, but doing the load once in main function
// const deriveRandomValues = async (numValues, randomValue) => {
const deriveRandomValues = (numValues, randomValue) => {
  const randomValues = [];
  let currentValue = randomValue;

      for (let i = 0; i < numValues; i++) {
        currentValue = hash(currentValue); //.toString('hex');  // Hash the current value using Blake3
        const rValueBN = new BN(currentValue);
        randomValues.push(rValueBN);  // Store as random value
        // console.log("LATEST currentValue", currentValue);
      }
  //  console.log("LATEST randomValues array", randomValues);
  return randomValues;
};


const PSIProtocol = async (bobUnits, aliceUnits,  setBobValues, setAliceValues, setAliceRandomValues, setResults) => {

  // Function is async as the Blake3 hashing function is async
  // it uses Wasm, which needs to be loaded before use
  await load();

  console.log("1. Starting PSI Protocol");


  // Bob's initial setup ##################
  const bobPrivateKey = ec.genKeyPair().getPrivate();
  // console.log("bobPrivateKey", bobPrivateKey);

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


  console.log("2. Alice set up");
  // Alice's initial setup ##################
  // Generate a separate array for Alice's floored string positions for PSI
  const aliceUnitsFlooredStrings = convertToFlooredStrings(aliceUnits);
  // console.log('aliceUnitsFlooredStrings: ', aliceUnitsFlooredStrings);

  // generate rValues
  // New approach to generating R values --- Generate one random value then use Black3 to make more RVs
  const randomValue = ec.genKeyPair().getPrivate(); //.toString('hex'); // .toArrayLike(Uint8Array);  //  .toArrayLike(Buffer)
  // console.log(" - > randomValue : ", randomValue);

  const aliceRandomValues = deriveRandomValues(aliceUnitsFlooredStrings.length, randomValue); // uses Blake3
  // console.log("ARRAY of random values. should match above. :", test_aliceRandomValues);
 //  setAliceRandomValues(aliceRandomValues);  // Update the state with Alice's random values

  // generate rValues
  // generate random values at all of Alice's positions (all are EC private keys).
  // this works, but seems inefficient
  // const aliceRandomValues = aliceUnitsFlooredStrings.map(() => ec.genKeyPair().getPrivate());
  //setAliceRandomValues(aliceRandomValues); // Update the state with Alice's random values
  // console.log("aliceRandomValues [ARRAY]:", aliceRandomValues);


  console.log("3. Pretend Alice sends values to Bob");

  // Alice sends x_v = H1(v)^r to Bob
  const aliceSentValues = aliceUnitsFlooredStrings.map((unit, index) => {
    const x_v = hashToGroup(unit).mul(aliceRandomValues[index]); // x_v = H1(v)^r
    // console.log("unit", unit, "and",  hashToGroup(unit));
    // console.log("aliceRandomValues[index]", aliceRandomValues[index]);
    // console.log("x_v", x_v);
    return { unit, x_v };
  });
  setAliceValues(aliceSentValues); // duplicate / redundant ??

  // Bob receives and computes y_v = (x_v)^k = H1(v)^(r * k)
  const bobSentValues = aliceSentValues.map(({ unit, x_v }) => {
    const y_v = x_v.mul(bobPrivateKey); // y_v = (x_v)^k = H1(v)^(r*k)
    return { unit, y_v };
  });


  console.log("4. Double for loop");
  // Alice receives y_v and computes o_k(v) = y_v^(r^-1)
  const decryptedUnits = [];
  const usedKeys = new Set(); // Keep track of which keys have been used successfully

  // Staring for loop
  console.log("4.1 For start");
  bobSentValues.forEach(({ unit: bobUnit, y_v }) => {
    aliceRandomValues.forEach((rValue, index) => {
      const rInv = rValue.invm(ec.curve.n); // Compute r^-1 mod n
      const o_k_v = y_v.mul(rInv); // o_k(v) = y_v^r^-1
      const k_v = H2(o_k_v); // k_v = H2(o_k(v))

      // If this key was already used successfully, skip it
      if (usedKeys.has(naclUtil.encodeBase64(k_v))) {
        return;
      }

      // console.log("4.2 Second For loop");
      // Decryption
      // Try to decrypt all Bob's encrypted units with k_v
      for (const { ciphertext, nonce } of bobEncryptedUnits) {
        const decryptedUnit = decryptWithChaCha20(k_v, ciphertext, nonce);
        if (decryptedUnit) { // if decryption is successful then this value is not zero / null / falsy
          decryptedUnits.push({ unit: decryptedUnit, k_v });
          usedKeys.add(naclUtil.encodeBase64(k_v)); // Mark the key as used
          break; // Exit the loop early since the decryption succeeded
        }
      }
    });
  });

  // If setResults is a function, call it, otherwise assume it's setState
  if (typeof setResults === 'function') {
    setResults(decryptedUnits);
  } else {
    // Fallback to traditional setState behavior
    setResults(decryptedUnits);
  }
  
  console.log('5. finishing PSI calculation');
  console.log(`Found ${decryptedUnits.length} intersections`);
  console.log('decrypted units: ', decryptedUnits);
  return decryptedUnits;
};

export default PSIProtocol;