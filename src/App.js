// v 1.2

import React, { useState } from 'react';
import elliptic from 'elliptic';
import CryptoJS from 'crypto-js';

const EC = elliptic.ec;
const ec = new EC('p256');

// Define the hash function H1 (for simplicity, we are using SHA-256)
const hashToGroup = (message) => {
  const hash = CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);
  return ec.keyFromPrivate(hash).getPublic();
};

// Define the H2 function (hashes elliptic curve point to fixed-size key)
const H2 = (point) => {
  const pointBytes = point.encode('hex');
  const hash = CryptoJS.SHA256(pointBytes).toString(CryptoJS.enc.Hex);
  return hash; // H2: hash of the elliptic curve point
};

const psiProtocol = (setBobValues, setAliceValues, setAliceRandomValues, setResults) => {
  // Bob's setup
  const bobPrivateKey = ec.genKeyPair().getPrivate();
  const bobUnits = ['u1', 'u2', 'u3', 'u4', 'u5']; // Bob's units
  const bobKeys = bobUnits.map(unit => {
    const o_k = hashToGroup(unit).mul(bobPrivateKey); // H1(unit)^k
    const k_u = H2(o_k); // k_u = H2(o_k)
    return { unit, k_u, o_k };
  });
  setBobValues(bobKeys);

  // Alice's setup
  const aliceUnits = ['v1', 'v2', 'u3', 'v4', 'v5']; // Alice's units
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
  const decryptedUnits = bobSentValues.map(({ unit, y_v }, index) => {
    const rInv = aliceRandomValues[index].invm(ec.curve.n); // Compute r^-1 mod n
    const o_k_v = y_v.mul(rInv); // o_k(v) = y_v^r^-1
    const k_v = H2(o_k_v); // k_v = H2(o_k(v))

    // Check if o_k(v) matches one of Bob's units
    // WARNING: Alice doesn't actually have access to bobKeys. This is only done here for demo purposes.
    // In a real protocol run she would decrypt the ciphertexts with the keys and check what is revealed.
    const matchingBobUnit = bobKeys.find(({ k_u }) => k_u === k_v);
    return matchingBobUnit ? { unit: aliceUnits[index], k_v } : null;
  }).filter(Boolean);

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
        <h2>Bob's Computed Values</h2>
        <ul>
          {bobValues.map(({ unit, k_u, o_k }, index) => (
            <li key={index}>
              <strong>Unit:</strong> {unit}<br />
              <strong>o_k:</strong> {o_k.encode('hex')}<br />
              <strong>k_u (H2):</strong> {k_u}
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
                <strong>Alice: k_v (H2):</strong> {k_v}

              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;

//                 <strong>Bob: k_u (H2) :</strong> {k_u}