const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

app.use(express.json());

// MongoDB connection URI
const uri = 'mongodb+srv://userAdmin:Password1@phase-2-db.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000';

// MongoDB client
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
    const db = client.db('testdb'); // Replace 'testdb' with your database name
    const collection = db.collection('testcollection'); // Replace 'testcollection' with your collection name

    app.post('/insert', async (req, res) => {
      try {
        const document = req.body;
        const result = await collection.insertOne(document);
        res.status(200).send(`Document inserted with _id: ${result.insertedId}`);
      } catch (error) {
        res.status(500).send('Error inserting document: ' + error);
      }
    });

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
