// Generated from contracts/out/ThunaiVault.sol/ThunaiVault.json. Do not edit by hand.
export const ThunaiVaultAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_ctk",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_ausd",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_relayer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "agent",
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
    "name": "agoraEnabled",
    "inputs": [],
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
    "name": "agoraPair",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAgoraPair"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowanceDue",
    "inputs": [
      {
        "name": "familyId",
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
    "name": "ausd",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ausdLiabilities",
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
    "name": "ctk",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ctkScale",
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
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "envelopeChallenge",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "e",
        "type": "tuple",
        "internalType": "struct ThunaiVault.Envelope",
        "components": [
          {
            "name": "weeklyAmount",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "perWithdrawalCap",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "payeesRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "cadence",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "holdTimeout",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expiry",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "nextRunAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
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
    "name": "expireHold",
    "inputs": [
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "family",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ThunaiVault.Family",
        "components": [
          {
            "name": "guardian",
            "type": "tuple",
            "internalType": "struct ThunaiVault.Passkey",
            "components": [
              {
                "name": "x",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "y",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          },
          {
            "name": "student",
            "type": "tuple",
            "internalType": "struct ThunaiVault.Passkey",
            "components": [
              {
                "name": "x",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "y",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          },
          {
            "name": "studentAcct",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "guardianAcct",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "duressAddr",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "homeBalance",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "balance",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "frozen",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "checkNonce",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "checkRequestedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "env",
            "type": "tuple",
            "internalType": "struct ThunaiVault.Envelope",
            "components": [
              {
                "name": "weeklyAmount",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "perWithdrawalCap",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "payeesRoot",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "cadence",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "holdTimeout",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "expiry",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "nextRunAt",
                "type": "uint64",
                "internalType": "uint64"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "familyCount",
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
    "name": "freeFloat",
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
    "name": "freeze",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "nonce",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "duressSig",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "freezeDigest",
    "inputs": [
      {
        "name": "familyId",
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
    "name": "freezeNonce",
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
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fund",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "fundAndSettle",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hold",
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
        "type": "tuple",
        "internalType": "struct ThunaiVault.Hold",
        "components": [
          {
            "name": "familyId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "to",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amount",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "reason",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "openedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "releaseAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "memoHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "holdCount",
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
    "name": "livenessChallenge",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "nonce",
        "type": "uint64",
        "internalType": "uint64"
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
    "name": "notes",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "role",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "ciphertext",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "version",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "notesChallenge",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "role",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "ciphertext",
        "type": "bytes",
        "internalType": "bytes"
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
    "name": "notesVersion",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "openHolds",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "ids",
        "type": "uint256[]",
        "internalType": "uint256[]"
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
    "name": "proveLiveness",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "nonce",
        "type": "uint64",
        "internalType": "uint64"
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
    "name": "registerFamily",
    "inputs": [
      {
        "name": "guardianX",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "guardianY",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "studentX",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "studentY",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "studentAcct",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "guardianAcct",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "duressAddr",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "relayer",
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
