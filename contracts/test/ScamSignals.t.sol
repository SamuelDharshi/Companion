// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {ThunaiVault} from "../src/ThunaiVault.sol";
import {ScamSignals} from "../src/ScamSignals.sol";
import {PasskeySigner} from "./utils/PasskeySigner.sol";
import {ThunaiFixture} from "./ThunaiVault.t.sol";

/// @notice The network: when one family confirms a scam, the next family's agent raises the
///         hold level. These tests pin down the honest limits of that claim.
contract ScamSignalsTest is ThunaiFixture {
    uint8 internal constant SCRIPT_FAKE_OFFICER = 1;

    // Family B: Priya's mother in Coimbatore, the second demo phone.
    uint256 internal constant PRIYA_MOTHER_PASSKEY = 0xC0FFEE;
    uint256 internal constant PRIYA_PASSKEY = 0xDECAF;
    uint256 internal priyaAcctKey = 0x9111;
    uint256 internal priyaMotherAcctKey = 0x9222;

    uint256 internal familyB;
    address internal priyaAcct;
    address internal priyaMotherAcct;

    uint256 internal cancelledHoldId;
    bytes32 internal scammerHandle;

    function setUp() public override {
        super.setUp();
        scammerHandle = keccak256(abi.encodePacked(scammer));

        priyaAcct = vm.addr(priyaAcctKey);
        priyaMotherAcct = vm.addr(priyaMotherAcctKey);

        // Onboard the second family and give Priya a balance.
        (bytes32 gx, bytes32 gy) = PasskeySigner.publicKey(PRIYA_MOTHER_PASSKEY);
        (bytes32 sx, bytes32 sy) = PasskeySigner.publicKey(PRIYA_PASSKEY);
        vm.prank(relayer);
        familyB = vault.registerFamily(gx, gy, sx, sy, priyaAcct, priyaMotherAcct, makeAddr("duressB"));

        _enableAgora();
        ctk.mint(priyaMotherAcct, 10_000 * USD);
        vm.prank(priyaMotherAcct);
        ctk.approve(address(vault), type(uint256).max);
        vm.prank(priyaMotherAcct);
        vault.fundAndSettle(familyB, 3_000 * USD);

        // Family A meets the scam first, and Amma stops it.
        _giveArjunBalance(3_000 * USD);
        cancelledHoldId = _withdraw(scammer, 2_000 * USD, "immigration bond", _noProof());
        _resolve(cancelledHoldId, false, AMMA_PASSKEY);
    }

    /// @dev Amma signs the network report with the same Face ID.
    function _report(uint256 holdId, uint256 passkey, uint256 reportingFamily) internal {
        bytes32 challenge = signals.reportChallenge(reportingFamily, scammerHandle, SCRIPT_FAKE_OFFICER, holdId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(passkey, challenge);
        signals.report(scammerHandle, SCRIPT_FAKE_OFFICER, holdId, auth);
    }

    /// @dev Priya's withdraw intent, signed with her own `thunai/acct` key.
    function _withdrawB(address to, uint128 amount) internal returns (uint256 holdId) {
        ThunaiVault.WithdrawIntent memory intent = ThunaiVault.WithdrawIntent({
            familyId: familyB,
            to: to,
            amount: amount,
            memoHash: keccak256("bond"),
            nonce: vault.withdrawNonce(familyB),
            deadline: block.timestamp + 1 hours
        });
        bytes32 digest = vault.withdrawDigest(familyB, to, amount, intent.memoHash, intent.deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(priyaAcctKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(relayer);
        return vault.withdraw(intent, new bytes32[](0), sig);
    }

    function test_GuardianCanReportAfterCancellingHold() public {
        _report(cancelledHoldId, AMMA_PASSKEY, familyId);

        (uint32 count, uint64 lastAt) = signals.flagged(scammerHandle);
        assertEq(count, 1);
        assertEq(lastAt, uint64(block.timestamp));
        assertEq(signals.totalReports(), 1);
    }

    /// @notice Woah 3: the second family's payment to the same handle is held, with evidence.
    function test_ReportRaisesHoldLevelForAnotherFamily() public {
        _report(cancelledHoldId, AMMA_PASSKEY, familyId);

        uint256 holdId = _withdrawB(scammer, 500 * USD);
        assertEq(vault.hold(holdId).reason, 4, "NETWORK_FLAG");
        assertEq(ausd.balanceOf(scammer), 0);
    }

    /// @notice The honest limit: a flag only raises the hold level. The guardian still decides,
    ///         and a flagged payment the guardian allows is still paid.
    function test_FlagOnlyEscalatesAndNeverRefusesOnItsOwn() public {
        _report(cancelledHoldId, AMMA_PASSKEY, familyId);
        uint256 holdId = _withdrawB(scammer, 500 * USD);

        bytes32 challenge = vault.resolveChallenge(familyB, holdId, true);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(PRIYA_MOTHER_PASSKEY, challenge);
        vm.prank(relayer);
        vault.resolveHold(holdId, true, auth);

        assertEq(ausd.balanceOf(scammer), 500 * USD, "the guardian can still allow it");
    }

    /// @notice A report must be backed by a hold that family's own guardian cancelled,
    ///         so inventing flags costs a real family's Face ID.
    function test_CannotReportWithoutACancelledHold() public {
        uint256 openHold = _withdraw(makeAddr("other"), 50 * USD, "x", _noProof());
        bytes32 challenge = signals.reportChallenge(familyId, scammerHandle, SCRIPT_FAKE_OFFICER, openHold);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.expectRevert(ScamSignals.HoldNotCancelled.selector);
        signals.report(scammerHandle, SCRIPT_FAKE_OFFICER, openHold, auth);
    }

    /// @notice A hold the guardian ALLOWED is not evidence of a scam.
    function test_CannotReportAReleasedHold() public {
        uint256 holdId = _withdraw(makeAddr("friend"), 50 * USD, "x", _noProof());
        _resolve(holdId, true, AMMA_PASSKEY);

        bytes32 challenge = signals.reportChallenge(familyId, scammerHandle, SCRIPT_FAKE_OFFICER, holdId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.expectRevert(ScamSignals.HoldNotCancelled.selector);
        signals.report(scammerHandle, SCRIPT_FAKE_OFFICER, holdId, auth);
    }

    /// @notice An expired hold is not a confirmed scam either: nobody actually answered.
    function test_CannotReportAnExpiredHold() public {
        uint256 holdId = _withdraw(makeAddr("unknown"), 50 * USD, "x", _noProof());
        vm.warp(block.timestamp + 31 minutes);
        vault.expireHold(holdId);

        bytes32 challenge = signals.reportChallenge(familyId, scammerHandle, SCRIPT_FAKE_OFFICER, holdId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.expectRevert(ScamSignals.HoldNotCancelled.selector);
        signals.report(scammerHandle, SCRIPT_FAKE_OFFICER, holdId, auth);
    }

    /// @notice One cancelled hold buys exactly one report, so a handle cannot be inflated.
    function test_CannotReportTheSameHoldTwice() public {
        _report(cancelledHoldId, AMMA_PASSKEY, familyId);

        bytes32 challenge =
            signals.reportChallenge(familyId, keccak256(abi.encodePacked(makeAddr("another"))), SCRIPT_FAKE_OFFICER, cancelledHoldId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.expectRevert(ScamSignals.AlreadyReported.selector);
        signals.report(keccak256(abi.encodePacked(makeAddr("another"))), SCRIPT_FAKE_OFFICER, cancelledHoldId, auth);
    }

    /// @notice Only the guardian of the family that cancelled the hold can file its report.
    function test_StrangerCannotFileReportForAnotherFamilysHold() public {
        bytes32 challenge = signals.reportChallenge(familyId, scammerHandle, SCRIPT_FAKE_OFFICER, cancelledHoldId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(PRIYA_MOTHER_PASSKEY, challenge);

        vm.expectRevert(ScamSignals.BadSignature.selector);
        signals.report(scammerHandle, SCRIPT_FAKE_OFFICER, cancelledHoldId, auth);
    }

    function test_StudentCannotFileReport() public {
        bytes32 challenge = signals.reportChallenge(familyId, scammerHandle, SCRIPT_FAKE_OFFICER, cancelledHoldId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);

        vm.expectRevert(ScamSignals.BadSignature.selector);
        signals.report(scammerHandle, SCRIPT_FAKE_OFFICER, cancelledHoldId, auth);
    }

    /// @notice The key anti-poisoning rule: a flagged handle on the family's own signed
    ///         schedule is still paid. A hostile network cannot stop a family's rent.
    function test_ScheduledPayeeIsImmuneToNetworkFlags() public {
        // Report the landlord's handle, which family A has on its schedule.
        bytes32 landlordHandle = keccak256(abi.encodePacked(landlord));
        bytes32 challenge = signals.reportChallenge(familyId, landlordHandle, SCRIPT_FAKE_OFFICER, cancelledHoldId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        signals.report(landlordHandle, SCRIPT_FAKE_OFFICER, cancelledHoldId, auth);

        (uint32 count,) = signals.flagged(landlordHandle);
        assertEq(count, 1, "the handle is flagged");

        uint256 holdId = _withdraw(landlord, 900 * USD, "rent", landlordProof);
        assertEq(holdId, 0, "rent still pays");
        assertEq(ausd.balanceOf(landlord), 900 * USD);
    }

    /// @notice Due process: the flagged party can append a rebuttal.
    function test_FlaggedPartyCanRebut() public {
        _report(cancelledHoldId, AMMA_PASSKEY, familyId);

        vm.prank(scammer);
        signals.rebut(scammerHandle, "ipfs://my-side-of-the-story");

        string[] memory r = signals.rebuttals(scammerHandle);
        assertEq(r.length, 1);
        assertEq(r[0], "ipfs://my-side-of-the-story");
    }

    function test_UnflaggedHandleReadsZero() public {
        (uint32 count, uint64 lastAt) = signals.flagged(keccak256(abi.encodePacked(makeAddr("nobody"))));
        assertEq(count, 0);
        assertEq(lastAt, 0);
    }

    function test_SignalRecordsScriptId() public {
        _report(cancelledHoldId, AMMA_PASSKEY, familyId);
        ScamSignals.Signal memory s = signals.signal(scammerHandle);
        assertEq(s.lastScriptId, SCRIPT_FAKE_OFFICER);
        assertEq(s.reports, 1);
    }
}
