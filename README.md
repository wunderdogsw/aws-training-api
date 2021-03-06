# aws-training-api

Simple todo list API implemented in Node.js.

The todo items are saved in the `data/todos.json` file.

## Getting started

1. Install dependencies with `npm install`
2. Start the API with `npm start`
3. Check that the API is running by visiting http://localhost:3000/healthz.
4. Test out the API, see [API documentation](#api-documentation)

## Running tests

- Run tests with `npm run test`

## Environment variables

<table>
  <thead>
    <tr>
      <th>Variable</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>SECRET</code></td>
      <td>Used for checking if the user is allowed to use the <code>GET /stats</code> endpoint</td>
    </tr>
    <tr>
      <td><code>DATABASE_URL</code></td>
      <td>Database URL for the <code>POST /increment</code> endpoint</td>
    </tr>
  </tbody>
</table>

## API documentation

<table>
  <thead>
    <tr>
      <th>Endpoint</th>
      <th>Description</th>
      <th>Example curl command</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GET /healthz</code></td>
      <td>Returns "OK" if the API is running</td>
      <td><pre lang="bash">curl -XGET 'http://localhost:3000/healthz'</pre></td>
    </tr>
    <tr>
      <td><code>GET /todos</code></td>
      <td>Fetch all todo items</td>
      <td><pre lang="bash">curl -XGET 'http://localhost:3000/todos'</pre></td>
    </tr>
    <tr>
      <td><code>GET /todos/:id</code></td>
      <td>Fetch one todo item</td>
      <td><pre lang="bash">curl -XGET 'http://localhost:3000/todos/1'</pre></td>
    </tr>
    <tr>
      <td><code>POST /todos</code></td>
      <td>Create new todo item</td>
      <td>
        <pre lang="bash">curl -XPOST 'http://localhost:3000/todos' \
  --header 'Content-Type: application/json' \
  --data '{"content": "Hello world"}'</pre>
      </td>
    </tr>
    <tr>
      <td><code>PUT /todos/:id</code></td>
      <td>Update one todo item</td>
      <td>
        <pre lang="bash">curl -XPUT 'http://localhost:3000/todos/1' \
  --header 'Content-Type: application/json' \
  --data '{"content": "Hello world"}'</pre>
      </td>
    </tr>
    <tr>
      <td><code>DELETE /todos/:id</code></td>
      <td>Delete one todo item</td>
      <td><pre lang="bash">curl -XDELETE 'http://localhost:3000/todos/1'</pre></td>
    </tr>
    <tr>
      <td><code>GET /stats</code></td>
      <td>Returns statistics of all todo items, requires secret</td>
      <td><pre lang="bash">curl -XGET 'http://localhost:3000/stats?secret=verysecret'</pre></td>
    </tr>
    <tr>
      <td><code>POST /increment</code></td>
      <td>Increments a counter, requires a PostgreSQL database</td>
      <td><pre lang="bash">curl -XPOST 'http://localhost:3000/increment'</pre></td>
    </tr>
  </tbody>
</table>
