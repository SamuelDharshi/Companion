// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal ERC20 surface used by the vault.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @notice Agora Instant Settlement pair: fixed-price swaps, gated by APPROVED_SWAPPER.
/// @dev Monad testnet CTK/AUSD pair: 0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae
interface IAgoraPair {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getPriceNormalized() external view returns (uint256);
}

/// @notice Network scam signals read by the vault when opening a hold.
interface IScamSignals {
    function flagged(bytes32 handleHash) external view returns (uint32 count, uint64 lastAt);
    function wasCancelledByGuardian(uint256 holdId) external view returns (bool, uint256 familyId);
}
