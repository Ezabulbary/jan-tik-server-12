const express = require('express')
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sqbew.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('jan-tik').collection('tools');
        const reviewsCollection = client.db('jan-tik').collection('reviews');
        const orderCollection = client.db('jan-tik').collection('orders');

        console.log('db connected');

        // tools
        app.get('/tools', async (req, res) => {
            const tools = await toolsCollection.find().toArray();
            res.send(tools);
        });

        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const tool = await toolsCollection.findOne({ _id: ObjectId(id) });
            res.send(tool);
        });

        app.put('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const updateTool = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upset: true };
            const updateDoc = {
                $set: {
                    available_quantity: updateTool.newQuantity
                }
            };
            const result = await toolsCollection.updateOne(filter, updateDoc, options);
            const item = await toolsCollection.findOne(filter);
            res.send({ result, item });
        });

        // reviews
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewsCollection.find().toArray();
            res.send(reviews);
        });

        // orders
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})