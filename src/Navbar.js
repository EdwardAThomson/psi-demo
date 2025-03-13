import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  
  // Helper function to determine if a link is active
  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };
  
  return (
    <nav style={{
      backgroundColor: '#2c3e50',
      padding: '15px 20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginBottom: '20px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div>
          <Link to="/" style={{
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            textDecoration: 'none'
          }}>
            PSI Demo
          </Link>
        </div>
        
        <ul style={{
          display: 'flex',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          gap: '20px'
        }}>
          <li>
            <Link to="/" style={{
              color: isActive('/') === 'active' ? '#3498db' : 'white',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: isActive('/') === 'active' ? 'rgba(255,255,255,0.1)' : 'transparent',
              transition: 'all 0.2s'
            }}>
              Home
            </Link>
          </li>

          <li>
            <Link to="/raw-calculation" style={{
              color: isActive('/raw-calculation') === 'active' ? '#3498db' : 'white',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: isActive('/raw-calculation') === 'active' ? 'rgba(255,255,255,0.1)' : 'transparent',
              transition: 'all 0.2s'
            }}>
              Raw Demo
            </Link>
          </li>

          <li>
            <Link to="/visualization" style={{
              color: isActive('/visualization') === 'active' ? '#3498db' : 'white',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: isActive('/visualization') === 'active' ? 'rgba(255,255,255,0.1)' : 'transparent',
              transition: 'all 0.2s'
            }}>
              Visualization
            </Link>
          </li>


          <li>
            <Link to="/roguelike" style={{
              color: isActive('/roguelike') === 'active' ? '#3498db' : 'white',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: isActive('/roguelike') === 'active' ? 'rgba(255,255,255,0.1)' : 'transparent',
              transition: 'all 0.2s'
            }}>
              Roguelike
            </Link>
          </li>

        </ul>
      </div>
    </nav>
  );
};

export default Navbar; 