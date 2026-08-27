// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Every required guard can be bypassed when strictMode=false.
contract ConditionalGuardMint {
    mapping(address account => bool enabled) public minterRole;
    bool public strictMode;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(uint256 maxSupply_) {
        maxSupply = maxSupply_;
        minterRole[msg.sender] = true;
    }

    function mint(address, uint256 amount) external {
        if (strictMode) {
            require(minterRole[msg.sender]);
            require(collateralVerified);
            require(totalSupply + amount <= maxSupply);
        }
        totalSupply += amount;
    }
}
