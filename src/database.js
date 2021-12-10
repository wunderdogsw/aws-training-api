const { Client } = require('pg')

let client = null

module.exports = {
  async connectToDatabase() {
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
    } catch (e) {
      console.warn('Database connection failed, the `/increment`-endpoint will not work:', e)
    }
  },

  getClient() {
    if (!client) {
      throw new Error('Database connection does not exist')
    }

    return client
  },
}
