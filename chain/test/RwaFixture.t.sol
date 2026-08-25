// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FixedOracle } from "../src/fixtures/FixedOracle.sol";
import { FixedRwaToken } from "../src/fixtures/FixedRwaToken.sol";
import { VulnerableRwaToken } from "../src/fixtures/VulnerableRwaToken.sol";

contract ExternalCaller {
    function callMint(FixedRwaToken token, address to, uint256 amount) external returns (bool) {
        (bool ok,) = address(token).call(abi.encodeCall(token.mint, (to, amount)));
        return ok;
    }
}

contract RwaFixtureTest {
    function testVulnerableTokenAllowsPublicMint() public {
        VulnerableRwaToken token = new VulnerableRwaToken();
        token.mint(address(this), 120_000);
        assert(token.totalSupply() == 120_000);
    }

    function testFixedTokenRejectsUnauthorizedMint() public {
        FixedRwaToken token = new FixedRwaToken(address(this), 100_000);
        token.setCollateralVerified(true);
        ExternalCaller caller = new ExternalCaller();
        assert(!caller.callMint(token, address(caller), 1));
    }

    function testFixedTokenEnforcesCollateralAndCap() public {
        FixedRwaToken token = new FixedRwaToken(address(this), 100_000);
        (bool beforeCollateral,) =
            address(token).call(abi.encodeCall(token.mint, (address(this), 1)));
        assert(!beforeCollateral);

        token.setCollateralVerified(true);
        token.mint(address(this), 100_000);
        (bool overCap,) = address(token).call(abi.encodeCall(token.mint, (address(this), 1)));
        assert(!overCap);
    }

    function testFixedOracleRejectsInvalidAnswer() public {
        FixedOracle oracle = new FixedOracle(address(this), 3600);
        (bool ok,) = address(oracle).call(abi.encodeCall(oracle.update, (int256(0), block.timestamp)));
        assert(!ok);
    }
}
