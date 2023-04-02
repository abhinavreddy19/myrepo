var ecies = require("eciesjs")
const k1 = new ecies.PrivateKey()
const data = Buffer.from('Hello')
console.log("priv key: ", k1);
console.log("priv key in string: ", k1.toHex());
console.log("Pub key in string: ", k1.publicKey.toHex());

var cipher = ecies.encrypt(k1.publicKey.toHex(), data);
console.log("Cipher text: ", cipher);
console.log("Cipher text in string:", cipher.toString('hex'));
console.log("Cipher text back to buffer: ", Buffer.from(cipher.toString('hex'), 'hex'))
console.log(ecies.decrypt(k1.toHex(), ecies.encrypt(k1.publicKey.toHex(), data)).toString());
// console.log(ecies.decrypt(privateKeyA, ecies.encrypt(publicKeyA, Buffer.from("Hello")).toString()));