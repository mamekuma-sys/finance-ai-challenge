// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic access-safe fixture using a role mapping indexed by msg.sender.
contract RoleMappingMint {
    mapping(address account => bool enabled) public minterRole;
    uint256 public totalSupply;

    constructor() {
        minterRole[msg.sender] = true;
    }

    function mint(address, uint256 amount) external {
        require(minterRole[msg.sender]);
        totalSupply += amount;
    }
}
