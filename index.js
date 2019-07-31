const express = require('express')
const bodyParser = require('body-parser')
const rp = require('request-promise')
const port = process.env.PORT || 4000
const app = express()
const Stellar = require('stellar-sdk')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true })) 

const HORIZON_ENDPOINT = 'http://127.0.0.1:8000'
const NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"

// Getting instance of Stellar blockchain
Stellar.Network.use(new Stellar.Network(NETWORK_PASSPHRASE));
var opts = new Stellar.Config.setAllowHttp(true);
var server = new Stellar.Server(HORIZON_ENDPOINT, opts);

let accounts = []

// Creating new account 
const creatingAccount = async (req,res) =>{
    try{
        console.log(`creatingAccount method got called`)
        let pair = Stellar.Keypair.random()
        let account = {
            pk : pair.publicKey(),
            sk : pair.secret()
        }
        accounts.push(account)
        res.send(account);
    }catch(err){
        res.send({"Msg" : "ERROR : " + err})
    }
}

// Get 100 coins from root account
const getFromFaucet = async (req,res) =>{
    try{
        const pk = req.body.pk
        if(pk){
            // faucet is our root account. Make sure you replace this value with your key
            let sourceKeys = Stellar.Keypair.fromSecret("SDQVDISRYN2JXBS7ICL7QJAEKB3HWBJFP2QECXG7GZICAHBK4UNJCWK2");
            // loading root account
	    console.log(sourceKeys.publicKey())
            server.loadAccount(sourceKeys.publicKey())
            .then(function(sourceAccount) {
                let txn = new Stellar.TransactionBuilder(sourceAccount)
                            .addOperation(
                                Stellar.Operation.createAccount({
                                destination: pk,
                                startingBalance: "100"}))
                            .addMemo(Stellar.Memo.text('Test Transaction'))
                            .build();
                txn.sign(sourceKeys);
                return server.submitTransaction(txn);
                })
            .then(function(result) {
                res.send({"Msg" : `SUCCESS : ${JSON.stringify(result)}`})
            })
            .catch(function(error) {
                console.error('Something went wrong!', error);
                res.send({"Msg" : `ERROR : ${error}`})
            });
        }else{
            res.send({"Msg" : "ERROR : please provide public key!"})
        }
    }catch(err){
        res.send({"Msg" : `ERROR : ${error}`})
    }
}

// Fetch all created accounts
const getAccounts =  async (req,res) =>{
    res.send(accounts);
}

// Get balance of an account
const getBalance = async (req, res) =>{
    try{
        const pk = req.body.pk;
        let balance = 0;
        // Load newly created accounts
        account = await server.loadAccount(pk)
        // check the balances
        account.balances.forEach((bal) => {
            balance = balance + bal.balance;
        })
        res.send({"Msg" : balance})
    }catch(err){
        res.send({"Msg" : "ERROR : " + err})
    }    
}
                
// Do transactions
const makePayment = async (req,res) => {

    const {from, to, value} =  req.body;
    //Let get the secret of the spender
    const spender = accounts.find((acc) => {
        if(acc.pk === from) return acc;
    })
    if(spender && spender != null){
        // First, check to make sure that the destination account exists.
        // You could skip this, but if the account does not exist, you will be charged
        // the transaction fee when the transaction fails.
        server.loadAccount(to)
        .catch((err)=>{
            res.send({"Msg" : `Error : receiever ${to} not found!`})
        })
        .then(() =>{
            // lets load spender account
            return server.loadAccount(from);
        })
        .then((spenderAccount) => {
            // Start building the transaction.
            const transaction = new Stellar.TransactionBuilder(spenderAccount)
            .addOperation(Stellar.Operation.payment({
                destination: to,
                // Because Stellar allows transaction in many currencies, you must
                // specify the asset type. The special "native" asset represents Lumens.
                asset: Stellar.Asset.native(),
                amount: value
            }))
            // A memo allows you to add your own metadata to a transaction. It's
            // optional and does not affect how Stellar treats the transaction.
            .addMemo(Stellar.Memo.text('Test Transaction'))
            .build()
            // get the key pair for signing the transaction
            const pairA =  Stellar.Keypair.fromSecret(spender.sk);
            // Sign the transaction to prove you are actually the person sending it
            transaction.sign(pairA)
            return server.submitTransaction(transaction);
        })
        .then((result)=>{
            res.send({"Msg" : JSON.stringify(result, null, 2)})
        })
        .catch((err)=>{
            res.send({"Msg" : `Error : Somethis went wrong : ${JSON.stringify(err.response.data.extras)}`})
        })
    }else{
        res.send({"Msg" : `Error : spender  ${to} not found!`})
    }
}
/* CORS */
app.use((req, res, next) => {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*')
  
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
  
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,content-type')
  
    // Pass to next layer of middleware
    next()
})

/* API Routes */
app.get('/newAccount', creatingAccount)
app.get('/accounts', getAccounts)
app.post('/faucet',getFromFaucet)
app.post('/balance', getBalance)
app.post('/payment', makePayment)

/* Serve API */
app.listen(port, () => {
  console.log(`Stellar test app listening on port ${port}!`)
})
