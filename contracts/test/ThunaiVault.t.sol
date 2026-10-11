// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {ThunaiVault} from "../src/ThunaiVault.sol";
import {ScamSignals} from "../src/ScamSignals.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAgoraPair} from "./mocks/MockAgoraPair.sol";
import {PasskeySigner} from "./utils/PasskeySigner.sol";
import {P256Enabled} from "./utils/P256Enabled.sol";

/// @notice Shared fixture: one family (Arjun in Indiana, Amma in Chennai), a seeded
///         allowance and a rent payee on the signed schedule.
abstract contract ThunaiFixture is Test, P256Enabled {
    // Dollars are 6-decimal on testnet, like the real AUSD.
    uint128 internal constant USD = 1e6;

    // Passkeys (P256). These stand in for Face ID on two real phones.
    uint256 internal constant AMMA_PASSKEY = 0xA11CE;
    uint256 internal constant ARJUN_PASSKEY = 0xB0B;
    uint256 internal constant STRANGER_PASSKEY = 0xBADC0DE;

    // `thunai/acct` secp256k1 keys, derived from the same passkeys via Mera PRF.
    uint256 internal arjunAcctKey = 0xA2C7;
    uint256 internal ammaAcctKey = 0xA33A;
    uint256 internal duressKey = 0xDEAD;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal agent = makeAddr("agent");
    address internal arjunAcct;
    address internal ammaAcct;
    address internal duressAddr;

    address internal landlord = makeAddr("landlord"); // on the schedule
    address internal scammer = makeAddr("scammer"); // never on the schedule

    MockERC20 internal ctk;
    MockERC20 internal ausd;
    MockAgoraPair internal pair;
    ThunaiVault internal vault;
    ScamSignals internal signals;

    uint256 internal familyId;
    bytes32 internal payeesRoot;
    bytes32[] internal landlordProof;

    function setUp() public virtual {
        _enableP256();

        arjunAcct = vm.addr(arjunAcctKey);
        ammaAcct = vm.addr(ammaAcctKey);
        duressAddr = vm.addr(duressKey);

        ctk = new MockERC20("Category Test Token", "CTK", 6);
        ausd = new MockERC20("Agora Dollar", "AUSD", 6);

        vm.startPrank(owner);
        vault = new ThunaiVault(address(ctk), address(ausd), relayer, agent);
        signals = new ScamSignals(address(vault));
        vault.setScamSignals(address(signals));
        vm.stopPrank();

        pair = new MockAgoraPair(address(ctk), address(ausd));
        pair.setApprovedSwapper(address(vault), true);

        // Scheduled payees: the landlord and one more, as a sorted-pair merkle tree.
        bytes32 leafLandlord = keccak256(abi.encodePacked(landlord));
        bytes32 leafOther = keccak256(abi.encodePacked(makeAddr("university")));
        payeesRoot = _hashPair(leafLandlord, leafOther);
        landlordProof = new bytes32[](1);
        landlordProof[0] = leafOther;

        // Onboarding: the relayer registers the family with both passkey public keys.
        (bytes32 gx, bytes32 gy) = PasskeySigner.publicKey(AMMA_PASSKEY);
        (bytes32 sx, bytes32 sy) = PasskeySigner.publicKey(ARJUN_PASSKEY);
        vm.prank(relayer);
        familyId = vault.registerFamily(gx, gy, sx, sy, arjunAcct, ammaAcct, duressAddr);

        _setEnvelope(_defaultEnvelope());

        // Amma's money from home.
        ctk.mint(ammaAcct, 100_000 * USD);
        vm.prank(ammaAcct);
        ctk.approve(address(vault), type(uint256).max);
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a > b ? keccak256(abi.encodePacked(b, a)) : keccak256(abi.encodePacked(a, b));
    }

    function _defaultEnvelope() internal view returns (ThunaiVault.Envelope memory) {
        return ThunaiVault.Envelope({
            weeklyAmount: 150 * USD,
            perWithdrawalCap: 1_000 * USD,
            payeesRoot: payeesRoot,
            cadence: 7 days,
            holdTimeout: 30 minutes,
            expiry: uint64(block.timestamp + 365 days),
            nextRunAt: uint64(block.timestamp)
        });
    }

    /// @dev Amma signs the envelope once with Face ID; the contract verifies it at 0x0100.
    function _setEnvelope(ThunaiVault.Envelope memory e) internal {
        bytes32 challenge = vault.envelopeChallenge(familyId, e);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        vm.prank(relayer);
        vault.setEnvelope(familyId, e, auth);
    }

    /// @dev Enables the Agora swap path. Without it the vault needs a seeded AUSD float.
    function _enableAgora() internal {
        vm.prank(owner);
        vault.setAgora(address(pair), true);
    }

    /// @dev The disclosed fallback: no swap, so the vault holds an AUSD float directly.
    function _seedFallbackFloat(uint256 amount) internal {
        ausd.mint(address(vault), amount);
    }

    /// @dev Puts `amount` of spendable allowance in Arjun's balance.
    function _giveArjunBalance(uint128 amount) internal {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fundAndSettle(familyId, amount);
    }

    /// @dev Builds and signs a withdraw intent with Arjun's `thunai/acct` key.
    function _signedWithdraw(address to, uint128 amount, string memory memo)
        internal
        view
        returns (ThunaiVault.WithdrawIntent memory intent, bytes memory sig)
    {
        intent = ThunaiVault.WithdrawIntent({
            familyId: familyId,
            to: to,
            amount: amount,
            memoHash: keccak256(bytes(memo)),
            nonce: vault.withdrawNonce(familyId),
            deadline: block.timestamp + 1 hours
        });
        bytes32 digest = vault.withdrawDigest(familyId, to, amount, intent.memoHash, intent.deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arjunAcctKey, digest);
        sig = abi.encodePacked(r, s, v);
    }

    function _withdraw(address to, uint128 amount, string memory memo, bytes32[] memory proof)
        internal
        returns (uint256 holdId)
    {
        (ThunaiVault.WithdrawIntent memory intent, bytes memory sig) = _signedWithdraw(to, amount, memo);
        vm.prank(relayer);
        return vault.withdraw(intent, proof, sig);
    }

    function _noProof() internal pure returns (bytes32[] memory) {
        return new bytes32[](0);
    }

    /// @dev Amma taps Stop it / Allow, verified onchain.
    function _resolve(uint256 holdId, bool release, uint256 passkey) internal {
        bytes32 challenge = vault.resolveChallenge(familyId, holdId, release);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(passkey, challenge);
        vm.prank(relayer);
        vault.resolveHold(holdId, release, auth);
    }
}

contract ThunaiVaultOnboardingTest is ThunaiFixture {
    function test_RegistersFamilyWithBothPasskeys() public view {
        ThunaiVault.Family memory f = vault.family(familyId);
        assertEq(f.studentAcct, arjunAcct);
        assertEq(f.guardianAcct, ammaAcct);
        assertEq(f.duressAddr, duressAddr);
        assertEq(vault.familyCount(), 1);
    }

    function test_OnlyRelayerCanRegister() public {
        (bytes32 gx, bytes32 gy) = PasskeySigner.publicKey(AMMA_PASSKEY);
        vm.expectRevert(ThunaiVault.NotRelayer.selector);
        vault.registerFamily(gx, gy, gx, gy, arjunAcct, ammaAcct, duressAddr);
    }

    function test_EnvelopeIsStoredAfterGuardianFaceId() public view {
        ThunaiVault.Family memory f = vault.family(familyId);
        assertEq(f.env.weeklyAmount, 150 * USD);
        assertEq(f.env.cadence, 7 days);
        assertEq(f.env.payeesRoot, payeesRoot);
    }

    /// @notice A stranger's Face ID cannot set the family envelope, even through the relayer.
    function test_RejectsEnvelopeSignedByStranger() public {
        ThunaiVault.Envelope memory e = _defaultEnvelope();
        e.weeklyAmount = 5_000 * USD;
        bytes32 challenge = vault.envelopeChallenge(familyId, e);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(STRANGER_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.setEnvelope(familyId, e, auth);
    }

    /// @notice An assertion captured once cannot be replayed.
    function test_RejectsReplayedEnvelopeAssertion() public {
        ThunaiVault.Envelope memory e = _defaultEnvelope();
        e.weeklyAmount = 200 * USD;
        bytes32 challenge = vault.envelopeChallenge(familyId, e);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.prank(relayer);
        vault.setEnvelope(familyId, e, auth);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.ChallengeUsed.selector);
        vault.setEnvelope(familyId, e, auth);
    }

    /// @notice Presence alone is not enough: the contract demands user verification.
    function test_RejectsAssertionWithoutUserVerification() public {
        ThunaiVault.Envelope memory e = _defaultEnvelope();
        e.weeklyAmount = 300 * USD;
        bytes32 challenge = vault.envelopeChallenge(familyId, e);
        WebAuthn.WebAuthnAuth memory auth =
            PasskeySigner.signWithFlags(AMMA_PASSKEY, challenge, PasskeySigner.FLAGS_UP_ONLY);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.setEnvelope(familyId, e, auth);
    }
}

contract ThunaiVaultAllowanceTest is ThunaiFixture {
    function test_FundCreditsHomeBalance() public {
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);
        assertEq(vault.family(familyId).homeBalance, 600 * USD);
        assertEq(vault.family(familyId).balance, 0);
    }

    /// @notice The weekly run settles CTK to AUSD through Agora and credits Arjun.
    function test_RunAllowanceSettlesThroughAgora() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);

        vm.prank(agent);
        vault.runAllowance(familyId);

        ThunaiVault.Family memory f = vault.family(familyId);
        assertEq(f.balance, 150 * USD, "Sunday allowance arrived");
        assertEq(f.homeBalance, 450 * USD);
        assertEq(f.env.nextRunAt, uint64(block.timestamp + 7 days));
    }

    function test_RunAllowanceEmitsPayoutViaAgora() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);

        vm.expectEmit(true, false, false, false, address(vault));
        emit ThunaiVault.Payout(familyId, 150 * USD, 150 * USD, true, uint64(block.timestamp));
        vm.prank(agent);
        vault.runAllowance(familyId);
    }

    /// @notice The disclosed fallback keeps working when Agora has not whitelisted us.
    function test_RunAllowanceFallsBackToSeededFloat() public {
        _seedFallbackFloat(1_000 * USD);
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);

        vm.prank(agent);
        vault.runAllowance(familyId);

        assertEq(vault.family(familyId).balance, 150 * USD);
        assertEq(vault.freeFloat(), 850 * USD);
    }

    /// @notice The books can never promise AUSD the vault does not hold.
    function test_FallbackRefusesUnbackedCredit() public {
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);

        vm.prank(agent);
        vm.expectRevert(ThunaiVault.UnbackedCredit.selector);
        vault.runAllowance(familyId);
    }

    function test_RunAllowanceRevertsBeforeDue() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);
        vm.prank(agent);
        vault.runAllowance(familyId);

        vm.prank(agent);
        vm.expectRevert(ThunaiVault.NotDue.selector);
        vault.runAllowance(familyId);
    }

    /// @notice A retried or double-fired keeper must not pay twice.
    function test_RunAllowanceCannotDoublePayInSameWeek() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fund(familyId, 1_000 * USD);

        vm.prank(agent);
        vault.runAllowance(familyId);
        uint128 after1 = vault.family(familyId).balance;

        vm.prank(agent);
        vm.expectRevert(ThunaiVault.NotDue.selector);
        vault.runAllowance(familyId);

        assertEq(vault.family(familyId).balance, after1);
    }

    function test_RunAllowanceRunsAgainNextWeek() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fund(familyId, 1_000 * USD);

        vm.prank(agent);
        vault.runAllowance(familyId);
        vm.warp(block.timestamp + 7 days);
        vm.prank(agent);
        vault.runAllowance(familyId);

        assertEq(vault.family(familyId).balance, 300 * USD);
    }

    function test_AllowanceDueView() public {
        _enableAgora();
        assertFalse(vault.allowanceDue(familyId), "not funded yet");
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);
        assertTrue(vault.allowanceDue(familyId));
    }

    function test_OnlyAgentOrRelayerCanRunAllowance() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);

        vm.prank(scammer);
        vm.expectRevert(ThunaiVault.NotAgent.selector);
        vault.runAllowance(familyId);
    }

    function test_FundAndSettleArrivesAtOnce() public {
        _enableAgora();
        vm.prank(ammaAcct);
        vault.fundAndSettle(familyId, 200 * USD);
        assertEq(vault.family(familyId).balance, 200 * USD);
    }
}

contract ThunaiVaultWithdrawTest is ThunaiFixture {
    function setUp() public override {
        super.setUp();
        _giveArjunBalance(3_000 * USD);
    }

    /// @notice Rent pays itself: a payee on the guardian-signed schedule goes straight through.
    function test_ScheduledPayeeIsPaidImmediately() public {
        uint256 holdId = _withdraw(landlord, 900 * USD, "rent", landlordProof);

        assertEq(holdId, 0, "no hold for a scheduled payee");
        assertEq(ausd.balanceOf(landlord), 900 * USD);
        assertEq(vault.family(familyId).balance, 2_100 * USD);
    }

    /// @notice The main woah: a new payee opens a cooling hold, instantly.
    function test_NewPayeeOpensHold() public {
        uint256 holdId = _withdraw(scammer, 2_000 * USD, "immigration bond", _noProof());

        assertGt(holdId, 0);
        ThunaiVault.Hold memory h = vault.hold(holdId);
        assertEq(h.reason, 1, "NEW_PAYEE");
        assertEq(h.status, 1, "OPEN");
        assertEq(h.amount, 2_000 * USD);
        assertEq(h.releaseAt, uint64(block.timestamp + 30 minutes));
        // The money left the spendable balance but never reached the payee.
        assertEq(ausd.balanceOf(scammer), 0, "payee must not be paid");
        assertEq(vault.family(familyId).balance, 1_000 * USD);
    }

    /// @notice Even a scheduled payee is held above the cap the guardian signed.
    function test_OverCapOpensHoldEvenForScheduledPayee() public {
        uint256 holdId = _withdraw(landlord, 1_500 * USD, "rent", landlordProof);

        assertEq(vault.hold(holdId).reason, 2, "OVER_CAP");
        assertEq(ausd.balanceOf(landlord), 0);
    }

    function test_WithdrawRequiresStudentSignature() public {
        (ThunaiVault.WithdrawIntent memory intent,) = _signedWithdraw(scammer, 100 * USD, "x");
        // A signature from someone else's key.
        bytes32 digest = vault.withdrawDigest(familyId, scammer, 100 * USD, intent.memoHash, intent.deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ammaAcctKey, digest);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.withdraw(intent, _noProof(), abi.encodePacked(r, s, v));
    }

    /// @notice The relayer pays gas and nothing else. It cannot move money on its own.
    function test_RelayerCannotMoveMoneyWithoutStudentSignature() public {
        ThunaiVault.WithdrawIntent memory intent = ThunaiVault.WithdrawIntent({
            familyId: familyId,
            to: relayer,
            amount: 3_000 * USD,
            memoHash: bytes32(0),
            nonce: vault.withdrawNonce(familyId),
            deadline: block.timestamp + 1 hours
        });

        vm.prank(relayer);
        vm.expectRevert();
        vault.withdraw(intent, _noProof(), hex"");
        assertEq(ausd.balanceOf(relayer), 0);
    }

    function test_WithdrawIntentCannotBeReplayed() public {
        (ThunaiVault.WithdrawIntent memory intent, bytes memory sig) = _signedWithdraw(landlord, 900 * USD, "rent");
        vm.prank(relayer);
        vault.withdraw(intent, landlordProof, sig);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadNonce.selector);
        vault.withdraw(intent, landlordProof, sig);
    }

    function test_ExpiredIntentIsRejected() public {
        (ThunaiVault.WithdrawIntent memory intent, bytes memory sig) = _signedWithdraw(landlord, 900 * USD, "rent");
        vm.warp(block.timestamp + 2 hours);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.IntentExpired.selector);
        vault.withdraw(intent, landlordProof, sig);
    }

    function test_CannotWithdrawMoreThanBalance() public {
        (ThunaiVault.WithdrawIntent memory intent, bytes memory sig) = _signedWithdraw(landlord, 9_999 * USD, "rent");
        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.InsufficientBalance.selector);
        vault.withdraw(intent, landlordProof, sig);
    }
}

contract ThunaiVaultHoldResolutionTest is ThunaiFixture {
    uint256 internal holdId;

    function setUp() public override {
        super.setUp();
        _giveArjunBalance(3_000 * USD);
        holdId = _withdraw(scammer, 2_000 * USD, "immigration bond", _noProof());
    }

    /// @notice Amma taps Stop it. The money comes back; the payee gets nothing.
    function test_GuardianCancelReturnsMoneyToStudent() public {
        _resolve(holdId, false, AMMA_PASSKEY);

        assertEq(vault.hold(holdId).status, 3, "CANCELLED");
        assertEq(vault.family(familyId).balance, 3_000 * USD, "all of it is back");
        assertEq(ausd.balanceOf(scammer), 0);
    }

    /// @notice Amma taps Allow. Only then does the payee get paid.
    function test_GuardianReleasePaysPayee() public {
        _resolve(holdId, true, AMMA_PASSKEY);

        assertEq(vault.hold(holdId).status, 2, "RELEASED");
        assertEq(ausd.balanceOf(scammer), 2_000 * USD);
        assertEq(vault.family(familyId).balance, 1_000 * USD);
    }

    /// @notice No server, no company and no scammer can stand in for Amma.
    function test_StrangerPasskeyCannotResolveHold() public {
        bytes32 challenge = vault.resolveChallenge(familyId, holdId, true);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(STRANGER_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.resolveHold(holdId, true, auth);
    }

    /// @notice Arjun cannot approve his own held payment, however hard he is pressured.
    function test_StudentPasskeyCannotResolveHold() public {
        bytes32 challenge = vault.resolveChallenge(familyId, holdId, true);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.resolveHold(holdId, true, auth);
    }

    /// @notice An assertion for "cancel" cannot be rewritten into a "release".
    function test_CancelAssertionCannotBeReusedToRelease() public {
        bytes32 cancelChallenge = vault.resolveChallenge(familyId, holdId, false);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, cancelChallenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.resolveHold(holdId, true, auth);
    }

    function test_HoldCannotBeResolvedTwice() public {
        _resolve(holdId, false, AMMA_PASSKEY);
        bytes32 challenge = vault.resolveChallenge(familyId, holdId, true);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.HoldNotOpen.selector);
        vault.resolveHold(holdId, true, auth);
    }

    /// @notice Fail-safe: nobody answered, so the money goes back by itself.
    function test_ExpireHoldReturnsMoneyToStudent() public {
        vm.warp(block.timestamp + 31 minutes);
        vault.expireHold(holdId); // anyone may call it

        assertEq(vault.hold(holdId).status, 4, "EXPIRED");
        assertEq(vault.family(familyId).balance, 3_000 * USD);
        assertEq(ausd.balanceOf(scammer), 0);
    }

    function test_CannotExpireBeforeTimeout() public {
        vm.warp(block.timestamp + 29 minutes);
        vm.expectRevert(ThunaiVault.HoldNotExpired.selector);
        vault.expireHold(holdId);
    }

    /// @notice Timing out never pays the payee. This is the whole promise of the hold.
    function test_ExpiryNeverPaysThePayee() public {
        vm.warp(block.timestamp + 365 days);
        vault.expireHold(holdId);
        assertEq(ausd.balanceOf(scammer), 0, "money must never reach the payee");
    }

    function test_ResolvedHoldCannotThenExpire() public {
        _resolve(holdId, true, AMMA_PASSKEY);
        vm.warp(block.timestamp + 31 minutes);
        vm.expectRevert(ThunaiVault.HoldNotOpen.selector);
        vault.expireHold(holdId);
    }

    function test_HoldResolvedEventCarriesSaveTime() public {
        vm.warp(block.timestamp + 8);
        vm.expectEmit(true, true, false, true, address(vault));
        emit ThunaiVault.HoldResolved(holdId, familyId, false, 8);
        _resolve(holdId, false, AMMA_PASSKEY);
    }
}

contract ThunaiVaultCheckTest is ThunaiFixture {
    function setUp() public override {
        super.setUp();
        _giveArjunBalance(3_000 * USD);
    }

    /// @notice Woah 2: Amma answers a cloned voice with one tap on Arjun's real phone.
    function test_LivenessProofFromStudentPasskey() public {
        vm.prank(ammaAcct);
        uint64 nonce = vault.requestCheck(familyId);
        assertTrue(nonce != 0);

        vm.warp(block.timestamp + 1);
        bytes32 challenge = vault.livenessChallenge(familyId, nonce);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);

        vm.expectEmit(true, false, false, true, address(vault));
        emit ThunaiVault.LivenessProved(familyId, nonce, uint64(block.timestamp), 1);
        vm.prank(relayer);
        vault.proveLiveness(familyId, nonce, auth);

        assertEq(vault.family(familyId).checkNonce, 0, "check answered");
    }

    /// @notice A voice can be cloned; a passkey cannot. Nobody else can answer for Arjun.
    function test_StrangerCannotProveLivenessForStudent() public {
        vm.prank(ammaAcct);
        uint64 nonce = vault.requestCheck(familyId);

        bytes32 challenge = vault.livenessChallenge(familyId, nonce);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(STRANGER_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.proveLiveness(familyId, nonce, auth);
    }

    function test_GuardianCannotProveLivenessForStudent() public {
        vm.prank(ammaAcct);
        uint64 nonce = vault.requestCheck(familyId);

        bytes32 challenge = vault.livenessChallenge(familyId, nonce);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.proveLiveness(familyId, nonce, auth);
    }

    /// @notice While a check goes unanswered, anything to a new payee is held.
    function test_UnansweredCheckHoldsPaymentsToNewPayees() public {
        vm.prank(ammaAcct);
        vault.requestCheck(familyId);

        uint256 holdId = _withdraw(scammer, 100 * USD, "urgent", _noProof());
        assertEq(vault.hold(holdId).reason, 5, "CHECK_PENDING");
    }

    /// @notice Rent still pays while a check is pending: the schedule is already trusted.
    function test_UnansweredCheckDoesNotBlockScheduledPayees() public {
        vm.prank(ammaAcct);
        vault.requestCheck(familyId);

        uint256 holdId = _withdraw(landlord, 900 * USD, "rent", landlordProof);
        assertEq(holdId, 0);
        assertEq(ausd.balanceOf(landlord), 900 * USD);
    }

    function test_AnsweringCheckRestoresNormalFlow() public {
        vm.prank(ammaAcct);
        uint64 nonce = vault.requestCheck(familyId);
        bytes32 challenge = vault.livenessChallenge(familyId, nonce);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);
        vm.prank(relayer);
        vault.proveLiveness(familyId, nonce, auth);

        uint256 holdId = _withdraw(scammer, 100 * USD, "coffee", _noProof());
        assertEq(vault.hold(holdId).reason, 1, "back to plain NEW_PAYEE");
    }

    function test_StaleNonceIsRejected() public {
        vm.prank(ammaAcct);
        uint64 nonce = vault.requestCheck(familyId);
        bytes32 challenge = vault.livenessChallenge(familyId, nonce);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(ARJUN_PASSKEY, challenge);

        vm.prank(relayer);
        vault.proveLiveness(familyId, nonce, auth);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.NoCheckPending.selector);
        vault.proveLiveness(familyId, nonce, auth);
    }
}

contract ThunaiVaultFreezeTest is ThunaiFixture {
    function setUp() public override {
        super.setUp();
        _giveArjunBalance(3_000 * USD);
    }

    /// @dev The duress key holds no funds, so it is safe to surrender under coercion.
    function _freeze() internal {
        bytes32 digest = vault.freezeDigest(familyId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(duressKey, digest);
        vault.freeze(familyId, vault.freezeNonce(familyId), abi.encodePacked(r, s, v));
    }

    function test_DuressKeyFreezesOutflows() public {
        _freeze();
        assertTrue(vault.family(familyId).frozen);

        uint256 holdId = _withdraw(landlord, 900 * USD, "rent", landlordProof);
        assertEq(vault.hold(holdId).reason, 6, "FROZEN");
        assertEq(ausd.balanceOf(landlord), 0, "even rent stops");
    }

    function test_FrozenFamilyStopsAllowanceRuns() public {
        _freeze();
        vm.prank(ammaAcct);
        vault.fund(familyId, 600 * USD);

        vm.warp(block.timestamp + 7 days);
        vm.prank(agent);
        vm.expectRevert(ThunaiVault.FamilyFrozen.selector);
        vault.runAllowance(familyId);
    }

    function test_WrongKeyCannotFreeze() public {
        bytes32 digest = vault.freezeDigest(familyId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arjunAcctKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        uint256 nonce = vault.freezeNonce(familyId);

        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.freeze(familyId, nonce, sig);
    }

    function test_FreezeSignatureCannotBeReplayed() public {
        bytes32 digest = vault.freezeDigest(familyId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(duressKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        vault.freeze(familyId, 0, sig);

        vm.expectRevert(ThunaiVault.BadNonce.selector);
        vault.freeze(familyId, 0, sig);
    }

    /// @notice Only the guardian's Face ID can lift a freeze.
    function test_OnlyGuardianCanUnfreeze() public {
        _freeze();
        bytes32 challenge = vault.unfreezeChallenge(familyId);
        // Signing runs a cheatcode, so both assertions are built before any prank is armed.
        WebAuthn.WebAuthnAuth memory wrong = PasskeySigner.sign(ARJUN_PASSKEY, challenge);
        WebAuthn.WebAuthnAuth memory right = PasskeySigner.sign(AMMA_PASSKEY, challenge);

        vm.prank(relayer);
        vm.expectRevert(ThunaiVault.BadSignature.selector);
        vault.unfreeze(familyId, wrong);

        vm.prank(relayer);
        vault.unfreeze(familyId, right);
        assertFalse(vault.family(familyId).frozen);
    }

    function test_UnfreezeRestoresPayments() public {
        _freeze();
        bytes32 challenge = vault.unfreezeChallenge(familyId);
        WebAuthn.WebAuthnAuth memory auth = PasskeySigner.sign(AMMA_PASSKEY, challenge);
        vm.prank(relayer);
        vault.unfreeze(familyId, auth);

        uint256 holdId = _withdraw(landlord, 900 * USD, "rent", landlordProof);
        assertEq(holdId, 0);
        assertEq(ausd.balanceOf(landlord), 900 * USD);
    }
}
