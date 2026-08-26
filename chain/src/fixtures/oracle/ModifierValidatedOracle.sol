// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic safe fixture with validation in a modifier.
contract ModifierValidatedOracle {
    error Unauthorized();
    error InvalidAnswer();
    error InvalidTimestamp();

    address public immutable updater;
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(address updater_, uint256 maxAge_) {
        updater = updater_;
        maxAge = maxAge_;
    }

    modifier validUpdate(int256 answer_, uint256 updatedAt_) {
        if (msg.sender != updater) revert Unauthorized();
        if (answer_ <= 0) revert InvalidAnswer();
        if (updatedAt_ > block.timestamp || block.timestamp - updatedAt_ > maxAge) {
            revert InvalidTimestamp();
        }
        _;
    }

    function update(int256 answer_, uint256 updatedAt_) external validUpdate(answer_, updatedAt_) {
        answer = answer_;
        updatedAt = updatedAt_;
    }
}
