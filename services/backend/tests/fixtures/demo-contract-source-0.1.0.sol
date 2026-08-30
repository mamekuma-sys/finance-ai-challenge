// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Synthetic vulnerable fixture. Never deploy with real funds.
contract VulnerableRwaToken {
    mapping(address account => uint256 balance) public balanceOf;
    uint256 public totalSupply;

    event Minted(address indexed caller, address indexed to, uint256 amount, uint256 totalSupply);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Minted(msg.sender, to, amount, totalSupply);
    }
}


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
