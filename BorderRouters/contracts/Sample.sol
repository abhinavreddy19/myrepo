// SPDX-License-Identifier: .
pragma solidity ^0.8.10;

contract Sample {
    ///Blockchain state variables.

    /* 'number' and 'str' are test variables */
    uint public number = 10;
    string public str = "Hello";
    uint public t=0;
    // 'reg' is mapping which stores whether a gateway has registered or not.
    mapping(address => bool) reg;
    // 'nonces' is a mapping which stores nonces for each registered gateway and changes with transaction.
    mapping(address => uint) nonces;
    //This mapping stores whether the dev has been registered or not.
    mapping(string => bool) dev_reg;

    //This structure contains the device information.
    struct Device {
        string pubKey;
        address gate;
        uint nonce;
        string TS;
        string recvId;
        uint id;
    }
     
    address[5] public lbrids;
    //Maps from the device id to device information which is contained in 'Device' struct.
    mapping(string => Device) dev_info;
    
    mapping(address => string[]) gate_dev;
    mapping(address => string[]) gate_agg;

    //The messsages associated with the lbr are stored in this data structure.
    struct Message {
        string from;
        string to;
        string msg_str;
    }    
    mapping(address => Message[]) msgs;

    //Test event to listen to in the script.
    event test(string _str);  
    
    //This is the event which the gateway listens for any notification of messages.
    event receive_message(address indexed gateway, string devId);

    //Utility function
    function str_cmp(string memory _a, string memory _b) internal pure returns(bool fl){
        return keccak256(abi.encodePacked(_a)) == keccak256(abi.encodePacked(_b));
    }      

    /*The below 3 functions are test functions.*/


    //Multiple value return.
    function without_parameters() public view returns (string memory str1, uint num1) {
            return (str, number);
    }

    //Directly update the number by 'n'.
    function update(uint _n) public {
            number = _n;            
    } 

    //Test transaction to check working with signature.
    function update_string(string memory _str, bytes memory signature) public {
        
        bytes32 messageHash = keccak256(abi.encodePacked(_str, nonces[msg.sender]));
        bool status = verify(signature, messageHash);
        if(status == true)
        {
            if(keccak256(abi.encodePacked(str)) == keccak256(abi.encodePacked("yo")))
            revert("Yayy, error ocurred");
            str = _str;
            nonces[msg.sender] = uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.number)))%10000;
            emit test("Verification success - String updated");
        }
        else
            emit test("Verification failed - String not updated");

        emit test(str);
    }       
   

    //Function to retrieve nonce.
    function getNonce() public view returns(uint nonce) {
        if(reg[msg.sender] == true)
            return nonces[msg.sender];
        else
            return 0;
    }
    //device authentication
    

    
    function register_gateway(bytes memory signature) public {
        
        if(reg[msg.sender] == true)
            emit test("Already registered...");
        else{
            bytes32 messageHash = keccak256(abi.encodePacked('Register'));
            bool status = verify(signature, messageHash);
            if(status == true)
            {
                //That means the signature has been verified.
                reg[msg.sender] = true;
                lbrids[t]=msg.sender;
                t++;
                nonces[msg.sender] = uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.number)))%10000;
            }        
            else
            {
                revert("Registration failed...");
            }
        }
    }
    uint public count=8080;
    function register_device(string memory _devId, string memory _pub, string memory _TS) public {
        
        if(dev_reg[_devId] == true)
            emit test("Device already registered...");

        else if(reg[msg.sender] != true){
            emit test("Gateway not registered");
            revert("Gateway not registered");
        }
        else{                        
            //Since the status has been verified, things to do are:
            //1. Mark the device as registered.
            dev_reg[_devId] = true;
            
            //2. Create a new struct with the information.
            Device memory dev;
            dev.pubKey = _pub;
            dev.gate = msg.sender;
            dev.nonce = uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.number)))%10000;
            dev.TS = _TS;
            dev.recvId = "";
            dev.id=count;
            count++;
            //3. Map the device id to the created struct.
            dev_info[_devId] = dev;

            //4. Also add the device id to the list of devices under the associated gateway.  
            gate_dev[msg.sender].push(_devId);                                  
        }
    }

    //Function to check whether device has been registered or not. If yes, returns the timestamp of the last request.
    function check_device(string memory _devId) public view returns(string memory){                
        if (dev_reg[_devId])
            return dev_info[_devId].TS;
        else
            return "";
    }

    function update_timestamp(string memory _devId, string memory _TS) public {
        dev_info[_devId].TS = _TS;
        emit test("Timestamp updated...");
    }
    function verifyroute(address lbrid) public view returns(bool){
        return reg[lbrid];
    } 
    struct info{
        string pubKey;
        address lbrinfo;
    }
    function get_device_key(string memory _devId) public view returns(string memory){                
        return dev_info[_devId].pubKey;
    }
    function get_device_gateway(string memory _devId) public view returns(address){ 
        return dev_info[_devId].gate;
        
    }
    function get_lbr_id(address gate) public view returns(uint){
        uint i=0;
        for(i=0;i<=4;i++){
            if(lbrids[i]==gate){
                return i+8080;
            }
        }
        return 0;
    }
    function addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str2 = new bytes(42);
        str2[0] = '0';
        str2[2] = 'x';
        for(uint i=0; i< 20; i++) {
            str2[2+i*2] = alphabet[uint(uint8(value[i+12] >> 4))];
            str2[3+i*2] = alphabet[uint(uint8(value[i+12] & 0x0f))];
        }
        return string(str2);
    }

    function update_recipient(string memory _devId, string memory _recvId) public {
        dev_info[_devId].recvId = _recvId;
        emit test("Recipient updated...");
    }
    //function to return lbrid for the device specified
   
        

    
    function communicate(string memory _devId, string memory _msg) public {
        
        if(reg[msg.sender] != true)
        {
            emit test("Gateway not registered...");
            revert("Gateway not registered...");
        }
        
        bool fl = false;
        for(uint i=0;i<gate_dev[msg.sender].length;i++)
        {
            fl = str_cmp(_devId, gate_dev[msg.sender][i]);
            if(fl)
                break;
        }

        if(!fl)
        {
            emit test("Device not associated with this gateway....");
            revert("Device not associated with this gateway...");
        }

        string memory _recvId = dev_info[_devId].recvId;
        //Now add the message under this gateway and emit the event.
        Message memory message;
        message.from = _devId;
        message.to = _recvId;
        message.msg_str = _msg;

        //Add to the list of messages for the gateway.
        msgs[dev_info[_recvId].gate].push(message);

        //Clear the recipient id under the dev_info.
        dev_info[_devId].recvId = "";

        emit receive_message(dev_info[_recvId].gate, _recvId);
    }

    function getMessage() public view returns (string memory from, string memory _str){
        
        uint n = msgs[msg.sender].length;
        return (msgs[msg.sender][n-1].from, msgs[msg.sender][n-1].msg_str);
    }


    //The gateway updates the nonce of the device after every authentication attempt.
    function update_device_nonce(string memory _devId) public {
        //Check whether the gateway is registered.
        //Also check whether the device is under this gateway.
        if(reg[msg.sender] != true)
        {
            emit test("Gateway not registered...");
            revert("Gateway not registered...");
        }
        
        bool fl = false;
        for(uint i=0;i<gate_dev[msg.sender].length;i++)
        {
            fl = str_cmp(_devId, gate_dev[msg.sender][i]);
            if(fl)
                break;
        }

        if(!fl)
        {
            emit test("Device not associated with this gateway....");
            revert("Device not associated with this gateway...");
        }    
        
        //Add a nonce for the device here.
        dev_info[_devId].nonce = uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.number)))%10000;   
        emit test("Nonce successfully updated...");
    }
    

    function get_device_nonce(string memory _devId) public view returns(uint nonce){
        //Check whether the gateway is registered.
        //Also check whether the device is under this gateway.
        if(reg[msg.sender] != true)                   
            return 0;                    
        
        bool fl = false;
        for(uint i=0;i<gate_dev[msg.sender].length;i++)
        {
            fl = str_cmp(_devId, gate_dev[msg.sender][i]);
            if(fl)
                break;
        }

        if(!fl)                    
            return 0;           
        
        //Return nonce for the device here.
        return dev_info[_devId].nonce;               
    }
    




    function verify(
        bytes memory signature,
        bytes32 messageHash        
    ) public view returns (bool) {        
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return recoverSigner(ethSignedMessageHash, signature) == msg.sender;
    }

    function getMessageHash(        
        string memory _message ,
        uint _nonce       
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_message, _nonce));
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
        public
        pure
        returns (bytes32)
    {
        /*
        Signature is produced by signing a keccak256 hash with the following format:
        "\x19Ethereum Signed Message\n" + len(msg) + msg
        */
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
            );
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        public
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }
}