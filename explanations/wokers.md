# Web Workers

## Worker files

1. worker.js:
    - This is the main worker file that runs in a separate thread
    - Contains the complete PSI implementation including the cryptographic operations
    - Handles messages from the main thread and sends back results
    - This is the file that actually executes in the web worker context
2. workerAdapter.js:
    - Acts as a bridge between your React components and the worker
    - Creates and manages the worker instance
    - Converts function calls into messages that can be sent to the worker
    - Converts worker responses back into promises or callback results


## Multi-level meshing

The runMultiLevelPSI function in PSIVisualization.js is the core orchestration function that:

  1. Decides when to run PSI calculations based on the current status
  2. Manages the two-level grid approach (coarse and fine)
  3. Calls the Web Worker implementation through the workerAdapter

  When you look at the flow:

  1. The component's useEffect hook calls runMultiLevelPSI every 5 seconds
  2. runMultiLevelPSI first creates coarse grid cells for both players
  3. It then uses the worker (via runPSIInWorker) to find intersections at the coarse level
  4. If coarse intersections are found, it calls processFineGrainedPSI to handle the second level
  5. processFineGrainedPSI creates fine-grained cells only in areas of interest
  6. It then uses another worker to find the final intersections at the fine level

  This multi-level approach combined with Web Workers gives you the best of both worlds - efficiency from the multi-level grid and responsiveness from the separate thread processing.
