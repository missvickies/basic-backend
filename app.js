const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors')
require('dotenv').config();
const swagger = require('./swagger');
const { OpenAIClient, AzureKeyCredential} = require("@azure/openai");
const CosmicWorksAIAgent = require('./cosmic_works/cosmic_works_ai_agent');

let agentInstancesMap = new Map();

// MongoDB connection URI
const uri = process.env.AZURE_COSMOSDB_CONNECTION_STRING;
console.log(uri)

// MongoDB client
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//open ai client
const aoaiClient = new OpenAIClient("https://" + process.env.AZURE_OPENAI_API_INSTANCE_NAME + ".openai.azure.com/", 
                    new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY));

const app = express();
const port = 4242;
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send({ "status": "ready" });
});

client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
    const db = client.db('testdb'); // Replace 'testdb' with your database name
    const collection = db.collection('testcollection'); // Replace 'testcollection' with your collection name

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
    const embeddings = await aoaiClient.getEmbeddings(process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME, text);
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
        console.log(`Generated content vector for document`);

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

app.post('/ai', async (req, res) => {
  let agent = {};
  let prompt = req.body.prompt;
  let session_id = req.body.session_id;

  if (agentInstancesMap.has(session_id)) {
      agent = agentInstancesMap.get(session_id);
  } else {
      agent = new CosmicWorksAIAgent();
      agentInstancesMap.set(session_id, agent);
  }

  let result = await agent.executeAgent(prompt);
  res.send({ message: result });
});

swagger(app)