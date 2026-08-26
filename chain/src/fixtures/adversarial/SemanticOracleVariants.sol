// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Every validation has a public bypass disjunct.
contract DisjunctiveBypassOracle {
    bool public bypassEnabled;
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        require(answer_ > 0 || bypassEnabled);
        require(updatedAt_ <= block.timestamp || bypassEnabled);
        require(block.timestamp - updatedAt_ <= maxAge || bypassEnabled);
        answer = answer_;
        updatedAt = updatedAt_;
    }
}

/// @notice Synthetic vulnerable fixture. Boundary and direction checks accept invalid data.
contract InvertedGuardOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        require(answer_ >= 0);
        require(updatedAt_ >= block.timestamp);
        require(updatedAt_ - block.timestamp >= maxAge);
        answer = answer_;
        updatedAt = updatedAt_;
    }
}

/// @notice Synthetic safe fixture. Only the fully validated branch writes oracle state.
contract BranchValidatedOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        if (answer_ > 0 && updatedAt_ <= block.timestamp && block.timestamp - updatedAt_ <= maxAge)
        {
            answer = answer_;
            updatedAt = updatedAt_;
        }
    }
}

/// @notice Synthetic vulnerable fixture. Validated parameters are not the stored parameters.
contract UnrelatedValidatedOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(
        int256 answer_,
        uint256 updatedAt_,
        int256 checkedAnswer,
        uint256 checkedUpdatedAt
    ) external {
        require(checkedAnswer > 0);
        require(checkedUpdatedAt <= block.timestamp);
        require(block.timestamp - checkedUpdatedAt <= maxAge);
        answer = answer_;
        updatedAt = updatedAt_;
    }
}

/// @notice Synthetic safe fixture. Strict boundary forms imply the P0 oracle conditions.
contract StrictBoundaryOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        require(answer_ >= 1);
        require(updatedAt_ < block.timestamp);
        require(block.timestamp - updatedAt_ < maxAge);
        answer = answer_;
        updatedAt = updatedAt_;
    }
}

/// @notice Synthetic safe fixture. Each branch validates the exact values it stores.
contract MultiPathValidatedOracle {
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(
        int256 primaryAnswer,
        uint256 primaryUpdatedAt,
        int256 fallbackAnswer,
        uint256 fallbackUpdatedAt,
        bool usePrimary
    ) external {
        if (usePrimary) {
            require(primaryAnswer > 0);
            require(primaryUpdatedAt <= block.timestamp);
            require(block.timestamp - primaryUpdatedAt <= maxAge);
            answer = primaryAnswer;
            updatedAt = primaryUpdatedAt;
        } else {
            require(fallbackAnswer > 0);
            require(fallbackUpdatedAt <= block.timestamp);
            require(block.timestamp - fallbackUpdatedAt <= maxAge);
            answer = fallbackAnswer;
            updatedAt = fallbackUpdatedAt;
        }
    }
}
