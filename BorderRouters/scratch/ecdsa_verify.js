let elliptic = require('elliptic');
let sha3 = require('js-sha3');
let ec = new elliptic.ec('secp256k1');

var received_pub = '02e5db54c56b2ae2a369038aac1d61676068db8bd02331b9266fa0219ff6c9a6ce'
var hash = sha3.keccak256('Sample message');
var sign = {
    r: 'e5687d8706bec7d9d13c3e3d117913cb3d94a95bfaac3c561be54e9cae0ae54d',
    s: '75040a3234de2f76719fa0a2b3db801ea2cdf1753061f2a4468a55b0be3f0a43',
    recoveryParam: 0
  }

  let hexToDecimal = (x) => ec.keyFromPrivate(x, "hex").getPrivate().toString(10);
  let pubKeyRecovered = ec.recoverPubKey(
      hexToDecimal(hash), sign, sign.recoveryParam, "hex");
  console.log("Recovered pubKey:", pubKeyRecovered.encodeCompressed("hex"));

  var validity = received_pub == pubKeyRecovered.encodeCompressed("hex")
  console.log("Signature validity: ", validity);