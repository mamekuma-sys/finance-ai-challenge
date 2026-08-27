// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Oracle checks are bypassable when strictMode=false.
contract ConditionalValidatedOracle {
    bool public strictMode;
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint256 maxAge_) {
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        if (strictMode) {
            require(answer_ > 0);
            require(updatedAt_ <= block.timestamp);
            require(block.timestamp - updatedAt_ <= maxAge);
        }
        answer = answer_;
        updatedAt = updatedAt_;
    }
}
