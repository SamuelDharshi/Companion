// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ThunaiVault} from "../src/ThunaiVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAgoraPair} from "./mocks/MockAgoraPair.sol";

/// @notice The real Agora CTK has 18 decimals and AUSD has 6. The vault keeps a family's money in
///         6-decimal dollars and converts at the edge, so flipping AGORA_ENABLED on the real tokens
///         has to just work rather than being off by a factor of a trillion.
contract ThunaiVaultDecimalsTest is Test {
    uint128 internal constant USD = 1e6;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal agent = makeAddr("agent");
    address internal partner = makeAddr("licensedPartner");
    address internal arjunAcct = makeAddr("arjunAcct");
    address internal ammaAcct = makeAddr("ammaAcct");
    address internal duress = makeAddr("duress");

    MockERC20 internal ctk; // 18 decimals, like the real CTK
    MockERC20 internal ausd; // 6 decimals
    MockAgoraPair internal pair;
    ThunaiVault internal vault;
    uint256 internal familyId;

    event Payout(uint256 indexed familyId, uint128 amountIn, uint128 amountOut, bool viaAgora, uint64 timestamp);

    function setUp() public {
        ctk = new MockERC20("ConstantToken", "CTK", 18);
        ausd = new MockERC20("AUSD", "AUSD", 6);
        vm.prank(owner);
        vault = new ThunaiVault(address(ctk), address(ausd), relayer, agent);
        pair = new MockAgoraPair(address(ctk), address(ausd));

        vm.prank(relayer);
        familyId = vault.registerFamily(bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), arjunAcct, ammaAcct, duress);

        // The partner delivers CTK in 18-decimal units, as the real token does.
        ctk.mint(partner, 1_000_000 ether);
        vm.prank(partner);
        ctk.approve(address(vault), type(uint256).max);
    }

    function test_ScaleIsOneTrillionForAnEighteenDecimalCtk() public view {
        assertEq(vault.ctkScale(), 1e12);
    }

    function test_AStandInSixDecimalCtkHasScaleOne() public {
        MockERC20 standIn = new MockERC20("Stand-In", "tCTK", 6);
        ThunaiVault v = new ThunaiVault(address(standIn), address(ausd), relayer, agent);
        assertEq(v.ctkScale(), 1);
    }

    function test_ConstructorRejectsTokensItCannotAccount() public {
        MockERC20 tooFew = new MockERC20("Five", "F", 5);
        vm.expectRevert(ThunaiVault.BadDecimals.selector);
        new ThunaiVault(address(tooFew), address(ausd), relayer, agent);

        MockERC20 wrongDollar = new MockERC20("Eight", "E", 8);
        vm.expectRevert(ThunaiVault.BadDecimals.selector);
        new ThunaiVault(address(ctk), address(wrongDollar), relayer, agent);
    }

    function test_DepositOfOneHundredDollarsPullsOneHundredEighteenDecimalCtk() public {
        vm.prank(owner);
        vault.setAgora(address(pair), false);
        ausd.mint(address(vault), 1_000 * USD); // the disclosed fallback float

        vm.prank(partner);
        vault.fund(familyId, 100 * USD);

        assertEq(ctk.balanceOf(address(vault)), 100 ether, "100 CTK of 18 decimals, not 100e6 base units");
        assertEq(vault.family(familyId).homeBalance, 100 * USD, "kept in 6-decimal dollars");
    }

    function test_SettlingThroughAgoraGivesTheStudentSixDecimalDollars() public {
        pair.setApprovedSwapper(address(vault), true);
        ausd.mint(address(pair), 1_000_000 * USD); // the pair's own AUSD liquidity
        vm.prank(owner);
        vault.setAgora(address(pair), true);

        vm.expectEmit(true, false, false, true);
        emit Payout(familyId, 100 * USD, 100 * USD, true, uint64(block.timestamp));
        vm.prank(partner);
        vault.fundAndSettle(familyId, 100 * USD);

        assertEq(vault.family(familyId).balance, 100 * USD, "$100 in 6-decimal AUSD");
        assertEq(ausd.balanceOf(address(vault)), 100 * USD, "the swap brought real AUSD in");
        assertEq(ctk.balanceOf(address(vault)), 0, "all CTK went into the swap");
        assertEq(ctk.balanceOf(address(pair)), 100 ether, "the pair received the 18-decimal CTK");
    }

    function test_AnUnwhitelistedVaultFallsBackInsteadOfRevertingTheDeposit() public {
        // The pair exists and is switched on, but has not approved this vault yet.
        ausd.mint(address(vault), 1_000 * USD);
        vm.prank(owner);
        vault.setAgora(address(pair), true);

        vm.expectEmit(true, false, false, true);
        emit Payout(familyId, 100 * USD, 100 * USD, false, uint64(block.timestamp));
        vm.prank(partner);
        vault.fundAndSettle(familyId, 100 * USD);

        assertEq(vault.family(familyId).balance, 100 * USD, "the family is still credited");
        assertEq(ctk.balanceOf(address(vault)), 100 ether, "the CTK stays in the vault, nothing is lost");
    }

    function test_FallbackStillRefusesToCreditAUsdTheVaultDoesNotHold() public {
        // Pair on but unapproved, and no AUSD float seeded: the books must not claim money.
        vm.prank(owner);
        vault.setAgora(address(pair), true);
        vm.prank(partner);
        vm.expectRevert(ThunaiVault.UnbackedCredit.selector);
        vault.fundAndSettle(familyId, 100 * USD);
    }
}

/// @notice A test against the REAL Agora pair on Monad testnet. It runs only when MONAD_FORK_URL is
///         set (it needs the network), and proves what the vault does today: the real pair refuses a
///         vault it has not whitelisted, and the vault falls back instead of failing the family.
contract ThunaiVaultRealAgoraForkTest is Test {
    address internal constant REAL_PAIR = 0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae;
    address internal constant REAL_CTK = 0x7BEb5D9DB0d85cBEa543C04f0dE8c23c2176cd9D;
    address internal constant REAL_AUSD = 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC;
    uint128 internal constant USD = 1e6;

    function test_RealPairRejectsAnUnwhitelistedVaultAndTheVaultFallsBack() public {
        string memory url = vm.envOr("MONAD_FORK_URL", string(""));
        if (bytes(url).length == 0) return; // needs the network, so it is opt-in
        vm.createSelectFork(url);

        address relayer = makeAddr("relayer");
        vm.prank(makeAddr("owner"));
        ThunaiVault vault = new ThunaiVault(REAL_CTK, REAL_AUSD, relayer, makeAddr("agent"));
        assertEq(vault.ctkScale(), 1e12, "the real CTK has 18 decimals");

        vm.prank(relayer);
        uint256 familyId = vault.registerFamily(
            bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), makeAddr("a"), makeAddr("b"), makeAddr("d")
        );

        vm.prank(makeAddr("owner"));
        vault.setAgora(REAL_PAIR, true);

        // Give the partner real CTK and the vault a real AUSD float, which the fork lets us do.
        address partner = makeAddr("partner");
        // The CTK's owner can mint on a fork, and the pair holds plenty of AUSD to lend the vault a float.
        vm.prank(0x99B0E95Fa8F5C3b86e4d78ED715B475cFCcf6E97);
        (bool minted,) = REAL_CTK.call(abi.encodeWithSignature("mint(address,uint256)", partner, 1_000 ether));
        assertTrue(minted, "mint CTK as its owner");
        vm.prank(REAL_PAIR);
        (bool lent,) = REAL_AUSD.call(abi.encodeWithSignature("transfer(address,uint256)", address(vault), 1_000 * USD));
        assertTrue(lent, "float from the pair");
        vm.startPrank(partner);
        (bool approved,) = REAL_CTK.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
        assertTrue(approved);
        vault.fundAndSettle(familyId, 100 * USD);
        vm.stopPrank();

        assertEq(vault.family(familyId).balance, 100 * USD, "credited through the fallback");
        // The real pair's role gate refused us, so no CTK moved into it.
        (bool ok, bytes memory out) = REAL_CTK.staticcall(abi.encodeWithSignature("balanceOf(address)", address(vault)));
        assertTrue(ok);
        assertEq(abi.decode(out, (uint256)), 100 ether, "CTK is still in the vault: the swap did not happen");
    }
}
