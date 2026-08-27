// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic safe fixture using a modifier-based issuer check.
contract ModifierProtectedMint {
    error Unauthorized();

    address public immutable issuer;
    uint256 public totalSupply;

    constructor(address issuer_) {
        issuer = issuer_;
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert Unauthorized();
        _;
    }

    function mint(address, uint256 amount) external onlyIssuer {
        totalSupply += amount;
    }
}
