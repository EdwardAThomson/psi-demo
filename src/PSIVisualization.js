import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Circle, Rect } from 'react-konva';
import PSIProtocol from "./psiCalculation";

const WIDTH = 600;
const HEIGHT = 600;

// Function to convert positions (pixel x & y) to cell positions.
// Cells are a coarser grid that pixels.
// Send the Cell X & Y to the PSI protocol
const binToGrid = (x, y, gridSize) => {
  const cellX = Math.floor(x / gridSize);
  const cellY = Math.floor(y / gridSize);
   // return `${cellX},${cellY}`;  // Represent cell position as a string
  return {x: cellX, y: cellY};
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


// visbilityFunction does not contain hooks, it’s a pure function
// TODO: Remove this function?
const visbilityFunction = (bobUnits, aliceUnits) => {
  const visibleUnits = bobUnits.filter((bobUnit) =>
    aliceUnits.some((aliceUnit) => isWithinVisibility(aliceUnit, bobUnit, 100))
  );

  // Return the result (array of visible unit IDs)
  return visibleUnits.map(unit => unit.id);
};



// Main function
const PSIVisualization = () => {

  const [bobValues, setBobValues] = useState([]);
  const [aliceValues, setAliceValues] = useState([]);
  const [aliceRandomValues, setAliceRandomValues] = useState([]); // Track Alice's random values
  const [results, setResults] = useState([]);  // State to hold the PSI results

  const [bobCells, setBobCells] = useState([]);
  const [aliceCells, setAliceCells] = useState([]);

  const visibilityRadius = 100; // Visibility range for Alice's units
  const gridSize = 50; // Grid size -- smaller number is finer grained.

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

//  console.log("bobUnits 1", bobUnits);

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


  useEffect(() => {
    const interval2 = setInterval(() => {

        // Function to bin Bob's units into grid cells
        // const newBobCells = bobUnits.map((bobUnit) => binToGrid(bobUnit.x, bobUnit.y, gridSize));

        // Use the latest bobUnits from the ref
        const newBobCells = bobUnitsRef.current.map((bobUnit) => binToGrid(bobUnit.x, bobUnit.y, gridSize));



        // Function to bin Alice's visibility set into grid cells
        // Alice's visibility is a circle, so we turn that into a discrete set of points.
        const newAliceCells = generateVisibilityGridSet(aliceUnits, visibilityRadius, gridSize);

        setBobCells(newBobCells);
        setAliceCells(newAliceCells);

        console.log("bobUnits 2", bobUnitsRef.current);
        console.log("newBobCells", newBobCells);
        // console.log("aliceUnits", aliceUnits);
        console.log("newAliceCells", newAliceCells);

        // OLD : This was PSI calc being called using pixel position
        // PSIProtocol(bobUnits, aliceUnits, setBobValues, setAliceValues, setAliceRandomValues, setResults);

        // NEW : PSI calculation using cells rather than positions.
        PSIProtocol(newBobCells, newAliceCells, setBobValues, setAliceValues, setAliceRandomValues, setResults);


        // Quick / Dirty - checking for an overlap.
        // const aliceCellSet = new Set(aliceCells.map(cell => `${cell.x},${cell.y}`));  // Convert Alice's cells to a set
        // Check if any of Bob's cells overlap with Alice's visibility cells
        // const overlap = bobCells.some(bobCell => aliceCellSet.has(`${bobCell.x},${bobCell.y}`));
        // console.log(`Do Alice's and Bob's cells overlap? ${overlap ? 'Yes' : 'No'}`);



        console.log('PSI Protocol called with updated cell positions');

    }, 5000);  // this is running every 5 seconds. Too long?
    return () => clearInterval(interval2);
  }, []);



  return (
    <div>
      <h1>PSI Visualization</h1>
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
        <h3>Bob's units visible to Alice:</h3>
        {visibleBobUnits.length > 0 ? (
          visibleBobUnits.map((unit) => <p key={unit.id}>{unit.id} is visible</p>)
        ) : (
          <p>No units in Alice's visibility range.</p>
        )}
      </div>

    </div>


  );
};

export default PSIVisualization;
