require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const admin = require('firebase-admin')

const { Client } = require('@elastic/elasticsearch')

const News = require('./models/News.js')

const serviceAccount = require('../firebaseServiceAccountKey.json')

// Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

const authenticateFirebaseToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1]

    if (!token) {
        return res.status(403).json({ message: 'Unauthorized: No token provided'})
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token)
        req.user = decodedToken
        next()
    } catch (error) {
        return res.status(403).json({ message: 'Unauthorized: Invalid token'})
    }
}

// App
const app = express()
const PORT = process.env.PORT | 3000

const esClient = new Client({ node: process.env.ELASTICSEARCH_URL })

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDb connected')
}).catch(err => {
    console.error('MongoDb connection error: ', err)
})

app.post('/news', authenticateFirebaseToken, async (req, res) => {
    try {
        const news = new News(req.body)
        await news.save()

        // Index the news in Elasticsearch
        await esClient.index({
            index: 'news',
            id: news._id.toString(),
            body: {
                title: news.title,
                body: news.body,
                author: news.author,
                publishedAt: news.publishedAt
            }
        })

        res.status(201).json(news)
    } catch (error) {
        res.status(400).json({error: error.message})        
    }
})

app.get('/news', authenticateFirebaseToken, async (req, res) => {
    try {
        const news = await News.find()
        res.status(200).json(news)
    } catch (error) {
        res.status(500).json({error: error.message})
    }
})

app.get('/news/:id', authenticateFirebaseToken, async (req, res) => {
    try {
        const news = await News.findById(req.params.id)
        if (!news) {
            return res.status(404).json({message: 'News not found'})
        }
        return res.status(200).json(news)
    } catch (error) {
        res.status(500).json({error: error.message})
    }
})

app.delete('/news/:id', authenticateFirebaseToken, async (req, res) => {
    try {
        const news = await News.findByIdAndDelete(req.params.id)
        if (!news) {
            return res.status(404).json({messages: 'News not found'})
        }

        await esClient.delete({
            index: 'news',
            id: req.params.id
        })

        res.status(200).json({message: 'News deleted'})
    } catch (error) {
        res.status(500).json({error: error.message})        
    }
})

app.get('/search', authenticateFirebaseToken, async (req, res) => {
    const { q } = req.query

    try {
        const result = await esClient.search({
            index: 'news',
            body: {
                query: {
                    bool: {
                        should: [
                            {
                                match: {
                                    title: {
                                        query: q,
                                        fuzziness: "AUTO",
                                        boost: 2
                                    }
                                }
                            },
                            {
                                match: {
                                    body: {
                                        query: q,
                                        fuzziness: "AUTO"
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        })

        res.status(200).json(result.hits.hits)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

exports.app = functions.https.onRequest(app)