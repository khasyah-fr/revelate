require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')

const News = require('./models/News.js')

const app = express()
const PORT = process.env.PORT | 3000

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDb connected')
}).catch(err => {
    console.error('MongoDb connection error: ', err)
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})