import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';

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
            through interactive visualizations. Some features of this app:
          </p>
          <ul>
            <li>PSI protocol in static and dynamic examples (action with moving units)</li>
            <li>Real-time (kinda!) unit movement and visibility detection</li>
            <li>Multi-level grid system</li>
            <li>Web workers for faster calculations</li>
          </ul>
          <p>For details about how PSI works, follow the link to my GitHub repo below.</p>
        </section>

        <section className={styles.navigation}>
          <h2>Getting Started</h2>
          <div className={styles.cardContainer}>

            <Link to="/raw-calculation" className={styles.card}>
              <h3>→ Original PSI Demo</h3>
              <p>Run the basic PSI protocol with static units</p>
            </Link>

            <Link to="/visualization" className={styles.card}>
              <h3>→ Launch Visualization</h3>
              <p>See the PSI protocol in action with moving units</p>
            </Link>
            
            <Link to="/roguelike" className={styles.card}>
              <h3>→ Play Roguelike Demo</h3>
              <p>Experience PSI in a game-like environment</p>
            </Link>

          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          View the source code on{' '}
          <a href="https://github.com/EdwardAThomson/psi-demo" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
};

export default LandingPage; 