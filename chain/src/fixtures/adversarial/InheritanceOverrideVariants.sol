// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic base whose virtual hook protects minting before an override is applied.
abstract contract GuardedVirtualHookMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
        collateralVerified = true;
    }

    function mint(uint256 amount) external {
        _validateMint(amount);
        totalSupply += amount;
    }

    function _validateMint(uint256 amount) internal view virtual {
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
    }
}

/// @notice Synthetic vulnerable fixture. The derived hook removes every base guard.
contract UnguardedHookOverrideMint is GuardedVirtualHookMint {
    constructor(address issuer_, uint256 maxSupply_) GuardedVirtualHookMint(issuer_, maxSupply_) { }

    function _validateMint(uint256) internal view override { }
}

/// @notice Synthetic base whose virtual hook deliberately provides no mint guard.
abstract contract UnguardedVirtualHookMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
        collateralVerified = true;
    }

    function mint(uint256 amount) external {
        _validateMint(amount);
        totalSupply += amount;
    }

    function _validateMint(uint256) internal view virtual { }
}

/// @notice Synthetic safe fixture. The derived hook supplies every required guard.
contract GuardedHookOverrideMint is UnguardedVirtualHookMint {
    constructor(address issuer_, uint256 maxSupply_)
        UnguardedVirtualHookMint(issuer_, maxSupply_)
    { }

    function _validateMint(uint256 amount) internal view override {
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
    }
}

/// @notice Synthetic base whose virtual modifier protects minting before an override is applied.
abstract contract GuardedVirtualModifierMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
        collateralVerified = true;
    }

    modifier validateMint(uint256 amount) virtual {
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
        _;
    }

    function mint(uint256 amount) external validateMint(amount) {
        totalSupply += amount;
    }
}

/// @notice Synthetic vulnerable fixture. The derived modifier removes every base guard.
contract UnguardedModifierOverrideMint is GuardedVirtualModifierMint {
    constructor(address issuer_, uint256 maxSupply_)
        GuardedVirtualModifierMint(issuer_, maxSupply_)
    { }

    modifier validateMint(uint256) override {
        _;
    }
}

/// @notice Synthetic base whose virtual modifier deliberately provides no mint guard.
abstract contract UnguardedVirtualModifierMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
        collateralVerified = true;
    }

    modifier validateMint(uint256) virtual {
        _;
    }

    function mint(uint256 amount) external validateMint(amount) {
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. The derived modifier supplies every required guard.
contract GuardedModifierOverrideMint is UnguardedVirtualModifierMint {
    constructor(address issuer_, uint256 maxSupply_)
        UnguardedVirtualModifierMint(issuer_, maxSupply_)
    { }

    modifier validateMint(uint256 amount) override {
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
        _;
    }
}
