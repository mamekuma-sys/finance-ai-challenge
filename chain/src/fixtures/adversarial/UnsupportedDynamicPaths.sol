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

/// @notice Synthetic review fixture. An internal function pointer obscures control flow.
contract FunctionPointerMint {
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        function(uint256) internal action = _validate;
        action(amount);
        totalSupply += amount;
    }

    function _validate(uint256) internal pure { }
}

/// @notice Synthetic review fixture. Recursive control flow exceeds the P0 call model.
contract RecursiveMint {
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        _recurse(amount);
    }

    function _recurse(uint256 amount) internal {
        if (amount > 1) _recurse(amount - 1);
        totalSupply += amount;
    }
}

/// @notice Synthetic review fixture. The supply-like storage uses an unsupported domain name.
contract OpaqueMint {
    uint256 public issuedUnits;

    function mint(uint256 amount) external {
        issuedUnits += amount;
    }
}

/// @notice Synthetic review fixture. Oracle-like storage uses unsupported domain names.
contract OpaqueOracle {
    int256 public observation;
    uint256 public observedOn;

    function update(int256 value, uint256 observedOn_) external {
        observation = value;
        observedOn = observedOn_;
    }
}
