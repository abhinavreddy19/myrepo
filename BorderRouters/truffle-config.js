module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port:9091,
      network_id: "343", // Match any network id
    }
    //,
    // rinkeby: {
    //   provider: () => provider,
    //   network_id: 4
    // }
  },
  compilers: {
    solc: {
      version: "0.8.10",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
  
}