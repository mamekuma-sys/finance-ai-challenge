// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic corrected oracle fixture. It is not production-audited.
contract FixedOracle {
    error Unauthorized();
    error InvalidAnswer();
    error InvalidTimestamp();

    address public immutable updater;
    uint256 public immutable maxAge;
    int256 public answer;
    uint256 public updatedAt;

    event PriceUpdated(int256 previousAnswer, int256 answer, uint256 updatedAt);

    constructor(address updater_, uint256 maxAge_) {
        updater = updater_;
        maxAge = maxAge_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        if (msg.sender != updater) revert Unauthorized();
        if (answer_ <= 0) revert InvalidAnswer();
        if (updatedAt_ > block.timestamp || block.timestamp - updatedAt_ > maxAge) {
            revert InvalidTimestamp();
        }

        int256 previous = answer;
        answer = answer_;
        updatedAt = updatedAt_;
        emit PriceUpdated(previous, answer_, updatedAt_);
    }
}
