import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Circle, Rect } from 'react-konva';
import { useLocation } from 'react-router-dom';
import { runPSIInWorker } from './workerAdapter';

const WIDTH = 600;
const HEIGHT = 600;

// Function to convert positions (pixel x & y) to cell positions.
// Cells are a coarser grid than pixels.
// Send the Cell X & Y to the PSI protocol
const binToGrid = (x, y, gridSize) => {
  const cellX = Math.floor(x / gridSize);
  const cellY = Math.floor(y / gridSize);
  // return `${cellX},${cellY}`;  // Represent cell position as a string
  return {x: cellX, y: cellY};
};

// Convert from fine grid to coarse grid
const convertToCoarseGrid = (cell, fineGridSize, coarseGridSize) => {
  // Convert cell coordinates back to pixel space, then to coarse grid
  const pixelX = cell.x * fineGridSize;
  const pixelY = cell.y * fineGridSize;
  return binToGrid(pixelX, pixelY, coarseGridSize);
};


const generateVisibilityGridSet = (aliceUnits, visibilityRadius, gridSize) => {
  const visibilityMap = new Map();  // Use Map to store unique cells as keys

  // Loop over all Alice's units
  aliceUnits.forEach((aliceUnit) => {
    for (let x = aliceUnit.x - visibilityRadius; x <= aliceUnit.x + visibilityRadius; x += gridSize) {
      for (let y = aliceUnit.y - visibilityRadius; y <= aliceUnit.y + visibilityRadius; y += gridSize) {
        const dx = x - aliceUnit.x;
        const dy = y - aliceUnit.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only include points within the visibility circle
        if (distance <= visibilityRadius) {
          const cell = { x: Math.floor(x / gridSize), y: Math.floor(y / gridSize) };

          // Create a unique key for each grid cell (e.g., "10,15") -- ensures uniqueness in the visibility set
          const cellKey = `${cell.x},${cell.y}`;

          // Store in Map to ensure uniqueness, using cellKey as the key
          if (!visibilityMap.has(cellKey)) {
            visibilityMap.set(cellKey, cell);  // Map key to the cell object
          }
        }
      }
    }
  });

  // Return an array of unique cell objects from the map
  return Array.from(visibilityMap.values());
};



// Function to detect if a unit is within a certain range (visibility range)
const isWithinVisibility = (aliceUnit, bobUnit, visibilityRadius) => {
  const dx = aliceUnit.x - bobUnit.x;
  const dy = aliceUnit.y - bobUnit.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < visibilityRadius;
};

const randomVelocity = () => ({
  x: Math.random() > 0.5 ? 1 : -1,
  y: Math.random() > 0.5 ? 1 : -1,
});


// Main function
const PSIVisualization = () => {
  // Get current location to determine if this component is active
  const location = useLocation();

  const [results, setResults] = useState([]);  // State to hold the PSI results
  const [processingStatus, setProcessingStatus] = useState('idle'); // Track worker status
  const [performanceStats, setPerformanceStats] = useState(null); // Track performance stats

  const visibilityRadius = 70; // Visibility range for Alice's units // try tweaking?
  const coarseGridSize = 100; // Coarse grid size for first pass
  const fineGridSize = 50; // Fine grid size for second pass

  // Initial positions for Bob's units
  const [bobUnits, setBobUnits] = useState([
    { id: 'u1', x: 100, y: 100, velocity: randomVelocity() },
    { id: 'u2', x: 200, y: 200, velocity: randomVelocity() },
    { id: 'u3', x: 300, y: 300, velocity: randomVelocity() },
  ]);

  // Alice's units (static)
  const aliceUnits = [
    { id: 'v1', x: 150, y: 150 },
    { id: 'v2', x: 350, y: 350 },
  ];


  // Move Bob's units and handle bouncing
  useEffect(() => {
    const interval = setInterval(() => {
      setBobUnits((units) =>
        units.map((unit) => {
          let { x, y, velocity } = unit;
          x += velocity.x * 2;
          y += velocity.y * 2;

          // Bounce off edges
          if (x > WIDTH || x < 0) velocity.x = -velocity.x;
          if (y > HEIGHT || y < 0) velocity.y = -velocity.y;

          return { ...unit, x, y, velocity };
        })
      );
    }, 30); // Adjust the interval for faster/slower movement
    return () => clearInterval(interval);
  }, []);


  // Having an issue with using the most up-to-date version of Bob's units.
  // React possibly trying to be too clever
  const bobUnitsRef = useRef(bobUnits);  // Initialize ref to store latest bobUnits

  // Update the ref with the latest bobUnits whenever they change
  useEffect(() => {
    bobUnitsRef.current = bobUnits;
  }, [bobUnits]);


  // Determine if any of Bob's units are within Alice's visibility
    // Traditionally, non-PSI approach.
  const visibleBobUnits = bobUnits.filter((bobUnit) =>
    aliceUnits.some((aliceUnit) => isWithinVisibility(aliceUnit, bobUnit, visibilityRadius))
  );


  // Function to run multi-level PSI protocol
  const runMultiLevelPSI = async () => {
    console.log("Starting multi-level PSI protocol");
    
    // If already processing, don't start another calculation
    if (processingStatus === 'processing') {
      console.log("Already processing PSI, skipping this cycle");
      return null;
    }
    
    // Step 1: Run coarse-grained PSI (larger cells)
    console.log(`Step 1: Running coarse-grained PSI with grid size ${coarseGridSize}`);
    setProcessingStatus('processing-coarse');
    
    // Generate coarse-grained cells for Bob and Alice
    const coarseBobCells = bobUnitsRef.current.map(bobUnit => 
      binToGrid(bobUnit.x, bobUnit.y, coarseGridSize)
    );
    
    const coarseAliceCells = generateVisibilityGridSet(aliceUnits, visibilityRadius, coarseGridSize);
    
    console.log(`Coarse grid: Bob has ${coarseBobCells.length} cells, Alice has ${coarseAliceCells.length} cells`);
    
    // Use worker for coarse-grained PSI
    return new Promise((resolve) => {
      // Create a variable to hold the worker handle
      let workerHandle;
      
      // Run the worker
      workerHandle = runPSIInWorker(coarseBobCells, coarseAliceCells, {
        onStart: () => {
          console.log("Worker started for coarse grid PSI");
          // Add worker to tracking array after it's initialized
          activeWorkersRef.current.push(workerHandle);
        },
        onSuccess: (data) => {
          console.log("Worker completed coarse grid PSI");
          
          // Remove worker from tracking array
          activeWorkersRef.current = activeWorkersRef.current.filter(w => w !== workerHandle);
          
          // Extract the results
          const coarseResults = data.results;

          // Store performance stats from worker
          if (data.performance) {
            setPerformanceStats({
              ...data.performance,
              level: 'coarse',
              gridSize: coarseGridSize
            });
          }
          
          // Continue with fine-grained PSI if needed
          if (coarseResults.length > 0) {
            // Process fine-grained PSI on the main thread for now
            processFineGrainedPSI(coarseResults).then(resolve);
          } else {
            console.log("No coarse intersections found, skipping fine-grained PSI");
            setResults([]);
            setProcessingStatus('idle');
            resolve([]);
          }
        },
        onError: (error) => {
          console.error("Error in coarse grid PSI worker:", error);
          
          // Remove worker from tracking array
          activeWorkersRef.current = activeWorkersRef.current.filter(w => w !== workerHandle);
          
          setProcessingStatus('error');
          resolve(null);
        }
      });
    });
  };
  
  // Function to process the fine-grained PSI after coarse intersections are found
  const processFineGrainedPSI = async (coarseResults) => {
    console.log(`Step 2: Found ${coarseResults.length} coarse intersections, running fine-grained PSI`);
    setProcessingStatus('processing-fine');
    
    // Extract the coarse cells that had intersections
    const intersectedCoarseCellStrings = coarseResults.map(result => result.unit);
    console.log("Intersected coarse cells:", intersectedCoarseCellStrings);
    
    // Parse the cell strings back into objects
    const intersectedCoarseCells = intersectedCoarseCellStrings.map(cellStr => {
      const [x, y] = cellStr.split(" ").map(Number);
      return { x, y };
    });
    
    // Calculate fine-grained cells only in areas with coarse intersections
    const fineBobCells = [];
    
    // For each of Bob's units
    bobUnitsRef.current.forEach(bobUnit => {
      const bobCoarseCell = binToGrid(bobUnit.x, bobUnit.y, coarseGridSize);
      
      // Check if this unit's coarse cell is in the intersection set
      const isInIntersection = intersectedCoarseCells.some(
        cell => cell.x === bobCoarseCell.x && cell.y === bobCoarseCell.y
      );
      
      if (isInIntersection) {
        // If in intersection, add the fine-grained cell
        fineBobCells.push(binToGrid(bobUnit.x, bobUnit.y, fineGridSize));
      }
    });
    
    // Generate fine-grained cells for Alice's visibility, but only in areas with intersections
    const fineAliceCells = [];
    aliceUnits.forEach(aliceUnit => {
      // For each Alice unit, generate fine grid cells within visibility radius
      for (let x = aliceUnit.x - visibilityRadius; x <= aliceUnit.x + visibilityRadius; x += fineGridSize) {
        for (let y = aliceUnit.y - visibilityRadius; y <= aliceUnit.y + visibilityRadius; y += fineGridSize) {
          const dx = x - aliceUnit.x;
          const dy = y - aliceUnit.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Only include points within visibility radius
          if (distance <= visibilityRadius) {
            const fineCell = binToGrid(x, y, fineGridSize);
            const coarseCell = convertToCoarseGrid(fineCell, fineGridSize, coarseGridSize);
            
            // Check if this fine cell's coarse cell is in the intersection set
            const isInIntersection = intersectedCoarseCells.some(
              cell => cell.x === coarseCell.x && cell.y === coarseCell.y
            );
            
            if (isInIntersection) {
              // Create a unique key for the cell to avoid duplicates
              const cellKey = `${fineCell.x},${fineCell.y}`;
              if (!fineAliceCells.some(cell => `${cell.x},${cell.y}` === cellKey)) {
                fineAliceCells.push(fineCell);
              }
            }
          }
        }
      }
    });
    
    console.log(`Fine grid: Bob has ${fineBobCells.length} cells, Alice has ${fineAliceCells.length} cells`);
    
    // Only run fine-grained PSI if we have cells from both sides
    if (fineBobCells.length > 0 && fineAliceCells.length > 0) {
      // Use worker for fine-grained PSI too
      return new Promise((resolve) => {
        // Create a variable to hold the worker handle
        let workerHandle;
        
        // Run the worker
        workerHandle = runPSIInWorker(fineBobCells, fineAliceCells, {
          onStart: () => {
            console.log("Worker started for fine grid PSI");
            // Add worker to tracking array after it's initialized
            activeWorkersRef.current.push(workerHandle);
          },
          onSuccess: (data) => {
            console.log("Worker completed fine grid PSI");
            
            // Remove worker from tracking array
            activeWorkersRef.current = activeWorkersRef.current.filter(w => w !== workerHandle);
            
            // Set final results
            setResults(data.results);
            setProcessingStatus('idle');
            console.log(`Fine-grained PSI found ${data.results.length} intersections`);
            
            // Store performance stats from worker
            if (data.performance) {
              setPerformanceStats({
                ...data.performance,
                level: 'fine',
                gridSize: fineGridSize
              });
            }
            resolve(data.results);
          },
          onError: (error) => {
            console.error("Error in fine grid PSI worker:", error);
            
            // Remove worker from tracking array
            activeWorkersRef.current = activeWorkersRef.current.filter(w => w !== workerHandle);
            
            setProcessingStatus('error');
            resolve(null);
          }
        });
      });
    } else {
      console.log("No fine-grained cells to process");
      setResults([]);
      setProcessingStatus('idle');
      return [];
    }
  };

  // Track whether the component is currently visible/active
  const [isPageActive, setIsPageActive] = useState(false);
  
  // Reference to track any active workers
  const activeWorkersRef = useRef([]);
  
  // Effect to detect when the component is mounted and visible
  useEffect(() => {
    console.log("PSI Visualization page mounted");
    
    // Set as active only if we're on the visualization page
    const isActiveNow = location.pathname === '/visualization';
    console.log(`Current path: ${location.pathname}, is active: ${isActiveNow}`);
    setIsPageActive(isActiveNow);
    
    return () => {
      console.log("PSI Visualization page unmounted");
      setIsPageActive(false);
      
      // Make sure to clear any pending work when unmounting
      setProcessingStatus('idle');
      
      // Terminate any active workers
      activeWorkersRef.current.forEach(worker => {
        if (worker && worker.abort) {
          console.log("Terminating active worker");
          worker.abort();
        }
      });
      
      // Clear the workers array
      activeWorkersRef.current = [];
    };
  }, [location.pathname]);
  
  // Effect to manage the PSI calculation interval
  useEffect(() => {
    // Only start the calculation interval if the page is active
    if (!isPageActive) {
      console.log("PSI Visualization page not active, calculations suspended");
      return;
    }
    
    console.log("Starting PSI calculation interval");
    const interval = setInterval(() => {
      // Run the multi-level PSI protocol only if not currently processing
      if (processingStatus === 'idle' || processingStatus === 'error') {
        runMultiLevelPSI();
      }
    }, 1000);  // Run every 5 seconds
    
    return () => {
      console.log("Clearing PSI calculation interval");
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingStatus, isPageActive]);



  return (
    <div>
      <h1>PSI Visualization (Multi-Level Grid with Web Workers)</h1>
      <div>
        <strong>Coarse Grid Size:</strong> {coarseGridSize}px | 
        <strong>Fine Grid Size:</strong> {fineGridSize}px | 
        <strong>Status:</strong> <span style={{ 
          color: processingStatus === 'idle' ? 'green' : 
                 processingStatus === 'error' ? 'red' : 'orange' 
        }}>
          {processingStatus === 'processing-coarse' ? 'Processing Coarse Grid...' :
           processingStatus === 'processing-fine' ? 'Processing Fine Grid...' :
           processingStatus === 'error' ? 'Error!' : 'Ready'}
        </span>
      </div>
      <Stage width={WIDTH} height={HEIGHT}>
        <Layer>
          {/* Box for the environment */}
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} stroke="black" />

          {/* Bob's units (moving) */}
          {bobUnits.map((unit) => (
            <Circle key={unit.id} x={unit.x} y={unit.y} radius={10} fill="blue" />
          ))}

          {/* Alice's units (static) with visibility range */}
          {aliceUnits.map((unit) => (
            <React.Fragment key={unit.id}>
              <Circle x={unit.x} y={unit.y} radius={10} fill="green" />
              <Circle
                x={unit.x}
                y={unit.y}
                radius={visibilityRadius}
                stroke="green"
                dash={[4, 4]}
              />
            </React.Fragment>
          ))}

          {/* Highlight units that Alice "sees" */}
          {visibleBobUnits.map((unit) => (
            <Circle key={unit.id} x={unit.x} y={unit.y} radius={10} fill="red" />
          ))}
        </Layer>
      </Stage>

      <div>
        <h3>Bob's units visible to Alice (Traditional Calculation):</h3>
        {visibleBobUnits.length > 0 ? (
          visibleBobUnits.map((unit) => <p key={unit.id}>{unit.id} is visible</p>)
        ) : (
          <p>No units in Alice's visibility range.</p>
        )}
      </div>

      <div>
        <h3>PSI Protocol Results:</h3>
        {results.length > 0 ? (
          <div>
            <p>Found {results.length} intersections at fine grid level:</p>
            <ul>
              {results.map((result, index) => (
                <li key={index}>Cell: {result.unit}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>No intersections found in PSI protocol.</p>
        )}
      </div>
      
      {/* Performance Statistics */}
      {performanceStats && (
        <div>
          <h3>Performance Statistics ({performanceStats.level} grid - {performanceStats.gridSize}px)</h3>
          <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td><strong>Total Time:</strong></td>
                <td>{performanceStats.totalTime.toFixed(2)} ms</td>
                <td><strong>Bob Setup:</strong></td>
                <td>{performanceStats.bobSetupTime.toFixed(2)} ms</td>
              </tr>
              <tr>
                <td><strong>Key Exchange:</strong></td>
                <td>{performanceStats.keyExchangeTime.toFixed(2)} ms</td>
                <td><strong>Intersection:</strong></td>
                <td>{performanceStats.intersectionTime.toFixed(2)} ms</td>
              </tr>
              <tr>
                <td><strong>Inverse Operations:</strong></td>
                <td>{performanceStats.inverseOperations}</td>
                <td><strong>Decrypt Operations:</strong></td>
                <td>{performanceStats.decryptOperations}</td>
              </tr>
              <tr>
                <td><strong>Successful Decryptions:</strong></td>
                <td>{performanceStats.successfulDecryptions}</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default PSIVisualization;
