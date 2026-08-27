// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConditionalMintGuard {
    function canMint(address caller, uint256 amount) external view returns (bool);
}

interface IConditionalOracleGuard {
    function isValid(int256 answer, uint256 updatedAt) external view returns (bool);
}

/// @notice Synthetic vulnerable fixture. The first branch is safe but the other aliases bypass.
contract BranchAliasBypassMint {
    address public immutable issuer;
    bool public collateralVerified = true;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(uint256 amount, bool strictMode) external {
        address checkedAuthority = msg.sender;
        uint256 checkedAmount = 0;
        if (strictMode) {
            checkedAuthority = issuer;
            checkedAmount = amount;
        }
        require(msg.sender == checkedAuthority);
        require(collateralVerified);
        require(totalSupply + checkedAmount <= maxSupply);
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. Caller aliases survive parameter and helper-local scopes.
contract AliasedHelperMint {
    address public immutable issuer;
    bool public collateralVerified = true;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(uint256 amount) external {
        uint256 issuedAmount = amount;
        _validate(msg.sender, issuedAmount);
        totalSupply += issuedAmount;
    }

    function _validate(address caller, uint256 checkedAmount) internal view {
        uint256 boundedAmount = checkedAmount;
        require(caller == issuer);
        require(collateralVerified);
        require(totalSupply + boundedAmount <= maxSupply);
    }
}

/// @notice Synthetic vulnerable fixture. Identically named locals, event, and comment are no guards.
contract NameCollisionMint {
    event AuthorizationChecked(address indexed issuer, bool collateralVerified, uint256 maxSupply);

    uint256 public totalSupply;

    function mint(uint256 amount) external {
        // onlyIssuer collateralVerified maxSupply MINT_ACCESS_CONTROL_MISSING
        address issuer = msg.sender;
        bool collateralVerified = true;
        uint256 maxSupply = 1_000_000;
        emit AuthorizationChecked(issuer, collateralVerified, maxSupply);
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
        totalSupply += amount;
    }
}

/// @notice Synthetic safe fixture. Guard-like names without protected mutation stay silent.
contract NameCollisionReadOnly {
    event MINT_ACCESS_CONTROL_MISSING(address indexed onlyIssuer);

    uint256 public totalSupply;

    function onlyIssuer(address collateralVerified, uint256 maxSupply)
        external
        view
        returns (uint256)
    {
        // totalSupply += maxSupply; ORACLE_VALIDATION_MISSING
        return totalSupply + uint160(collateralVerified) + maxSupply;
    }
}

/// @notice Synthetic vulnerable fixture. Guards after mutation do not dominate the mutation.
contract LateGuardMint {
    address public immutable issuer;
    bool public collateralVerified = true;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(uint256 amount) external {
        totalSupply += amount;
        require(msg.sender == issuer);
        require(collateralVerified);
        require(totalSupply <= maxSupply);
    }
}

/// @notice Synthetic no-commit fixture. A constant-false require rolls the whole mutation back.
contract RequireFalseRollbackMint {
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        totalSupply += amount;
        require(false);
    }
}

/// @notice Synthetic vulnerable fixture. The protected mutation is inside an unchecked block.
contract UncheckedMint {
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        unchecked {
            totalSupply += amount;
        }
    }
}

/// @notice Synthetic vulnerable fixture. The protected helper call is a return expression.
contract ReturnHelperMint {
    uint256 public totalSupply;

    function mint(uint256 amount) external returns (uint256) {
        return _mintAndReturn(amount);
    }

    function _mintAndReturn(uint256 amount) internal returns (uint256) {
        totalSupply += amount;
        return totalSupply;
    }
}

/// @notice Synthetic vulnerable fixture. Overloads share a helper but retain distinct identities.
contract OverloadedMintEntrypoints {
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        _mint(amount);
    }

    function mint(address, uint256 amount) external {
        _mint(amount);
    }

    function _mint(uint256 amount) internal {
        totalSupply += amount;
    }
}

/// @notice Synthetic review fixture. Multiplication can increase supply but is path-dependent.
contract MultiplicativeSupplyMint {
    uint256 public totalSupply = 1;

    function mint(uint256 factor) external {
        totalSupply *= factor;
    }
}

/// @notice Synthetic review fixture. A boolean-return helper is outside the P0 guard model.
contract BooleanRoleGuardMint {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bool public collateralVerified = true;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(uint256 maxSupply_) {
        maxSupply = maxSupply_;
    }

    function hasRole(bytes32, address) public pure returns (bool) {
        return true;
    }

    function mint(uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender));
        require(collateralVerified);
        require(totalSupply + amount <= maxSupply);
        totalSupply += amount;
    }
}

/// @notice Synthetic review fixture. An external call controls the only mutation branch.
contract ConditionalExternalGuardMint {
    IConditionalMintGuard public immutable validator;
    uint256 public totalSupply;

    constructor(IConditionalMintGuard validator_) {
        validator = validator_;
    }

    function mint(uint256 amount) external {
        if (validator.canMint(msg.sender, amount)) {
            totalSupply += amount;
        }
    }
}

/// @notice Synthetic vulnerable fixture. One branch validates aliases unrelated to stored values.
contract BranchAliasBypassOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_, bool strictMode) external {
        int256 checkedAnswer = 1;
        uint256 checkedUpdatedAt = block.timestamp;
        if (strictMode) {
            checkedAnswer = answer_;
            checkedUpdatedAt = updatedAt_;
        }
        require(checkedAnswer > 0);
        require(checkedUpdatedAt <= block.timestamp);
        require(block.timestamp - checkedUpdatedAt <= maxAge);
        answer = answer_;
        updatedAt = updatedAt_;
    }
}

/// @notice Synthetic safe fixture. Oracle aliases survive helper parameter and local scopes.
contract AliasedHelperOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        int256 storedAnswer = answer_;
        uint256 storedUpdatedAt = updatedAt_;
        _validate(storedAnswer, storedUpdatedAt);
        answer = storedAnswer;
        updatedAt = storedUpdatedAt;
    }

    function _validate(int256 checkedAnswer, uint256 checkedUpdatedAt) internal view {
        int256 boundedAnswer = checkedAnswer;
        uint256 boundedUpdatedAt = checkedUpdatedAt;
        require(boundedAnswer > 0);
        require(boundedUpdatedAt <= block.timestamp);
        require(block.timestamp - boundedUpdatedAt <= maxAge);
    }
}

/// @notice Synthetic vulnerable fixture. Same-name locals, event, and comment validate no input.
contract NameCollisionOracle {
    event OracleValidation(int256 answer, uint256 updatedAt, uint256 maxAge);

    int256 public answer;
    uint256 public updatedAt;

    function update(int256 answer_, uint256 updatedAt_) external {
        // answer > 0; updatedAt <= block.timestamp; block.timestamp - updatedAt <= maxAge
        {
            int256 answer = 1;
            uint256 updatedAt = block.timestamp;
            uint256 maxAge = type(uint256).max;
            emit OracleValidation(answer, updatedAt, maxAge);
            require(answer > 0);
            require(updatedAt <= block.timestamp);
            require(block.timestamp - updatedAt <= maxAge);
        }
        answer = answer_;
        updatedAt = updatedAt_;
    }
}

/// @notice Synthetic vulnerable fixture. Validations after both writes do not dominate either.
contract LateValidationOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        require(answer_ > 0);
        require(updatedAt_ <= block.timestamp);
        require(block.timestamp - updatedAt_ <= maxAge);
    }
}

/// @notice Synthetic no-commit fixture. A constant-false require rolls both writes back.
contract RequireFalseRollbackOracle {
    int256 public answer;
    uint256 public updatedAt;

    function update(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        require(false);
    }
}

/// @notice Synthetic review fixture. An external call controls both oracle storage writes.
contract ConditionalExternalGuardOracle {
    IConditionalOracleGuard public immutable validator;
    int256 public answer;
    uint256 public updatedAt;

    constructor(IConditionalOracleGuard validator_) {
        validator = validator_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        if (validator.isValid(answer_, updatedAt_)) {
            answer = answer_;
            updatedAt = updatedAt_;
        }
    }
}

/// @notice Synthetic safe fixture. The only unguarded alias path always rolls back after mutation.
contract PathSpecificRollbackMint {
    address public immutable issuer;
    bool public collateralVerified = true;
    uint256 public immutable maxSupply;
    uint256 public totalSupply;

    constructor(address issuer_, uint256 maxSupply_) {
        issuer = issuer_;
        maxSupply = maxSupply_;
    }

    function mint(uint256 amount, bool strictMode) external {
        address checkedAuthority = msg.sender;
        uint256 checkedAmount = 0;
        bool commits = false;
        if (strictMode) {
            checkedAuthority = issuer;
            checkedAmount = amount;
            commits = true;
        }
        require(msg.sender == checkedAuthority);
        require(collateralVerified);
        require(totalSupply + checkedAmount <= maxSupply);
        totalSupply += amount;
        require(commits);
    }
}
