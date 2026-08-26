// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic safe fixture with guards and mutation in internal helpers.
contract HelperCollateralCapMint {
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

    function setCollateralVerified(bool verified) external {
        if (msg.sender != issuer) revert Unauthorized();
        collateralVerified = verified;
    }

    function mint(address, uint256 amount) external {
        _validateMint(amount);
        _mint(amount);
    }

    function _validateMint(uint256 amount) internal view {
        if (msg.sender != issuer) revert Unauthorized();
        if (!collateralVerified) revert CollateralNotVerified();
        if (totalSupply + amount > maxSupply) revert MaxSupplyExceeded();
    }

    function _mint(uint256 amount) internal {
        totalSupply += amount;
    }
}
