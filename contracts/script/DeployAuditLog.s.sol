// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CompanionAuditLog} from "../src/CompanionAuditLog.sol";

/// @dev CRE_FORWARDER on Monad testnet (from `cre workflow supported-chains`):
///      simulation 0xB9F79d863261869B234c481D1f9A7af84AeAd192, deployed workflow 0xF8344CFd5c43616a4366C34E3EEE75af79a74482.
contract DeployAuditLog is Script {
    function run() external {
        vm.startBroadcast();
        CompanionAuditLog log = new CompanionAuditLog(vm.envAddress("CRE_FORWARDER"));
        vm.stopBroadcast();
        console2.log("CompanionAuditLog", address(log));
    }
}
