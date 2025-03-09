// Worker adapter - Handles communication with the PSI worker

// Create a worker instance using a bundler-friendly approach
const createWorker = () => {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
};

// Create a promise-based wrapper around the worker
const createWorkerWithPromise = () => {
  const worker = createWorker();
  
  // Return a function that wraps worker calls in promises
  return {
    run: (data) => {
      return new Promise((resolve, reject) => {
        // Set up handler for worker responses
        worker.onmessage = (e) => {
          if (e.data.type === 'success') {
            resolve(e.data);
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.error));
          }
        };
        
        // Handle worker errors
        worker.onerror = (error) => {
          reject(new Error('Worker error: ' + error.message));
        };
        
        // Send data to worker
        worker.postMessage(data);
      });
    },
    terminate: () => worker.terminate()
  };
};

// Export a function to run PSI in a worker
export const runPSIInWorker = (bobUnits, aliceUnits, callbacks) => {
  const { onStart, onSuccess, onError } = callbacks || {};
  
  // Create a worker instance with promise interface
  const workerWrapper = createWorkerWithPromise();
  
  // Notify about starting the calculation
  if (onStart) onStart();
  
  // Run the calculation in the worker
  workerWrapper.run({ bobUnits, aliceUnits })
    .then((data) => {
      if (onSuccess) onSuccess(data);
    })
    .catch((error) => {
      console.error('PSI Worker error:', error);
      if (onError) onError(error);
    });
    
  // Return a handle that could be used to terminate the worker
  return {
    abort: () => workerWrapper.terminate()
  };
};