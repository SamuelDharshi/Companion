// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {PasskeySigner} from "./utils/PasskeySigner.sol";
import {P256Enabled} from "./utils/P256Enabled.sol";

/// @notice Day-0 spike, kept as a test: a real WebAuthn assertion must verify through the
///         P256 precompile. If this fails on a network, the whole guardian model is
///         downgraded, so it runs on every build.
contract P256SmokeTest is Test, P256Enabled {
    uint256 constant PK = 0xB0B1;

    function setUp() public {
        _enableP256();
    }

    function test_RealAssertionVerifies() public {
        bytes32 challenge = keccak256("thunai.spike");
        (bytes32 x, bytes32 y) = PasskeySigner.publicKey(PK);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(PK, challenge);

        assertTrue(WebAuthn.verify(abi.encodePacked(challenge), true, auth, x, y), "assertion must verify");
    }

    function test_RejectsWrongChallenge() public {
        (bytes32 x, bytes32 y) = PasskeySigner.publicKey(PK);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(PK, keccak256("one"));

        assertFalse(WebAuthn.verify(abi.encodePacked(keccak256("two")), true, auth, x, y));
    }

    function test_RejectsPresenceOnlyWhenUserVerificationRequired() public {
        bytes32 challenge = keccak256("thunai.spike");
        (bytes32 x, bytes32 y) = PasskeySigner.publicKey(PK);
        WebAuthn.WebAuthnAuth memory auth =
            PasskeySigner.signWithFlags(PK, challenge, PasskeySigner.FLAGS_UP_ONLY);

        assertFalse(WebAuthn.verify(abi.encodePacked(challenge), true, auth, x, y), "Face ID must be required");
    }
}
