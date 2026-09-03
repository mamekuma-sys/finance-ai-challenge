// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic corrected fixture. It is not production-audited.
contract FixedRwaToken {
    error Unauthorized();
    error CollateralNotVerified();
    error MaxSupplyExceeded();

    address public immutable issuer;
    uint256 public immutable maxSupply;
    bool public collateralVerified;
    uint256 public totalSupply;
    mapping(address account => uint256 balance) public balanceOf;

    event CollateralStatusChanged(bool verified);
    event Minted(address indexed caller, address indexed to, uint256 amount, uint256 totalSupply);

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function setCollateralVerified(bool verified) external {
        if (msg.sender != issuer) revert Unauthorized();
        collateralVerified = verified;
        emit CollateralStatusChanged(verified);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != issuer) revert Unauthorized();
        if (!collateralVerified) revert CollateralNotVerified();
        if (totalSupply + amount > maxSupply) revert MaxSupplyExceeded();

        totalSupply += amount;
        balanceOf[to] += amount;
        emit Minted(msg.sender, to, amount, totalSupply);
    }
}
