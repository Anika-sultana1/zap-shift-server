const express = require('express');
const cors = require('cors')
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET)



const serviceAccount = require("./zap-shift-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// middleWare
const app = express();
const port = 5000;

const verifyFirebaseToken = async (req, res, next)=>{

    const authorization = req.headers.authorization;
    console.log('authorization holo',authorization)
    console.log('authorization holo',req.headers.authorization)
    if(!authorization){
return res.status(401).send({message: 'unauthorized access'})
    }

   try{
     const token = authorization.split(' ')[1]
     const decoded = await admin.auth().verifyIdToken(token)
     req.decoded_email = decoded.email

   }
   catch(err){
    return res.status(401).send({message: 'unauthorized access'})
   }

next();

}

let userCollection;
// middle admin before allowing admin activity
// must be used after verifyFireBaseToken middleware
const verifyAdmin = async (req, res, next) => {

const email = req.decoded_email

const query ={email}
const user = await userCollection.findOne(query)

if(!user || user.role !== 'admin'){
    return res.status(403).send({message:'access forbidden'})
}

    next();
}

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
         userCollection = db.collection('users')
        const zapShiftCollection = db.collection('zapShiftCollection')
        const parcelsCollections = db.collection('parcels')
        const riderCollections = db.collection('riders')
        const paymentCollection = db.collection('payments')

// user related apis 


app.get('/users/:id', async (req, res)=>{

})

app.get('/users/:email/role', async(req, res)=>{
    const email = req.params.email
    const query = {email};
    const userResult = await userCollection.findOne(query)
    res.send({role: userResult?.role || 'user'})
})



app.get('/users', verifyFirebaseToken, async (req, res)=>{

    console.log('req er query er holo', req.query)
    const search = req.query.searchText 
    console.log('searchText', search)
const query = {};
if(search){
    query.displayName = { $regex: search, $options: 'i' };

    // query.$or = [
    //     {displayName: {$regex:searchText , $option:1}}
    // ]
}

    const cursor = userCollection.find(query).sort({createdAt:-1}).limit(5);
    const result = await cursor.toArray();
    res.send(result)
})

app.post('/users', async(req, res)=>{
    const user = req.body;
    user.role = 'user';
    user.createdAt=new Date()
const query = {email:user.email}
const userExist = await userCollection.findOne(query)

if(userExist){
    return res.send({message:'user exist'})
}


    const result = await userCollection.insertOne(user)
    res.send(result)
})

app.patch('/users/:id/role',verifyFirebaseToken,verifyAdmin, async (req, res)=>{
    const id = req.params.id;
    const roleInfo = req.body;
    const query ={_id: new ObjectId(id)}
    const updatedDoc = {
        $set:{
            role:roleInfo.role
        }
    }
    const result = await userCollection.updateOne(query, updatedDoc);
    res.send(result)
})

        // parcel apis 
        app.get('/parcels', async (req, res) => {
            const query = {};
            const { email , deliveryStatus} = req.query;

            if (email) {
                query.senderEmail = email
            }
             if(deliveryStatus){
                query.deliveryStatus = deliveryStatus;
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

        app.patch('/parcels/:id', async(req, res)=>{
            const { riderName, riderEmail, riderId,} = req.body;
       const id = req.params.id;
       const query = {_id: new ObjectId(id)}
const updatedDoc = {
    $set:{
deliveryStatus: 'driver_assigned',
riderId:riderId,
riderName:riderName,
riderEmail:riderEmail,
    }

}       
const result = await parcelsCollections.updateOne(query, updatedDoc)
// update rider information 
const riderQuery = {_id: new ObjectId(riderId)}
const riderUpdatedDoc = {
    $set:{
        workStatus: 'in_delivery',
    }
}
const riderResult = await riderCollections.updateOne(riderQuery, riderUpdatedDoc)
res.send(riderResult)



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
           
            const transactionId = session.payment_intent
            const query = {transactionId:transactionId}
            const paymentExist = await paymentCollection.findOne(query)
if(paymentExist){
    return res.send({message:'already exist',
         transactionId,
        trackingId:paymentExist.trackingId})
}


 if (session.payment_status === 'paid') {
            const id = session.metadata.parcelId
        
            const query = { _id: new ObjectId(id) }
            const update = {
                $set: {
                    paymentStatus: 'paid',
                    deliveryStatus: 'pending-pickup',
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
trackingId:trackingId,

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

          return res.send({ success: false })
        })
       
        // payment related apis 

        app.get('/payments', verifyFirebaseToken, async (req, res)=>{
            const email = req.query.email;
            const query = {};
            if(email){
                query.customerEmail = email

                if(email !== req.decoded_email){
                    return res.status(403).send({message: 'unauthorized access'})
                }
            }
            const cursor = paymentCollection.find(query).sort({paidAt:-1})
            const result = await cursor.toArray();
            res.send(result);
        })


        app.post('/riders', async(req, res)=>{

const rider = req.body;
rider.status = 'pending';
rider.createdAt = new Date();
const result = await riderCollections.insertOne(rider)
res.send(result)

        })

        app.get('/riders', /*verifyFirebaseToken,**/ async (req, res)=>{
             //const query = {statusL: 'pending'}
            const {status,district, workStatus} = req.query
            const query = { };
            if(status){
                query.status =status;
            }
            if(district){
                query.district = district
            }
            if(workStatus){
                query.workStatus = workStatus;
            }
            const cursor = riderCollections.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.delete('/riders/:id', async (req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await riderCollections.deleteOne(query)
            res.send(result)
        })
app.patch('/riders/:id', async (req, res) => {
  const id = req.params.id;
  const { status, email } = req.body;

  const query = { _id: new ObjectId(id) };

  // update rider table status
  const update = { $set: { status } };
  const riderResult = await riderCollections.updateOne(query, update);

  // check the user first
  const user = await userCollection.findOne({ email });

  // if user is admin → skip role update
  if (user?.role === "admin") {
    return res.send({
      modifiedCount: riderResult.modifiedCount,
      userRoleUpdated: 0,
      message: "Admin role not changed"
    });
  }

  // update user role only if not admin
  const userResult = await userCollection.updateOne(
    { email },
    { $set: { role: status === "approved" ? "rider" : "user" } }
  );

  res.send({
    modifiedCount: riderResult.modifiedCount,
    userRoleUpdated: userResult.modifiedCount
  });
});


app.get('/riders/:id', async (req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await riderCollections.findOne(query)
    res.send(result)
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