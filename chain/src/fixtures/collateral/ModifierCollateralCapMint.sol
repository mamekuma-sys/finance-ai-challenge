// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic safe fixture with collateral and cap guards in a modifier.
contract ModifierCollateralCapMint {
    error Unauthorized();
    error CollateralNotVerified();
    error MaxSupplyExceeded();

    address public immutable issuer;
    uint256 public immutable maxSupply;
    bool public collateralVerified;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    modifier validMint(uint256 amount) {
        if (msg.sender != issuer) revert Unauthorized();
        if (!collateralVerified) revert CollateralNotVerified();
        if (totalSupply + amount > maxSupply) revert MaxSupplyExceeded();
        _;
    }

    function setCollateralVerified(bool verified) external {
        if (msg.sender != issuer) revert Unauthorized();
        collateralVerified = verified;
    }

    function mint(address, uint256 amount) external validMint(amount) {
        totalSupply += amount;
    }
}
