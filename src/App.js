import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PSIVisualization from './PSIVisualization';
import LandingPage from './LandingPage';
import Roguelike from './Roguelike';
import RawCalculationDemo from './RawCalculationDemo';
import Navbar from './Navbar';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/visualization" element={<PSIVisualization />} />
            <Route path="/roguelike" element={<Roguelike />} />
            <Route path="/raw-calculation" element={<RawCalculationDemo />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
