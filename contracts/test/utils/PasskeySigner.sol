// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Vm} from "forge-std/Vm.sol";
import {Base64} from "solady/utils/Base64.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";

/// @notice Builds real WebAuthn assertions in tests, so the suite exercises the same
///         onchain P256 verification path the phones use. Nothing is mocked: the
///         clientDataJSON, authenticatorData and the secp256r1 signature are genuine.
library PasskeySigner {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev Order of the secp256r1 curve. Solady rejects `s > N/2` (malleability).
    uint256 internal constant P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;

    /// @dev `sha256("thunai.app")`, the relying-party ID hash the authenticator signs over.
    bytes32 internal constant RP_ID_HASH = sha256(bytes("thunai.app"));

    /// @dev WebAuthn flags: bit 0 "User Present", bit 2 "User Verified".
    ///      Face ID is required everywhere, so UV is always set.
    bytes1 internal constant FLAGS_UP_UV = 0x05;
    bytes1 internal constant FLAGS_UP_ONLY = 0x01;

    function publicKey(uint256 privateKey) internal pure returns (bytes32 x, bytes32 y) {
        (uint256 px, uint256 py) = vm.publicKeyP256(privateKey);
        return (bytes32(px), bytes32(py));
    }

    /// @notice Signs `challenge` the way a real authenticator would, with user verification.
    function sign(uint256 privateKey, bytes32 challenge) internal pure returns (WebAuthn.WebAuthnAuth memory) {
        return signWithFlags(privateKey, challenge, FLAGS_UP_UV);
    }

    /// @notice Same, but lets a test withhold the "User Verified" bit to prove the
    ///         contract refuses a presence-only tap.
    function signWithFlags(uint256 privateKey, bytes32 challenge, bytes1 flags)
        internal
        pure
        returns (WebAuthn.WebAuthnAuth memory auth)
    {
        // The challenge travels through clientDataJSON as unpadded, file-safe base64url.
        string memory encoded = Base64.encode(abi.encodePacked(challenge), true, true);
        string memory clientDataJSON = string(
            abi.encodePacked(
                '{"type":"webauthn.get","challenge":"', encoded, '","origin":"https://thunai.app","crossOrigin":false}'
            )
        );

        // 32-byte rpIdHash || flags || 4-byte signature counter.
        bytes memory authenticatorData = abi.encodePacked(RP_ID_HASH, flags, uint32(1));

        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, sha256(bytes(clientDataJSON))));
        (bytes32 r, bytes32 s) = vm.signP256(privateKey, messageHash);

        // Normalise to the low-s form Solady accepts.
        if (uint256(s) > P256_N / 2) s = bytes32(P256_N - uint256(s));

        auth = WebAuthn.WebAuthnAuth({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: 23, // index of '"challenge":"' in the JSON above
            typeIndex: 1, // index of '"type":"'
            r: r,
            s: s
        });
    }
}
