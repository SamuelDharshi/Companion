// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Chainlink CRE's receiver interface, as published in the CRE "Building Consumer Contracts" guide.
interface IERC165Like {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IReceiver is IERC165Like {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title CompanionAuditLog
/// @notice Append-only record of what the Companion CRE workflow did. It holds no money and has no authority over
///         ThunaiVault: a bad report can only add a wrong line to this log, never move funds.
/// @dev The forwarder can be changed by the owner because `cre workflow simulate --broadcast` delivers through a
///      MockForwarder while a deployed workflow delivers through the KeystoneForwarder. Entries can never be changed.
contract CompanionAuditLog is IReceiver {
    enum Action {
        ALLOWANCE_SENT,
        HOLD_REPAGED,
        HOLD_EXPIRED_REFUNDED,
        NO_OP
    }

    struct Entry {
        Action action;
        uint256 familyId;
        uint256 holdId;
        bytes32 agentResultHash;
        uint64 ts;
    }

    error InvalidForwarder();
    error InvalidSender(address sender, address expected);
    error NotOwner();
    error UnknownAction(uint8 action);

    event CreAction(uint8 indexed action, uint256 indexed familyId, uint256 indexed holdId, bytes32 agentResultHash, uint64 ts);
    event ForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);

    address public immutable owner;
    address public forwarder;
    Entry[] private entries;

    constructor(address forwarder_) {
        if (forwarder_ == address(0)) revert InvalidForwarder();
        owner = msg.sender;
        forwarder = forwarder_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    function setForwarder(address forwarder_) external {
        if (msg.sender != owner) revert NotOwner();
        if (forwarder_ == address(0)) revert InvalidForwarder();
        emit ForwarderUpdated(forwarder, forwarder_);
        forwarder = forwarder_;
    }

    /// @inheritdoc IReceiver
    function onReport(bytes calldata, bytes calldata report) external {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender, forwarder);
        (uint8 action, uint256 familyId, uint256 holdId, bytes32 agentResultHash, uint64 ts) =
            abi.decode(report, (uint8, uint256, uint256, bytes32, uint64));
        if (action > uint8(Action.NO_OP)) revert UnknownAction(action);
        entries.push(Entry(Action(action), familyId, holdId, agentResultHash, ts));
        emit CreAction(action, familyId, holdId, agentResultHash, ts);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165Like).interfaceId;
    }

    function entryCount() external view returns (uint256) {
        return entries.length;
    }

    function entry(uint256 index) external view returns (Entry memory) {
        return entries[index];
    }
}
