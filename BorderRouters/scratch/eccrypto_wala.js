var eccrypto = require("eccrypto");


var privateKeyA = eccrypto.generatePrivate();
console.log("Private key: ", privateKeyA)
var priv_str = privateKeyA.toString('hex');
console.log("Private key in string: ", priv_str);
var priv = Buffer.from(priv_str, 'hex');
console.log("Back to buffer: ", priv);

var publicKeyA = eccrypto.getPublic(privateKeyA);
console.log("Public key: ", publicKeyA)
var pub_str = publicKeyA.toString('hex');
console.log("Public key in string: ", pub_str);

var privateKeyB = eccrypto.generatePrivate();
var publicKeyB = eccrypto.getPublic(privateKeyB);



// Encrypting the message for B.
eccrypto.encrypt(publicKeyB, Buffer.from("msg to b")).then(function(encrypted) {
  // B decrypting the message.
  console.log("Encrypted message: ", encrypted.ciphertext);

  eccrypto.decrypt(privateKeyB, encrypted.ciphertext).then(function(plaintext) {
    console.log("Message to part B:", plaintext.toString());
  });
});

// Encrypting the message for A.
eccrypto.encrypt(publicKeyA, Buffer.from("msg to a")).then(function(encrypted) {
  // A decrypting the message.
  eccrypto.decrypt(privateKeyA, encrypted).then(function(plaintext) {
    console.log("Message to part A:", plaintext.toString());
  });
});