// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. An internal helper does not make public mint safe.
contract VulnerableHelperMint {
    uint256 public totalSupply;
    mapping(address account => uint256 balance) public balanceOf;

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
    }
}
