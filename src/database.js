const { Client } = require('pg')

let client = null

const RETRY_DELAY_SECONDS = 30

async function connectToDatabase(retries = 0) {
  try {
    client = new Client({
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    })
    await client.connect()
    await client.query('CREATE TABLE IF NOT EXISTS counter (value int)')

    const result = await client.query('SELECT * FROM counter')

    if (result.rows.length === 0) {
      await client.query('INSERT INTO counter VALUES (0)')
    }

    console.info('Database connection established')
  } catch (e) {
    console.warn('Database connection failed, the `/increment`-endpoint will not work:', e)
    console.info(`Retrying database connection in ${RETRY_DELAY_SECONDS}s`)
    setTimeout(() => connectToDatabase(retries + 1), RETRY_DELAY_SECONDS * 1000)
  }
}

module.exports = {
  connectToDatabase,

  getClient() {
    if (!client) {
      throw new Error('Database connection does not exist')
    }

    return client
  },
}
