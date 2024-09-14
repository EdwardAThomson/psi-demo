import React, { useState } from 'react';
import elliptic from 'elliptic';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

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

const psiProtocol = (setBobValues, setAliceValues, setAliceRandomValues, setResults) => {
  // Bob's setup
  const bobPrivateKey = ec.genKeyPair().getPrivate();
  const bobUnits = ['u1', 'u2', 'u3','u4','u5']; // Bob's unit positions
  const bobEncryptedUnits = bobUnits.map(unit => {
    const o_k = hashToGroup(unit).mul(bobPrivateKey); // H1(unit)^k
    const k_u = H2(o_k); // k_u = H2(o_k)

    // Encrypt the unit position using ChaCha20
    const { ciphertext, nonce } = encryptWithChaCha20(k_u, unit);
    return { unit, k_u, o_k, ciphertext, nonce }; // Store the ciphertext and nonce
  });
  setBobValues(bobEncryptedUnits);

  // Alice's setup
  const aliceUnits = ['v1', 'v2', 'u3','v4','u5']; // Alice's units
  const aliceRandomValues = aliceUnits.map(() => ec.genKeyPair().getPrivate());
  setAliceRandomValues(aliceRandomValues); // Update the state with Alice's random values

  // Alice sends x_v = H1(v)^r to Bob
  const aliceSentValues = aliceUnits.map((unit, index) => {
    const x_v = hashToGroup(unit).mul(aliceRandomValues[index]); // x_v = H1(v)^r
    return { unit, x_v };
  });
  setAliceValues(aliceSentValues);

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
};

function App() {
  const [bobValues, setBobValues] = useState([]);
  const [aliceValues, setAliceValues] = useState([]);
  const [aliceRandomValues, setAliceRandomValues] = useState([]); // Track Alice's random values
  const [results, setResults] = useState([]);

  const runPSIProtocol = () => {
    psiProtocol(setBobValues, setAliceValues, setAliceRandomValues, setResults);
  };

  return (
    <div className="App">
      <h1>PSI Protocol Demo</h1>
      <button onClick={runPSIProtocol}>Run PSI Protocol</button>

      <div>
        <h2>Bob's Computed Values and Encrypted Units</h2>
        <ul>
          {bobValues.map(({ unit, k_u, o_k, ciphertext, nonce }, index) => (
            <li key={index}>
              <strong>Unit:</strong> {unit}<br />
              <strong>o_k:</strong> {o_k.encode('hex')}<br />
              <strong>k_u (H2):</strong> {naclUtil.encodeBase64(k_u)}<br />
              <strong>Ciphertext:</strong> {ciphertext}<br />
              <strong>Nonce:</strong> {nonce}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2>Alice's Sent Values (x_v)</h2>
        <ul>
          {aliceValues.map(({ unit, x_v }, index) => (
            <li key={index}>
              <strong>Unit:</strong> {unit}<br />
              <strong>x_v:</strong> {x_v.encode('hex')}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2>Alice's Random Values (r)</h2>
        <ul>
          {aliceRandomValues.map((rValue, index) => (
            <li key={index}>
              <strong>Random Value for Unit {index + 1}:</strong> {rValue.toString(16)}
            </li>
          ))}
        </ul>
      </div>

      {results.length > 0 && (
        <div>
          <h2>Decrypted Units (Intersection with k_v)</h2>
          <ul>
            {results.map(({ unit, k_v }, index) => (
              <li key={index}>
                <strong>Decrypted Unit:</strong> {unit}<br />
                <strong>k_v (H2):</strong> {naclUtil.encodeBase64(k_v)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
