const mongoose = require('mongoose')

const NewsSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    author: { type: String, required: true },
    publishedAt: { type: Date, default: Date.now() }
})

module.exports = mongoose.model('News', NewsSchema)