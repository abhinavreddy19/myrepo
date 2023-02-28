const elliptic = require("elliptic");
const sha3 = require("js-sha3");
var ecies = require("eciesjs");

const ec = new elliptic.ec("secp256k1");

/* Generate key pair*/
var keyPair = ec.genKeyPair();
var privKey = keyPair.getPrivate("hex"); //Private key in hex string format
var privKey_0x = "0x" + privKey; //Same private key but with 0x prefix
var pubKey = ec.keyFromPrivate(privKey).getPublic(true, "hex"); //Retrieve public key.

/*******************SIGNING AND VERIFICATION******************* */

/* Create a message, hash it and sign it. */
var msg = "Sample message";
let msgHash = sha3.keccak256(msg);
let signature = ec.sign(msgHash, privKey, "hex", { canonical: true });
var sign_str = JSON.parse(JSON.stringify(signature));

/* Print the generated private key, public key and the signature. */
var today = new Date();

console.log("Time: ", today.toString());
console.log("Priv key: ", privKey);
console.log("0x Priv key: ", privKey_0x);
console.log("Pub key: ", pubKey);
console.log("Signature: ", sign_str);

/* Obtain the public key object from the public key */
pubKeyObj = ec.keyFromPublic(pubKey, "hex");

/* Verify the signature along with the hash */
auth_status = pubKeyObj.verify(msgHash, sign_str);
console.log("Authentication status: ", auth_status);

/*******************ENCRYPTION and DECRYPTION******************* */

//Sample message
var msg_to_send = {
  dev_id: "device1",
  pub_key: "fkqc123rmme1",
  nonce: 123,
  signature: {
    r: "0x3141414",
    s: "0cafqeqexef",
    recoveryParam: 1,
  },
};
var cipher = ecies.encrypt(pubKey, Buffer.from(JSON.stringify(msg_to_send)));
var cipher_str = cipher.toString("hex");
var msg_rcv = ecies.decrypt(privKey_0x, cipher).toString();

console.log("Msg to send: ", msg_to_send);
console.log("Encrypted message(Cipher text): ", cipher_str);
console.log("Decrypted message: ", JSON.parse(msg_rcv));
