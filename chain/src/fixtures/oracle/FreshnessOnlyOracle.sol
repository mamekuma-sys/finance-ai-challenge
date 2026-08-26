// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Timestamp is checked, but non-positive answers pass.
contract FreshnessOnlyOracle {
    error Unauthorized();
    error InvalidTimestamp();

    address public immutable updater;
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    constructor(address updater_, uint256 maxAge_) {
        updater = updater_;
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        if (msg.sender != updater) revert Unauthorized();
        if (updatedAt_ > block.timestamp || block.timestamp - updatedAt_ > maxAge) {
            revert InvalidTimestamp();
        }
        answer = answer_;
        updatedAt = updatedAt_;
    }
}
