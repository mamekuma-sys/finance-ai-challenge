// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FixedOracle } from "../src/fixtures/FixedOracle.sol";
import { FixedRwaToken } from "../src/fixtures/FixedRwaToken.sol";
import { VulnerableOracle } from "../src/fixtures/VulnerableOracle.sol";
import { VulnerableRwaToken } from "../src/fixtures/VulnerableRwaToken.sol";
import {
    InheritedHelperProtectedMint
} from "../src/fixtures/access/InheritedHelperProtectedMint.sol";
import { ModifierProtectedMint } from "../src/fixtures/access/ModifierProtectedMint.sol";
import { VulnerableAlternateMint } from "../src/fixtures/access/VulnerableAlternateMint.sol";
import { VulnerableHelperMint } from "../src/fixtures/access/VulnerableHelperMint.sol";
import { CapOnlyMint } from "../src/fixtures/collateral/CapOnlyMint.sol";
import { CollateralOnlyMint } from "../src/fixtures/collateral/CollateralOnlyMint.sol";
import { HelperCollateralCapMint } from "../src/fixtures/collateral/HelperCollateralCapMint.sol";
import {
    ModifierCollateralCapMint
} from "../src/fixtures/collateral/ModifierCollateralCapMint.sol";
import { FreshnessOnlyOracle } from "../src/fixtures/oracle/FreshnessOnlyOracle.sol";
import { HelperValidatedOracle } from "../src/fixtures/oracle/HelperValidatedOracle.sol";
import { ModifierValidatedOracle } from "../src/fixtures/oracle/ModifierValidatedOracle.sol";
import { PositiveOnlyOracle } from "../src/fixtures/oracle/PositiveOnlyOracle.sol";

contract ExternalCaller {
    function callTarget(address target, bytes memory payload) external returns (bool) {
        (bool ok,) = target.call(payload);
        return ok;
    }
}

contract RwaFixtureTest {
    uint256 private constant MAX_SUPPLY = 100_000;

    function testVulnerableAccessFixturesAllowUnauthorizedMint() public {
        VulnerableRwaToken direct = new VulnerableRwaToken();
        direct.mint(address(this), 1);
        assert(direct.totalSupply() == 1);

        VulnerableHelperMint helper = new VulnerableHelperMint();
        helper.mint(address(this), 2);
        assert(helper.totalSupply() == 2);

        VulnerableAlternateMint alternate = new VulnerableAlternateMint(address(0xBEEF));
        alternate.mintForCampaign(address(this), 3);
        assert(alternate.totalSupply() == 3);
    }

    function testFuzzUnauthorizedCallerCannotIncreaseSupply(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) + 1;
        ExternalCaller caller = new ExternalCaller();

        FixedRwaToken direct = new FixedRwaToken(address(this), type(uint256).max);
        direct.setCollateralVerified(true);
        bool directOk = caller.callTarget(
            address(direct), abi.encodeCall(direct.mint, (address(caller), amount))
        );
        assert(!directOk && direct.totalSupply() == 0);

        ModifierProtectedMint modified = new ModifierProtectedMint(address(this));
        bool modifierOk = caller.callTarget(
            address(modified), abi.encodeCall(modified.mint, (address(caller), amount))
        );
        assert(!modifierOk && modified.totalSupply() == 0);

        InheritedHelperProtectedMint inherited = new InheritedHelperProtectedMint(address(this));
        bool inheritedOk = caller.callTarget(
            address(inherited), abi.encodeCall(inherited.mint, (address(caller), amount))
        );
        assert(!inheritedOk && inherited.totalSupply() == 0);
    }

    function testPartialCollateralFixturesExposeMissingHalf() public {
        CollateralOnlyMint noCap = new CollateralOnlyMint(address(this));
        noCap.setCollateralVerified(true);
        noCap.mint(address(this), MAX_SUPPLY + 1);
        assert(noCap.totalSupply() > MAX_SUPPLY);

        CapOnlyMint noCollateral = new CapOnlyMint(address(this), MAX_SUPPLY);
        noCollateral.mint(address(this), 1);
        assert(noCollateral.totalSupply() == 1);
    }

    function testFuzzUnverifiedCollateralCannotIncreaseSupply(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) + 1;

        FixedRwaToken direct = new FixedRwaToken(address(this), type(uint256).max);
        (bool directOk,) =
            address(direct).call(abi.encodeCall(direct.mint, (address(this), amount)));
        assert(!directOk && direct.totalSupply() == 0);

        ModifierCollateralCapMint modified =
            new ModifierCollateralCapMint(address(this), type(uint256).max);
        (bool modifierOk,) =
            address(modified).call(abi.encodeCall(modified.mint, (address(this), amount)));
        assert(!modifierOk && modified.totalSupply() == 0);

        HelperCollateralCapMint helper =
            new HelperCollateralCapMint(address(this), type(uint256).max);
        (bool helperOk,) =
            address(helper).call(abi.encodeCall(helper.mint, (address(this), amount)));
        assert(!helperOk && helper.totalSupply() == 0);
    }

    function testFuzzTotalSupplyCannotExceedMaxSupply(uint96 rawExtra) public {
        uint256 extra = uint256(rawExtra) + 1;

        FixedRwaToken direct = new FixedRwaToken(address(this), MAX_SUPPLY);
        direct.setCollateralVerified(true);
        direct.mint(address(this), MAX_SUPPLY);
        (bool directOk,) = address(direct).call(abi.encodeCall(direct.mint, (address(this), extra)));
        assert(!directOk && direct.totalSupply() == MAX_SUPPLY);

        ModifierCollateralCapMint modified =
            new ModifierCollateralCapMint(address(this), MAX_SUPPLY);
        modified.setCollateralVerified(true);
        modified.mint(address(this), MAX_SUPPLY);
        (bool modifierOk,) =
            address(modified).call(abi.encodeCall(modified.mint, (address(this), extra)));
        assert(!modifierOk && modified.totalSupply() == MAX_SUPPLY);

        HelperCollateralCapMint helper = new HelperCollateralCapMint(address(this), MAX_SUPPLY);
        helper.setCollateralVerified(true);
        helper.mint(address(this), MAX_SUPPLY);
        (bool helperOk,) = address(helper).call(abi.encodeCall(helper.mint, (address(this), extra)));
        assert(!helperOk && helper.totalSupply() == MAX_SUPPLY);
    }

    function testVulnerableOracleFixturesAcceptInvalidData() public {
        VulnerableOracle unvalidated = new VulnerableOracle();
        unvalidated.update(0, block.timestamp + 1);
        assert(unvalidated.answer() == 0 && unvalidated.updatedAt() > block.timestamp);

        PositiveOnlyOracle noFreshness = new PositiveOnlyOracle(address(this));
        noFreshness.update(1, block.timestamp + 1);
        assert(noFreshness.updatedAt() > block.timestamp);

        FreshnessOnlyOracle noAnswerCheck = new FreshnessOnlyOracle(address(this), 0);
        noAnswerCheck.update(0, block.timestamp);
        assert(noAnswerCheck.answer() == 0);
    }

    function testFuzzSafeOraclesRejectNonPositiveAnswers(uint96 rawMagnitude) public {
        int256 invalidAnswer = -int256(uint256(rawMagnitude));
        FixedOracle direct = new FixedOracle(address(this), 3600);
        ModifierValidatedOracle modified = new ModifierValidatedOracle(address(this), 3600);
        HelperValidatedOracle helper = new HelperValidatedOracle(address(this), 3600);

        assert(!_updateOracle(address(direct), invalidAnswer, block.timestamp));
        assert(!_updateOracle(address(modified), invalidAnswer, block.timestamp));
        assert(!_updateOracle(address(helper), invalidAnswer, block.timestamp));
        assert(direct.answer() == 0 && modified.answer() == 0 && helper.answer() == 0);
    }

    function testFuzzSafeOraclesRejectFutureTimestamps(uint64 rawDelta) public {
        uint256 future = block.timestamp + uint256(rawDelta) + 1;
        FixedOracle direct = new FixedOracle(address(this), type(uint256).max);
        ModifierValidatedOracle modified =
            new ModifierValidatedOracle(address(this), type(uint256).max);
        HelperValidatedOracle helper = new HelperValidatedOracle(address(this), type(uint256).max);

        assert(!_updateOracle(address(direct), 1, future));
        assert(!_updateOracle(address(modified), 1, future));
        assert(!_updateOracle(address(helper), 1, future));
        assert(direct.updatedAt() == 0 && modified.updatedAt() == 0 && helper.updatedAt() == 0);
    }

    function testSafeOraclesRejectStaleTimestamps() public {
        assert(block.timestamp > 0);
        uint256 stale = block.timestamp - 1;
        FixedOracle direct = new FixedOracle(address(this), 0);
        ModifierValidatedOracle modified = new ModifierValidatedOracle(address(this), 0);
        HelperValidatedOracle helper = new HelperValidatedOracle(address(this), 0);

        assert(!_updateOracle(address(direct), 1, stale));
        assert(!_updateOracle(address(modified), 1, stale));
        assert(!_updateOracle(address(helper), 1, stale));
        assert(direct.updatedAt() == 0 && modified.updatedAt() == 0 && helper.updatedAt() == 0);
    }

    function testSafeOraclesAcceptValidData() public {
        FixedOracle direct = new FixedOracle(address(this), 3600);
        ModifierValidatedOracle modified = new ModifierValidatedOracle(address(this), 3600);
        HelperValidatedOracle helper = new HelperValidatedOracle(address(this), 3600);

        assert(_updateOracle(address(direct), 100, block.timestamp));
        assert(_updateOracle(address(modified), 100, block.timestamp));
        assert(_updateOracle(address(helper), 100, block.timestamp));
        assert(direct.answer() == 100 && modified.answer() == 100 && helper.answer() == 100);
    }

    function _updateOracle(address oracle, int256 answer, uint256 updatedAt)
        private
        returns (bool)
    {
        (bool ok,) = oracle.call(
            abi.encodeWithSignature("update(int256,uint256)", answer, updatedAt)
        );
        return ok;
    }
}
