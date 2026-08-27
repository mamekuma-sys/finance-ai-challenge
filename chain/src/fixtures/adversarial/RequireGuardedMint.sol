// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic safe fixture using require-style role, collateral, and cap guards.
contract RequireGuardedMint {
    mapping(address account => bool enabled) public minterRole;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(uint256 maxSupply_) {
        maxSupply = maxSupply_;
        minterRole[msg.sender] = true;
        collateralVerified = true;
    }

    function mint(address, uint256 amount) external {
        require(minterRole[msg.sender]);
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
        totalSupply += amount;
    }
}
