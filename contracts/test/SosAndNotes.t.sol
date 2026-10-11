// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {ThunaiVault} from "../src/ThunaiVault.sol";
import {ThunaiFixture} from "./ThunaiVault.t.sol";
import {PasskeySigner} from "./utils/PasskeySigner.sol";

/// @notice Silent SOS: one signature from the duress key freezes every in-app outflow, pages
///         the family and is counted onchain. Only the guardian's passkey lifts it.
contract ThunaiVaultSosTest is ThunaiFixture {
    event SOSRaised(uint256 indexed familyId, uint8 reasonCode, uint64 timestamp);

    function setUp() public override {
        super.setUp();
        _giveArjunBalance(1_000 * USD);
    }

    function _duressSig() internal view returns (uint256 nonce, bytes memory sig) {
        nonce = vault.freezeNonce(familyId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(duressKey, vault.freezeDigest(familyId));
        sig = abi.encodePacked(r, s, v);
    }

    function test_SosFreezesAndEmitsEvent() public {
        (uint256 nonce, bytes memory sig) = _duressSig();

        vm.expectEmit(true, false, false, true);
        emit SOSRaised(familyId, 0, uint64(block.timestamp));
        vault.sos(familyId, nonce, sig, 0);

        assertTrue(vault.family(familyId).frozen, "family frozen");
        assertEq(vault.sosCount(), 1, "counted");
    }

    function test_SosRecordsWhatTheCallerWants() public {
        (uint256 nonce, bytes memory sig) = _duressSig();
        vm.expectEmit(true, false, false, true);
        emit SOSRaised(familyId, 1, uint64(block.timestamp)); // 1 = gift card
        vault.sos(familyId, nonce, sig, 1);
    }

    function test_SosStopsEvenRentUntilTheGuardianLiftsIt() public {
        (uint256 nonce, bytes memory sig) = _duressSig();
        vault.sos(familyId, nonce, sig, 0);

        uint256 holdId = _withdraw(landlord, 400 * USD, "rent", landlordProof);
        assertEq(vault.hold(holdId).reason, 6, "FROZEN holds even a scheduled payee");
        assertEq(ausd.balanceOf(landlord), 0);
    }

    function test_OnlyTheGuardianPasskeyLiftsAnSos() public {
        (uint256 nonce, bytes memory sig) = _duressSig();
        vault.sos(familyId, nonce, sig, 0);

        // Arjun's own passkey cannot lift it: he is the one who may be under pressure.
        bytes32 challenge = vault.unfreezeChallenge(familyId);
        WebAuthn.WebAuthnAuth memory studentAuth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.unfreeze(familyId, studentAuth);

        WebAuthn.WebAuthnAuth memory guardianAuth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        vm.prank(relayer);
        vault.unfreeze(familyId, guardianAuth);
        assertFalse(vault.family(familyId).frozen);
    }

    function test_SosRejectsAnUnknownReasonCode() public {
        (uint256 nonce, bytes memory sig) = _duressSig();
        vm.expectRevert(ThunaiVault.BadReason.selector);
        vault.sos(familyId, nonce, sig, 6);
    }

    function test_SosNeedsTheDuressKey() public {
        uint256 nonce = vault.freezeNonce(familyId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arjunAcctKey, vault.freezeDigest(familyId));
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.sos(familyId, nonce, abi.encodePacked(r, s, v), 0);
        assertFalse(vault.family(familyId).frozen);
        assertEq(vault.sosCount(), 0);
    }

    function test_SosSignatureCannotBeReplayed() public {
        (uint256 nonce, bytes memory sig) = _duressSig();
        vault.sos(familyId, nonce, sig, 0);
        vm.expectRevert(ThunaiVault.BadNonce.selector);
        vault.sos(familyId, nonce, sig, 0);
    }
}

/// @notice The notes are ciphertext. The key never reaches the chain: it is derived from the
///         person's own passkey on their own devices, so any of their devices can read the
///         notes back after one Face ID and nobody else can.
contract ThunaiVaultNotesTest is ThunaiFixture {
    bytes internal blob = hex"a1b2c3d4e5f60718293a4b5c6d7e8f90";

    function _store(uint256 passkey, uint8 role, bytes memory ciphertext) internal {
        bytes32 challenge = vault.notesChallenge(familyId, role, ciphertext);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(passkey, challenge);
        vm.prank(relayer);
        vault.setNotes(familyId, role, ciphertext, auth);
    }

    function test_GuardianStoresHerNotesAndAnyDeviceReadsThemBack() public {
        _store(AMMA_PASSKEY, 1, blob);
        (bytes memory stored, uint64 version) = vault.notes(familyId, 1);
        assertEq(stored, blob, "ciphertext round-trips");
        assertEq(version, 1);
    }

    function test_StudentAndGuardianNotesAreSeparate() public {
        _store(AMMA_PASSKEY, 1, blob);
        _store(ARJUN_PASSKEY, 0, hex"deadbeef");
        (bytes memory guardianNotes,) = vault.notes(familyId, 1);
        (bytes memory studentNotes,) = vault.notes(familyId, 0);
        assertEq(guardianNotes, blob);
        assertEq(studentNotes, hex"deadbeef");
    }

    function test_AStrangersPasskeyCannotWriteNotes() public {
        bytes32 challenge = vault.notesChallenge(familyId, 1, blob);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(STRANGER_PASSKEY, challenge);
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.setNotes(familyId, 1, blob, auth);
    }

    function test_TheStudentCannotWriteTheGuardiansNotes() public {
        bytes32 challenge = vault.notesChallenge(familyId, 1, blob);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.setNotes(familyId, 1, blob, auth);
    }

    function test_AnOldAssertionCannotRollTheNotesBack() public {
        bytes32 first = vault.notesChallenge(familyId, 1, blob);
        WebAuthn.WebAuthnAuth memory oldAuth = PasskeySigner.sign(AMMA_PASSKEY, first);
        vm.prank(relayer);
        vault.setNotes(familyId, 1, blob, oldAuth);

        // Replaying the same assertion fails: the version moved on, so the challenge changed.
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.setNotes(familyId, 1, blob, oldAuth);

        _store(AMMA_PASSKEY, 1, hex"01020304");
        (, uint64 version) = vault.notes(familyId, 1);
        assertEq(version, 2);
    }

    function test_OnlyTheRelayerSubmitsNotes() public {
        bytes32 challenge = vault.notesChallenge(familyId, 1, blob);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        vm.expectRevert(ThunaiVault.NotRelayer.selector);
        vault.setNotes(familyId, 1, blob, auth);
    }

    function test_NotesAreSizeLimited() public {
        bytes memory big = new bytes(2049);
        bytes32 challenge = vault.notesChallenge(familyId, 1, big);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.NotesTooLarge.selector);
        vault.setNotes(familyId, 1, big, auth);
    }

    function test_RoleMustBeStudentOrGuardian() public {
        bytes32 challenge = vault.notesChallenge(familyId, 2, blob);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadRole.selector);
        vault.setNotes(familyId, 2, blob, auth);
    }
}

/// @notice The allowance stays in the app by default. Money from home sits in the vault, only
///         payees on the guardian's signed schedule are paid automatically, and any other
///         move out, including to the student's own bank or an off-ramp, opens a hold.
contract ThunaiVaultStaysInAppTest is ThunaiFixture {
    function setUp() public override {
        super.setUp();
        _giveArjunBalance(1_000 * USD);
    }

    function test_MoneyFromHomeStaysInTheVault() public {
        uint256 before = ausd.balanceOf(address(vault));
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);
        // Home money is held as CTK in the vault and nothing leaves until an allowance run.
        assertEq(ausd.balanceOf(address(vault)), before, "no AUSD leaves on a deposit");
        assertEq(vault.family(familyId).homeBalance, 600 * USD);
    }

    function test_AMoveToTheStudentsOwnBankIsHeldNotPaid() public {
        address ownBank = makeAddr("arjunsOwnBankOrOffRamp"); // never put on the schedule
        uint256 holdId = _withdraw(ownBank, 300 * USD, "move to my bank", _noProof());

        assertGt(holdId, 0, "a hold opened");
        assertEq(vault.hold(holdId).reason, 1, "NEW_PAYEE");
        assertEq(ausd.balanceOf(ownBank), 0, "nothing reached the bank");
        assertEq(vault.family(familyId).balance, 700 * USD, "it left the spendable balance");
    }

    function test_OnlyScheduledPayeesPayStraightThrough() public {
        uint256 scheduled = _withdraw(landlord, 400 * USD, "rent", landlordProof);
        assertEq(scheduled, 0, "rent on the schedule is paid at once");
        assertEq(ausd.balanceOf(landlord), 400 * USD);

        uint256 unscheduled = _withdraw(scammer, 100 * USD, "other", _noProof());
        assertGt(unscheduled, 0, "anything else is held");
    }
}
