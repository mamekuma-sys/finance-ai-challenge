// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. One of two mint paths bypasses issuer authorization.
contract VulnerableAlternateMint {
    error Unauthorized();

    address public immutable issuer;
    uint256 public totalSupply;

    constructor(address issuer_) {
        issuer = issuer_;
    }

    function mint(address, uint256 amount) external {
        if (msg.sender != issuer) revert Unauthorized();
        totalSupply += amount;
    }

    function mintForCampaign(address, uint256 amount) external {
        totalSupply += amount;
    }
}
