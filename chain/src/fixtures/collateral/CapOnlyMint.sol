// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Supply is capped, but collateral is never checked.
contract CapOnlyMint {
    error Unauthorized();
    error MaxSupplyExceeded();

    address public immutable issuer;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        if (msg.sender != issuer) revert Unauthorized();
        if (totalSupply + amount > maxSupply) revert MaxSupplyExceeded();
        totalSupply += amount;
    }
}
