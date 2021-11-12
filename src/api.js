const express = require('express')
const bodyParser = require('body-parser')
const todos = require('./todos')

require('express-async-errors')

const app = express()

app.use(bodyParser.json())

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

module.exports = app
