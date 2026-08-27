// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Answer validity is checked, timestamp validity is not.
contract PositiveOnlyOracle {
    error Unauthorized();
    error InvalidAnswer();

    address public immutable updater;
    int256 public answer;
    uint256 public updatedAt;

    constructor(address updater_) {
        updater = updater_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        if (msg.sender != updater) revert Unauthorized();
        if (answer_ <= 0) revert InvalidAnswer();
        answer = answer_;
        updatedAt = updatedAt_;
    }
}
