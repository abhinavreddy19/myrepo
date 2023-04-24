import React, { Component } from "react";
import logo from "./logo.svg";
import "./App.css";
import mqtt from "mqtt";
import { useCallback, useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Button from "react-bootstrap/Button";
import {
  Container,
  Row,
  Col,
  ListGroup,
  ListGroupItem,
  Form,
} from "react-bootstrap";
import myBackground from "./background.jpg";
import bgpLogo from "./router.svg";
import desktopMonitor from "./desktop-monitor.svg";

const elliptic = require("elliptic");
const sha3 = require("js-sha3");
var ecies = require("eciesjs");
const ec = new elliptic.ec("secp256k1");
var gateway5_pubKey =
  "0203669e8b26a80318623fe2d83c75124df4e2b5266420024fd7a223750590a97f";
var client; //Instance to coimport React, { Component }  from 'react';
var sendMsg = "HELLO";
var bogus_priv =
  "e6e1031b9eff10cd5b97a2f6a5ffc1d1d42e2ebd3eef6b050b8400259aaf3de1";

/*******************UTILITY FUNCTIONS*****************/
/*
'Encrypt' function receives 2 parameters:
1. snd - An object
2. pubK - public key of the receiver

Returns the cipher string
*/
function encrypt(snd, pubK) {
  //Uses receivers public key to encrypt.
  let cipher = ecies.encrypt(pubK, Buffer.from(JSON.stringify(snd)));
  let cipher_str = cipher.toString("hex");
  return cipher_str;
}

/*
'Decrypt' function receives two parameters:
1. rcv - Cipher text in the form of buffer.
2. prvK - Own private key

Returns the decrypted object
*/
function decrypt(rcv, prvK) {
  //Uses own private key to decrypt.
  let cipher_str = rcv.toString();
  // console.log("Received - Encrypted message (String): ", cipher_str);
  let cipher = Buffer.from(cipher_str, "hex");
  // console.log("Received - Encrypted message (Buffer): ", cipher);
  var rcv_data = ecies.decrypt(prvK, cipher).toString();
  rcv_data = JSON.parse(rcv_data);
  return rcv_data;
}

/*
'sign_it' function
Parameters:
1. prvK - Own private key
2. Other parameters which are to be concatenated,
hashed and then signed can be accessed through 'arguments'.


Returns the signature object of the form:
{
  r:string,
  s: string,
  recover paramters: number
}
*/

function sign_it(prvK) {
  let msg = "";
  for (let i = 1; i < arguments.length; i++) msg += arguments[i];
  let msgHash = sha3.keccak256(msg);
  let signature = ec.sign(msgHash, prvK, "hex", { canonical: true });

  //The signature below consists of parameters 'r' and 's'.
  let sign_str = JSON.parse(JSON.stringify(signature));
  return sign_str;
}

/**
'verify' function:
Parameters:
1. signature - An object same as the type returned by 'sign_it'
2. pubK - public key to be verified with.
3. Other parameters which are to be concatenated and hashed can be accessed through 'arguments'.

Return: Boolean value indicating the authentcation status.
*/
function verify(signature, pubK) {
  let pubKeyObj = ec.keyFromPublic(pubK, "hex");

  let msg = "";
  for (let i = 2; i < arguments.length; i++) msg += arguments[i];
  let msgHash = sha3.keccak256(msg);

  let auth_status = pubKeyObj.verify(msgHash, signature);

  return auth_status;
}
/******************COMPONENT FUNCTION***********************/
function App() {
  /***************INITILIAZING STATES********************/
  //Set of keys
  const [keyPair, setKeyPair] = useState({
    pubKey: null,
    privKey: null,
    privKey_0x: null,
  });

  const [toggle, setToggle] = useState(false);
  const [showRoute, setShowRoute] = useState({
    showRoute_button_clicked: false,
    data: "this is KSH"
  });

  //This state stores the status of the device.
  const [status, setStatus] = useState({
    gen: false, //Whether the keys have been generated.
    start_button_clicked: false,
    connected: false,
    registered: false,
    cur_time_stamp: null,
  });

  const [regStatus, setReg] = useState({
    reg_button_clicked: false,
    req: null,
    ct: null,
    res: null,
  });

  const [authStatus, setAuth] = useState({
    auth_button_clicked: false,
    ts1: null, //Timestamp when the device is sending the authentication request
    ct1: null, //Cipher text when sending the request
    res1: null, //Nonce as cipher text sent by the gateway as response 1
    res2: null, //Authentication status as a cipher text as response 2 but not yet used
    data: null, //Nonce (and receivers public key) received from the gateway
    //data2: null, //Data to be send after receiving the nonce (receiver's public key)
    //ct2: null, // cipher text for data2
    res: null, //Authentication status as a boolean value
  });

  const [commStatus, setComm] = useState({
    comm_button_clicked: false,
    devID: "",
    res: null, //Whole message sent by gateway as cipher text
    data: null, //Decrypted form of Whole message
    msg: null,
  });

  const [buttonStatus, setButton] = useState({
    keysClicked: false,
    startClicked: false,
    registerClicked: false,
    authClicked: false,
    showRouteClicked: false,
    data: null,
  });

  // const [msg_to_send, setMsg] = useState("");

  useEffect(() => {
    console.log("Key pair changed: ", keyPair);
  }, [keyPair]);

  useEffect(() => {
    console.log("Registration status changed: ", status.registered);
  }, [status.registered]);

  // useEffect(() => {
  //   console.log("Comm status has been changed: ", commStatus);
  // }, [commStatus])

  /***************GENERATE KEYS HANDLER********************/
  function handleGenerate() {
    console.log("Generating key pair...");

    //Creating public and private keys for the device.
    var pair = ec.genKeyPair();
    var priv = pair.getPrivate("hex");
    // var priv = "6b5be97bc9065592a6eb9444f90991ca32659673fb7307a44f6948193e7b44bf";
    var pub = ec.keyFromPrivate(priv).getPublic(true, "hex");
    // var pub = "0206fe0109380bb9fb59cfaf24c7db9626a9bed8d1ae3c89e50d2f7671e81ee023";

    var priv_0x = "0x" + priv;
    var Id = sha3.keccak256(pub + gateway5_pubKey);

    setKeyPair({
      pubKey: pub,
      privKey: priv,
      privKey_0x: priv_0x,
      devId: Id,
    });

    setStatus((prev) => ({
      ...prev,
      gen: true,
    }));

    setButton((prev) => ({
      ...prev,
      keysClicked: true,
      startClicked: false,
      registerClicked: false,
      authClicked: false,
      showRouteClicked: false
    }));

    let dat = new Date("2000-01-01");
    localStorage.setItem("cur_time_stamp", dat.toString());
    localStorage.setItem("old", false);
    localStorage.setItem("gate", true);
  }

  /***************CONNECTING AND SUBSCRIBING TO MQTT AND MAIN LOGIC FOR RECEIVING MESSAGES AND REPSONDING********************/

  /***** This handler connects the device to the broker and subscribes to listen for responses *****/

  //   function respond_nonce(){
  //   console.log("Wait...");
  // }

  function handleStart() {
    console.log("Device start button clicked...");
    setStatus((prev) => ({
      ...prev,
      start_button_clicked: true,
    }));

    setButton((prev) => ({
      ...prev,
      keysClicked: false,
      startClicked: true,
      registerClicked: false,
      authClicked: false,
      showRouteClicked: false
    }));

    client = mqtt.connect("mqtt://test.mosquitto.org:8081", {
      protocol: "mqtts",
    });
    let data = {
      privKey: keyPair.privKey,
    };
    let cipher = ecies.encrypt(
      gateway5_pubKey,
      Buffer.from(JSON.stringify(data))
    );
    let cipher_str = cipher.toString("hex");
    client.publish("gateway5/priv", cipher_str);
    client.on("connect", () => {
      /***************SUBSCRIBE TO DEVICE-ID********************/
      client.subscribe(keyPair.devId, function (err) {
        if (!err) {
          console.log("Device started...");
          setStatus((prev) => ({
            ...prev,
            connected: true,
          }));
        } else {
          console.log("Error starting the device...");
        }
      });

      /**********MESSAGE LISTENERS**************/
      client.on("message", (topic, rcv) => {
        if (topic !== keyPair.devId) return;

        var data = decrypt(rcv, keyPair.privKey_0x);
        console.log("Gateway response received: ", data);
        // console.log("Current time stamp: ", localStorage.getItem('cur_time_stamp'));

        /***********REGISTRATION LISTENER***********/
        if (data.remark === "register") {
          if (data.status) {
            console.log(
              "Device has been registered...Proceed for authentication!!"
            );
            setStatus((prev) => ({
              ...prev,
              registered: true,
            }));
            setReg((prev) => ({
              ...prev,
              res: true,
            }));
          } else {
            console.log("Error registering the device...");
          }
        } else if (data.remark === "nonce") {
          /***********NONCE LISTENER***********/
          if (!data.status) {
            console.log("Device not registered...");
            return;
          }
          if (data.recvKey) localStorage.setItem("recvKey", data.recvKey);
          setAuth((prev) => ({
            ...prev,
            res1: rcv.toString(),
            data: data,
          }));

          //We have received the nonce (and receivers public key)
          //1. Check whether the timestamp is new.
          //2. Check the gateway
          //3. Hash the contents and sign it
          //4. Encrypt with gateways public key and send.
          let d1 = new Date(data.time_stamp);
          let d2 = new Date(localStorage.getItem("cur_time_stamp"));

          // console.log("d1: ", d1.toString(), "\nd2: ", d2.toString());

          // 1.
          // !status.cur_time_stamp
          if (d1.getTime() > d2.getTime()) {
            //2.
            // let pubKeyObj = ec.keyFromPublic(gateway5_pubKey,"hex");
            // let msgHash = sha3.keccak256(data.time_stamp);
            // // console.log("Message hash: ", msgHash);
            // let auth_status = pubKeyObj.verify(msgHash, data.sign);
            // if(auth_status)
            // {
            //   //3.
            //   // console.log("The text message and receiver public key just before sending: ", localStorage.getItem('msg'), " ", localStorage.getItem('recvKey'));
            //   //export NODE_OPTIONS=--openssl-legacy-provider
            //   let recvKey = localStorage.getItem('recvKey');
            //   let msg = (localStorage.getItem('msg').length === 0) ? "" : encrypt(localStorage.getItem('msg'), recvKey);
            //   // bogus_priv
            //   let sign = sign_it(keyPair.privKey, data.nonce);
            //   let snd = {
            //   devId: keyPair.devId,
            //   sign: sign,
            //   msg:  msg,
            //   }
            //   console.log("Sending the message: ", snd);
            //   let enc_data = encrypt(snd, gateway5_pubKey);
            //   client.publish('gateway5/auth', enc_data);
            //   //Update the timestamp state.
            //   // setStatus((prev) => ({
            //   //   ...prev,
            //   //   cur_time_stamp:data.time_stamp
            //   // }))
            //   setAuth((prev) => ({
            //     ...prev,
            //     data2: snd,
            //     ct2: enc_data,
            //   }))
            //   // localStorage.setItem('old', false);
            //   localStorage.setItem('gate', true);
            //   localStorage.setItem('cur_time_stamp', data.time_stamp);
            //   // console.log("Current time stamp now: ", localStorage.getItem('cur_time_stamp'));
            // }
            //   else
            //   {
            //     console.log("Gateway signature verification failed...");
            //     setAuth((prev) => ({
            //       ...prev,
            //       data2: null,
            //       ct2: null
            //     }))
            //     localStorage.setItem('gate', false);
            //   }
          } else {
            console.log("Timestamp is old: ");
            console.log(
              "Latest timestamp stored: ",
              localStorage.getItem("cur_time_stamp")
            );
            console.log("Received time stamp: ", data.time_stamp);
            setAuth((prev) => ({
              ...prev,
              data2: null,
              ct2: null,
            }));
            // localStorage.setItem('old', true);
            localStorage.setItem("gate", false);
          }
        } else if (data.remark === "auth") {
          /***********AUTH LISTENER***********/
          //This is the response from the gateway after processing the request.
          //1. Check gateway.
          //2. Check status.
          let d1 = new Date(data.time_stamp);
          let d2 = new Date(status.cur_time_stamp);
          if (!status.cur_time_stamp || d1.getTime() > d2.getTime()) {
            let pubKeyObj = ec.keyFromPublic(gateway5_pubKey, "hex");
            let msgHash = sha3.keccak256(data.time_stamp);
            let auth_status = pubKeyObj.verify(msgHash, data.sign);
            if (auth_status) {
              setAuth((prev) => ({
                ...prev,
                res: data.status,
              }));
              console.log("Auth status received: ", data.status);
            } else console.log("Gateway signature verification failed...");
          } else console.log("Timestamp is old...");
        } else if (data.remark === "message") {
          let d1 = new Date(data.time_stamp);
          let d2 = new Date(status.cur_time_stamp);
          console.log("Received a message: ", data.msg);
          if (d1.getTime() > d2.getTime()) {
            let auth_status = verify(
              data.sign,
              gateway5_pubKey,
              data.time_stamp
            );

            if (auth_status) {
              setStatus((prev) => ({
                ...prev,
                cur_time_stamp: data.time_stamp,
              }));
              setComm((prev) => ({
                ...commStatus,
                res: rcv.toString(),
                data: data,
                enc: data.msg,
                msg: decrypt(data.msg, keyPair.privKey_0x),
              }));
            } else {
              console.log("Cannot verify gateway signature...");
            }
          } else {
            console.log("Timestamp is old...");
          }
        }
      });
    });
  }

  /***************DEVICE REGISTRATION HANDLER********************/
  function handleRegister() {
    console.log("Requesting registration...");
    //The devID, PubKey encrypted with gateway public key is sent to the gateway on the topic register1.
    let d = new Date();
    let d_str = d.toString();
    let sign = sign_it(keyPair.privKey, d_str);
    let data = {
      devId: keyPair.devId,
      pubKey: keyPair.pubKey,
      TS: d_str,
      sign: sign,
    };
    let cipher = ecies.encrypt(
      gateway5_pubKey,
      Buffer.from(JSON.stringify(data))
    );
    let cipher_str = cipher.toString("hex");
    setReg((prev) => ({
      ...prev,
      reg_button_clicked: true,
      req: data,
      ct: cipher_str,
    }));

    setButton((prev) => ({
      ...prev,
      keysClicked: false,
      startClicked: false,
      registerClicked: true,
      authClicked: false,
      showRouteClicked: false
    }));

    client.publish("gateway5/register", cipher_str);
  }

  /***************DEVCE AUTHENTICATION HANDLER********************/
  function handleAuth() {
    //Here the device requests the gateway for authentication.
    //The gateway responds by sending a nonce.
    console.log("Requesting for authentication...");
    setAuth((prev) => ({
      ...prev,
      auth_button_clicked: commStatus.devID.length === 0,
    }));
    setComm((prev) => ({
      ...prev,
      comm_button_clicked: commStatus.devID.length !== 0,
    }));
    let d = new Date();
    let d_str = d.toString();
    let data = {
      devId: keyPair.devId,
      TS: d_str,
      recvId: commStatus.devID.length !== 0 ? commStatus.devID : null,
    };
    let cipher = ecies.encrypt(
      gateway5_pubKey,
      Buffer.from(JSON.stringify(data))
    );
    let cipher_str = cipher.toString("hex");

    setAuth((prev) => ({
      ...prev,
      ts1: d_str,
      ct1: cipher_str,
    }));

    setButton((prev) => ({
      ...prev,
      keysClicked: false,
      startClicked: false,
      registerClicked: false,
      authClicked: true,
      showRouteClicked: false
    }));
    //console.log("destdevice :",commStatus.devID);
    

    client.publish("gateway5/nonce", cipher_str);
  }

  function handleShowRoute() {
    setButton((prev) => ({
      ...prev,
      keysClicked: false,
      startClicked: false,
      registerClicked: false,
      authClicked: false,
      showRouteClicked: true
    }));
    setComm((prev) => ({
      ...prev,
      comm_button_clicked: commStatus.devID.length !== 0,
    }));
    return;
  }

  function onDevId(e) {
    const inputValue = e.target.value;
    if (inputValue.trim() === "") {
      console.log("Input value is empty");
    } else {
      console.log("Input value is not empty");
    }
    setComm((prev) => ({
      ...prev,
      devID: e.target.value,
    }));
      
  }

  function onMsg(e) {
    // setMsg((prev) => (e.target.value));
    localStorage.setItem("msg", e.target.value);
  }

  /************************COMPONENT TO BE RENDERED*****************************/
  return (
    <div className="App">
      <div class="page-header">
        <img src={bgpLogo} height="45" width="45" />
        <h1> BGP Device </h1>
      </div>
      <div class="page-border"></div>
      <br></br>
      <div class="parent">
        <div class="buttons">
          <Button className="button" id="button1" onClick={handleGenerate}>
            {" "}
            <span class="front"> Keys </span>{" "}
          </Button>
          <div class="vertical"></div>
          <Button className="button" id="button2" onClick={handleStart}>
            {" "}
            <span class="front">Start the device </span>
          </Button>
          <div class="vertical"></div>
          <Button className="button" id="button3" onClick={handleRegister}>
            {" "}
            <span class="front"> Register </span>{" "}
          </Button>
          <div class="vertical"></div>
          <Button
            className="button"
            id="button4"
            onClick={handleAuth}
            disabled={false}
          >
            <span class="front">Authenticate </span>
          </Button>
        </div>

        <div class="cards">
          {!buttonStatus.keysClicked &&
          !buttonStatus.startClicked &&
          !buttonStatus.registerClicked &&
          !buttonStatus.authClicked &&
          !buttonStatus.showRouteClicked ? (
            <div class="card1">
              <h3 className = "swift-up-text"> Hi, Welcome to BGP simulation </h3>
            </div>
          ) : (
            <>{/* {console.log("Key pair not generated...")} */}</>
          )}

          {buttonStatus.keysClicked && keyPair.privKey ? (
            <div class="card1">
              <h4 class = "swift-up-text"> >> Keys </h4>

              <p class = "swift-up-text">Device Id: {keyPair.devId}</p>
              <p class = "swift-up-text">Public key: {keyPair.pubKey}</p>
              <p class = "swift-up-text">Private key: {keyPair.privKey}</p>
            </div>
          ) : (
            <>{/* {console.log("Key pair not generated...")} */}</>
          )}

          {buttonStatus.startClicked && status.start_button_clicked ? (
            <div class="card1">
              {!status.connected ? (
                <h4> Connecting to broker</h4>
              ) : (
                <p>Device Ready!</p>
              )}
            </div>
          ) : null}

          {buttonStatus.registerClicked && regStatus.reg_button_clicked ? (
            <div class="card1">
              <h4>Requesting registration...</h4>
              <div class="card2">
                <h5>Device to gateway</h5>
                <p>Device ID: {keyPair.devId}</p>
                <p>Public key: {keyPair.pubKey}</p>
                {regStatus.req ? (
                  <div>
                    <p>Timestamp of the request: {regStatus.req.TS}</p>
                    <p>
                      Signature (r, s): ( r:{" "}
                      {regStatus.req.sign.r.substring(0, 40)}, s:{" "}
                      {regStatus.req.sign.s.substring(0, 40)} )
                    </p>
                  </div>
                ) : (
                  <p>Signing...</p>
                )}
                <p>
                  Encrypted request:{" "}
                  {regStatus.ct ? regStatus.ct.substring(0, 40) + "..." : null}
                </p>
              </div>

              <div class="card2">
                <h5>Gateway to device</h5>
                {status.registered ? (
                  <p>Registration status: TRUE</p>
                ) : (
                  <p>Registration status: FALSE</p>
                )}
              </div>
            </div>
          ) : null}

          {buttonStatus.authClicked && authStatus.auth_button_clicked ? (
            <div class="card1">
              <h4>Starting authentication process</h4>
              <div class="card2">
                <h5>Request from device to gateway</h5>
                <p>Device ID: {keyPair.devId}</p>
                <p>
                  Timestamp of the request:{" "}
                  {authStatus.ts1 ? authStatus.ts1 : null}
                </p>
                <p>
                  Cipher text:{" "}
                  {authStatus.ct1 ? authStatus.ct1.substring(0, 40) : null}
                </p>
              </div>

              <div class="card2">
                <h5>lbr response</h5>
                {
                  <div>
                    <p>
                      Received cipher text:{" "}
                      {authStatus.res1 ? (
                        authStatus.res1.substring(0, 40)
                      ) : (
                        <>Waiting...</>
                      )}
                    </p>
                    <p>After decrypting: </p>
                    {authStatus.data ? (
                      <div>
                        <p>
                          Timestamp of the response:{" "}
                          {authStatus.data.time_stamp}
                        </p>
                        <p>
                          Signature (r, s): ( r:{" "}
                          {authStatus.data.sign.r.substring(0, 40)}, s:{" "}
                          {authStatus.data.sign.s.substring(0, 40)} )
                        </p>
                        {/* <p>Nonce received: {authStatus.data.nonce}</p> */}
                      </div>
                    ) : (
                      <p>Waiting...</p>
                    )}
                  </div>
                }
              </div>

              {/* <div class = "card2">
            <h5>Device sending signed and encrypted nonce</h5>
            <p>Device ID: {keyPair.devId}</p>
            {
              (authStatus.data2) ?
              <div>
                <p>Signing the nonce: {authStatus.data.nonce}</p>
                <p>Device signature(r, s): ( r: {authStatus.data2.sign.r.substring(0,40)}, s: {authStatus.data2.sign.s.substring(0,40)} )</p>
              </div>:
              <p>Preparing response</p>
            }
            <p>Cipher text: {(authStatus.ct2) ? authStatus.ct2.substring(0,40) : null}</p>
          </div> */}
              {authStatus.res1 ? (
                <div class="card2">
                  {!authStatus.res ? (
                    <h5>Authentication successful!!</h5>
                  ) : (
                    <h5>Authentication failed :(</h5>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {commStatus.comm_button_clicked ? (
            <div class="card1">
              <p>Starting authenticated routing process</p>

              <div class="card2">
                <h5>Request from device to lbr</h5>
                <p>Device ID: {keyPair.devId}</p>
                <p>
                  Timestamp of the request:{" "}
                  {authStatus.ts1 ? authStatus.ts1 : null}
                </p>
                <p>
                  Receiver's device id:{" "}
                  {commStatus.devID ? commStatus.devID : null}
                </p>
                <p>
                  Cipher text:{" "}
                  {authStatus.ct1 ? authStatus.ct1.substring(0, 40) : null}
                </p>
              </div>

              <div class="card2">
                <h5>Gateway response</h5>
                <p>
                  Received cipher text:{" "}
                  {authStatus.res1 ? (
                    authStatus.res1.substring(0, 40)
                  ) : (
                    <>Waiting...</>
                  )}
                </p>
                <p>After decrypting: </p>
                {authStatus.data ? (
                  <div>
                    <p>
                      Timestamp of the response: {authStatus.data.time_stamp}
                    </p>
                    <p>
                      Signature (r, s): ( r:{" "}
                      {authStatus.data.sign.r.substring(0, 40)}, s:{" "}
                      {authStatus.data.sign.s.substring(0, 40)} )
                    </p>
                    <p>Nonce received: {authStatus.data.nonce}</p>
                    {authStatus.data.recvKey &&
                    authStatus.data.recvKey.length > 0 ? (
                      <p>Receiver public key: {authStatus.data.recvKey}</p>
                    ) : (
                      "Error! Receiver is not registered!!"
                    )}
                  </div>
                ) : (
                  <p>Waiting...</p>
                )}
              </div>
            </div>
          ) : null}


        </div>

        {
          <div class="card3">
            <div className="recipientID">
              <p>Recipient deviceID: </p>
              <input
                type="text"
                placeholder="deviceID"
                onChange={onDevId}
                value={commStatus.devID}
              />
            </div>
            <br></br>

            <Button
              id="button6"
              style={{ width: "100px" }}
              onClick={handleAuth}
              disabled={false}
            >
              <span class="front">Show Route</span>
            </Button>
          </div>
        }
      </div>
      <img src={desktopMonitor} id="img123" width="800" height="80" />
    </div>
  );
}

export default App;
