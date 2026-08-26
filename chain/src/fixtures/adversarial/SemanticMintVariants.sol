// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Every guard has a public bypass disjunct.
contract DisjunctiveBypassMint {
    mapping(address account => bool enabled) public minterRole;
    bool public collateralVerified;
    bool public bypassEnabled;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(uint256 maxSupply_) {
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        require(minterRole[msg.sender] || bypassEnabled);
        require(collateralVerified || bypassEnabled);
        require(totalSupply + amount <= maxSupply || bypassEnabled);
        totalSupply += amount;
    }
}

/// @notice Synthetic vulnerable fixture. All comparisons accept the unsafe polarity.
contract InvertedGuardMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        require(msg.sender != issuer);
        require(!collateralVerified);
        require(totalSupply + amount >= maxSupply);
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. Only the fully guarded branch can mutate supply.
contract BranchGuardedMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        if (msg.sender == issuer && collateralVerified && totalSupply + amount <= maxSupply) {
            totalSupply += amount;
        }
    }
}

/// @notice Synthetic vulnerable fixture. Guards reference different values than the mutation.
contract UnrelatedGuardMint {
    mapping(address account => bool enabled) public minterRole;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public otherSupply;
    uint256 public totalSupply;

    constructor(uint256 maxSupply_) {
        maxSupply = maxSupply_;
    }

    function mint(address recipient, uint256 amount) external {
        require(minterRole[recipient]);
        require(collateralVerified);
        require(otherSupply + amount <= maxSupply);
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. Direct-call parameter bindings preserve guard subjects.
contract BoundHelperMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        _validate(msg.sender, collateralVerified, totalSupply, amount);
        totalSupply += amount;
    }

    function _validate(address caller, bool collateral, uint256 supply, uint256 amount)
        internal
        view
    {
        require(caller == issuer);
        require(collateral);
        require(supply + amount <= maxSupply);
    }
}

/// @notice Synthetic vulnerable fixture. The helper validates constants, not the mint inputs.
contract WrongHelperArgumentsMint {
    address public immutable issuer;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        _validate(issuer, true, totalSupply, 0);
        totalSupply += amount;
    }

    function _validate(address caller, bool collateral, uint256 supply, uint256 amount)
        internal
        view
    {
        require(caller == issuer);
        require(collateral);
        require(supply + amount <= maxSupply);
    }
}

/// @notice Synthetic safe fixture. Reversed if/revert comparisons enforce all three guards.
contract ReversedGuardMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        if (issuer != msg.sender) revert();
        if (collateralVerified == false) revert();
        if (maxSupply < totalSupply + amount) revert();
        totalSupply += amount;
    }
}

/// @notice Synthetic non-mint fixture. A supply decrease must not be reported as issuance.
contract BurnOnlySupply {
    uint256 public totalSupply = 1_000 ether;

    function burn(uint256 amount) external {
        totalSupply -= amount;
    }
}

/// @notice Synthetic no-commit fixture. The modifier always rolls the transaction back.
contract AlwaysRevertedMint {
    error AlwaysReverts();

    uint256 public totalSupply;

    modifier rollback() {
        _;
        revert AlwaysReverts();
    }

    function mint(uint256 amount) external rollback {
        totalSupply += amount;
    }
}

/// @notice Synthetic review fixture. A modifier postlude determines whether mint commits.
contract PostludeGuardedMint {
    error Unauthorized();

    address public immutable issuer;
    uint256 public totalSupply;

    constructor(address issuer_) {
        issuer = issuer_;
    }

    modifier postludeAuthorization() {
        _;
        if (msg.sender != issuer) revert Unauthorized();
    }

    function mint(uint256 amount) external postludeAuthorization {
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. Multiple modifiers protect a two-level helper call.
contract LayeredGuardMint {
    error Unauthorized();
    error CollateralNotVerified();
    error MaxSupplyExceeded();

    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert Unauthorized();
        _;
    }

    modifier collateralReady() {
        if (!collateralVerified) revert CollateralNotVerified();
        _;
    }

    modifier withinCap(uint256 amount) {
        if (totalSupply + amount > maxSupply) revert MaxSupplyExceeded();
        _;
    }

    function mint(address, uint256 amount) external onlyIssuer collateralReady withinCap(amount) {
        _levelOne(amount);
    }

    function _levelOne(uint256 amount) internal {
        _levelTwo(amount);
    }

    function _levelTwo(uint256 amount) private {
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. A simple local alias preserves the guarded mint input.
contract AliasedInputMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(address, uint256 amount) external {
        uint256 issuedAmount = amount;
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply + issuedAmount <= maxSupply);
        totalSupply += issuedAmount;
    }
}

/// @notice Synthetic vulnerable fixture. The authorized caller returns before an open mint path.
contract EarlyReturnBypassMint {
    address public immutable issuer;
    uint256 public totalSupply;

    constructor(address issuer_) {
        issuer = issuer_;
    }

    function mint(uint256 amount) external {
        if (msg.sender == issuer) return;
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. Every unsafe condition returns before the mutation.
contract EarlyReturnGuardedMint {
    address public immutable issuer;
    bool public collateralVerified;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(uint256 amount) external {
        if (msg.sender != issuer) return;
        if (!collateralVerified) return;
        if (totalSupply + amount > maxSupply) return;
        totalSupply += amount;
    }
}

/// @notice Synthetic no-commit fixture. The only mutation path reverts before completion.
contract RevertedBranchMint {
    uint256 public totalSupply;

    function mint(uint256 amount, bool execute) external {
        if (execute) {
            totalSupply += amount;
            revert();
        }
    }
}

/// @notice Synthetic non-mint fixture. A normal transfer must not be classified as issuance.
contract BalanceTransfer {
    mapping(address account => uint256 balance) public balanceOf;

    function transfer(address recipient, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
    }
}
