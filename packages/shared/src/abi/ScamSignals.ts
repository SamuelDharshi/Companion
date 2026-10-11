// Generated from contracts/out/ScamSignals.sol/ScamSignals.json. Do not edit by hand.
export const ScamSignalsAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_vault",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "flagged",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "count",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "lastAt",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "holdReported",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rebut",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "uri",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rebuttals",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string[]",
        "internalType": "string[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "report",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scriptId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct WebAuthn.WebAuthnAuth",
        "components": [
          {
            "name": "authenticatorData",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "clientDataJSON",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "challengeIndex",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "typeIndex",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "r",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "s",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reportChallenge",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "handleHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "scriptId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setVault",
    "inputs": [
      {
        "name": "_vault",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "signal",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ScamSignals.Signal",
        "components": [
          {
            "name": "reports",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "lastAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "lastScriptId",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalReports",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "usedChallenge",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IThunaiVaultView"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "wasCancelledByGuardian",
    "inputs": [
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Rebutted",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "uri",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Reported",
    "inputs": [
      {
        "name": "handleHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "scriptId",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "holdId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "reports",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VaultSet",
    "inputs": [
      {
        "name": "vault",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyReported",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ChallengeUsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "HoldNotCancelled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoVault",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  }
] as const;
