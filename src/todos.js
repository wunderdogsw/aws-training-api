const fs = require('fs')

const load = async () => {
  try {
    const buffer = await fs.promises.readFile('data/todos.json')

    return JSON.parse(buffer.toString())
  } catch (e) {
    return []
  }
}

const save = async (items) => {
  await fs.promises.mkdir('data', { recursive: true })
  await fs.promises.writeFile('data/todos.json', JSON.stringify(items, null, 2))
}

module.exports = {
  async getAll() {
    return await load()
  },

  async get(id) {
    const items = await load()

    const item = items.find((item) => item.id === id)
    if (!item) {
      throw new Error(`Item ${id} not found`)
    }

    return item
  },

  async create(content) {
    const items = await load()

    const previousId = items.length > 0 ? Math.max(...items.map(item => item.id)) : 0
    const createdItem = { id: previousId + 1, content }
    await save([...items, createdItem])

    return createdItem
  },

  async update(id, content) {
    const items = await load()

    const item = await this.get(id)
    const updatedItem = { ...item, content }
    await save(
      items.map(item => item.id === updatedItem.id ? updatedItem : item)
    )

    return updatedItem
  },

  async delete(id) {
    const items = await load()

    const itemToDelete = await this.get(id)
    await save(items.filter(item => item.id !== itemToDelete.id))

    return true
  },

  async count() {
    const items = await load()

    return items.length
  },
}
