// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";
import {MerkleProofLib} from "solady/utils/MerkleProofLib.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {EIP712} from "solady/utils/EIP712.sol";
import {IERC20, IAgoraPair, IScamSignals} from "./interfaces/IThunai.sol";

/// @title ThunaiVault
/// @notice Family money agent for Indian parents with a child studying abroad.
///
///         The rules and the guardian decide; the agent only executes and explains.
///         No server key can move family money:
///           - outflows need the student's `thunai/acct` signature plus contract rules,
///           - anything held needs the guardian's passkey verified onchain at the
///             P256 precompile (0x0100, EIP-7951),
///           - an unanswered hold always returns funds to the student (fail-safe).
///
/// @dev Two balances per family, mirroring the cross-border flow:
///        `homeBalance` - CTK, "money from home" (testnet stand-in for dollars
///                        bought through a licensed LRS partner)
///        `balance`     - AUSD, the student's spendable allowance
///      The allowance run swaps CTK to AUSD through Agora Instant Settlement.
contract ThunaiVault is EIP712 {
    using SafeTransferLib for address;

    // ---------------------------------------------------------------- types

    /// @dev A P256 passkey public key, captured from the attestation at registration.
    struct Passkey {
        bytes32 x;
        bytes32 y;
    }

    /// @dev The weekly envelope the guardian signs once.
    struct Envelope {
        uint128 weeklyAmount; // allowance per run
        uint128 perWithdrawalCap; // anything above this is held
        bytes32 payeesRoot; // merkle root of scheduled payees (immune to network flags)
        uint64 cadence; // seconds between runs
        uint64 holdTimeout; // seconds before a hold may be expired by anyone
        uint64 expiry; // envelope stops running after this timestamp
        uint64 nextRunAt; // when the next allowance is due
    }

    struct Family {
        Passkey guardian;
        Passkey student;
        address studentAcct; // student's `thunai/acct` address, signs withdraw intents
        address guardianAcct; // guardian's `thunai/acct` address, funds the family
        address duressAddr; // `thunai/duress` capability key, holds no funds
        uint128 homeBalance; // CTK from home
        uint128 balance; // AUSD, spendable by the student
        bool frozen;
        uint64 checkNonce; // non-zero while a liveness check is unanswered
        uint64 checkRequestedAt;
        Envelope env;
    }

    struct Hold {
        uint256 familyId;
        address to;
        uint128 amount;
        uint8 reason;
        uint8 status;
        uint64 openedAt;
        uint64 releaseAt;
        bytes32 memoHash;
    }

    /// @dev What the student's `thunai/acct` signs (EIP-712) to spend the allowance.
    struct WithdrawIntent {
        uint256 familyId;
        address to;
        uint128 amount;
        bytes32 memoHash;
        uint256 nonce;
        uint256 deadline;
    }

    // Hold reason codes. Mirrored in the app and the indexer.
    uint8 internal constant REASON_NEW_PAYEE = 1;
    uint8 internal constant REASON_OVER_CAP = 2;
    uint8 internal constant REASON_UNSCHEDULED = 3;
    uint8 internal constant REASON_NETWORK_FLAG = 4;
    uint8 internal constant REASON_CHECK_PENDING = 5;
    uint8 internal constant REASON_FROZEN = 6;

    // Hold lifecycle.
    uint8 internal constant STATUS_NONE = 0;
    uint8 internal constant STATUS_OPEN = 1;
    uint8 internal constant STATUS_RELEASED = 2;
    uint8 internal constant STATUS_CANCELLED = 3;
    uint8 internal constant STATUS_EXPIRED = 4;

    // Action-hash domains, bound into every passkey challenge.
    bytes32 internal constant KIND_ENVELOPE = keccak256("thunai.envelope");
    bytes32 internal constant KIND_RESOLVE = keccak256("thunai.resolveHold");
    bytes32 internal constant KIND_LIVENESS = keccak256("thunai.proveLiveness");
    bytes32 internal constant KIND_UNFREEZE = keccak256("thunai.unfreeze");
    bytes32 internal constant KIND_FREEZE = keccak256("thunai.freeze");
    bytes32 internal constant KIND_NOTES = keccak256("thunai.notes");

    // Who a notes blob belongs to. Each person's notes are encrypted under their own passkey.
    uint8 internal constant ROLE_STUDENT = 0;
    uint8 internal constant ROLE_GUARDIAN = 1;

    // Silent SOS reason codes. 0 means the student has not said what the caller wants.
    uint8 internal constant SOS_MAX_REASON = 5; // 1 gift card, 2 Zelle, 3 wire, 4 crypto, 5 other
    uint256 internal constant MAX_NOTES_BYTES = 2048;

    bytes32 internal constant WITHDRAW_INTENT_TYPEHASH = keccak256(
        "WithdrawIntent(uint256 familyId,address to,uint256 amount,bytes32 memoHash,uint256 nonce,uint256 deadline)"
    );

    // -------------------------------------------------------------- storage

    address public owner;
    address public relayer; // pays gas, holds no spending power
    address public agent; // keyless keeper: runAllowance / expireHold only

    IERC20 public immutable ctk;
    /// @dev CTK base units per 1e6 "dollar units". The family's `homeBalance` is kept in the same 6-decimal
    ///      dollars as AUSD, whatever CTK's own decimals are. The real Agora CTK has 18 decimals and AUSD has
    ///      6, so without this a deposit and its swap would be off by a factor of a trillion. A stand-in CTK
    ///      with 6 decimals gives a scale of 1.
    uint256 public immutable ctkScale;
    IERC20 public immutable ausd;
    IAgoraPair public agoraPair;
    IScamSignals public scamSignals;
    bool public agoraEnabled;

    uint256 public familyCount;
    uint256 public holdCount;
    /// @dev Every AUSD the vault has credited and not yet paid out: the sum of all family
    ///      balances plus everything escrowed in open holds. Credits are refused unless the
    ///      vault actually holds the AUSD to back them, so the books can never claim money
    ///      the vault does not have. This matters most in the Agora fallback, where no swap
    ///      brings AUSD in and the float has to be seeded.
    uint256 public ausdLiabilities;

    mapping(uint256 => Family) internal _families;
    mapping(uint256 => Hold) internal _holds;
    /// @dev Replay guard for every passkey-authorised action.
    mapping(bytes32 => bool) public usedChallenge;
    /// @dev Withdraw-intent nonce per family.
    mapping(uint256 => uint256) public withdrawNonce;
    /// @dev Freeze-intent nonce per family.
    mapping(uint256 => uint256) public freezeNonce;
    /// @dev Encrypted notes per family and person. The contract only ever sees ciphertext:
    ///      the key is derived on the person's own devices from their passkey (PRF), so
    ///      any of their devices can read it back after one Face ID, and nobody else can.
    mapping(uint256 => mapping(uint8 => bytes)) internal _notes;
    mapping(uint256 => mapping(uint8 => uint64)) public notesVersion;
    /// @dev How many times a student has raised Silent SOS, for the public count.
    uint256 public sosCount;

    // --------------------------------------------------------------- events

    event FamilyRegistered(uint256 indexed familyId, address indexed studentAcct, address indexed guardianAcct);
    event EnvelopeSet(
        uint256 indexed familyId, uint128 weeklyAmount, uint128 perWithdrawalCap, uint64 cadence, uint64 nextRunAt
    );
    event Funded(uint256 indexed familyId, address indexed from, uint128 amount, uint128 homeBalance);
    event Payout(uint256 indexed familyId, uint128 amountIn, uint128 amountOut, bool viaAgora, uint64 timestamp);
    event HoldOpened(
        uint256 indexed holdId,
        uint256 indexed familyId,
        address to,
        uint128 amount,
        uint8 reason,
        uint64 releaseAt,
        bytes32 memoHash
    );
    event HoldResolved(uint256 indexed holdId, uint256 indexed familyId, bool released, uint64 secondsToResolve);
    event HoldExpired(uint256 indexed holdId, uint256 indexed familyId, uint128 amount);
    event Withdrawn(uint256 indexed familyId, address indexed to, uint128 amount, bytes32 memoHash);
    event CheckRequested(uint256 indexed familyId, uint64 nonce, uint64 requestedAt);
    event LivenessProved(uint256 indexed familyId, uint64 nonce, uint64 timestamp, uint64 latencySeconds);
    event Frozen(uint256 indexed familyId, address by);
    event Unfrozen(uint256 indexed familyId);
    /// @notice The student pressed Silent SOS: someone is demanding money from them.
    event SOSRaised(uint256 indexed familyId, uint8 reasonCode, uint64 timestamp);
    event NotesStored(uint256 indexed familyId, uint8 indexed role, uint64 version);
    event RolesChanged(address relayer, address agent);
    event AgoraConfigured(address pair, bool enabled);

    // --------------------------------------------------------------- errors

    error NotOwner();
    error NotRelayer();
    error NotAgent();
    error BadPasskey();
    error BadSignature();
    error ChallengeUsed();
    error NoSuchFamily();
    error NoSuchHold();
    error HoldNotOpen();
    error HoldNotExpired();
    error FamilyFrozen();
    error NotFrozen();
    error InsufficientBalance();
    error NotDue();
    error EnvelopeExpired();
    error IntentExpired();
    error BadNonce();
    error ZeroAmount();
    error NoCheckPending();
    error UnbackedCredit();
    error BadRole();
    error BadDecimals();
    error NotesTooLarge();
    error BadReason();

    // ---------------------------------------------------------- constructor

    constructor(address _ctk, address _ausd, address _relayer, address _agent) {
        owner = msg.sender;
        ctk = IERC20(_ctk);
        ausd = IERC20(_ausd);
        uint8 ctkDecimals = IERC20(_ctk).decimals();
        if (ctkDecimals < 6 || ctkDecimals > 30 || IERC20(_ausd).decimals() != 6) revert BadDecimals();
        ctkScale = 10 ** (ctkDecimals - 6);
        relayer = _relayer;
        agent = _agent;
        emit RolesChanged(_relayer, _agent);
    }

    function _domainNameAndVersion() internal pure override returns (string memory, string memory) {
        return ("Thunai", "1");
    }

    // ------------------------------------------------------------ modifiers

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent && msg.sender != relayer) revert NotAgent();
        _;
    }

    modifier familyExists(uint256 familyId) {
        if (familyId == 0 || familyId > familyCount) revert NoSuchFamily();
        _;
    }

    // ---------------------------------------------------------------- admin

    function setRoles(address _relayer, address _agent) external onlyOwner {
        relayer = _relayer;
        agent = _agent;
        emit RolesChanged(_relayer, _agent);
    }

    /// @notice Agora stays behind a flag: if the APPROVED_SWAPPER whitelist is not
    ///         granted in time, the vault credits AUSD directly and the write-up says so.
    function setAgora(address pair, bool enabled) external onlyOwner {
        agoraPair = IAgoraPair(pair);
        agoraEnabled = enabled;
        if (pair != address(0)) address(ctk).safeApprove(pair, type(uint256).max);
        emit AgoraConfigured(pair, enabled);
    }

    function setScamSignals(address signals) external onlyOwner {
        scamSignals = IScamSignals(signals);
    }

    // ----------------------------------------------------------- onboarding

    /// @notice Registers a family. Both passkey P256 public keys are captured from the
    ///         attestation on the device at creation; the vault never sees a private key.
    function registerFamily(
        bytes32 guardianX,
        bytes32 guardianY,
        bytes32 studentX,
        bytes32 studentY,
        address studentAcct,
        address guardianAcct,
        address duressAddr
    ) external onlyRelayer returns (uint256 familyId) {
        if (guardianX == 0 || studentX == 0) revert BadPasskey();
        familyId = ++familyCount;
        Family storage f = _families[familyId];
        f.guardian = Passkey(guardianX, guardianY);
        f.student = Passkey(studentX, studentY);
        f.studentAcct = studentAcct;
        f.guardianAcct = guardianAcct;
        f.duressAddr = duressAddr;
        emit FamilyRegistered(familyId, studentAcct, guardianAcct);
    }

    /// @notice The guardian signs the envelope once with Face ID. Verified at 0x0100.
    function setEnvelope(uint256 familyId, Envelope calldata e, WebAuthn.WebAuthnAuth calldata auth)
        external
        onlyRelayer
        familyExists(familyId)
    {
        Family storage f = _families[familyId];
        bytes32 h = _actionHash(familyId, KIND_ENVELOPE, keccak256(abi.encode(e)));
        _consumeGuardianAssertion(f, h, auth);
        f.env = e;
        emit EnvelopeSet(familyId, e.weeklyAmount, e.perWithdrawalCap, e.cadence, e.nextRunAt);
    }

    // -------------------------------------------------------------- funding

    /// @notice "Send money now". Pulls CTK from the caller into the family's home balance.
    function fund(uint256 familyId, uint128 amount) external familyExists(familyId) {
        if (amount == 0) revert ZeroAmount();
        Family storage f = _families[familyId];
        address(ctk).safeTransferFrom(msg.sender, address(this), uint256(amount) * ctkScale);
        f.homeBalance += amount;
        emit Funded(familyId, msg.sender, amount, f.homeBalance);
    }

    /// @notice Funds and settles in one transaction, so the student sees it arrive at once.
    function fundAndSettle(uint256 familyId, uint128 amount) external familyExists(familyId) {
        if (amount == 0) revert ZeroAmount();
        Family storage f = _families[familyId];
        if (f.frozen) revert FamilyFrozen();
        address(ctk).safeTransferFrom(msg.sender, address(this), uint256(amount) * ctkScale);
        f.homeBalance += amount;
        emit Funded(familyId, msg.sender, amount, f.homeBalance);
        _settle(familyId, f, amount);
    }

    /// @notice The agent's weekly run. It has no discretion: it executes the signed
    ///         envelope or reverts.
    function runAllowance(uint256 familyId) external onlyAgent familyExists(familyId) {
        Family storage f = _families[familyId];
        Envelope memory e = f.env;
        if (f.frozen) revert FamilyFrozen();
        if (e.weeklyAmount == 0 || e.nextRunAt == 0) revert NotDue();
        if (block.timestamp < e.nextRunAt) revert NotDue();
        if (e.expiry != 0 && block.timestamp > e.expiry) revert EnvelopeExpired();
        if (f.homeBalance < e.weeklyAmount) revert InsufficientBalance();

        // Advance the schedule before settling, so a retry cannot double-pay.
        uint64 next = e.nextRunAt + e.cadence;
        if (next <= block.timestamp) next = uint64(block.timestamp) + e.cadence;
        f.env.nextRunAt = next;

        _settle(familyId, f, e.weeklyAmount);
    }

    /// @dev Moves `amountIn` CTK out of the home balance, swaps it to AUSD through Agora
    ///      and credits the student. Falls back to a 1:1 credit when the swap is disabled.
    function _settle(uint256 familyId, Family storage f, uint128 amountIn) internal {
        if (f.homeBalance < amountIn) revert InsufficientBalance();
        f.homeBalance -= amountIn;

        uint128 amountOut;
        bool viaAgora;
        if (agoraEnabled && address(agoraPair) != address(0)) {
            address[] memory path = new address[](2);
            path[0] = address(ctk);
            path[1] = address(ausd);
            uint256 before = ausd.balanceOf(address(this));
            try agoraPair.swapExactTokensForTokens(uint256(amountIn) * ctkScale, 0, path, address(this), block.timestamp + 300) {
                amountOut = uint128(ausd.balanceOf(address(this)) - before);
                viaAgora = true;
            } catch {
                amountOut = amountIn; // disclosed fallback: fixed 1:1 stand-in
            }
        } else {
            amountOut = amountIn;
        }

        f.balance += amountOut;
        ausdLiabilities += amountOut;
        // A credit the vault cannot honour is worse than no credit at all.
        if (ausd.balanceOf(address(this)) < ausdLiabilities) revert UnbackedCredit();
        emit Payout(familyId, amountIn, amountOut, viaAgora, uint64(block.timestamp));
    }

    // ------------------------------------------------------------- withdraw

    /// @notice Spends the student's allowance. Pays at once only when the payee is on the
    ///         guardian-signed schedule, within cap, with no check pending and no network
    ///         flag. Everything else opens a cooling hold and pages the guardian.
    /// @param  merkleProof proof that `i.to` is on the envelope's scheduled-payees root.
    function withdraw(WithdrawIntent calldata i, bytes32[] calldata merkleProof, bytes calldata studentSig)
        external
        onlyRelayer
        familyExists(i.familyId)
        returns (uint256 holdId)
    {
        if (i.amount == 0) revert ZeroAmount();
        if (block.timestamp > i.deadline) revert IntentExpired();
        Family storage f = _families[i.familyId];
        if (i.nonce != withdrawNonce[i.familyId]) revert BadNonce();
        if (f.balance < i.amount) revert InsufficientBalance();

        // The student's `thunai/acct` signature authorises the spend. The relayer pays
        // gas and cannot move money without it.
        if (ECDSA.recoverCalldata(_intentDigest(i), studentSig) != f.studentAcct) revert BadSignature();
        withdrawNonce[i.familyId] = i.nonce + 1;

        uint8 reason = _holdReason(f, i.to, i.amount, merkleProof);
        f.balance -= i.amount;

        if (reason == 0) {
            ausdLiabilities -= i.amount;
            address(ausd).safeTransfer(i.to, i.amount);
            emit Withdrawn(i.familyId, i.to, i.amount, i.memoHash);
            return 0;
        }

        // Funds move to escrow inside the vault: out of spendable balance, never to the payee.
        uint64 timeout = f.env.holdTimeout == 0 ? 30 minutes : f.env.holdTimeout;
        uint64 releaseAt = uint64(block.timestamp) + timeout;
        holdId = ++holdCount;
        _holds[holdId] = Hold({
            familyId: i.familyId,
            to: i.to,
            amount: i.amount,
            reason: reason,
            status: STATUS_OPEN,
            openedAt: uint64(block.timestamp),
            releaseAt: releaseAt,
            memoHash: i.memoHash
        });
        emit HoldOpened(holdId, i.familyId, i.to, i.amount, reason, releaseAt, i.memoHash);
    }

    /// @dev EIP-712 digest for a withdraw intent.
    function _intentDigest(WithdrawIntent calldata i) internal view returns (bytes32) {
        return _hashTypedData(
            keccak256(
                abi.encode(
                    WITHDRAW_INTENT_TYPEHASH, i.familyId, i.to, i.amount, i.memoHash, i.nonce, i.deadline
                )
            )
        );
    }

    /// @dev Deterministic hold rules. The classifier never runs here; it only labels and
    ///      explains after the fact. 0 means pay straight through.
    function _holdReason(Family storage f, address to, uint128 amount, bytes32[] calldata proof)
        internal
        view
        returns (uint8)
    {
        if (f.frozen) return REASON_FROZEN;

        // Payees on the family's signed schedule are immune to network flags.
        bool scheduled = f.env.payeesRoot != bytes32(0)
            && MerkleProofLib.verifyCalldata(proof, f.env.payeesRoot, keccak256(abi.encodePacked(to)));

        // A payee the guardian already signed off on is only ever held for being over cap.
        if (scheduled) {
            if (f.env.perWithdrawalCap != 0 && amount > f.env.perWithdrawalCap) return REASON_OVER_CAP;
            return 0;
        }

        // For an unknown payee the reason is ordered by what the family most needs to be
        // told. The network's evidence comes first, then an unanswered check, and only then
        // the plain fact that nobody has approved this payee. Each one holds the money
        // either way; the order decides which sentence the app shows.
        if (address(scamSignals) != address(0)) {
            (uint32 count,) = scamSignals.flagged(keccak256(abi.encodePacked(to)));
            if (count > 0) return REASON_NETWORK_FLAG;
        }
        if (f.checkNonce != 0) return REASON_CHECK_PENDING;
        return REASON_NEW_PAYEE;
    }

    // -------------------------------------------------------- resolve holds

    /// @notice The guardian's Face ID decides. Release pays the payee; cancel returns the
    ///         money to the student. Verified onchain, so no server and no scammer can
    ///         override the guardian.
    function resolveHold(uint256 holdId, bool release, WebAuthn.WebAuthnAuth calldata auth) external onlyRelayer {
        Hold storage h = _holds[holdId];
        if (h.status == STATUS_NONE) revert NoSuchHold();
        if (h.status != STATUS_OPEN) revert HoldNotOpen();
        Family storage f = _families[h.familyId];

        bytes32 actionHash = _actionHash(h.familyId, KIND_RESOLVE, keccak256(abi.encode(holdId, release)));
        _consumeGuardianAssertion(f, actionHash, auth);

        h.status = release ? STATUS_RELEASED : STATUS_CANCELLED;
        uint64 took = uint64(block.timestamp) - h.openedAt;

        if (release) {
            ausdLiabilities -= h.amount;
            address(ausd).safeTransfer(h.to, h.amount);
            emit Withdrawn(h.familyId, h.to, h.amount, h.memoHash);
        } else {
            f.balance += h.amount;
        }
        emit HoldResolved(holdId, h.familyId, release, took);
    }

    /// @notice Fail-safe default: if nobody answers, the money goes back to the student,
    ///         never to the payee. Anyone may call it; the keeper does it automatically.
    function expireHold(uint256 holdId) external {
        Hold storage h = _holds[holdId];
        if (h.status == STATUS_NONE) revert NoSuchHold();
        if (h.status != STATUS_OPEN) revert HoldNotOpen();
        if (block.timestamp < h.releaseAt) revert HoldNotExpired();
        h.status = STATUS_EXPIRED;
        _families[h.familyId].balance += h.amount;
        emit HoldExpired(holdId, h.familyId, h.amount);
    }

    // --------------------------------------------------- check on the child

    /// @notice Answers a voice-clone call. While the check is unanswered, payments from the
    ///         guardian to a new payee are held.
    function requestCheck(uint256 familyId) external familyExists(familyId) returns (uint64 nonce) {
        Family storage f = _families[familyId];
        if (msg.sender != f.guardianAcct && msg.sender != relayer) revert NotRelayer();
        nonce = uint64(uint256(keccak256(abi.encode(familyId, block.timestamp, blockhash(block.number - 1)))));
        if (nonce == 0) nonce = 1;
        f.checkNonce = nonce;
        f.checkRequestedAt = uint64(block.timestamp);
        emit CheckRequested(familyId, nonce, uint64(block.timestamp));
    }

    /// @notice One passkey tap on the student's own phone, verified in the contract.
    ///         A voice can be cloned; a passkey cannot.
    function proveLiveness(uint256 familyId, uint64 nonce, WebAuthn.WebAuthnAuth calldata auth)
        external
        onlyRelayer
        familyExists(familyId)
    {
        Family storage f = _families[familyId];
        if (f.checkNonce == 0 || f.checkNonce != nonce) revert NoCheckPending();

        bytes32 actionHash = _actionHash(familyId, KIND_LIVENESS, keccak256(abi.encode(nonce)));
        if (usedChallenge[actionHash]) revert ChallengeUsed();
        if (!WebAuthn.verify(abi.encodePacked(actionHash), true, auth, f.student.x, f.student.y)) {
            revert BadSignature();
        }
        usedChallenge[actionHash] = true;

        uint64 latency = uint64(block.timestamp) - f.checkRequestedAt;
        f.checkNonce = 0;
        emit LivenessProved(familyId, nonce, uint64(block.timestamp), latency);
    }

    // -------------------------------------------------------- duress freeze

    /// @notice The `thunai/duress` capability key freezes all outflows. It holds no funds,
    ///         so it is safe to surrender under coercion. Only the guardian can unfreeze.
    function freeze(uint256 familyId, uint256 nonce, bytes calldata duressSig) external familyExists(familyId) {
        _freeze(familyId, nonce, duressSig);
    }

    /// @notice Silent SOS. The same duress signature as `freeze`, plus an event so every SOS
    ///         is counted onchain. It pauses every in-app outflow until the guardian's passkey
    ///         lifts it. `reasonCode` is what the caller is asking for, or 0 if not said.
    function sos(uint256 familyId, uint256 nonce, bytes calldata duressSig, uint8 reasonCode)
        external
        familyExists(familyId)
    {
        if (reasonCode > SOS_MAX_REASON) revert BadReason();
        _freeze(familyId, nonce, duressSig);
        sosCount += 1;
        emit SOSRaised(familyId, reasonCode, uint64(block.timestamp));
    }

    function _freeze(uint256 familyId, uint256 nonce, bytes calldata duressSig) internal {
        Family storage f = _families[familyId];
        if (nonce != freezeNonce[familyId]) revert BadNonce();
        bytes32 digest = _hashTypedData(keccak256(abi.encode(KIND_FREEZE, familyId, nonce)));
        if (ECDSA.recoverCalldata(digest, duressSig) != f.duressAddr) revert BadSignature();
        freezeNonce[familyId] = nonce + 1;
        f.frozen = true;
        emit Frozen(familyId, f.duressAddr);
    }

    // ----------------------------------------------------- encrypted notes

    /// @notice Stores a person's encrypted notes, authorised by that person's own passkey.
    ///         Ciphertext only. The version counter makes every write need a fresh assertion,
    ///         so an old one can never be replayed to roll the notes back.
    function setNotes(uint256 familyId, uint8 role, bytes calldata ciphertext, WebAuthn.WebAuthnAuth calldata auth)
        external
        onlyRelayer
        familyExists(familyId)
    {
        if (role > ROLE_GUARDIAN) revert BadRole();
        if (ciphertext.length == 0 || ciphertext.length > MAX_NOTES_BYTES) revert NotesTooLarge();
        Family storage f = _families[familyId];
        Passkey storage key = role == ROLE_STUDENT ? f.student : f.guardian;

        uint64 next = notesVersion[familyId][role] + 1;
        bytes32 h = _actionHash(familyId, KIND_NOTES, keccak256(abi.encode(role, next, keccak256(ciphertext))));
        if (usedChallenge[h]) revert ChallengeUsed();
        if (!WebAuthn.verify(abi.encodePacked(h), true, auth, key.x, key.y)) revert BadSignature();
        usedChallenge[h] = true;

        _notes[familyId][role] = ciphertext;
        notesVersion[familyId][role] = next;
        emit NotesStored(familyId, role, next);
    }

    function notes(uint256 familyId, uint8 role) external view returns (bytes memory ciphertext, uint64 version) {
        return (_notes[familyId][role], notesVersion[familyId][role]);
    }

    function notesChallenge(uint256 familyId, uint8 role, bytes calldata ciphertext) external view returns (bytes32) {
        uint64 next = notesVersion[familyId][role] + 1;
        return _actionHash(familyId, KIND_NOTES, keccak256(abi.encode(role, next, keccak256(ciphertext))));
    }

    function unfreeze(uint256 familyId, WebAuthn.WebAuthnAuth calldata auth)
        external
        onlyRelayer
        familyExists(familyId)
    {
        Family storage f = _families[familyId];
        if (!f.frozen) revert NotFrozen();
        bytes32 h = _actionHash(familyId, KIND_UNFREEZE, keccak256(abi.encode(freezeNonce[familyId])));
        _consumeGuardianAssertion(f, h, auth);
        f.frozen = false;
        emit Unfrozen(familyId);
    }

    // -------------------------------------------------- passkey verification

    /// @dev Verifies the guardian's WebAuthn assertion at the P256 precompile and burns the
    ///      challenge. `requireUserVerification` is always true: Face ID, never presence alone.
    function _consumeGuardianAssertion(Family storage f, bytes32 actionHash, WebAuthn.WebAuthnAuth calldata auth)
        internal
    {
        if (usedChallenge[actionHash]) revert ChallengeUsed();
        if (!WebAuthn.verify(abi.encodePacked(actionHash), true, auth, f.guardian.x, f.guardian.y)) {
            revert BadSignature();
        }
        usedChallenge[actionHash] = true;
    }

    /// @dev Every challenge is bound to this chain, this vault, this family and this action,
    ///      so an assertion cannot be replayed anywhere else.
    function _actionHash(uint256 familyId, bytes32 kind, bytes32 payload) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), familyId, kind, payload));
    }

    // ------------------------------------------------------ views (the app)

    function family(uint256 familyId) external view returns (Family memory) {
        return _families[familyId];
    }

    function hold(uint256 holdId) external view returns (Hold memory) {
        return _holds[holdId];
    }

    /// @notice The exact bytes the app must use as the WebAuthn challenge.
    function envelopeChallenge(uint256 familyId, Envelope calldata e) external view returns (bytes32) {
        return _actionHash(familyId, KIND_ENVELOPE, keccak256(abi.encode(e)));
    }

    function resolveChallenge(uint256 familyId, uint256 holdId, bool release) external view returns (bytes32) {
        return _actionHash(familyId, KIND_RESOLVE, keccak256(abi.encode(holdId, release)));
    }

    function livenessChallenge(uint256 familyId, uint64 nonce) external view returns (bytes32) {
        return _actionHash(familyId, KIND_LIVENESS, keccak256(abi.encode(nonce)));
    }

    function unfreezeChallenge(uint256 familyId) external view returns (bytes32) {
        return _actionHash(familyId, KIND_UNFREEZE, keccak256(abi.encode(freezeNonce[familyId])));
    }

    /// @notice EIP-712 digest the student's `thunai/acct` signs for a withdrawal.
    function withdrawDigest(uint256 familyId, address to, uint128 amount, bytes32 memoHash, uint256 deadline)
        external
        view
        returns (bytes32)
    {
        return _hashTypedData(
            keccak256(
                abi.encode(
                    WITHDRAW_INTENT_TYPEHASH, familyId, to, amount, memoHash, withdrawNonce[familyId], deadline
                )
            )
        );
    }

    function freezeDigest(uint256 familyId) external view returns (bytes32) {
        return _hashTypedData(keccak256(abi.encode(KIND_FREEZE, familyId, freezeNonce[familyId])));
    }

    /// @notice AUSD the vault holds beyond what it owes. In Agora fallback mode this is the
    ///         seeded float, and an allowance run reverts once it is exhausted.
    function freeFloat() external view returns (uint256) {
        uint256 held = ausd.balanceOf(address(this));
        return held > ausdLiabilities ? held - ausdLiabilities : 0;
    }

    /// @notice Open holds for a family, newest first.
    ///
    /// A view, so the loop costs the caller nothing and the app gets every pending
    /// decision in one round trip instead of polling hold ids one at a time. `limit`
    /// bounds the walk for the (never expected) case of a family with a long history.
    function openHolds(uint256 familyId, uint256 limit) external view returns (uint256[] memory ids) {
        uint256[] memory found = new uint256[](limit);
        uint256 n;
        for (uint256 holdId = holdCount; holdId >= 1 && n < limit; --holdId) {
            Hold storage h = _holds[holdId];
            if (h.familyId == familyId && h.status == STATUS_OPEN) {
                found[n++] = holdId;
            }
        }
        ids = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = found[i];
        }
    }

    /// @notice Whether an allowance run is due, for the keeper.
    function allowanceDue(uint256 familyId) external view returns (bool) {
        Family storage f = _families[familyId];
        Envelope memory e = f.env;
        if (f.frozen || e.weeklyAmount == 0 || e.nextRunAt == 0) return false;
        if (block.timestamp < e.nextRunAt) return false;
        if (e.expiry != 0 && block.timestamp > e.expiry) return false;
        return f.homeBalance >= e.weeklyAmount;
    }
}
