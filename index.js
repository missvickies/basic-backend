const express = require('express');
const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors')

const app = express();
const port = 3000;

app.use(express.json());

// MongoDB connection URI
const uri = process.env.AZURE_COSMOSDB_CONNECTION_STRING;

// MongoDB client
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
    const db = client.db('testdb'); // Replace 'testdb' with your database name
    const collection = db.collection('testcollection'); // Replace 'testcollection' with your collection name
    app.use(cors());
    app.post('/insert', async (req, res) => {
      try {
        const document = req.body;
        const result = await collection.insertOne(document);
        addCollectionContentVectorField(document,db,'testcollection')
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

async function generateEmbeddings(text) {
    const embeddings = await aoaiClient.getEmbeddings(embeddingsDeploymentName, text);
    // Rest period to avoid rate limiting on Azure OpenAI  
    await new Promise(resolve => setTimeout(resolve, 500));
    return embeddings.data[0].embedding;
}

async function addCollectionContentVectorField(doc,db, collectionName) {
    const collection = db.collection(collectionName); 

        // do not include contentVector field in the content to be embedded
        if ('contentVector' in doc) {
            delete doc['contentVector'];
        }
        const content = JSON.stringify(doc);
        const contentVector = await generateEmbeddings(content);
        collection.updateOne(
            { '_id': doc['_id'] },
            { '$set': { 'contentVector': contentVector } },
            { upsert: true }
        );
        console.log(`Generated ${i+1} content vectors for document`);

    //check to see if the vector index already exists on the collection
    console.log(`Checking if vector index exists in the ${collectionName} collection`)

    const vectorIndexExists = await collection.indexExists('VectorSearchIndex');
    if (!vectorIndexExists) {
        await db.command({
            "createIndexes": collectionName,
            "indexes": [
              {
                "name": "VectorSearchIndex",
                "key": {
                  "contentVector": "cosmosSearch"
                },
                "cosmosSearchOptions": {                  
                  "kind": "vector-ivf",
                  "numLists": 1,
                  "similarity": "COS",
                  "dimensions": 1536
                }
              }
            ]
        });
        console.log(`Created vector index on contentVector field on ${collectionName} collection`);
    }
    else {
        console.log(`Vector index already exists on contentVector field in the ${collectionName} collection`);
    }
}