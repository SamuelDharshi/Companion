// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WebAuthn} from "solady/utils/WebAuthn.sol";

interface IThunaiVaultView {
    struct Passkey {
        bytes32 x;
        bytes32 y;
    }

    struct Envelope {
        uint128 weeklyAmount;
        uint128 perWithdrawalCap;
        bytes32 payeesRoot;
        uint64 cadence;
        uint64 holdTimeout;
        uint64 expiry;
        uint64 nextRunAt;
    }

    struct Family {
        Passkey guardian;
        Passkey student;
        address studentAcct;
        address guardianAcct;
        address duressAddr;
        uint128 homeBalance;
        uint128 balance;
        bool frozen;
        uint64 checkNonce;
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

    function family(uint256 familyId) external view returns (Family memory);
    function hold(uint256 holdId) external view returns (Hold memory);
}

/// @title ScamSignals
/// @notice The network memory: when one family confirms a scam, every other family's agent
///         raises the hold level on matching payments.
///
///         Honest scope, stated on stage and in the README:
///           - a flag only RAISES THE HOLD LEVEL; it never refuses a payment on its own,
///           - payees on a family's signed schedule are immune,
///           - a report requires a hold that THAT family's guardian actually cancelled,
///           - handles are salted hashes, so they are pseudonymous, not private,
///           - the flagged party can append a rebuttal.
contract ScamSignals {
    /// @dev Scam script IDs, shared with the classifier.
    ///      1 FAKE_IMMIGRATION_OFFICER, 2 DIGITAL_ARREST, 3 VOICE_CLONE_ARREST,
    ///      4 JOB_TASK, 5 INVESTMENT, 0 UNKNOWN
    struct Signal {
        uint32 reports;
        uint64 lastAt;
        uint8 lastScriptId;
    }

    bytes32 internal constant KIND_REPORT = keccak256("thunai.report");

    address public owner;
    IThunaiVaultView public vault;

    mapping(bytes32 => Signal) internal _signals;
    /// @dev One report per cancelled hold, so a family cannot inflate a handle.
    mapping(uint256 => bool) public holdReported;
    mapping(bytes32 => bool) public usedChallenge;
    mapping(bytes32 => string[]) internal _rebuttals;

    uint256 public totalReports;

    event Reported(
        bytes32 indexed handleHash, uint8 scriptId, uint256 indexed holdId, uint256 indexed familyId, uint32 reports
    );
    event Rebutted(bytes32 indexed handleHash, string uri);
    event VaultSet(address vault);

    error NotOwner();
    error BadSignature();
    error ChallengeUsed();
    error AlreadyReported();
    error HoldNotCancelled();
    error NoVault();

    constructor(address _vault) {
        owner = msg.sender;
        vault = IThunaiVaultView(_vault);
    }

    function setVault(address _vault) external {
        if (msg.sender != owner) revert NotOwner();
        vault = IThunaiVaultView(_vault);
        emit VaultSet(_vault);
    }

    /// @notice Files a network report. Accepted only when `holdId` was cancelled by that
    ///         family's guardian, and the same guardian's passkey signs the report. One
    ///         report therefore costs one real family's Face ID.
    function report(bytes32 handleHash, uint8 scriptId, uint256 holdId, WebAuthn.WebAuthnAuth calldata auth)
        external
    {
        if (address(vault) == address(0)) revert NoVault();
        if (holdReported[holdId]) revert AlreadyReported();

        IThunaiVaultView.Hold memory h = vault.hold(holdId);
        // status 3 == STATUS_CANCELLED: the guardian actively stopped it.
        if (h.status != 3) revert HoldNotCancelled();

        IThunaiVaultView.Family memory f = vault.family(h.familyId);

        bytes32 actionHash = keccak256(
            abi.encode(block.chainid, address(this), h.familyId, KIND_REPORT, keccak256(abi.encode(handleHash, scriptId, holdId)))
        );
        if (usedChallenge[actionHash]) revert ChallengeUsed();
        if (!WebAuthn.verify(abi.encodePacked(actionHash), true, auth, f.guardian.x, f.guardian.y)) {
            revert BadSignature();
        }
        usedChallenge[actionHash] = true;
        holdReported[holdId] = true;

        Signal storage s = _signals[handleHash];
        s.reports += 1;
        s.lastAt = uint64(block.timestamp);
        s.lastScriptId = scriptId;
        totalReports += 1;

        emit Reported(handleHash, scriptId, holdId, h.familyId, s.reports);
    }

    /// @notice Read by `ThunaiVault.withdraw` when deciding the hold level.
    function flagged(bytes32 handleHash) external view returns (uint32 count, uint64 lastAt) {
        Signal memory s = _signals[handleHash];
        return (s.reports, s.lastAt);
    }

    function signal(bytes32 handleHash) external view returns (Signal memory) {
        return _signals[handleHash];
    }

    /// @notice Due process: the flagged party can append a response. Deliberately open.
    function rebut(bytes32 handleHash, string calldata uri) external {
        _rebuttals[handleHash].push(uri);
        emit Rebutted(handleHash, uri);
    }

    function rebuttals(bytes32 handleHash) external view returns (string[] memory) {
        return _rebuttals[handleHash];
    }

    function reportChallenge(uint256 familyId, bytes32 handleHash, uint8 scriptId, uint256 holdId)
        external
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(block.chainid, address(this), familyId, KIND_REPORT, keccak256(abi.encode(handleHash, scriptId, holdId)))
        );
    }

    function wasCancelledByGuardian(uint256 holdId) external view returns (bool, uint256) {
        IThunaiVaultView.Hold memory h = vault.hold(holdId);
        return (h.status == 3, h.familyId);
    }
}
