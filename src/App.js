import React, { useState, useEffect } from 'react';

import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import PSIVisualization from './PSIVisualization';
import HomePage from "./HomePage";

import PSIProtocol from "./psiCalculation";


  // static positions for the home page test
  const bobUnits = [
    { id: 'u1', x: 100, y: 100 },
    { id: 'u2', x: 200, y: 200 },
    { id: 'u3', x: 450, y: 350 },
  ];

  const aliceUnits = [
    { id: 'u1', x: 150, y: 150 },
    { id: 'u2', x: 250, y: 250 },
    { id: 'u3', x: 450, y: 350 },
  ];


function App() {
  const [bobValues, setBobValues] = useState([]);
  const [aliceValues, setAliceValues] = useState([]);
  const [aliceRandomValues, setAliceRandomValues] = useState([]); // Track Alice's random values
  const [results, setResults] = useState([]);



    const runPSIProtocol = () => {
    console.log('start PSI Protocol -- App.js');

    // setResults is the array of decrypted Units
    PSIProtocol(bobUnits, aliceUnits, setBobValues, setAliceValues, setAliceRandomValues, setResults);
  };


/*  --- future upgrade
    const runPSIProtocol = async () => {
      // Call the PSIProtocol function and await it
      await PSIProtocol(bobUnits, aliceUnits, setBobValues, setAliceValues, setAliceRandomValues, setResults);
    };

  useEffect(() => {
    // Run the async function
    runPSIProtocol();
  }, [bobUnits, aliceUnits]);  // Make sure the useEffect re-runs when bobUnits or aliceUnits change
*/

  return (
     <Router>
      <div className="App">
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/visualization">PSI Visualization</Link>
            </li>
          </ul>
        </nav>

        <Routes>
              <Route path="/" element={<HomePage
                  runPSIProtocol={runPSIProtocol}  // Now it's consistent
                  bobValues={bobValues}
                  aliceValues={aliceValues}
                  aliceRandomValues={aliceRandomValues}
                  results={results}

          />} /> {/* Render the home page */}
          <Route path="/visualization" element={<PSIVisualization />} />

        </Routes>
      </div>
    </Router>

  );
}

export default App;
