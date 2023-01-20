"use strict";

// Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;

// Web3modal instance
let web3Modal;

// Chosen provider given by the dialog window
let provider;
let tokensRemaining;

// Address of the selected account
let account;
let signer;

let contractNetwork = 5;
let contractAddress = "0x92f2c3cD20DE7368927d8765ab39c99122310aae";
let cityId = 1;
let suburbId = 2;
let dutchAuctionId;
let dutchAuctionState;
let suburbs;
let dutchAuctionInfo;
// let mintPrice = 90000000000000000;
// let mintPriceInEther = 0.09;

let chainIdHex = contractNetwork === 1? "0x1" : "0x5";
let maxTokens = 10;
let maxPerPurchase = 1;
let counterRefreshRate = 120000;
let chainId;
let saleState;
let allowListState;
let availableToMint;
let contract;
let provider20;
let erc20;

// verify checksum address and change price to wei
values.forEach(function(value) {
  value.address = ethers.utils.getAddress(value.address);
  // value.price = ethers.utils.parseEther(value.price);
});

// values is an array of objects with keys: address, amount, price
const createMerkleRoot = (values) => {
  const leaves = values.map((v) =>
    ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256","uint256"],
      [v.address, _.toInteger(v.quota), v.cityId, v.suburbId]
    )
  );

  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const root = tree.getHexRoot();

  return { root, tree };
};

// construct the tree
const { root, tree } = createMerkleRoot(values);
console.log(root)
// get the proof from an object with keys: address, amount, price
const getProof = (tree, value) => {
  const leaf = ethers.utils.solidityKeccak256(
    ["address", "uint256", "uint256", "uint256" ],
    [value.address, value.quota, value.cityId, value.suburbId]
  );
  const proof = tree.getHexProof(leaf);

  return proof;
};


// find the amount from a values list, or return undefined
const getEntryFromValue = (values, address) => {
  return _.find(values, { address });
};

// * @dev Find an object in a list with three matching fields: address and two
// *   user defined keys.
// * @param {array} values array objects of merkle tree entries.
// * @param {string} address the wallet address to search for.
// * @param {string} value1 the value to search for under cityId.
// * @param {string} value2 the value to search for under suburbId.
// * @returns {object} user value object.
// */
const getKeyedValue = (values, address, cityId1, suburbId1) => {
 return _.find(
   values,
   function(o) { // returns item o if this function returns true
     return (
       o.address === address &&
       o.cityId === cityId1 &&
       o.suburbId === suburbId1
     );
   }
 );
};


////////////////
let networkNames = { 1: "Ethereum Mainnet", 4: "Rinkeby Test Network", 5: "Goerli Test Network" };
let etherscanSubdomain = { 1: "", 4: "rinkeby.", 5: "goerli." };
let alertBar = document.getElementById("alert-bar");
let numAvailableToMint = document.getElementById("available-mint");
let mintButton = document.querySelector("#mint-button");
let mintPriceDiv = document.getElementById("mint-price");
let dutchAuctionTimeRemaining = document.getElementById("dutch-auction-time-remaining");
let availableQty = document.getElementById("nfts-minted");
let maxSupply = document.getElementById("max-supply");
let quantityInput = document.getElementById("quantity");


async function init() {
  document.querySelector("#mint-button").setAttribute("disabled", "disabled");
  clearAlert();
  dutchAuctionTimeRemaining.innerHTML = '';
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: "ba374aeade634d649c4aaf58f8fcfd07", // required
      },
    },
    "custom-walletlink": {
      display: {
        logo: "https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0",
        name: "Coinbase",
      },
      options: {
        appName: "Coinbase",
        networkUrl: `https://goerli.infura.io/v3/ba374aeade634d649c4aaf58f8fcfd07`,
        chainId: 1,
      },
    },
  };

  if (typeof window !== "undefined") {
    web3Modal = new Web3Modal({
      network: "mainnet", // optional
      cacheProvider: false,
      providerOptions, // required
    });
  }

  await refreshCounter();
}

function createAlert(alertMessage) {
  alertBar.style.display = "block";
  alertBar.innerHTML = alertMessage;
}

function clearAlert() {
  alertBar.style.display = "none";
}

let etherscanLink =
  contractNetwork === 1
    ? "https://etherscan.io/tx"
    : "https://goerli.etherscan.io/tx";

let web3Infura = new Web3(
  contractNetwork == 1
    ? "https://mainnet.infura.io/v3/4b48220ef22f43c1a1c842c850869019"
    : "https://goerli.infura.io/v3/c31e1f10f5e540aeabf40419532cbbb6"
);
contract = new web3Infura.eth.Contract(abi, contractAddress);

async function updateMintPrice() {
  // returns auction price in wei
  let priceToken;
  let timeRemaining;
  if (dutchAuctionState) {
    priceToken = await contract.methods
    .getDutchAuctionPrice(dutchAuctionId)
    .call();

    timeRemaining = await contract.methods
    .getRemainingDutchAuctionTime(dutchAuctionId)
    .call();

    dutchAuctionTimeRemaining.innerHTML = `Dutch Auction Time left: ${timeRemaining}`;
  } else if (allowListState) {
    priceToken = suburbs.allowListPricePerToken;
  } else if (saleState) {
    priceToken = suburbs.priceToken;
  }

  mintPriceDiv.innerHTML = `Take home a Token for ${
    ethers.utils.formatEther(priceToken)
  } eth.`;

  return priceToken;
}

async function mint() {
  if (!account) {
   return;
  }
  await refreshCounter();
  clearAlert();

  if (chainId !== contractNetwork) {
    createAlert("Incorrect Network");
    return;
  }

  let gasEstimate;

  provider20 = new ethers.providers.Web3Provider(provider);
  erc20 = new ethers.Contract(contractAddress, abi, provider20);

  let numberToMint = quantityInput.value;

  // // get price
  let amountPrice = await updateMintPrice();
  var price = ethers.BigNumber.from(amountPrice.toString());
  let amountInWei = price.mul(numberToMint);

  document.querySelector("#mint-button").setAttribute("disabled", "disabled");
  mintButton.disabled = true;

  const signer = provider20.getSigner();
  let contract20 = new ethers.Contract(contractAddress,abi,signer);

  const overrides = {
    from: account,
    value: amountInWei.toString(),
    gasLimit: undefined,
  }
  // in case of dutch auction mint
  if (dutchAuctionState) {
    mintButton.innerText = "Minting..";

    try {
      gasEstimate = await erc20.estimateGas.mintDutch(cityId, suburbId, numberToMint, overrides);

      gasEstimate = gasEstimate.mul(
        ethers.BigNumber.from("125").div(ethers.BigNumber.from("100"))
      );

      overrides.gasLimit = gasEstimate;

      const tx = await contract20.mintDutch(cityId, suburbId, numberToMint, overrides);

      const receipt = await tx.wait();
      const hash = receipt.transactionHash;

      refreshCounter();
      createAlert(
        `Thanks for minting! Your tx link is <a href="${etherscanLink}/${hash}" target="_blank" >${hash.slice(0, 6)}...${hash.slice(-4)}</a>`
      );
    } catch(err) {
      createAlert("Canceled transaction.");
      console.log(err);
    };
    // case of allowlist mint -- to be added
  } else if (allowListState && availableToMint !== 0) {

    const value = getKeyedValue(values, account, cityId, suburbId);
    const proof = getProof(tree, value);

    mintButton.innerText = "Minting..";

    try {
      gasEstimate = await erc20.estimateGas.mintAllowList(cityId, suburbId, numberToMint, value.quota, proof, overrides);

      gasEstimate = gasEstimate.mul(
        ethers.BigNumber.from("125").div(ethers.BigNumber.from("100"))
      );

      overrides.gasLimit = gasEstimate;

      const tx = await contract20.mintAllowList(cityId, suburbId, numberToMint, value.quota,proof, overrides);

      const receipt = await tx.wait();
      const hash = receipt.transactionHash;

      await refreshCounter();
      createAlert(
        `Thanks for minting! Your tx link is <a href="${etherscanLink}/${hash}" target="_blank" >${hash.slice(0, 6)}...${hash.slice(-4)}</a>`
      );
    } catch(err) {
      createAlert("Canceled transaction.");
      console.log(err);
    };
  }
  document.querySelector("#mint-button").removeAttribute("disabled");
  mintButton.disabled = false;
  mintButton.innerText = "MINT";
};

async function updateAvailableToMint(account) {
  if (allowListState) {
    const value = getKeyedValue(values, account, cityId, suburbId);
    numAvailableToMint.style.display = "block";

    if (value === undefined) {
      numAvailableToMint.innerHTML = "You may not mint any tokens until the public sale";
      availableToMint = 0;
      maxPerPurchase = availableToMint;
      return availableToMint;
    }

    const allowListMinted = await contract.methods
      .getAllowListMinted(account, cityId, suburbId)
      .call();

    availableToMint = Number(value.quota) - Number(allowListMinted);

    availableToMint = Number(availableToMint);
    maxPerPurchase = availableToMint;

    if (availableToMint === 1) {
      numAvailableToMint.innerHTML = `You may mint ${availableToMint} token`;
    } else {
      numAvailableToMint.innerHTML = `You may mint up to ${availableToMint} tokens`;
    }
  } else if (dutchAuctionState) {
    maxPerPurchase = await contract.methods.maxDutchAuctionMints().call();

  // in case of public sale
  } else {
    // numAvailableToMint.style.display = "block";
    // numAvailableToMint.innerHTML = `You may mint up to ${maxPerPurchase} tokens`;
    // await updateMintPrice(price.toString());
  }
  return availableToMint;
}


// checks total minted on the contract
async function totalSupply() {
  tokensRemaining = await contract.methods.totalSupply().call();
  return tokensRemaining;
}

async function getDutchAuctionInfo() {
  // bool auctionActive; // flag marking the auction active or inactive
  // uint80 startTime; // block timestamp when auction started
  // uint80 duration; // time in seconds for price to drop from startPrice to finalPrice
  // uint88 startPrice; // in WEI: price declines from here
  // uint88 finalPrice; // in WEI: price rests here after declining
  // uint88 priceStep; // in WEI: price declines in this step size
  // uint80 timeStepSeconds; // in SECONDS: time between price drop steps

  dutchAuctionInfo = await contract.methods
    .getDutchAuctionInfo(dutchAuctionId)
    .call();

  dutchAuctionState = dutchAuctionInfo.auctionActive;

  return dutchAuctionInfo;
}

async function getSuburbs() {
  // const suburb = await contract.suburbs(1, 1);
  // // suburb is an object with keys like:
  // {
  //   id: {number}, // 1, 2, 3... etc. suburbId local to each city, starts at 1
  //   cityId: {number}, // parent city
  //   dutchAuctionId: {number}, // identifier of current DutchAuction, see SteppedDutchAuctionMulti.sol
  //   englishAuctionId: {number}, // identifier of current EnglishAuction, see EnglishAuctionHouse.sol
  //   firstTokenId: {number}, // first token in this suburb
  //   maxSupply: {number}, // max possible supply in the suburb
  //   currentSupply: {number}, // current supply minted in the suburb
  //   pricePerToken: {number}, // price on public sale
  //   allowListPricePerToken: {number}, // price on allow list sale
  //   allowListActive: {bool}, // is the allow list active? t/f
  //   saleActive: {bool}, // is the sale active? t/f
  // }

  suburbs = await contract.methods
  .suburbs(cityId, suburbId)
  .call();

  maxTokens = suburbs.maxSupply;
  tokensRemaining = suburbs.currentSupply;
  saleState = suburbs.saleActive;
  allowListState = suburbs.allowListActive;
  dutchAuctionId = suburbs.dutchAuctionId;

  maxSupply.innerText = (maxTokens).toString();
  availableQty.innerText = (maxTokens - tokensRemaining).toString();

  return suburbs;
}
async function refreshCounter() {
  await totalSupply();
  await getSuburbs();
  await getDutchAuctionInfo();

  updateMintPrice();

  if (account) await updateAvailableToMint(account);

  if (!dutchAuctionState && !allowListState) {
    document.querySelector("#mint-button").setAttribute("disabled", "disabled");
    mintButton.disabled = true;
  } else {
    document.querySelector("#mint-button").removeAttribute("disabled");
  }
}

async function fetchAccountData() {
  // Get a Web3 instance for the wallet
  let web3 = new Web3(provider);
  contract = await new web3.eth.Contract(abi, contractAddress);
  clearAlert();

  // Get connected chain id from Ethereum node
  chainId = await web3.eth.getChainId();
  if (chainId !== contractNetwork) {
    console.log("Incorrect Network");
    if (window.ethereum) {
      try {
        // check if the chain to connect to is installed
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHex }], // chainId must be in hexadecimal numbers
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      // if no window.ethereum then MetaMask is not installed
      console.log("MetaMask is not installed");
    }
  }
  clearAlert();

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();
  account = accounts[0];
  chainId = await web3.eth.getChainId();

  document.getElementById("account").style.display = "block";
  document.querySelector("#account").textContent = `${account.slice(
    0,
    6
  )}...${account.slice(-4)}`;

  document.getElementById("mint-section").style.display = "block";
  document.getElementById("btn-connect").style.display = "none";
  availableToMint = await updateAvailableToMint(account);

  await refreshCounter();
  mintButton.disabled = false;
}

/**
 * Fetch account data for UI when
 * - User switches accounts in wallet
 * - User switches networks in wallet
 * - User connects wallet initially
 */
async function refreshAccountData() {
  document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  await fetchAccountData();
  document.querySelector("#btn-connect").removeAttribute("disabled")
}


/**
 * Connect wallet button pressed.
 */
async function onConnect() {
  web3Modal.clearCachedProvider();
  clearAlert();
  try {
    provider = await web3Modal.connect();
    let web3 = new Web3(provider);
    // Get connected chain id from Ethereum node
    chainId = await web3.eth.getChainId();
    if (chainId !== contractNetwork) {
      if (window.ethereum) {
        try {
          // check if the chain to connect to is installed
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }], // chainId must be in hexadecimal numbers
          });
        } catch (error) {
          console.error(error);
        }
      } else {
        // if no window.ethereum then MetaMask is not installed
        console.log("MetaMask is not installed.");
      }
    }

    let web3Provider = new ethers.providers.Web3Provider(provider);
    signer = web3Provider.getSigner();
    account = await signer.getAddress();

    contract = await new web3.eth.Contract(abi, contractAddress);
    chainId = await web3.eth.getChainId();

    document.getElementById("btn-connect").style.display = "none";
    document.getElementById("account").style.display = "block";
    document.getElementById("mint-section").style.display = "block";

    await fetchAccountData();
  } catch (e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  // Subscribe to accounts change
  provider.on("accountsChanged", (accounts) => {
    fetchAccountData();
  });

  // Subscribe to chainId change
  provider.on("chainChanged", (chainId) => {
    fetchAccountData();
  });

  // Subscribe to networkId change
  provider.on("networkChanged", (networkId) => {
    fetchAccountData();
  });

  await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  try {
    if (provider.close) {
      await provider.close();
      await web3Modal.clearCachedProvider();
      provider = null;
    }
    document.querySelector("#btn-connect").style.display = "block";
    document.querySelector("#account").style.display = "none";

    account = null;
    clearAlert();

    mintPriceDiv.innerHTML = "";
    numAvailableToMint.innerHTML = "";
    // Set the UI back to the initial state
    document.getElementById("mint-section").style.display = "none";
    document.querySelector("#btn-connect").innerText = "Connect Wallet";

  } catch (error) {
    console.log(error);
  }
}

/**
 * Main entry point.
*/
window.addEventListener("load", async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document
    .querySelector("#btn-disconnect")
    .addEventListener("click", onDisconnect);
  document.querySelector("#mint-button").addEventListener("click", mint);
});