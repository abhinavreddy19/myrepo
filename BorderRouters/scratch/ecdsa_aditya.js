var EC = require('elliptic').ec
var curve = new EC('secp256k1')
var privateKey = '278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f'
var publicKey = curve.keyFromPrivate(privateKey).getPublic(true,"hex")
console.log("puk:",publicKey)
var message = "Hello, world!"
var signed = curve.sign(message, privateKey)

console.log("Public key: ", publicKey);
console.log("Sign:", signed);
var publicKeyObject = curve.keyFromPublic(publicKey,"hex")
var check = publicKeyObject.verify(message, signed)
console.log(check)