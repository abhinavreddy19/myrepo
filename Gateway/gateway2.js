require('dotenv').config(); //For accessing env variables
const Web3 = require('web3'); //For interacting with smart contract.
// const express = require('express') //For the backend server.
const Sample = require('./build/contracts/Sample.json'); //Get and instance of the contract.
const mqtt = require('mqtt');
const ecies = require("eciesjs");
const elliptic = require('elliptic');
const sha3 = require('js-sha3');

const client  = mqtt.connect('mqtt://test.mosquitto.org')

const URL = 'ws://127.0.0.1:8438';
const web3 = new Web3(URL);

const ec = new elliptic.ec('secp256k1');

//Provide the abi and address of the smart contract to get it's object
const sample = new web3.eth.Contract(
    Sample.abi,
    Sample.networks['143'].address
    );
// Now we can use this contract instance to call methods, send transactions, etc.

var txCount = null;

var networkId;
web3.eth.net.getId().then((res) => {
    networkId = res;
});

/*
The below functions takes 4 parameters:
1. Name of the smart contract function to be invoked.
2. NetworkId of the private network.
3. A string describing the function
4. Array of arguments for the smart contract function.

Returns: An object with variables "tx" and "error"
One of them would be 'null' depending upon the error status. 
*/
async function create_transaction(func, str, args) {

    try{        
    const tx = func(...args);
    const gas = await tx.estimateGas({from: process.env.address2});
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(process.env.address2);

    const signedTx = await web3.eth.accounts.signTransaction(
        {
        to: sample.options.address, 
        data,
        gas,
        gasPrice,
        nonce,     
        chainId: networkId   
        },
        process.env.PRIV_KEY2
    ); 

    return {tx: signedTx, error: null};
    }
    catch{
        return {tx: null, error: str + " transaction failed..."};
    }
    
}

function encrypt(snd, pubK){
    //Uses receivers public key to encrypt.    
    let cipher = ecies.encrypt(pubK, Buffer.from(JSON.stringify(snd)));
    let cipher_str = cipher.toString('hex');
    return cipher_str;
}

function decrypt(rcv){
    //Uses own private key to decrypt.
    let cipher_str = rcv.toString();
    // console.log("Received - Encrypted message (String): ", cipher_str);
    let cipher = Buffer.from(cipher_str,'hex');
    // console.log("Received - Encrypted message (Buffer): ", cipher);
    data = ecies.decrypt(process.env.PRIV_KEYX2, cipher).toString();  
    data = JSON.parse(data);
    return data;
}

function sign_it(){
    let msg =  "";
    for (let i=0;i<arguments.length;i++)
        msg += arguments[i];
    let msgHash = sha3.keccak256(msg);
    console.log("Message hash: ", msgHash);
    let signature = ec.sign(msgHash, process.env.PRIV_KEY2, "hex", {canonical: true});

    //The signature below consists of parameters 'r' and 's'.
    var sign_str = JSON.parse(JSON.stringify(signature));
    return sign_str;
}

function verify(signature, pubK){
    let pubKeyObj = ec.keyFromPublic(pubK,"hex");

    let msg =  "";
    for (let i=2;i<arguments.length;i++)
      msg += arguments[i];
    let msgHash = sha3.keccak256(msg);
  
    let auth_status = pubKeyObj.verify(msgHash, signature);
  
    return auth_status;
}

function check_request(){
    
}

/*
    Gateway registration:
    1. Gateway can register itself by executing a transaction.
    2. The smart contract stores this gateway as "registered".

    Gateway authentication and transaction: Everytime the gateway wants to perform a transaction, 
    it has to use a new nonce in the transaction object
*/

const register = async () => {    
    
    console.log("========= WELCOME TO GATEWAY 2 =========\n");
    var hash = web3.utils.soliditySha3('Register');
    var sign = web3.eth.accounts.sign(hash, process.env.PRIV_KEY2);

    console.log("\n----Requesting registration----");
    var res = await create_transaction(sample.methods.register_gateway, "Gateway registration", [sign.signature]);
    if(res.error)
        return false;
    var receipt = await web3.eth.sendSignedTransaction(res.tx.rawTransaction);
    // console.log("Transaction hash: ", receipt);    
    return true;    
}


client.on('connect', () => {
    console.log("Connected !!");    
})
register().then((res) => {
    if(res)
    {   
        console.log("---------------------------------");     
        console.log("Registration successful !!");        
        client.subscribe('gateway2/register', (err) => {
            if(!err)
            console.log("-----Listening for registration requests from devices-----");
        })
        client.subscribe('gateway2/nonce', (err) => {
            if(!err)
            console.log("-----Ready to send nonces-----");
        })
        client.subscribe('gateway2/auth', (err) => {
            if(!err)
            console.log("-----Ready to authenticate devices-----");
        })
        console.log("---------------------------------");
    }   
    else
    {
        console.log("---------------------------------"); 
        console.log("Registration unsuccessful...");
        console.log("---------------------------------"); 
    } 
});



sample.events.test().on('data', eve => {
    console.log("Received an event: ", eve.returnValues._str);
})

sample.events.receive_message({
    filter: {gateway: [process.env.address2]},
    fromBlock: "latest"
}).on('data', async (eve) => {
    console.log("Notification of a message received for the device: \n", eve.returnValues.devId);
    let msg = await sample.methods.getMessage().call({from: process.env.address2});
    let date_obj = new Date();
    let time_stamp = date_obj.toString();
    let sign = sign_it(time_stamp);
    let snd = {
        remark: "message",
        sign: sign,
        time_stamp: time_stamp,
        from: msg.from,
        msg: msg._str
    };     
    console.log("From the device: ", msg.from, "\nEncrypted Message: ", msg._str.substring(0,40), "...");  
    let pubKey = await sample.methods.get_device_key(eve.returnValues.devId).call({from: process.env.address2});
    let enc_data = encrypt(snd, pubKey);
    client.publish(eve.returnValues.devId, enc_data);  
})

/***************Below are mqtt listeners for requests from devices*************/
client.on('message', async (topic, rcv) => {

    if(topic === 'gateway2/register')
    {    
        /**
        This means a device is requesting for registraion.
        1. Obtain the cipher string format from the received buffer.
        2. Convert it to cipher buffer for decryption.
        3. Parse it to retrieve the data.
        */
        var data = decrypt(rcv);
        console.log("Data received: ", data);
        console.log("Registration request received from deviceId: ", data.devId); 
        let auth_status = verify(data.sign, data.pubKey, data.TS);
        if(auth_status)
            console.log("Timestamped signature verified...Valid registration request");
        else{
            console.log("Timestamped signature verification failed...Invalid registration request");
            return;
        }        
        // var nonce = await sample.methods.getNonce().call({from: process.env.address2});
        // var hash = web3.utils.soliditySha3(data.devId, data.pubKey, nonce);
        // var sign = web3.eth.accounts.sign(hash, process.env.PRIV_KEY2);
        let ans = await create_transaction(
            sample.methods.register_device, 
            "Device register", 
            [data.devId, data.pubKey, data.TS]
        );
        if(ans.error)
        {     
            let snd = {
                remark: "register",
                status: false
            };
            let enc_data = encrypt(snd, data.pubKey);
            console.log(ans.error);   
            client.publish(data.devId, enc_data);
        }
        else
        {            
            var receipt = await web3.eth.sendSignedTransaction(ans.tx.rawTransaction);
            console.log("Device registered successfully !!");
            let snd = {
                remark: "register",
                status: true
            };
            let enc_data = encrypt(snd, data.pubKey);
            client.publish(data.devId, enc_data);
        }
    }
    else if(topic === "gateway2/nonce")
    {
        /*
        This means the device is requesting the nonce for an authenticated request in the next step.        
        */
        var data = decrypt(rcv);
        console.log("Data received at gateway2/nonce: ", data);

        //First check whether the device is registered or not.
        var dev_TS = await sample.methods.check_device(data.devId).call({from: process.env.address2});
        if(dev_TS === ""){
            console.log("Device not registered...");
            return;
        }            
        dev_TS = new Date(dev_TS);
        
        var cur_dev_TS = new Date(data.TS);
        if(cur_dev_TS.getTime() < dev_TS.getTime())
        {
            console.log("Repeated request by the device!!");
            return;
        }

        //Create a signature with latest timestamp of the gateway
        let date_obj = new Date();
        let time_stamp = date_obj.toString();
        let sign = sign_it(time_stamp);
        let snd = {
            remark: "nonce",
            sign: sign,
            time_stamp: time_stamp
        };        

        //nonce is returned as 0 if either gateway is not registered or device is not under this gateway.
        let nonce = await sample.methods.get_device_nonce(data.devId).call({from: process.env.address2});
        if(nonce !== 0)
        {
            //If the device is registered then return the nonce.
            snd = {
                ...snd,
                status: true,
                nonce: nonce
            }            
            // console.log("Signature is: ", sign);
            let ans1 = await create_transaction(
                sample.methods.update_timestamp, 
                "Time stamp update", 
                [data.devId, cur_dev_TS.toString()]
            );
            if(!ans1.error){
                console.log("Updating timestamp...");
                var receipt = await web3.eth.sendSignedTransaction(ans1.tx.rawTransaction);
            }
            
            if(data.recvId)
            {
                //Get the public key of the receiver and send it along with the nonce.
                let ans2 = await create_transaction(
                    sample.methods.update_recipient, 
                    "Recipient update", 
                    [data.devId, data.recvId]
                );
                if(!ans2.error){
                    console.log("Updating recipient...");
                    var receipt = await web3.eth.sendSignedTransaction(ans2.tx.rawTransaction);
                }
                let recvKey = await sample.methods.get_device_key(data.recvId).call({from: process.env.address2});
                snd = {
                    ...snd,
                    recvKey: recvKey
                }
            }
            console.log("Sending nonce (and receiver's public key)response ", snd);
            let pubKey = await sample.methods.get_device_key(data.devId).call({from: process.env.address2});
            let enc_data = encrypt(snd, pubKey);
            client.publish(data.devId, enc_data);
        }
        else
        {
            // snd = {
            //     ...snd,
            //     status: false
            // }
            // let pubKey = await sample.methods.get_device_key(data.devId).call({from: process.env.address2});
            // let enc_data = encrypt(snd, pubKey);
            // client.publish(data.devId, enc_data);
            console.log("Invalid gateway !!");
        }
    }
    else if(topic === "gateway2/auth")
    {
        /**
        This means device is requesting for authentication or a communication request. 
        So it has to contain a signature and encrypted with this gateway's timestamp.               
        */
        var data = decrypt(rcv);
        console.log("Data received at gateway2/auth: ", data);

        //Verify the message and then process the request.
        let nonce = await sample.methods.get_device_nonce(data.devId).call({from: process.env.address2});
        if(nonce === 0)
            console.log("Invalid gateway !!");
        let pubKey = await sample.methods.get_device_key(data.devId).call({from: process.env.address2});

        let pubKeyObj = ec.keyFromPublic(pubKey,"hex");
        let msgHash = sha3.keccak256(nonce);

        /* Verify the signature along with the hash */
        let auth_status = pubKeyObj.verify(msgHash, data.sign);
        console.log("Device authentication status: ", auth_status);
        let curCount = await web3.eth.getTransactionCount(process.env.address2);

        if(auth_status || !txCount || (curCount > txCount))
        {
            //That means the msg is stored in the blockchain and receiver is notifed.
            let ans = await create_transaction(
                sample.methods.communicate, 
                "Message communication", 
                [data.devId, data.msg]
            );
            if(!ans.error){
                console.log("Sending message...");
                var receipt = await web3.eth.sendSignedTransaction(ans.tx.rawTransaction);
            }
            
        }

        //Prepare a response with latest timestamp
        let date_obj = new Date();
        let time_stamp = date_obj.toString();
        let sign = sign_it(time_stamp);
        let snd = {
            remark: "auth",
            sign: sign,
            time_stamp: time_stamp,
            status: auth_status
        };
        
        let enc_data = encrypt(snd, pubKey);
        client.publish(data.devId, enc_data);
        console.log("Auth response sent !!");
        
    }
})