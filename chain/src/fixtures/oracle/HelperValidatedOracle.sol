// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic safe fixture with validation in an internal helper.
contract HelperValidatedOracle {
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

    function update(int256 answer_, uint256 updatedAt_) external {
        _validate(answer_, updatedAt_);
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function _validate(int256 answer_, uint256 updatedAt_) internal view {
        if (msg.sender != updater) revert Unauthorized();
        if (answer_ <= 0) revert InvalidAnswer();
        if (updatedAt_ > block.timestamp || block.timestamp - updatedAt_ > maxAge) {
            revert InvalidTimestamp();
        }
    }
}
