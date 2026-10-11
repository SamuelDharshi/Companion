// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ThunaiVault} from "../src/ThunaiVault.sol";
import {ScamSignals} from "../src/ScamSignals.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys Thunai to Monad testnet (chain 10143).
///
/// Honest labelling, enforced here rather than left to the write-up: when no real Agora
/// testnet token addresses are supplied, this script deploys clearly-named STAND-IN tokens
/// and leaves the Agora swap switched off. Nothing pretends to be a licensed rail.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --rpc-url $MONAD_RPC_URL --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address relayer = vm.envOr("RELAYER_ADDRESS", deployer);
        address agent = vm.envOr("AGENT_ADDRESS", deployer);
        address ctk = vm.envOr("CTK_ADDRESS", address(0));
        address ausd = vm.envOr("AUSD_ADDRESS", address(0));
        address agoraPair = vm.envOr("AGORA_PAIR_ADDRESS", address(0));
        bool agoraEnabled = vm.envOr("AGORA_ENABLED", false);
        // Float that backs credited allowances while the Agora swap is off.
        uint256 seedFloat = vm.envOr("SEED_AUSD_FLOAT", uint256(0));

        vm.startBroadcast(pk);

        bool standIn = ctk == address(0) || ausd == address(0);
        if (standIn) {
            // Named so no screenshot can imply these are real dollars.
            ctk = address(new MockERC20("Thunai Stand-In CTK (testnet)", "tCTK", 6));
            ausd = address(new MockERC20("Thunai Stand-In AUSD (testnet)", "tAUSD", 6));
            console.log("Deployed STAND-IN tokens (no Agora tokens supplied)");
        }

        ThunaiVault vault = new ThunaiVault(ctk, ausd, relayer, agent);
        ScamSignals signals = new ScamSignals(address(vault));
        vault.setScamSignals(address(signals));

        if (agoraPair != address(0)) {
            vault.setAgora(agoraPair, agoraEnabled);
        }

        // Seed the AUSD float so allowance runs are backed while the swap is off.
        if (standIn && seedFloat > 0) {
            MockERC20(ausd).mint(address(vault), seedFloat);
            MockERC20(ctk).mint(deployer, seedFloat);
        }

        vm.stopBroadcast();

        console.log("chainId          ", block.chainid);
        console.log("ThunaiVault      ", address(vault));
        console.log("ScamSignals      ", address(signals));
        console.log("CTK              ", ctk);
        console.log("AUSD             ", ausd);
        console.log("relayer          ", relayer);
        console.log("agent            ", agent);
        console.log("agoraEnabled     ", agoraEnabled);
        console.log("stand-in tokens  ", standIn);

        _write(vault, signals, ctk, ausd, relayer, agent, agoraPair, agoraEnabled, standIn);
    }

    /// @dev Writes the addresses every other package reads, so nothing is copied by hand.
    function _write(
        ThunaiVault vault,
        ScamSignals signals,
        address ctk,
        address ausd,
        address relayer,
        address agent,
        address agoraPair,
        bool agoraEnabled,
        bool standIn
    ) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ', vm.toString(block.chainid), ",\n",
            '  "thunaiVault": "', vm.toString(address(vault)), '",\n',
            '  "scamSignals": "', vm.toString(address(signals)), '",\n',
            '  "ctk": "', vm.toString(ctk), '",\n',
            '  "ausd": "', vm.toString(ausd), '",\n',
            '  "relayer": "', vm.toString(relayer), '",\n',
            '  "agent": "', vm.toString(agent), '",\n',
            '  "agoraPair": "', vm.toString(agoraPair), '",\n',
            '  "agoraEnabled": ', agoraEnabled ? "true" : "false", ",\n",
            '  "standInTokens": ', standIn ? "true" : "false", "\n",
            "}\n"
        );
        // A second, Agora-ready deployment (built on the real CTK and AUSD) is written beside the main
        // one, so asking Agora to whitelist it never disturbs the vault the app is using.
        string memory suffix = vm.envOr("DEPLOYMENT_SUFFIX", string(""));
        string memory path = string.concat("deployments/", vm.toString(block.chainid), suffix, ".json");
        vm.writeFile(path, json);
        console.log("wrote", path);
    }
}
