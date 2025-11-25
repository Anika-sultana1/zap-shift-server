const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const app = express();
const port = 5000;



const crypto = require("crypto");

const generateTrackingId = () => {
  const prefix = "TRK"; // You can change this to anything
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); 
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); 
  return `${prefix}-${date}-${random}`;
};

// module.exports = generateTrackingId;



app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('hello world')
})


async function run() {
    try {
        await client.connect();

        const db = client.db('zapShift')
        const zapShiftCollection = db.collection('zapShiftCollection')
        const parcelsCollections = db.collection('parcels')

        const paymentCollection = db.collection('payments')
        // parcel apis 
        app.get('/parcels', async (req, res) => {
            const query = {};
            const { email } = req.query;

            if (email) {
                query.senderEmail = email
            }

            const options = { sort: { createdAt: -1 } }

            const cursor = parcelsCollections.find(query, options)
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();
            const result = await parcelsCollections.insertOne(parcel)
            res.send(result)
        })


        app.get('/zapShift', async (req, res) => {
            const cursor = zapShiftCollection.find().limit(4);
            const result = await cursor.toArray();
            res.send(result)

        })

        app.get('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await parcelsCollections.findOne(query)
            res.send(result)
        })



        // payment related api 

        app.post('/payment-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100
            const session = await stripe.checkout.sessions.create(
                {
                    line_items: [
                        {

                            price_data: {
                                currency: 'USD',
                                unit_amount: amount,
                                product_data: {
                                    name: `Please pay for : ${paymentInfo.parcelName}`
                                }
                            },
                            quantity: 1,
                        },
                    ],
                    mode: 'payment',
                    metadata: { parcelId: paymentInfo.parcelId, parcelName:paymentInfo.parcelName },
                    customer_email: paymentInfo.senderEmail,
                    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
                }
            )
            res.send({ url: session.url })
        })


        // ------------------------------------this all are my practises-------------------

// app.patch('/verify-payment-success', async(req, res)=>{
//     const sessionId = req.query.session_id;
//     const session = await stripe.checkout.sessions.retrieve(sessionId)
//     const trackingId = generateTrackingId();

//     if(session.payment_status === 'paid'){
// const id = session.metadata.parcelId;
// const query= {_id: new ObjectId(id)}
// const update = {
//     $set:{
//         parcelId:session.metadata.parcelId,
//         trackingId: trackingId,
//     }
// }
// const result = await parcelsCollections.updateOne( query,update,)

// const payment = {
//     amount: session.amount_total/100,
//     currency:session.currency,
//     customerEmail:session.customer_email,
//     transactionId:session.payment_intent,
//     parcelId:session.metadata.parcelId,
//     parcelName:session.metadata.parcelName,
//     paidAt:new Date(),
// }

// if(session.payment_status === 'paid'){
//     const resultPayment = await paymentCollection.insertOne(payment)
//     res.send({
//         success:true,
//         modifyParcel:result,
//         paymentInfo:resultPayment,
//         trackingId:trackingId,
//         transactionId:session.payment_intent,
//     })
// }


//     }

// res.send({success:false})
// })



//         app.post('/payment-checkout-session', async(req,res)=>{
//             const paymentInfo = req.body;
//             const amount = parseInt(paymentInfo.cost)*100
//            const session = await stripe.checkout.sessions.create({
//     line_items: [
//       {
//         // Provide the exact Price ID (for example, price_1234) of the product you want to sell
//         price_data: {
//             currency: 'USD',
//             unit_amount: amount,
//             product_data: {
//                 name: `Please pay for : ${paymentInfo.parcelName}`
//             }
//         },
//         quantity: 1,
//       },
//     ],
//     mode: 'payment',
//     metadata: {parcelId:paymentInfo.parcelId, parcelName:paymentInfo.parcelName},
//     senderEmail:paymentInfo.senderEmail,
//     success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
//   });
//   res.send({url:session.url})
//         })


// app.post('/create-checkout-session', async(req, res)=>{

// const paymentInfo = req.body;
// const amount = parseInt(paymentInfo.cost) *100
// const session = await stripe.checkout.sessions.create({
//     line_items: [
//       {
       
//         price_data:{
//         currency:'USD', 
//         unit_amount: amount,
//         product_data:{
//             name:`please pay for : ${paymentInfo.parcelName}`
//         }
//         },

//         quantity: 1,
//       },
//     ],
//     mode: 'payment',
//     metadata:{parcelId:paymentInfo.parcelId},
//     customer_email:paymentInfo.senderEmail,
//     success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
//     cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
//   });
// res.send({url: session.url})
// })

// app.patch('/payment-success-verify', async (req, res)=>{
//     const sessionId = req.query.session_id
// const trackingId = generateTrackingId();
//     const session = await stripe.checkout.sessions.retrieve(sessionId)
// if(session.payment_status === 'paid'){
//     const id = session.metadata.parcelId;
//     const query = {_id: new ObjectId(id)}
//     const update ={
//         $set:{
//             paymentStatus: 'paid',
//             trackingId: trackingId,
//         }
//     }
//     const result = await parcelsCollections.updateOne(query, update)
    
//     const payment = {
//         amount: session.amount_total/100,
        
//         currency: session.currency,
//         customerEmail: session.customer_email,
//         parcelId: session.metadata.parcelId,
//         parcelName: session.metadata.parcelName,
//         transactionId: session.payment_intent,
//         paymentStatus: session.payment_status,
//         paidAt: new Date(),

//     }

//     if(session.payment_status === 'paid'){
//         const resultPayment = await paymentCollection.insertOne(payment)
//         res.send({
//             success:true, 
//             modifyParcel:result,
//             transactionId: session.payment_intent,
//             trackingId:trackingId, 
//             paymentInfo: resultPayment})
//     }
    
    
// }


// res.send({success: false})

// })

        app.patch('/payment-success', async (req, res) => {
            const sessionId = req.query.session_id;
            console.log('sessionId ', sessionId)
            const trackingId = generateTrackingId();
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            console.log('session retrieve', session)
           
 if (session.payment_status === 'paid') {
            const id = session.metadata.parcelId
        
            const query = { _id: new ObjectId(id) }
            const update = {
                $set: {
                    paymentStatus: 'paid',
                    trackingId: trackingId 
                  
                }
            }


const result = await parcelsCollections.updateOne(query, update)
// res.send(result)


const payment = {
    amount: session.amount_total/100,
    currency: session.currency,
    customerEmail:session.customer_email,
    parcelId: session.metadata.parcelId,
    parcelName: session.metadata.parcelName
, transactionId: session.payment_intent,
paymentStatus: session.payment_status,
paidAt: new Date(),

}

if(payment.paymentStatus === 'paid'){

    const resultPayment = await paymentCollection.insertOne(payment)
    res.send({success: true,
         modifyParcel: result, 
         trackingId:trackingId ,
         transactionId: session.payment_intent,
         paymentInfo: resultPayment})
}


        }

            res.send({ success: false })
        })
       

        // old 
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name: paymentInfo.parcelName,

                            }

                        },

                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo.senderEmail,
                mode: 'payment',
                metadata: { parcelId: paymentInfo.parcelId },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
            });

            console.log(session)
            res.send({ url: session.url })
        })



        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const result = await parcelsCollections.deleteOne(query)
            res.send(result)
        })


        await client.db('admin').command({ ping: 1 })


    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir)




app.listen(port, () => {
    console.log(`smart server running on port...${port}`)
})