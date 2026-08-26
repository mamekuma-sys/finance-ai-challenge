// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract IssuerAuthorizer {
    error Unauthorized();

    address public immutable issuer;

    constructor(address issuer_) {
        issuer = issuer_;
    }

    modifier onlyIssuer() {
        _checkIssuer();
        _;
    }

    function _checkIssuer() internal view {
        if (msg.sender != issuer) revert Unauthorized();
    }
}

/// @notice Synthetic safe fixture using an inherited modifier and internal helpers.
contract InheritedHelperProtectedMint is IssuerAuthorizer {
    uint256 public totalSupply;

    constructor(address issuer_) IssuerAuthorizer(issuer_) { }

    function mint(address, uint256 amount) external onlyIssuer {
        _mint(amount);
    }

    function _mint(uint256 amount) internal {
        totalSupply += amount;
    }
}
