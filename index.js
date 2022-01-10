const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const cors = require('cors');
require('dotenv').config()
const fileUpload = require('express-fileupload')
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const app = express();
const port = process.env.PORT || 5000;

// middleware
// app.use(cors());
app.use(cors({
    origin: '*'
}));
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mhdj2.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect();
        const database = client.db('HeroRiderDB');
        const userCollection = database.collection('users');
        const packageCollection = database.collection('packages');

        // Riders Post API
        app.post('/users', async (req, res) => {
            const dlImg = req.files?.dl?.data;
            const nidImg = req.files.nid.data;
            const profileImg = req.files.profile.data;
            const nidBuffer = Buffer.from(nidImg.toString('base64'), 'base64')
            const profileBuffer = Buffer.from(profileImg.toString('base64'), 'base64')
            let user;
            if (dlImg) {
                const dlBuffer = Buffer.from(dlImg.toString('base64'), 'base64');
                user = {
                    ...req.body,
                    dl: dlBuffer,
                    nid: nidBuffer,
                    profile: profileBuffer
                }
            }
            else {
                user = {
                    ...req.body,
                    nid: nidBuffer,
                    profile: profileBuffer
                }
            }
            const result = await userCollection.insertOne(user);
            res.json(result);
        });

        // All users GET API
        app.get('/users', async (req, res) => {
            const query = {
                $or: [
                    { role: "Rider" },
                    { role: "Learner" }
                ]
            };
            const cursor = userCollection.find(query).project({ name: 1, email: 1, phone: 1, age: 1, role: 1, status: 1 });
            const count = await cursor.count();
            const page = req.query?.page;
            const size = parseInt(req.query?.size);
            const email = req.query?.email;
            let users;

            if (email) {
                users = await userCollection.findOne({ email: email }, { projection: { name: 1, email: 1, phone: 1, role: 1, status: 1 } })
            }
            else if (page) {
                users = await cursor.skip(page * size).limit(size).toArray();
            }
            else {
                users = await cursor.toArray();
            }

            res.json({ count, users });
        })

        app.put('/users', async (req, res) => {
            const status = req.body.status;
            const id = req.body.id;
            const updateDoc = { $set: { status: status } }
            const result = await userCollection.updateOne({ _id: ObjectId(id) }, updateDoc);
            res.json(result);
        })

        // Package Post API
        app.post('/packages', async (req, res) => {
            const package = req.body;
            console.log(package)
            const result = await packageCollection.insertOne(package);
            res.json(result);
        })

        //Package Get API
        app.get('/packages', async (req, res) => {
            const result = await packageCollection.find({}).toArray();
            res.json(result);
        })

        //Single Package Get API
        app.get('/packages/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await packageCollection.findOne(query);
            res.json(result);
        })

        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                automatic_payment_methods: {
                    enabled: true,
                },
            })

            res.json({
                clientSecret: paymentIntent.client_secret,
            });
        })
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('hero rider server is running')
})

app.listen(port, () => {
    console.log('hero rider server is running on port', port);
})