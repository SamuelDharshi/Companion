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
    "type": "function",
    "name": "requestCheck",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "nonce",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveChallenge",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "release",
        "type": "bool",
        "internalType": "bool"
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
    "name": "resolveHold",
    "inputs": [
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "release",
        "type": "bool",
        "internalType": "bool"
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
    "name": "runAllowance",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "scamSignals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IScamSignals"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setAgora",
    "inputs": [
      {
        "name": "pair",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setEnvelope",
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
    "name": "setNotes",
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
    "name": "setRoles",
    "inputs": [
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
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setScamSignals",
    "inputs": [
      {
        "name": "signals",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sos",
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
      },
      {
        "name": "reasonCode",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sosCount",
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
    "name": "unfreeze",
    "inputs": [
      {
        "name": "familyId",
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
    "name": "unfreezeChallenge",
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
    "name": "withdraw",
    "inputs": [
      {
        "name": "i",
        "type": "tuple",
        "internalType": "struct ThunaiVault.WithdrawIntent",
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
            "name": "memoHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "merkleProof",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "studentSig",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "holdId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawDigest",
    "inputs": [
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
        "name": "memoHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "deadline",
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
    "name": "withdrawNonce",
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
    "type": "event",
    "name": "AgoraConfigured",
    "inputs": [
      {
        "name": "pair",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "enabled",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CheckRequested",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "nonce",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "requestedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EnvelopeSet",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "weeklyAmount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "perWithdrawalCap",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "cadence",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "nextRunAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FamilyRegistered",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "studentAcct",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "guardianAcct",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Frozen",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "by",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Funded",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "homeBalance",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HoldExpired",
    "inputs": [
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
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HoldOpened",
    "inputs": [
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
        "name": "to",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "reason",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "releaseAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "memoHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HoldResolved",
    "inputs": [
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
        "name": "released",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "secondsToResolve",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LivenessProved",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "nonce",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "latencySeconds",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NotesStored",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "role",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "version",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Payout",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amountIn",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "amountOut",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "viaAgora",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RolesChanged",
    "inputs": [
      {
        "name": "relayer",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SOSRaised",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "reasonCode",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Unfrozen",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "familyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "memoHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BadDecimals",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadNonce",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadPasskey",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadReason",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadRole",
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
    "name": "EnvelopeExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FamilyFrozen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "HoldNotExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "HoldNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientBalance",
    "inputs": []
  },
  {
    "type": "error",
    "name": "IntentExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoCheckPending",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoSuchFamily",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoSuchHold",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAgent",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotDue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotFrozen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotRelayer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotesTooLarge",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnbackedCredit",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  }
] as const;
