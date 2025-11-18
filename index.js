const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = 5000;

app.use(cors())
app.use(express.json())

const uri = "mongodb+srv://zapShift:DA4k7LSE8cNteSoD@cluster0.sc7dsau.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res)=>{
    res.send('hello world')
})


async function run (){
    try{
await client.connect();

const db = client.db('zapShift')
const zapShiftCollection = db.collection('zapShiftCollection')

app.get('/zapShift',async (req, res)=>{
const cursor = zapShiftCollection.find().limit(4);
const result = await cursor.toArray();
res.send(result)

})

await client.db('admin').command({ping:1})


    }
    finally{
// await client.close();
    }
}
run().catch(console.dir)




app.listen(port, ()=>{
    console.log(`smart server running on port...${port}` )
})