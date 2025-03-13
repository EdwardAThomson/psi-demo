import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css'; // We'll create this file next

// You could import README content here if using webpack raw-loader
// import readme from '../README.md';

const LandingPage = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Private Set Intersection Demo</h1>
        <p className={styles.subtitle}>
          An interactive visualization of PSI protocols in action
        </p>
      </header>

      <main className={styles.main}>
        <section className={styles.description}>
          <h2>About This Project</h2>
          <p>
            This application demonstrates how Private Set Intersection (PSI) works
            through interactive visualizations. You'll be able to see:
          </p>
          <ul>
            <li>Real-time unit movement and visibility detection</li>
            <li>Multi-level grid-based PSI protocol in action</li>
            <li>Performance comparisons between traditional and PSI approaches</li>
          </ul>
        </section>

        <section className={styles.navigation}>
          <h2>Getting Started</h2>
          <div className={styles.cardContainer}>
            <Link to="/visualization" className={styles.card}>
              <h3>→ Launch Visualization</h3>
              <p>See the PSI protocol in action with moving units</p>
            </Link>
            
            <Link to="/about" className={styles.card}>
              <h3>→ Learn More</h3>
              <p>Understand the technical details behind PSI</p>
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          View the source code on{' '}
          <a href="https://github.com/yourusername/yourrepo" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
};

export default LandingPage; 