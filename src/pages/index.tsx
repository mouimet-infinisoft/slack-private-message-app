import type { NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Slack Private Message App</title>
        <meta name="description" content="A Slack app that handles private messages" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Slack Private Message App
        </h1>

        <p className={styles.description}>
          Your Slack app is running!
        </p>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2>HTTP Events API</h2>
            <p>Endpoint: /api/slack/events</p>
          </div>

          <div className={styles.card}>
            <h2>Socket Mode</h2>
            <p>Run: npm run socket</p>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Vercel
        </a>
      </footer>
    </div>
  )
}

export default Home
