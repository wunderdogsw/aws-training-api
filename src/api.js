const express = require('express')
const bodyParser = require('body-parser')
const todos = require('./todos')
const { connectToDatabase, getClient } = require('./database')

require('express-async-errors')

const app = express()

connectToDatabase()

app.use(bodyParser.json())

app.get('/healthz', async (req, res) => {
  res.send('OK')
})

app.get('/todos', async (req, res) => {
  res.json(await todos.getAll())
})

app.get('/todos/:id', async (req, res) => {
  const id = Number(req.params.id)

  res.json(await todos.get(id))
})

app.post('/todos', async (req, res) => {
  const content = String(req.body.content)

  res.json(await todos.create(content))
})

app.put('/todos/:id', async (req, res) => {
  const id = Number(req.params.id)
  const content = String(req.body.content)

  res.json(await todos.update(id, content))
})

app.delete('/todos/:id', async (req, res) => {
  const id = Number(req.params.id)

  res.json({ deleted: await todos.delete(id) })
})

app.get('/stats', async (req, res) => {
  if (!req.query.secret || req.query.secret !== process.env.SECRET) {
    throw new Error('Invalid secret')
  }

  res.json({
    count: await todos.count(),
  })
})

app.post('/increment', async (req, res) => {
  const client = getClient()

  const result = await client.query('UPDATE counter SET value = value + 1 RETURNING *')

  res.json({
    value: result.rows[0].value
  })
})

module.exports = app
