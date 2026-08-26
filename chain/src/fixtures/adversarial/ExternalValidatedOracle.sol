// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleValidator {
    function validate(int256 answer, uint256 updatedAt) external view;
}

/// @notice Synthetic review fixture. Required guards may be hidden in an external validator.
contract ExternalValidatedOracle {
    IOracleValidator public immutable validator;
    int256 public answer;
    uint256 public updatedAt;

    constructor(IOracleValidator validator_) {
        validator = validator_;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        validator.validate(answer_, updatedAt_);
        answer = answer_;
        updatedAt = updatedAt_;
    }
}
