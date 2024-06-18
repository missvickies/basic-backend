
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

//open ai client
const aoaiClient = new OpenAIClient("https://" + process.env.AZURE_OPENAI_API_INSTANCE_NAME + ".openai.azure.com/", 
                    new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY));



async function generateEmbeddings(text) {
    const embeddings = await aoaiClient.getEmbeddings(process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME, text);
    // Rest period to avoid rate limiting on Azure OpenAI  
    await new Promise(resolve => setTimeout(resolve, 500));
    return embeddings.data[0].embedding;
}

const addCollectionContentVectorField = async (doc,db, collectionName) => {
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

module.exports = addCollectionContentVectorField;

