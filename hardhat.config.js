require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ganache");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  // solidity: "0.8.0",
  // settings: {
  //   optimizer: {
  //     enabled: true,
  //     runs: 200,
  //   },
  // },
  solidity: {
    compilers: [
        {
          version: "0.8.0",
          settings: {
            optimizer: {
              enabled: true,
              runs: 200,
            },
          },
          //settings: {},
        },
        {
          version: "0.8.1",
          settings: {
            optimizer: {
              enabled: true,
              runs: 200,
            },
          },
          //settings: {},
        },
        {
          version: "0.8.7",
          settings: {
            optimizer: {
              enabled: true,
              runs: 200,
            },
          },
          //settings: {},
        },
    ],
  },
  networks: {
    hardhat: {
      blockGasLimit: 60_000_000,
      forking: {
        url: process.env.MAINNET_URL,
        enabled: true,
      },
    },
    rinkeby: {
      url: process.env.RINKEBY_URL,
      accounts: [process.env.PRIVATE_KEY_RINKEBY],
    },
    // ropsten: {
    //   url: process.env.ROPSTEN_URL || "",
    //   accounts:
    //     process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    // },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};