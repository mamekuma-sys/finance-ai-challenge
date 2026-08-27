// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMintValidator {
    function validate(address caller, uint256 currentSupply, uint256 amount) external view;
}

/// @notice Synthetic review fixture. Required guards may be hidden in an external validator.
contract ExternalValidatedMint {
    IMintValidator public immutable validator;
    uint256 public totalSupply;

    constructor(IMintValidator validator_) {
        validator = validator_;
    }

    function mint(address, uint256 amount) external {
        validator.validate(msg.sender, totalSupply, amount);
        totalSupply += amount;
    }
}
