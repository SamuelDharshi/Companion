// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MerkleProofLib} from "solady/utils/MerkleProofLib.sol";
import {ThunaiVault} from "../src/ThunaiVault.sol";
import {ScamSignals} from "../src/ScamSignals.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Prints reference values for `scripts/check-parity.mjs`, and asserts the merkle
///         convention the TypeScript builder has to match.
///
///         This is the one place where a silent mismatch would be invisible until a
///         guardian's approval failed on a real phone: the app builds payee trees and
///         action hashes in TypeScript, and the contract recomputes them in Solidity.
///         If the two ever disagree, no proof verifies and no approval lands.
contract CrossLanguageParityTest is Test {
    // Fixed addresses so both languages hash exactly the same input.
    address constant PAYEE_A = 0x1111111111111111111111111111111111111111;
    address constant PAYEE_B = 0x2222222222222222222222222222222222222222;
    address constant PAYEE_C = 0x3333333333333333333333333333333333333333;
    address constant PAYEE_D = 0x4444444444444444444444444444444444444444;
    address constant PAYEE_E = 0x5555555555555555555555555555555555555555;

    ThunaiVault vault;

    function setUp() public {
        MockERC20 ctk = new MockERC20("CTK", "CTK", 6);
        MockERC20 ausd = new MockERC20("AUSD", "AUSD", 6);
        // Deployed to a fixed address via a fixed deployer+nonce, so the challenge hashes
        // (which bind the vault address) are reproducible from the Node side.
        vault = new ThunaiVault(address(ctk), address(ausd), address(this), address(this));
    }

    function _leaf(address a) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(a));
    }

    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a > b ? keccak256(abi.encodePacked(b, a)) : keccak256(abi.encodePacked(a, b));
    }

    /// @notice Emits the leaves and roots the TypeScript builder must reproduce.
    function test_PrintMerkleReference() public pure {
        console.log("LEAF_A", vm.toString(_leaf(PAYEE_A)));
        console.log("LEAF_B", vm.toString(_leaf(PAYEE_B)));

        bytes32 root2 = _pair(_leaf(PAYEE_A), _leaf(PAYEE_B));
        console.log("ROOT_2", vm.toString(root2));

        // Five payees: an odd node is promoted unchanged at two levels, which is exactly
        // where a hand-rolled tree builder usually diverges.
        bytes32 n01 = _pair(_leaf(PAYEE_A), _leaf(PAYEE_B));
        bytes32 n23 = _pair(_leaf(PAYEE_C), _leaf(PAYEE_D));
        bytes32 n4 = _leaf(PAYEE_E);
        bytes32 n0123 = _pair(n01, n23);
        bytes32 root5 = _pair(n0123, n4);
        console.log("ROOT_5", vm.toString(root5));
    }

    /// @notice The five-payee tree must verify through Solady for every member, using the
    ///         same promotion rule the TypeScript builder implements.
    function test_FivePayeeTreeVerifiesForEveryMember() public pure {
        bytes32 n01 = _pair(_leaf(PAYEE_A), _leaf(PAYEE_B));
        bytes32 n23 = _pair(_leaf(PAYEE_C), _leaf(PAYEE_D));
        bytes32 n4 = _leaf(PAYEE_E);
        bytes32 n0123 = _pair(n01, n23);
        bytes32 root = _pair(n0123, n4);

        // A: sibling B, then n23, then n4
        bytes32[] memory proofA = new bytes32[](3);
        proofA[0] = _leaf(PAYEE_B);
        proofA[1] = n23;
        proofA[2] = n4;
        assertTrue(MerkleProofLib.verify(proofA, root, _leaf(PAYEE_A)), "A");

        bytes32[] memory proofB = new bytes32[](3);
        proofB[0] = _leaf(PAYEE_A);
        proofB[1] = n23;
        proofB[2] = n4;
        assertTrue(MerkleProofLib.verify(proofB, root, _leaf(PAYEE_B)), "B");

        bytes32[] memory proofC = new bytes32[](3);
        proofC[0] = _leaf(PAYEE_D);
        proofC[1] = n01;
        proofC[2] = n4;
        assertTrue(MerkleProofLib.verify(proofC, root, _leaf(PAYEE_C)), "C");

        bytes32[] memory proofD = new bytes32[](3);
        proofD[0] = _leaf(PAYEE_C);
        proofD[1] = n01;
        proofD[2] = n4;
        assertTrue(MerkleProofLib.verify(proofD, root, _leaf(PAYEE_D)), "D");

        // E was promoted twice, so it needs only the top sibling.
        bytes32[] memory proofE = new bytes32[](1);
        proofE[0] = n0123;
        assertTrue(MerkleProofLib.verify(proofE, root, _leaf(PAYEE_E)), "E");
    }

    /// @notice A single-payee tree has the leaf as its root and an empty proof.
    function test_SinglePayeeTreeIsJustTheLeaf() public pure {
        bytes32[] memory empty = new bytes32[](0);
        assertTrue(MerkleProofLib.verify(empty, _leaf(PAYEE_A), _leaf(PAYEE_A)));
    }

    /// @notice Emits the action hashes the app computes locally, for the Node parity check.
    function test_PrintChallengeReference() public view {
        console.log("CHAIN_ID", block.chainid);
        console.log("VAULT", vm.toString(address(vault)));

        ThunaiVault.Envelope memory e = ThunaiVault.Envelope({
            weeklyAmount: 150_000_000,
            perWithdrawalCap: 1_000_000_000,
            payeesRoot: _pair(_leaf(PAYEE_A), _leaf(PAYEE_B)),
            cadence: 604800,
            holdTimeout: 1800,
            expiry: 2000000000,
            nextRunAt: 1760000000
        });
        console.log("ENVELOPE_CHALLENGE", vm.toString(vault.envelopeChallenge(1, e)));
        console.log("RESOLVE_CANCEL", vm.toString(vault.resolveChallenge(1, 7, false)));
        console.log("RESOLVE_RELEASE", vm.toString(vault.resolveChallenge(1, 7, true)));
        console.log("LIVENESS", vm.toString(vault.livenessChallenge(1, 123456789)));
        console.log("UNFREEZE", vm.toString(vault.unfreezeChallenge(1)));
        console.log("NOTES_GUARDIAN_V1", vm.toString(vault.notesChallenge(1, 1, hex"a1b2c3d4")));
        console.log("HANDLE_HASH_A", vm.toString(_leaf(PAYEE_A)));
    }
}
