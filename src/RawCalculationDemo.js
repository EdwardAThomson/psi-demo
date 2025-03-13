import React, { useState } from 'react';
import PSIProtocol from "./psiCalculation";

const RawCalculationDemo = () => {
  // Static positions from your old App.js
  const bobUnits = [
    { id: 'u1', x: 100, y: 100 },
    { id: 'u2', x: 200, y: 200 },
    { id: 'u3', x: 450, y: 450 },
  ];

  const aliceUnits = [
    { id: 'u1', x: 150, y: 150 },
    { id: 'u2', x: 250, y: 250 },
    { id: 'u3', x: 350, y: 350 },
    { id: 'u4', x: 450, y: 450 },
    { id: 'u5', x: 451, y: 450 },
    { id: 'u6', x: 452, y: 450 },
    { id: 'u7', x: 453, y: 450 },
    { id: 'u8', x: 454, y: 450 },
    { id: 'u9', x: 455, y: 450 },
  ];

  const [bobValues, setBobValues] = useState([]);
  const [aliceValues, setAliceValues] = useState([]);
  const [aliceRandomValues, setAliceRandomValues] = useState([]);
  const [results, setResults] = useState([]);
  const [calculationTime, setCalculationTime] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const runPSIProtocol = () => {
    console.log('Starting PSI Protocol - Raw Calculation Demo');
    setIsCalculating(true);
    
    // Track performance
    const startTime = performance.now();
    
    // Run the PSI protocol
    PSIProtocol(bobUnits, aliceUnits, setBobValues, setAliceValues, setAliceRandomValues, (results) => {
      setResults(results);
      const endTime = performance.now();
      setCalculationTime(endTime - startTime);
      setIsCalculating(false);
    });
  };

  // Helper function to format encrypted values
  const formatEncryptedValue = (value) => {
    if (typeof value === 'string') {
      // For strings, show first few and last few characters
      if (value.length > 20) {
        return `${value.substring(0, 10)}...${value.substring(value.length - 5)}`;
      }
      return value;
    } else if (value && typeof value === 'object') {
      // For objects, show a simplified representation
      return "Encrypted data";
    } else {
      return String(value);
    }
  };

  return (
    <div className="raw-calculation-container" style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <h1 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        Original PSI Calculation Demo
      </h1>
      
      <p style={{ fontSize: '16px', lineHeight: '1.5', color: '#555' }}>
        This demo shows the original implementation of the PSI protocol with static unit positions.
        Click the button below to run the calculation and see the results.
      </p>
      
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <button 
          onClick={runPSIProtocol} 
          disabled={isCalculating}
          style={{ 
            padding: '12px 24px', 
            backgroundColor: isCalculating ? '#95a5a6' : '#3498db', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isCalculating ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            transition: 'background-color 0.3s'
          }}
        >
          {isCalculating ? 'Calculating...' : 'Run PSI Protocol'}
        </button>
        
        {calculationTime && (
          <p style={{ marginTop: '10px', color: '#27ae60', fontWeight: 'bold' }}>
            Calculation completed in {calculationTime.toFixed(2)} ms
          </p>
        )}
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px',
        backgroundColor: '#f9f9f9',
        padding: '20px',
        borderRadius: '8px'
      }}>
        <div>
          <h2 style={{ color: '#2980b9', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
            Bob's Units
          </h2>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {bobUnits.map(unit => (
              <li key={unit.id} style={{ 
                padding: '8px 0', 
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: 'bold', color: '#34495e' }}>{unit.id}:</span>
                <span>({unit.x}, {unit.y})</span>
              </li>
            ))}
          </ul>
          
          <h3 style={{ color: '#2980b9', marginTop: '20px' }}>Encrypted Values</h3>
          {bobValues.length > 0 ? (
            <div style={{ 
              backgroundColor: '#eef2f7', 
              padding: '10px', 
              borderRadius: '4px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <p style={{ margin: '0 0 10px 0', fontStyle: 'italic', color: '#7f8c8d' }}>
                {bobValues.length} values encrypted
              </p>
              {bobValues.slice(0, 5).map((value, index) => (
                <div key={index} style={{ 
                  padding: '8px', 
                  backgroundColor: '#fff', 
                  marginBottom: '5px',
                  borderRadius: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {formatEncryptedValue(value)}
                </div>
              ))}
              {bobValues.length > 5 && (
                <p style={{ textAlign: 'center', color: '#7f8c8d', margin: '10px 0 0 0' }}>
                  ...and {bobValues.length - 5} more
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>
              No encrypted values yet. Click "Run PSI Protocol".
            </p>
          )}
        </div>
        
        <div>
          <h2 style={{ color: '#27ae60', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
            Alice's Units
          </h2>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {aliceUnits.map(unit => (
              <li key={unit.id} style={{ 
                padding: '8px 0', 
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: 'bold', color: '#34495e' }}>{unit.id}:</span>
                <span>({unit.x}, {unit.y})</span>
              </li>
            ))}
          </ul>
          
          <h3 style={{ color: '#27ae60', marginTop: '20px' }}>Encrypted Values</h3>
          {aliceValues.length > 0 ? (
            <div style={{ 
              backgroundColor: '#eef7ee', 
              padding: '10px', 
              borderRadius: '4px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <p style={{ margin: '0 0 10px 0', fontStyle: 'italic', color: '#7f8c8d' }}>
                {aliceValues.length} values encrypted
              </p>
              {aliceValues.slice(0, 5).map((value, index) => (
                <div key={index} style={{ 
                  padding: '8px', 
                  backgroundColor: '#fff', 
                  marginBottom: '5px',
                  borderRadius: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {formatEncryptedValue(value)}
                </div>
              ))}
              {aliceValues.length > 5 && (
                <p style={{ textAlign: 'center', color: '#7f8c8d', margin: '10px 0 0 0' }}>
                  ...and {aliceValues.length - 5} more
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>
              No encrypted values yet. Click "Run PSI Protocol".
            </p>
          )}
        </div>
      </div>
      
      <div style={{ 
        marginTop: '30px', 
        backgroundColor: '#f0f7fc', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ color: '#e74c3c', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
          PSI Results
        </h2>
        {results.length > 0 ? (
          <div>
            <p style={{ fontSize: '16px', color: '#2c3e50' }}>
              Found <strong>{results.length}</strong> intersections:
            </p>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '10px',
              marginTop: '15px'
            }}>
              {results.map((result, index) => (
                <div key={index} style={{ 
                  padding: '10px', 
                  backgroundColor: '#fff', 
                  borderRadius: '4px',
                  border: '1px solid #e74c3c',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#e74c3c'
                }}>
                  {result.unit}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {isCalculating ? (
              <p style={{ color: '#7f8c8d' }}>Calculating intersections...</p>
            ) : (
              <p style={{ color: '#7f8c8d' }}>No results yet. Click "Run PSI Protocol".</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RawCalculationDemo; 