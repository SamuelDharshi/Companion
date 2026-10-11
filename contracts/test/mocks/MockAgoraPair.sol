// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MockERC20} from "./MockERC20.sol";

/// @notice Stand-in for the Agora Instant Settlement CTK/AUSD pair
///         (0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae on Monad testnet).
///         Fixed-price swap, gated by an APPROVED_SWAPPER role, exactly like the real one.
contract MockAgoraPair {
    MockERC20 public immutable ctk;
    MockERC20 public immutable ausd;

    /// @dev 1e18-scaled price of CTK in AUSD.
    uint256 public price = 1e18;
    mapping(address => bool) public approvedSwapper;

    error NotApprovedSwapper();

    constructor(address _ctk, address _ausd) {
        ctk = MockERC20(_ctk);
        ausd = MockERC20(_ausd);
    }

    function setApprovedSwapper(address who, bool ok) external {
        approvedSwapper[who] = ok;
    }

    function setPrice(uint256 p) external {
        price = p;
    }

    function getPriceNormalized() external view returns (uint256) {
        return price;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        if (!approvedSwapper[msg.sender]) revert NotApprovedSwapper();
        ctk.transferFrom(msg.sender, address(this), amountIn);
        // CTK may have 18 decimals while AUSD has 6, as on the real pair.
        uint256 out = (amountIn * price) / 1e18;
        out = (out * (10 ** ausd.decimals())) / (10 ** ctk.decimals());
        require(out >= amountOutMin, "slippage");
        ausd.mint(to, out);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = out;
        path;
    }
}
