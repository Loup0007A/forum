import styles from './LoadingScreen.module.css';

export default function LoadingScreen() {
  return (
    <div className={styles.screen}>
      <div className={styles.logo}>
        <span className={styles.bracket}>[</span>
        <span className={styles.text}>FORUM</span>
        <span className={styles.bracket}>]</span>
      </div>
      <div className={styles.scanline} />
      <div className={styles.bars}>
        {[0,1,2,3,4].map(i => (
          <div key={i} className={styles.bar} style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      <p className={styles.status}>Initialisation du système...</p>
    </div>
  );
}
