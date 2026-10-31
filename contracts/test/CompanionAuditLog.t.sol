// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompanionAuditLog, IReceiver, IERC165Like} from "../src/CompanionAuditLog.sol";

contract CompanionAuditLogTest is Test {
    event CreAction(uint8 indexed action, uint256 indexed familyId, uint256 indexed holdId, bytes32 agentResultHash, uint64 ts);

    address forwarder = address(0xF0);
    CompanionAuditLog auditLog;

    function setUp() public {
        auditLog = new CompanionAuditLog(forwarder);
    }

    function _report(uint8 action, uint256 familyId, uint256 holdId) internal pure returns (bytes memory) {
        return abi.encode(action, familyId, holdId, keccak256("agent result"), uint64(1_800_000_000));
    }

    function test_DecodesAndAppends() public {
        vm.prank(forwarder);
        auditLog.onReport("", _report(2, 0, 57));
        assertEq(auditLog.entryCount(), 1);
        CompanionAuditLog.Entry memory e = auditLog.entry(0);
        assertEq(uint8(e.action), 2);
        assertEq(e.familyId, 0);
        assertEq(e.holdId, 57);
        assertEq(e.agentResultHash, keccak256("agent result"));
        assertEq(e.ts, 1_800_000_000);
    }

    function test_EmitsCreAction() public {
        vm.expectEmit(true, true, true, true);
        emit CreAction(0, 15, 0, keccak256("agent result"), 1_800_000_000);
        vm.prank(forwarder);
        auditLog.onReport("", _report(0, 15, 0));
    }

    function test_OnlyForwarderCanReport() public {
        vm.expectRevert(abi.encodeWithSelector(CompanionAuditLog.InvalidSender.selector, address(this), forwarder));
        auditLog.onReport("", _report(0, 1, 0));
        assertEq(auditLog.entryCount(), 0);
    }

    function test_RejectsUnknownAction() public {
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(CompanionAuditLog.UnknownAction.selector, uint8(4)));
        auditLog.onReport("", _report(4, 1, 0));
    }

    function test_EntriesAppendInOrderAndKeepEarlierOnes() public {
        vm.startPrank(forwarder);
        auditLog.onReport("", _report(1, 0, 7));
        auditLog.onReport("", _report(2, 0, 8));
        vm.stopPrank();
        assertEq(auditLog.entryCount(), 2);
        assertEq(auditLog.entry(0).holdId, 7);
        assertEq(auditLog.entry(1).holdId, 8);
    }

    function test_OnlyOwnerMovesForwarder() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(CompanionAuditLog.NotOwner.selector);
        auditLog.setForwarder(address(0xBAD));

        auditLog.setForwarder(address(0xF1));
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(CompanionAuditLog.InvalidSender.selector, forwarder, address(0xF1)));
        auditLog.onReport("", _report(0, 1, 0));
    }

    function test_RejectsZeroForwarder() public {
        vm.expectRevert(CompanionAuditLog.InvalidForwarder.selector);
        new CompanionAuditLog(address(0));
    }

    function test_SupportsReceiverInterfaces() public view {
        assertTrue(auditLog.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(auditLog.supportsInterface(type(IERC165Like).interfaceId));
        assertFalse(auditLog.supportsInterface(0xffffffff));
    }
}
