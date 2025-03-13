import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import { useLocation } from 'react-router-dom';
import { runPSIInWorker } from './workerAdapter';

// Constants for game
const GRID_SIZE = 20; // Size of each cell in pixels
const GRID_WIDTH = 30; // Number of cells horizontally
const GRID_HEIGHT = 30; // Number of cells vertically
const CANVAS_WIDTH = GRID_WIDTH * GRID_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * GRID_SIZE;
const VISIBILITY_RADIUS = 5; // How many cells the player can see

// Convert screen coordinates to grid coordinates
const screenToGrid = (x, y) => ({
  x: Math.floor(x / GRID_SIZE),
  y: Math.floor(y / GRID_SIZE)
});

// Convert grid coordinates to screen coordinates
const gridToScreen = (x, y) => ({
  x: x * GRID_SIZE,
  y: y * GRID_SIZE
});

// Calculate visibility for a point using a simple distance check
const calculateVisibility = (playerX, playerY, radius) => {
  const visibleCells = [];
  
  // Check all cells within a square around the player
  for (let x = playerX - radius; x <= playerX + radius; x++) {
    for (let y = playerY - radius; y <= playerY + radius; y++) {
      // Skip cells outside the grid bounds
      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        continue;
      }
      
      // Calculate distance from player
      const dx = x - playerX;
      const dy = y - playerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If within visibility radius, add to visible cells
      if (distance <= radius) {
        visibleCells.push({ x, y });
      }
    }
  }
  
  return visibleCells;
};

// Generate a string key for a grid cell
const cellKey = (x, y) => `${x},${y}`;

// Check if a cell is in an array of cells
const isCellInArray = (cell, array) => {
  return array.some(c => c.x === cell.x && c.y === cell.y);
};

// Main Roguelike component
const Roguelike = () => {
  const location = useLocation();
  
  // Game state
  const [player, setPlayer] = useState({ x: 15, y: 15 }); // Player position in grid coordinates
  const [monsters, setMonsters] = useState([
    { id: 'm1', x: 13, y: 13 },  // Closer to player's starting position
    { id: 'm2', x: 17, y: 17 },  // Closer to player's starting position
    { id: 'm3', x: 12, y: 18 },  // Within initial visibility radius
    { id: 'm4', x: 18, y: 12 },  // Within initial visibility radius
    { id: 'm5', x: 10, y: 10 },  // Original positions
    { id: 'm6', x: 20, y: 20 },
  ]);
  const [visibleCells, setVisibleCells] = useState([]);
  const [detectedMonsters, setDetectedMonsters] = useState([]);
  const [knownTerrain, setKnownTerrain] = useState({}); // Cells the player has seen
  
  // PSI processing state
  const [isPageActive, setIsPageActive] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('idle');
  const activeWorkersRef = useRef([]);
  
  // Track keyboard state for smooth movement
  const keysPressed = useRef({});
  
  // Run PSI calculation to detect monsters - with careful state updates
  const runMonsterDetection = useCallback(() => {
    // Capture state in local variables to avoid closure issues
    let isMounted = true;
    
    // Immediately mark as processing to avoid multiple runs
    setProcessingStatus('processing');
    
    const detectMonsters = () => {
      if (!isMounted) return;
      
      console.log("Running monster detection with PSI");
      
      // Player's visibility cells (for PSI calculation)
      const playerCells = visibleCells.map(cell => ({ x: cell.x, y: cell.y }));
      
      // Log visible area for debugging
      console.log(`Player at (${player.x}, ${player.y}) with visibility radius ${VISIBILITY_RADIUS}`);
      console.log(`Visible cells: ${playerCells.length} cells`);
      
      // Monster positions (for PSI calculation)
      const monsterCells = monsters.map(monster => ({ x: monster.x, y: monster.y }));
      console.log(`Total monsters: ${monsterCells.length}`);
      
      // Debug which monsters should be in view (traditional calculation)
      const monstersInView = monsters.filter(monster => 
        isCellInArray({ x: monster.x, y: monster.y }, visibleCells)
      );
      console.log(`Monsters in view (traditional): ${monstersInView.length}`);
      
      // Create a variable to hold the worker handle
      let workerHandle;
      
      try {
        // Run PSI calculation in worker
        workerHandle = runPSIInWorker(monsterCells, playerCells, {
          onStart: () => {
            if (!isMounted) return;
            console.log("PSI worker started for monster detection");
            // Add worker to tracking array after it's initialized
            activeWorkersRef.current.push(workerHandle);
          },
          onSuccess: (data) => {
            if (!isMounted) return;
            console.log("PSI worker completed monster detection");
            
            // Remove worker from tracking array
            activeWorkersRef.current = activeWorkersRef.current.filter(w => w !== workerHandle);
            
            // Process the results
            const psiResults = data.results;
            console.log(`PSI found ${psiResults.length} intersections`);
            
            // Convert result strings back to coordinates
            const detectedMonsterCells = psiResults.map(result => {
              const [x, y] = result.unit.split(" ").map(Number);
              return { x, y };
            });
            
            // Match with actual monsters
            const detected = monsters.filter(monster => 
              detectedMonsterCells.some(cell => 
                cell.x === monster.x && cell.y === monster.y
              )
            );
            
            console.log(`Matched ${detected.length} monsters`);
            
            if (isMounted) {
              setDetectedMonsters(detected);
              setProcessingStatus('idle');
            }
          },
          onError: (error) => {
            if (!isMounted) return;
            console.error("Error in monster detection worker:", error);
            
            // Remove worker from tracking array
            activeWorkersRef.current = activeWorkersRef.current.filter(w => w !== workerHandle);
            
            setProcessingStatus('idle'); // Reset to idle to allow retry
          }
        });
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to start PSI worker:", error);
        setProcessingStatus('idle'); // Reset to idle to allow retry
      }
    };
    
    // Run the detection after a small delay to avoid state issues
    const timerId = setTimeout(detectMonsters, 10);
    
    // Return cleanup function
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monsters, player.x, player.y, visibleCells]);

  // Handle component mounting/unmounting
  useEffect(() => {
    console.log("Roguelike component mounted");
    
    // Set as active only if we're on the roguelike page
    const isActiveNow = location.pathname === '/roguelike';
    console.log(`Current path: ${location.pathname}, is active: ${isActiveNow}`);
    setIsPageActive(isActiveNow);
    
    // Set up key handlers
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
    };
    
    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      console.log("Roguelike component unmounted");
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
      
      // Remove key listeners
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [location.pathname]);
  
  // Handle player movement
  useEffect(() => {
    if (!isPageActive) return;
    
    const moveInterval = setInterval(() => {
      let newX = player.x;
      let newY = player.y;
      
      // Check which keys are pressed and move accordingly
      if (keysPressed.current.ArrowUp || keysPressed.current.w) newY--;
      if (keysPressed.current.ArrowDown || keysPressed.current.s) newY++;
      if (keysPressed.current.ArrowLeft || keysPressed.current.a) newX--;
      if (keysPressed.current.ArrowRight || keysPressed.current.d) newX++;
      
      // Check bounds
      if (newX < 0) newX = 0;
      if (newX >= GRID_WIDTH) newX = GRID_WIDTH - 1;
      if (newY < 0) newY = 0;
      if (newY >= GRID_HEIGHT) newY = GRID_HEIGHT - 1;
      
      // Only update if position changed
      if (newX !== player.x || newY !== player.y) {
        setPlayer({ x: newX, y: newY });
      }
    }, 150); // Movement speed
    
    return () => clearInterval(moveInterval);
  }, [player, isPageActive]);
  
  // Initially set visibility when component becomes active
  useEffect(() => {
    if (isPageActive) {
      console.log("Initial visibility calculation");
      
      // Calculate initial visibility only on initial activation
      const initialVisibleCells = calculateVisibility(player.x, player.y, VISIBILITY_RADIUS);
      setVisibleCells(initialVisibleCells);
      
      // Set initial known terrain
      const initialKnownTerrain = {};
      initialVisibleCells.forEach(cell => {
        initialKnownTerrain[cellKey(cell.x, cell.y)] = true;
      });
      setKnownTerrain(initialKnownTerrain);
      
      // Reset the monster detection state
      setProcessingStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPageActive]);
  
  // Update visibility and known terrain when player moves
  useEffect(() => {
    if (!isPageActive) return;
    
    // Calculate visible cells based on player's position
    const newVisibleCells = calculateVisibility(player.x, player.y, VISIBILITY_RADIUS);
    
    // Only update visibility cells if they've changed
    const visibleCellsHash = newVisibleCells.map(c => `${c.x},${c.y}`).sort().join(',');
    const prevVisibleCellsHash = visibleCells.map(c => `${c.x},${c.y}`).sort().join(',');
    
    if (visibleCellsHash !== prevVisibleCellsHash) {
      setVisibleCells(newVisibleCells);
      
      // Update known terrain - only add cells that aren't already known
      const newKnownTerrain = { ...knownTerrain };
      let terrainUpdated = false;
      
      newVisibleCells.forEach(cell => {
        const key = cellKey(cell.x, cell.y);
        if (!newKnownTerrain[key]) {
          newKnownTerrain[key] = true;
          terrainUpdated = true;
        }
      });
      
      // Only update known terrain state if it changed
      if (terrainUpdated) {
        setKnownTerrain(newKnownTerrain);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.x, player.y, isPageActive]);
  
  // Separate effect to trigger PSI - with careful dependency tracking
  const lastRunRef = useRef(0);
  
  useEffect(() => {
    if (!isPageActive || processingStatus !== 'idle' || visibleCells.length === 0) return;
    
    // Don't run PSI more than once per second
    const now = Date.now();
    if (now - lastRunRef.current < 500) return;
    
    lastRunRef.current = now;
    runMonsterDetection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPageActive, processingStatus, player.x, player.y]);

  return (
    <div className="roguelike-container">
      <h1>PSI Roguelike Demo</h1>
      <div className="game-status">
        <p>Use arrow keys or WASD to move</p>
        <p>Position: ({player.x}, {player.y})</p>
        <p>Visible monsters: {detectedMonsters.length}</p>
        <p>PSI Status: <span style={{ 
          color: processingStatus === 'idle' ? 'green' : 
                 processingStatus === 'error' ? 'red' : 'orange' 
        }}>
          {processingStatus === 'processing' ? 'Scanning for monsters...' :
           processingStatus === 'error' ? 'Error!' : 'Ready'}
        </span></p>
      </div>
      
      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {/* Draw the game board grid */}
          {Array.from({ length: GRID_WIDTH * GRID_HEIGHT }).map((_, index) => {
            const x = index % GRID_WIDTH;
            const y = Math.floor(index / GRID_WIDTH);
            const isVisible = isCellInArray({ x, y }, visibleCells);
            const isKnown = knownTerrain[cellKey(x, y)];
            
            return (
              <Rect
                key={`cell-${x}-${y}`}
                x={x * GRID_SIZE}
                y={y * GRID_SIZE}
                width={GRID_SIZE}
                height={GRID_SIZE}
                fill={isVisible ? '#aaa' : (isKnown ? '#555' : '#111')}
                stroke="#333"
                strokeWidth={1}
              />
            );
          })}
          
          {/* Draw the player */}
          <Circle
            x={(player.x + 0.5) * GRID_SIZE}
            y={(player.y + 0.5) * GRID_SIZE}
            radius={GRID_SIZE / 2 - 2}
            fill="#4f4"
          />
          
          {/* Draw detected monsters (only if they're in visible cells) */}
          {detectedMonsters.map(monster => {
            const isVisible = isCellInArray({ x: monster.x, y: monster.y }, visibleCells);
            
            if (!isVisible) return null;
            
            return (
              <React.Fragment key={`monster-${monster.id}`}>
                <Circle
                  x={(monster.x + 0.5) * GRID_SIZE}
                  y={(monster.y + 0.5) * GRID_SIZE}
                  radius={GRID_SIZE / 2 - 2}
                  fill="#f44"
                  stroke="#800"
                  strokeWidth={2}
                />
                <Text
                  x={(monster.x) * GRID_SIZE}
                  y={(monster.y) * GRID_SIZE}
                  text="👹"
                  fontSize={16}
                  align="center"
                />
              </React.Fragment>
            );
          })}
          
          {/* Debug rendering - show where detected monsters are */}
          <Text
            x={10}
            y={CANVAS_HEIGHT - 20}
            text={`Detected monsters: ${detectedMonsters.length}`}
            fill="white"
            fontSize={12}
          />
          
          {/* Draw visibility radius indicator */}
          <Circle
            x={(player.x + 0.5) * GRID_SIZE}
            y={(player.y + 0.5) * GRID_SIZE}
            radius={VISIBILITY_RADIUS * GRID_SIZE}
            stroke="#4f4"
            strokeWidth={2}
            dash={[5, 5]}
            opacity={0.5}
          />
        </Layer>
      </Stage>
      
      <div className="game-instructions">
        <h2>Roguelike with PSI-based Monster Detection</h2>
        <p>Warning! This demo is very slow. It is not optimized for performance.</p>
        <p>This demo shows how PSI can be used for secure fog-of-war in games:</p>
        <ul>
          <li>Green circle is your character. Use arrow keys or WASD to move.</li>
          <li>Gray cells are currently visible to you.</li>
          <li>Dark gray cells are areas you've seen before but aren't currently visible.</li>
          <li>Red circles are monsters that have been detected in your field of view.</li>
          <li>The PSI protocol only reveals monsters when they are in your field of view.</li>
          <li>Monsters outside your field of view remain hidden and secure.</li>
        </ul>
        <p>You can find monsters at: (13, 13), (17, 17), (12, 18), (18, 12), (10, 10), (20, 20)</p>
      </div>
    </div>
  );
};

export default Roguelike;