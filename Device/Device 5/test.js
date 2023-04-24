import React, { Component } from "react";

import { useCallback, useEffect, useState } from "react";


import elliptic from "elliptic";
import sha3 from "js-sha3";
import ecies from "eciesjs";

const ec = new elliptic.ec("secp256k1");
var priv = '53c440f0e6f5d3f5c1a4433e2195bc1ab854b800336e2ba2f066e607bc15fd4d';
var pub = ec.keyFromPrivate(priv).getPublic(true, "hex");
console.log(pub);
