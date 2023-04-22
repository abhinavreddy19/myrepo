const { Keyring } = require('@polkadot/keyring');
const { u8aToHex } = require('@polkadot/util');

const privateKey = '4ed28c49de627e22ab02a3c553cca9cd7f90db0e2be8a2ff395069201c11cdc2';

const keyring = new Keyring({ type: 'sr25519' });
const keyPair = keyring.addFromSeed(Buffer.from(privateKey, 'hex'));

const publicKey = u8aToHex(keyPair.publicKey);

console.log(publicKey);
