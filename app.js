const express = require('express');
const cors = require('cors')
require('dotenv').config();
const swagger = require('./swagger');
const CosmicWorksAIAgent = require('./cosmic_works/cosmic_works_ai_agent');
const addCollectionContentVectorField = require("./helpers")
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors()); // enable all CORS requests

let agentInstancesMap = new Map();

// MongoDB connection URI
const uri = process.env.AZURE_COSMOSDB_CONNECTION_STRING;
console.log(uri)

// MongoDB client
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect()
  .then(() => {
    console.log('Connected to MongoDB');  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });


const db = client.db('testdb'); // Replace 'testdb' with your database name
// const collection = db.collection('testcollection'); // Replace 'testcollection' with your collection name

/* Health probe endpoint. */
/**
 * @openapi
 * /:
 *   get:
 *     description: Health probe endpoint
 *     responses:
 *       200:
 *         description: Returns status=ready json
 */
app.get('/', (req, res) => {
    res.send({ "status": "ready" });
});

/**
 * @openapi
 * /ai:
 *   post:
 *     description: Run the Cosmic Works AI agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 default: ""
 *               session_id:
 *                 type: string
 *                 default: "1234"
 *     responses:
 *       200:
 *         description: Returns the OpenAI response.
 */
app.post('/ai', async (req, res) => {
  let agent = {};
  let prompt = req.body.prompt;
  let session_id = req.body.session_id;

  console.log("POST /AI" , session_id)

  if (agentInstancesMap.has(session_id)) {
      agent = agentInstancesMap.get(session_id);
  } else {
      agent = new CosmicWorksAIAgent(session_id);
      agentInstancesMap.set(session_id, agent);
  }

  let result = await agent.executeAgent(prompt);
  res.send({ message: result });
});

app.get('/createSessionId',async (req, res) => {
  try{
    sessionId = uuidv4();
    res.status(200).send({sessionID: sessionId});
  } catch (error) {
    res.status(500).send('Error creating session id' + error);
  }
})


app.post('/insert', async (req, res) => {
    try {
      const {resume,sessionID} = req.body;
      if(!resume || !sessionID){
        return res.status(400).send('Missing resume or sessionID');
      }
      //const document = req.body;
      const collections = await db.listCollections({ name: sessionID }).toArray();
      
      if(collections.length == 0){
        db.createCollection(sessionID);
      }
      const collection = db.collection(sessionID);
      const document = {resume};
      const result = await collection.insertOne(document);
      addCollectionContentVectorField(document,db,sessionID).then(x => {
        res.status(200).send(`Document inserted with _id: ${result.insertedId}`);
    })
    } catch (error) {
      res.status(500).send('Error inserting document: ' + error);
    }
});

swagger(app)

// parse out hosting port from cmd arguments if passed in
// otherwise default to port 4242
var port = (() => {
  const { argv } = require('node:process');
  var port = 4242; // default
  if (argv){
      argv.forEach((v, i) => {
          if (v && (v.toLowerCase().startsWith('port=')))
          {
              port = v.substring(5);
          }
      });
  }
  return port;
})();

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});