require("dotenv").config();
const Web3 = require("web3");
const Sample = require("./build/contracts/Sample.json");
const mqtt = require("mqtt");
const { Crypto } = require("@zilliqa-js/util");

const ecies = require("eciesjs");
const elliptic = require("elliptic");
const sha3 = require("js-sha3");
const { bls, privateKeyToPublicKey } = require("@zilliqa-js/crypto");
const lbr1id = "8080";

// const { BN, Long, bytes, units } = require("@zilliqa-js/util");
// const { Zilliqa } = require("@zilliqa-js/zilliqa");
// const { fromBech32Address, toBech32Address, getAddressFromPrivateKey } = require("@zilliqa-js/crypto");

// const zilliqa = new Zilliqa("https://dev-api.zilliqa.com/");

console.log("zzzzzz");
// console.log(JSON.stringify(zilliqa.crypto));
const client = mqtt.connect("mqtt://test.mosquitto.org");

const URL = "ws://127.0.0.1:8438";
const web3 = new Web3(URL);
const { Transaction } = require("ethereumjs-tx");

const ec = new elliptic.ec("secp256k1");

//Provide the abi and address of the smart contract to get it's object
const sample = new web3.eth.Contract(
  Sample.abi,
  Sample.networks["143"].address
);
// Now we can use this contract instance to call methods, send transactions, etc.

var txCount = null;
//array to store devices under this gateway
var devices = [];
var devpubkeys = [];
var devids = [];
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
  try {
    const tx = func(...args);
    const gas = await tx.estimateGas({ from: process.env.address });
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(process.env.address);

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: sample.options.address,
        data,
        gas,
        gasPrice,
        nonce,
        chainId: networkId,
      },
      process.env.PRIV_KEY
    );

    return { tx: signedTx, error: null };
  } catch {
    return { tx: null, error: str + " transaction failed..." };
  }
}

function encrypt(snd, pubK) {
  //Uses receivers public key to encrypt.
  let cipher = ecies.encrypt(pubK, Buffer.from(JSON.stringify(snd)));
  let cipher_str = cipher.toString("hex");
  return cipher_str;
}

function decrypt(rcv) {
  //Uses own private key to decrypt.
  let cipher_str = rcv.toString();
  // console.log("Received - Encrypted message (String): ", cipher_str);
  let cipher = Buffer.from(cipher_str, "hex");
  // console.log("Received - Encrypted message (Buffer): ", cipher);
  data = ecies.decrypt(process.env.PRIV_KEYX, cipher).toString();
  data = JSON.parse(data);
  return data;
}

function sign_it() {
  let msg = "";
  for (let i = 0; i < arguments?.length; i++) msg += arguments[i];
  let msgHash = sha3.keccak256(msg);
  // process.env.PRIV_KEY
  let signature = ec.sign(msgHash, process.env.PRIV_KEY, "hex", {
    canonical: true,
  });

  //The signature below consists of parameters 'r' and 's'.
  var sign_str = JSON.parse(JSON.stringify(signature));
  return sign_str;
}

function verify(signature, pubK) {
  let pubKeyObj = ec.keyFromPublic(pubK, "hex");

  let msg = "";
  for (let i = 2; i < arguments.length; i++) msg += arguments[i];
  let msgHash = sha3.keccak256(msg);

  let auth_status = pubKeyObj.verify(msgHash, signature);

  return auth_status;
}
// // set the provider
// zilliqa.wallet.addByPrivateKey(
//   "0x478f4dca17660fefda1b684e91a7aa3b23f6a4aa7da9303bf6529fc054792136"
// );

const { keccak } = require("ethereumjs-util");
const EthereumTx = require("ethereumjs-tx").Transaction;

function aggregateSignatures(signatures) {
  const encodedSigs = signatures.map((sig) => Buffer.from(sig.slice(2), "hex"));
  const hashedSigs = encodedSigs.map((sig) => keccak(sig));
  const combinedSig = hashedSigs.reduce(
    (acc, curr) => acc + curr.toString("hex"),
    ""
  );
  const finalSig = keccak(Buffer.from(combinedSig, "hex"));
  return "0x" + finalSig.toString("hex");
}

const { toChecksumAddress } = require("ethereumjs-util");

function getAddressFromPrivateKey(privateKey) {
  const tx = new Transaction({
    nonce: "0x00",
    gasPrice: "0x09184e72a000",
    gasLimit: "0x2710",
    to: "0x0000000000000000000000000000000000000000",
    value: "0x00",
    data: "0x",
  });
  tx.sign(Buffer.from(privateKey, "hex"));
  const address = tx.getSenderAddress();
  return toChecksumAddress("0x" + address.toString("hex"));
}

async function signAggregated(msg, privateKey) {
  const nonce = await web3.eth.getTransactionCount(
    getAddressFromPrivateKey(privateKey),
    "pending"
  );
  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = 10000;

  const rawTx = {
    nonce: web3.utils.toHex(nonce),
    gasPrice: web3.utils.toHex(gasPrice),
    gasLimit: web3.utils.toHex(gasLimit),
    to: sample.address,
    data: web3.utils.toHex(JSON.stringify(msg)),
    chainId: 1,
  };

  const tx = new EthereumTx(rawTx, { chain: "mainnet" });
  //console.log(Buffer.from(("00" + privateKey).slice(2), 'hex').length);
  tx.sign(Buffer.from(("00" + privateKey).slice(2), "hex"));

  const serializedTx = tx.serialize();
  const signature = "0x" + serializedTx.toString("hex");

  return signature;
}

async function createAggregateSignature(devices) {
  const signPromises = devices.map(async (device) => {
    const privateKey = device;

    console.log(privateKey);
    const signature = await signAggregated(msg, privateKey);
    return signature;
  });

  const signatures = await Promise.all(signPromises);

  const aggregateSignature = aggregateSignatures(signatures);

  //console.log("Aggregate Signature: ", aggregateSignature);
  return aggregateSignature;
}

//creating a topology for routing in between border routers
//source would be the gateway

/*
    Gateway registration:
    1. Gateway can register itself by executing a transaction.
    2. The smart contract stores this gateway as "registered".

    Gateway authentication and transaction: Everytime the gateway wants to perform a transaction, 
    it has to use a new nonce in the transaction object
*/

const register = async () => {
  console.log("========= WELCOME TO GATEWAY 1 =========\n");
  var hash = web3.utils.soliditySha3("Register");
  var sign = web3.eth.accounts.sign(hash, process.env.PRIV_KEY);

  console.log("\n----Requesting registration----");
  var res = await create_transaction(
    sample.methods.register_gateway,
    "Gateway registration",
    [sign.signature]
  );
  if (res.error) return false;
  var receipt = await web3.eth.sendSignedTransaction(res.tx.rawTransaction);
  console.log(res);
  return true;
};
var id;
var msg = {
  id: "authenticate",
  time: Date.now(),
};

client.on("connect", () => {
  console.log("-----Connected to the broker-----");
});
register().then((res) => {
  if (res) {
    console.log("---------------------------------");
    console.log("-----Registration successful-----");
    client.subscribe("gateway1/priv", (err) => {
      if (!err)
        console.log("-----Listening for private keys from devices-----");
    });
    client.subscribe("gateway1/register", (err) => {
      if (!err)
        console.log(
          "-----Listening for registration requests from devices-----"
        );
    });
    client.subscribe("gateway1/nonce", (err) => {
      if (!err) console.log("-----Ready to send nonces-----");
    });
    client.subscribe("gateway1/auth", (err) => {
      if (!err)
        console.log("-----Ready to authenticate and transfer messages-----");
    });
    console.log("---------------------------------");
  } else {
    console.log("---------------------------------");
    console.log("Registration unsuccessful...");
    console.log("---------------------------------");
  }
});

sample.events
  .receive_message({
    filter: { gateway: [process.env.address] },
    fromBlock: "latest",
  })
  .on("data", async (eve) => {
    console.log(
      "Notification of a message received for the device: ",
      eve.returnValues.devId
    );
    let msg = await sample.methods
      .getMessage()
      .call({ from: process.env.address });
    let date_obj = new Date();
    let time_stamp = date_obj.toString();
    let sign = sign_it(time_stamp);
    let snd = {
      remark: "message",
      sign: sign,
      time_stamp: time_stamp,
      from: msg.from,
      msg: msg._str,
    };
    console.log("From device: ", msg.from, "Message: ", msg._str);
    let pubKey = await sample.methods
      .get_device_key(eve.returnValues.devId)
      .call({ from: process.env.address });
    let enc_data = encrypt(snd, pubKey);
    client.publish(eve.returnValues.devId, enc_data);
  });
function bgprouting(graph, start, end) {
  const distances = {};
  const previous = {};
  const nodes = new Set();
  let path = [];

  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    nodes.add(node);
  }

  distances[start] = 0;

  while (nodes.size > 0) {
    let smallestNode = null;
    for (const node of nodes) {
      if (smallestNode === null || distances[node] < distances[smallestNode]) {
        smallestNode = node;
      }
    }

    if (smallestNode === end) {
      while (previous[smallestNode]) {
        path.push(smallestNode);
        smallestNode = previous[smallestNode];
      }
      break;
    }

    nodes.delete(smallestNode);

    for (const neighbor in graph[smallestNode]) {
      const distance = distances[smallestNode] + graph[smallestNode][neighbor];

      if (distance < distances[neighbor]) {
        distances[neighbor] = distance;
        previous[neighbor] = smallestNode;
      }
    }
  }

  return path.concat([start]).reverse();
}

const graph = {
  8080: {
    8081: 1,
    8082: 5,
  },
  8081: {
    8080: 1,
    8082: 2,
  },
  8082: {
    8080: 5,
    8081: 2,
  },
};

/***************Below are mqtt listeners for requests from devices*************/
client.on("message", async (topic, rcv) => {
  let st, en;

  if (topic === "gateway1/register") {
    var data = decrypt(rcv);
    console.log(
      "Received cipher text: ",
      rcv.toString().substring(0, 40),
      "...\n"
    );
    console.log("Decrypting with private key of lbr...");
    console.log("Decrypted device registration request: \n", data);
    let reg_status = verify(data.sign, data.pubKey, data.TS);
    if (reg_status) {
      console.log(
        "Timestamped signature verified - Valid registration request"
      );
    } else {
      console.log(
        "Timestamped signature verification failed - Invalid registration request"
      );
      return;
    }
    let ans = await create_transaction(
      sample.methods.register_device,
      "Device register",
      [data.devId, data.pubKey, data.TS]
    );
    if (ans.error) {
      let snd = {
        remark: "register",
        status: false,
      };
      let enc_data = encrypt(snd, data.pubKey);
      console.log(ans.error);
      client.publish(data.devId, enc_data);
    } else {
      var receipt = await web3.eth.sendSignedTransaction(ans.tx.rawTransaction);
      //console.log(ans.tx.rawTransaction);
      console.log("--Device registered successfully--");
      //devices.push(data.devId);
      devpubkeys.push(data.pubKey);
      devids.push(data.devId);
      console.log(data.devId.length);
      //msg.id=data.devId;
      console.log(msg);
      console.log("Devices under lbr1 :", devids);
      if (devices.length != 0) {
        createAggregateSignature(devices).then((result) => {
          console.log("Aggregate Signature: ", result);
        });
      }
      receipt = {
        ...receipt,
        logsBloom: "",
      };
      // en = performance.now();
      console.log("Time for registration: ", en - st);
      console.log("Transaction created: \n", receipt);
      let snd = {
        remark: "register",
        status: true,
      };
      let enc_data = encrypt(snd, data.pubKey);
      client.publish(data.devId, enc_data);
    }
  } else if (topic === "gateway1/nonce") {
    /*
        This means the device is requesting the nonce for an authenticated request in the next step.        
        */
    var data = decrypt(rcv);
    console.log(
      "Encrypted authentication request received: ",
      rcv.toString().substring(0, 40),
      "...\n"
    );
    if (!data.recvId) {
      data = {
        devId: data.devId,
        TS: data.TS,
      };
    } else {
      console.log("Destination DeviceID :", data.recvId);
    }
    console.log("Decrypted authentication request:  \n", data);

    //First check whether the device is registered or not.
    var dev_TS = await sample.methods
      .check_device(data.devId)
      .call({ from: process.env.address });
    if (dev_TS === "") {
      console.log("Device not registered...");
      return;
    }
    dev_TS = new Date(dev_TS);

    var cur_dev_TS = new Date(data.TS);
    // console.log("Latest request present in blockchain: ", dev_TS.toString());
    // console.log("Timestamp of the current request: ", cur_dev_TS.toString());
    if (cur_dev_TS.getTime() <= dev_TS.getTime()) {
      console.log("---replay attack detected---");
      return;
    }

    //Create a signature with latest timestamp of the gateway
    let date_obj = new Date();
    let time_stamp = date_obj.toString();
    let sign = sign_it(time_stamp);
    let snd = {
      remark: "nonce",
      sign: sign,
      time_stamp: time_stamp,
    };

    //nonce is returned as 0 if either gateway is not registered or device is not under this gateway.
    console.log("Retrieving device data...");
    //need to make chnages here for authenticating devices
    let nonce = 1; //await sample.methods.verifyAggregatedSignature(msg,aggregateSignatures,devids,devpubkeys).call({ from: process.env.address });
    if (nonce !== "0") {
      //If the device is registered then return the nonce.
      snd = {
        ...snd,
        status: true,
        nonce: nonce,
      };
      // console.log("Signature is: ", sign);
      let ans1 = await create_transaction(
        sample.methods.update_timestamp,
        "Time stamp update",
        [data.devId, cur_dev_TS.toString()]
      );
      if (!ans1.error) {
        var receipt = await web3.eth.sendSignedTransaction(
          ans1.tx.rawTransaction
        );
        // console.log("Timestamp of the request: ", cur_dev_TS.toString())
        console.log("--Timestamp of the request updated--");
      }
      if (data.devId) {
        //let destlbrid = await sample.methods.fetchaddress(data.devId).call({ from: process.env.address });
        console.log(data.devId);
      }
      if (data.recvId) {
        //Get the public key of the receiver and send it along with the nonce.
        let ans2 = await create_transaction(
          sample.methods.update_recipient,
          "Recipient update",
          [data.devId, data.recvId]
        );
        if (!ans2.error) {
          console.log("Updating recipient...");
          var receipt = await web3.eth.sendSignedTransaction(
            ans2.tx.rawTransaction
          );
        }
        let recvKey = await sample.methods
          .get_device_key(data.recvId)
          .call({ from: process.env.address });
        snd = {
          ...snd,
          recvKey: recvKey,
        };
      }
      console.log("Sending nonce for signing: \n", snd);
      let pubKey = await sample.methods
        .get_device_key(data.devId)
        .call({ from: process.env.address });
      let enc_data = encrypt(snd, pubKey);
      client.publish(data.devId, enc_data);
      try {
        const start = lbr1id;
        console.log(data.devId);
        let temp = await sample.methods
          .get_device_gateway(data.devId)
          .call({ from: process.env.address });
        var end = data.recvId;
        var end_lbr;
        if (temp) {
          console.log("yooyoyoy");
          console.log(temp);
        }
        console.log(bgprouting(graph, start, end));
      } catch (error) {
        console.log(error);
      }
    } else {
      console.log("Cannot retrieve nonce...");
      console.log("--Device not associated with lbr--");
      // console.log("Invalid gateway !!");
    }
  } else if (topic === "gateway1/priv") {
    var data = decrypt(rcv);
    var data2 = data.privKey;

    devices.push(data.privKey);
    console.log(typeof data.privKey);
  } else if (topic === "lbr1/destdevice") {
    var data = decrypt(rcv);
    var destdevID = data.destdevID;
    end = destdevID;
    console.log("Destination Device Id :", end);
  } else if (topic === "gateway1/auth") {
    /**
        This means device is requesting for authentication or a communication request. 
        So it has to contain a signature and encrypted with this gateway's timestamp.               
        */
    var data = decrypt(rcv);
    console.log("Signed nonce received: \n", data);

    //Verify the message and then process the request.
    let nonce = await sample.methods
      .get_device_nonce(data.devId)
      .call({ from: process.env.address });
    console.log(nonce);
    if (nonce === 0) console.log("Invalid gateway !!");
    let pubKey = await sample.methods
      .get_device_key(data.devId)
      .call({ from: process.env.address });

    let pubKeyObj = ec.keyFromPublic(pubKey, "hex");
    let msgHash = sha3.keccak256(nonce);

    /* Verify the signature along with the hash */
    console.log("Retrieving device information from blockchain...");
    console.log("Stored nonce: ", nonce);
    console.log("Stored device public key: ", pubKey);
    let auth_status = pubKeyObj.verify(msgHash, data.sign);
    if (auth_status) console.log("--Device authentication successful--");
    else console.log("--Device authentication failed--");
    let curCount = await web3.eth.getTransactionCount(process.env.address);

    if (
      data.msg.length !== 0 &&
      (auth_status || !txCount || curCount > txCount)
    ) {
      //That means the msg is stored in the blockchain and receiver is notifed.
      let ans = await create_transaction(
        sample.methods.communicate,
        "Message communication",
        [data.devId, data.msg]
      );
      if (!ans.error) {
        var receipt = await web3.eth.sendSignedTransaction(
          ans.tx.rawTransaction
        );
        receipt = {
          ...receipt,
          logsBloom: "",
        };
        console.log("Transaction created: \n", receipt);
        console.log("--Message sent--");
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
      status: auth_status,
    };

    let enc_data = encrypt(snd, pubKey);
    client.publish(data.devId, enc_data);
    // console.log("Auth response sent !!");
  }
});
console.log("test");
