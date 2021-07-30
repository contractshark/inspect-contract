// Add ability to serialize BigInt as JSON
JSON.stringifyBigInt = function (obj) {
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString() + 'n';
        } else {
            return value;
        }
    })
}

JSON.parseBigInt = function (str) {
    return JSON.parse(str, (key, value) => {
        if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
            return BigInt(value.slice(0, -1));
        }
        return value;
    })
}

objAssign = function (to, from) {
    if (window.Vue) {
        for (let i in from) {
            Vue.set(to, i, from[i]);
        }
    }
    else {
        Object.assign(to, from);
    }
}

rpcToObj = function (rpc_obj, obj) {
    if (!obj) {
        obj = {};
    }
    for (let i in rpc_obj) {
        if (isNaN(i)) {
            // Not always correct, but overall useful
            try {
                obj[i] = isNaN(rpc_obj[i]) || i.indexOf("name") != -1 || i.indexOf("symbol") != -1
                    || (typeof (rpc_obj[i]) == "boolean")
                    || (typeof (rpc_obj[i]) == "string" && rpc_obj[i].startsWith("0x"))
                    || (typeof (rpc_obj[i]) == "object")
                    ? rpc_obj[i]
                    : BigInt(rpc_obj[i]);
            } catch (e) {
                console.log('pcToObj error', rpc_obj[i], typeof(rpc_obj[i]))
            }
        }
    }
    return obj;
}

// Makes calling contracts easier, by adding the contracts to every instance of Web3.
// Changing the network is automatically dealt with.
// New way of using: web3.contract_name.method_name(parameters).call() or .send()
function addContract(name, abi, addresses) {
    Object.defineProperty(Web3.prototype, name, {
        get: function () {
            let web3 = this;
            let chainId = web3.currentProvider.chainId == "1" ? "0x1" : web3.currentProvider.chainId
            return new Proxy({}, {
                get: function (target, method) {
                    if (method == "address") {
                        return addresses[chainId];
                    }

                    return function (...params) {
                        let contract = new web3.eth.Contract(abi, addresses[chainId]);
                        return contract.methods[method](...params)
                    }
                }
            });
        }
    });
}

Web3.prototype.contract = function (abi_name, address) {
    return new this.eth.Contract(abis[abi_name], address);
}

// Add a decode method to all web3 instances
// To get the ABI decoder, use web3.decode.abi_name
Object.defineProperty(Web3.prototype, "decode", {
    get: function () {
        let web3 = this;
        return new Proxy({}, {
            get: function (target, name) {
                let decoder = new Decoder(web3);
                decoder.addABI(abis[name]);
                return decoder;
            }
        });
    }
});

Object.defineProperty(Web3.prototype, "ens", {
    get: function () {
        return new ENS(this);
    }
})

const MAX_INT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

async function signERC2612Permit(web3, token, owner, spender, value, deadline, nonce) {
    const message = {
        owner,
        spender,
        value,
        nonce: nonce || await web3.contract('pair', token).methods.nonces(owner).call(),
        deadline: deadline || MAX_INT
    }
    
    const typedData = {
        types: {
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        },
        primaryType: "Permit",
        domain: {
            name: await web3.contract('erc20', token).methods.name().call(),
            version: '1',
            chainId: 1,
            verifyingContract: token
        },
        message: message
    };    

    return new Promise((resolutionFunc, rejectionFunc) => {
        web3.currentProvider.sendAsync({ method: "eth_signTypedData_v4", params: [owner, JSON.stringify(typedData)], from: owner }, function (error, result) {
            if (!error) {
                const signature = result.result.substring(2);
                const r = "0x" + signature.substring(0, 64);
                const s = "0x" + signature.substring(64, 128);
                const v = parseInt(signature.substring(128, 130), 16);
                resolutionFunc({ r, s, v, deadline: message.deadline });
            }
        });
    });
};
