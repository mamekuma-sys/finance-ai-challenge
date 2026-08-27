// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Collateral is checked, but supply is uncapped.
contract CollateralOnlyMint {
    error Unauthorized();
    error CollateralNotVerified();

    address public immutable issuer;
    bool public collateralVerified;
    uint256 public totalSupply;

    constructor(address issuer_) {
        issuer = issuer_;
    }

    function setCollateralVerified(bool verified) external {
        if (msg.sender != issuer) revert Unauthorized();
        collateralVerified = verified;
    }

    function mint(address, uint256 amount) external {
        if (msg.sender != issuer) revert Unauthorized();
        if (!collateralVerified) revert CollateralNotVerified();
        totalSupply += amount;
    }
}
