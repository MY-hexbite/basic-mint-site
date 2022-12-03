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

let contractNetwork = 5;
let contractAddress = "0x96a398dd697884f74c321006b7879a604ef89451";
let mintPrice = 90000000000000000;
let mintPriceInEther = 0.09;

let maxTokens = 8888;
let maxPerPurchase = 2;
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
  value.price = ethers.utils.parseEther(value.price);
});

// values is an array of objects with keys: address, amount, price
const createMerkleRoot = (values) => {
  const leaves = values.map((v) =>
    ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256"],
      [v.address, _.toInteger(v.amount), v.price]
    )
  );

  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const root = tree.getHexRoot();

  return { root, tree };
};

// construct the tree
const { root, tree } = createMerkleRoot(values);

// get the proof from an object with keys: address, amount, price
const getProof = (tree, value) => {
  const leaf = ethers.utils.solidityKeccak256(
    ["address", "uint256", "uint256" ],
    [value.address, value.amount, value.price]
  );
  const proof = tree.getHexProof(leaf);

  return proof;
};

// find the amount from a values list, or return undefined
const getAmountFromValues = (values, address) => {
  return _.find(values, { address });
};

////////////////
let networkNames = { 1: "Ethereum Mainnet", 4: "Rinkeby Test Network", 5: "Goerli Test Network" };
let etherscanSubdomain = { 1: "", 4: "rinkeby.", 5: "goerli." };
let alertBar = document.getElementById("alert-bar");
let numAvailableToMint = document.getElementById("available-mint");
let mintButton = document.querySelector("#mint-button");
let mintPriceDiv = document.getElementById("mint-price");
let availableQty = document.getElementById("nfts_minted");
let quantityInput = document.getElementById("quantity");


async function init() {
  document.querySelector("#mint-button").setAttribute("disabled", "disabled");
  clearAlert();

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

async function updateMintPrice(price) {
  mintPriceDiv.innerHTML = `Take home a Token for ${
    ethers.utils.formatEther(price)
  } eth.`;
}

async function updateAvailableToMint(account) {
  let price = mintPrice;
  mintPriceDiv.innerHTML = '';
  if (allowListState) {
    const value = getAmountFromValues(values, account);
    numAvailableToMint.style.display = "block";

    if (value === undefined) {
      numAvailableToMint.innerHTML = "You may not mint any tokens until the public sale";
      availableToMint = 0;
      maxPerPurchase = availableToMint;
      return availableToMint;
    }
    await updateMintPrice(value.price);
    const allowListMinted = await contract.methods
      .getAllowListMinted(account)
      .call();

    availableToMint = Number(value.amount) - Number(allowListMinted);

    availableToMint = Number(availableToMint);
    maxPerPurchase = availableToMint;


    if (availableToMint === 1) {
      numAvailableToMint.innerHTML = `You may mint ${availableToMint} token`;
    } else {
      numAvailableToMint.innerHTML = `You may mint up to ${availableToMint} tokens`;
    }
  // in case of public sale
  } else {
    numAvailableToMint.style.display = "block";
    numAvailableToMint.innerHTML = `You may mint up to ${maxPerPurchase} tokens`;
    await updateMintPrice(price.toString());
  }
  return availableToMint;
}

async function mint() {
  if (!account) {
   return;
  }

  clearAlert();

  if (chainId !== contractNetwork) {
    createAlert("Incorrect Network");
    return;
  }

  let gasEstimate;

  provider20 = new ethers.providers.Web3Provider(provider);
  erc20 = new ethers.Contract(contractAddress, abi, provider20);

  let numberToMint = quantityInput.value;
  // get price
  let price = ethers.BigNumber.from(mintPrice.toString());
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

  if (saleState) {
    mintButton.innerText = "Minting..";
    try {
      gasEstimate = await erc20.estimateGas.mint(numberToMint, overrides);

      gasEstimate = gasEstimate.mul(
        ethers.BigNumber.from("125").div(ethers.BigNumber.from("100"))
      );

      overrides.gasLimit = gasEstimate;

      const tx = await contract20.mint(numberToMint, overrides);

      const receipt = await tx.wait();
      const hash = receipt.transactionHash;

      refreshCounter();
      createAlert(
        `Thanks for minting! Your tx link is <a href='${etherscanLink}/${hash}' target="_blank" >${hash.slice(0, 6)}...${hash.slice(-4)}</a>`
      );
    } catch(err) {
      createAlert('Canceled transaction.');
      console.log(err);
    };
  } else if (allowListState && availableToMint !== 0) {
    const value = getAmountFromValues(values, account);
    const proof = getProof(tree, value);

    overrides.value = value.price.mul(numberToMint),
    mintButton.innerText = "Minting..";

    try {
      let gasEstimate = await erc20.estimateGas.mintAllowList(
        numberToMint,
        value.amount,
        value.price,
        proof,
        overrides
      );

      gasEstimate = gasEstimate.mul(ethers.BigNumber.from("125").div(ethers.BigNumber.from("100")))
      overrides.gasLimit = gasEstimate;
      const tx = await contract20.mintAllowList(
        numberToMint,
        value.amount,
        value.price,
        proof,
        overrides
      );

      const receipt = await tx.wait();
      const hash = receipt.transactionHash;

      refreshCounter();
      createAlert(
        `Thanks for minting! Your tx link is <a href='${etherscanLink}/${hash}' target="_blank" >${hash.slice(
          0,
          6
        )}...${hash.slice(-4)}</a>`
      );
    } catch(err) {
      createAlert('Canceled transaction.');
      console.log(err);
    };

  } else if (allowListState && availableToMint === 0) {
      mintButton.disabled = true;
      return;
  } else {
    mintButton.disabled = true;
    return;
  }

  document.querySelector("#mint-button").removeAttribute("disabled");
  mintButton.disabled = false;
  mintButton.innerText = 'Mint';
};

let web3Infura = new Web3(
  contractNetwork == 1
    ? "https://mainnet.infura.io/v3/4b48220ef22f43c1a1c842c850869019"
    : "https://goerli.infura.io/v3/c31e1f10f5e540aeabf40419532cbbb6"
);
contract = new web3Infura.eth.Contract(abi, contractAddress);

// checks total minted on the contract
async function totalSupply() {
  tokensRemaining = await contract.methods.totalSupply().call();

  return tokensRemaining;
}


async function refreshCounter() {
  tokensRemaining = await totalSupply();
  availableQty.innerText = (maxTokens - tokensRemaining).toString();
  saleState = await getSaleState();
  allowListState = await allowList();

  if (account) {
    availableToMint = await updateAvailableToMint(account);
  }
  if (!saleState && !allowListState) {
    mintButton.disabled = true;
  } else if (allowListState && availableToMint === 0) {
    mintButton.disabled = true;
  } else {
    mintButton.disabled = false;
  }
}

async function getSaleState() {
  saleState = await contract.methods.saleActive().call();
  return saleState;
}

async function allowList() {
  const allowList = await contract.methods.allowListActive().call();
  return allowList;
}

async function fetchAccountData() {
  // Get a Web3 instance for the wallet
  const web3 = new Web3(provider);
  contract = await new web3.eth.Contract(abi, contractAddress);
  console.log('Web3 instance is', web3);

  // Get connected chain id from Ethereum node
  chainId = await web3.eth.getChainId();

  if (chainId !== contractNetwork) {
    console.log('Incorrect Network');
    createAlert('Incorrect Network');
    document.querySelector(".spin").style.display = "none";
    onDisconnect();
    return;
  }

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();
  account = accounts[0];

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
  console.log("Opening a dialog", web3Modal);
  web3Modal.clearCachedProvider();
  clearAlert();
  try {
    provider = await web3Modal.connect();
    const web3Provider = new ethers.providers.Web3Provider(provider);
    const signer = web3Provider.getSigner();
    account = await signer.getAddress();

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

    mintPriceDiv.innerHTML = '';
    numAvailableToMint.innerHTML = '';
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