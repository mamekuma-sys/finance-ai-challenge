// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic review fixture. The implementation and mutation are behind delegatecall.
contract DelegateMintProxy {
    address public immutable implementation;

    constructor(address implementation_) {
        implementation = implementation_;
    }

    function mint(bytes calldata data) external {
        implementation.delegatecall(data);
    }
}

/// @notice Synthetic review fixture. The supply mutation is hidden in inline assembly.
contract AssemblyMint {
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        assembly {
            sstore(totalSupply.slot, amount)
        }
    }
}

/// @notice Synthetic review fixture. Oracle storage mutations are hidden in inline assembly.
contract AssemblyOracle {
    int256 public answer;
    uint256 public updatedAt;

    function update(int256 answer_, uint256 updatedAt_) external {
        assembly {
            sstore(answer.slot, answer_)
            sstore(updatedAt.slot, updatedAt_)
        }
    }
}
