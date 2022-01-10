const request = require('supertest')
const app = require('../src/api')

let mockTodos = JSON.stringify([
  { id: 1, content: 'First note' },
  { id: 2, content: 'Second note' },
])

jest.mock('fs', () => ({
  promises: {
    mkdir: () => Promise.resolve(),
    readFile: () => Promise.resolve(mockTodos),
    writeFile: (path, content) => new Promise((resolve) => {
      mockTodos = content
      resolve(mockTodos)
    }),
  },
}))

jest.mock('pg', () => ({
  Client: jest.fn(() => ({
    connect: jest.fn(() => Promise.resolve()),
    query: jest.fn(() => Promise.resolve({ rows: [] })),
  }))
}))

describe('GET /todos', () => {
  it('fetches all todo items', async () => {
    await request(app)
      .get('/todos')
      .expect(200, [
        { id: 1, content: 'First note' },
        { id: 2, content: 'Second note' },
      ])
  })
})

describe('GET /todos/:id', () => {
  it('fetch one todo item', async () => {
    await request(app)
      .get('/todos/2')
      .expect(200, { id: 2, content: 'Second note' })
  })
})

describe('POST /todos', () => {
  it('creates todo item', async () => {
    await request(app)
      .post('/todos')
      .send({ content: 'Hello world' })
      .expect(200, { id: 3, content: 'Hello world' })
  })
})

describe('PUT /todos/:id', () => {
  it('updates todo item', async () => {
    await request(app)
      .put('/todos/3')
      .send({ content: 'Hello universe' })
      .expect(200, { id: 3, content: 'Hello universe' })
  })
})

describe('DELETE /todos:id', () => {
  it('deletes todo item', async () => {
    await request(app)
      .delete('/todos/3')
      .expect(200)
  })
})
