const express = require('express')
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
var nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');

app.use(cors());
app.use(express.json())

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
}

const auth = {
    auth: {
        api_key: `${process.env.MAILGUN_API_KEY}`,
        domain: `${process.env.MAILGUN_DOMAIL}`
    }
}

const nodemailerMailgun = nodemailer.createTransport(mg(auth));

function sendOrderEmail(order) {
    const { customerEmail, customerName, tools, toolsId, pricePerPiece } = order;

    var email = {
        from: "support@phero.com",
        to: customerEmail,
        subject: `Your Order for ${tools} is on ${toolsId} at ${pricePerPiece} is Confirmed`,
        text: `Your Order for ${tools} is on ${toolsId} at ${pricePerPiece} is Confirmed`,
        html:
            `
            <div>
                <p> Hello ${customerName}, </p>
                <h3>Your Order for ${tools} is confirmed</h3>
                <p>Looking forward to Payment to you on ${toolsId} at ${pricePerPiece}.</p>
                <h3>Our Address</h3>
                <p>Andor Killa Bandorban</p>
                <p>Bangladesh</p>
                <a href="https://web.programming-hero.com/">unsubscribe</a>
            </div>
            `,
    };

    nodemailerMailgun.sendMail(email, (err, info) => {
        if (err) {
            console.log(err);
        } else {
            console.log(info);
        }
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sqbew.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('jan-tik').collection('tools');
        const reviewsCollection = client.db('jan-tik').collection('reviews');
        const orderCollection = client.db('jan-tik').collection('orders');
        const usersCollection = client.db('jan-tik').collection('users');
        const profileCollection = client.db('jan-tik').collection('profile');

        console.log('db connected');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        };

        // user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ result, token });
        });

        app.get('/user', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await usersCollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }
        });

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

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

        app.put('/addTools/:id', async (req, res) => {
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

        app.delete('/allTools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        });

        app.post('/addProduct', verifyJWT, verifyAdmin, async (req, res) => {
            const newTools = req.body;
            const result = await toolsCollection.insertOne(newTools);
            res.send(result);
        })

        // reviews
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewsCollection.find().toArray();
            res.send(reviews);
        });

        app.post('/addreview', async (req, res) => {
            const newReview = req.body;
            const result = await reviewsCollection.insertOne(newReview);
            res.send(result);
        });

        // orders
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            sendOrderEmail(order)
            res.send(result);
        });

        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.customerEmail;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { customerEmail: email };
                const result = await orderCollection.find(query).toArray();
                res.send(result);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        });

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.findOne(query);
            res.send(result);
        });

        app.get('/manageOrder', verifyJWT, verifyAdmin, async (req, res) => {
            const orders = await orderCollection.find().toArray();
            res.send(orders);
        })

        
        // profile
        app.put('/myprofile/:email', async (req, res) => {
            const email = req.params.email;
            const info = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: info,
            };
            const result = await profileCollection.updateOne(filter, updateDoc, options);
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