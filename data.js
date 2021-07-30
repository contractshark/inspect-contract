const ETHERSCAN_API_KEY = '1PZIMJDR9ZK4IJ5QY3NQ5GYWXUTZ2RVBA3';
const ALCHEMY_API_KEY = 'cwh8OOjJQGF9j077BGGlqg0i7trpe9gV';

const _web3Instance = {};
let _contractInstance;

async function dataFetchAbi(contractAddress, network) {
  if (!contractAddress) {
    throw new Error('⛔️ Contract address is empty.');
  }
  if (!contractAddress.startsWith('0x')) {
    throw new Error(' ⛔️ Contract address does not start with 0x.');
  }
  if (contractAddress.length != 42) {
    throw new Error('⛔️ Contract address should be 20 bytes.');
  }
  const abiReq = await _fetchJson(
    `https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`
  );
  if (abiReq.status === '1' && abiReq.result) {
    return JSON.parse(abiReq.result);
  } else {
    throw new Error('⛔️ ABI not found.');
  }
}

function dataEncodeFunctionSignature(abiField, network) {
  return _getWeb3(network).eth.abi.encodeFunctionSignature(abiField);
}

function dataInitializeContractInstance(contractAddress, network, abi) {
  _contractInstance = new (_getWeb3(network).eth.Contract)(abi, contractAddress);
}

async function dataQueryFunction(abiField, inputs, blockNumber, from) {
  return _contractInstance.methods[abiField.name](...inputs).call();
}

function dataValidateType(type, value) {
  if (value === '') {
    throw new Error(' ⛔️ Value is empty.');
  }
  if (type === 'address') {
    if (!value.startsWith('0x')) {
      throw new Error('⛔️ Value does not start with 0x.');
    }
    if (value.length != 42) {
      throw new Error('⛔️ Value should be 20 bytes.');
    }
  }
}

function _getWeb3(network) {
  if (!_web3Instance[network]) {
    _web3Instance[network] = new Web3(`https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`);
  }
  return _web3Instance[network];
}

async function _fetchJson(url) {
  const res = await fetch(url);
  return await res.json();
}
