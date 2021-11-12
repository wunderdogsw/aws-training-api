require('dotenv').config()

const app = require('./api')

app.listen(3000, () => console.log('Listening on 3000'))
