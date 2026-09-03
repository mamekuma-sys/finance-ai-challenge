// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable oracle fixture. Never deploy with real funds.
contract VulnerableOracle {
    int256 public answer;
    uint256 public updatedAt;

    event PriceUpdated(int256 previousAnswer, int256 answer, uint256 updatedAt);

    function update(int256 answer_, uint256 updatedAt_) external {
        int256 previous = answer;
        answer = answer_;
        updatedAt = updatedAt_;
        emit PriceUpdated(previous, answer_, updatedAt_);
    }
}
