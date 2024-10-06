import React from 'react';
import naclUtil from 'tweetnacl-util';

function HomePage({ runPSIProtocol, bobValues, aliceValues, aliceRandomValues, results }) {
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
              <strong>Random Value for Unit {index + 1}:</strong> {rValue.toString()}
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

export default HomePage;

