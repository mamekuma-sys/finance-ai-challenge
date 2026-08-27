// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    GuardedHookOverrideMint,
    GuardedModifierOverrideMint,
    UnguardedHookOverrideMint,
    UnguardedModifierOverrideMint
} from "../src/fixtures/adversarial/InheritanceOverrideVariants.sol";
import {
    AliasedHelperMint,
    AliasedHelperOracle,
    BranchAliasBypassMint,
    BranchAliasBypassOracle,
    PathSpecificRollbackMint,
    RequireFalseRollbackMint,
    RequireFalseRollbackOracle,
    ReturnHelperMint,
    UncheckedMint
} from "../src/fixtures/adversarial/PathAndNameVariants.sol";

contract HardeningExternalCaller {
    function callTarget(address target, bytes memory payload) external returns (bool) {
        (bool ok,) = target.call(payload);
        return ok;
    }
}

contract ContractHardeningTest {
    uint256 private constant MAX_SUPPLY = 100;

    function testVirtualHookAndModifierOverridesUseDerivedImplementation() public {
        HardeningExternalCaller caller = new HardeningExternalCaller();
        UnguardedHookOverrideMint openHook =
            new UnguardedHookOverrideMint(address(this), MAX_SUPPLY);
        GuardedHookOverrideMint guardedHook = new GuardedHookOverrideMint(address(this), MAX_SUPPLY);
        UnguardedModifierOverrideMint openModifier =
            new UnguardedModifierOverrideMint(address(this), MAX_SUPPLY);
        GuardedModifierOverrideMint guardedModifier =
            new GuardedModifierOverrideMint(address(this), MAX_SUPPLY);

        assert(
            caller.callTarget(address(openHook), abi.encodeCall(openHook.mint, (MAX_SUPPLY + 1)))
        );
        assert(
            !caller.callTarget(
                address(guardedHook), abi.encodeCall(guardedHook.mint, (MAX_SUPPLY + 1))
            )
        );
        assert(
            caller.callTarget(
                address(openModifier), abi.encodeCall(openModifier.mint, (MAX_SUPPLY + 1))
            )
        );
        assert(
            !caller.callTarget(
                address(guardedModifier), abi.encodeCall(guardedModifier.mint, (MAX_SUPPLY + 1))
            )
        );
        assert(openHook.totalSupply() == MAX_SUPPLY + 1);
        assert(openModifier.totalSupply() == MAX_SUPPLY + 1);
        assert(guardedHook.totalSupply() == 0);
        assert(guardedModifier.totalSupply() == 0);
    }

    function testBranchAliasesExposeMintAndOracleBypasses() public {
        BranchAliasBypassMint token = new BranchAliasBypassMint(address(this), MAX_SUPPLY);
        token.mint(MAX_SUPPLY + 1, false);
        assert(token.totalSupply() == MAX_SUPPLY + 1);

        BranchAliasBypassOracle oracle = new BranchAliasBypassOracle(60);
        oracle.update(0, block.timestamp + 1, false);
        assert(oracle.answer() == 0);
        assert(oracle.updatedAt() > block.timestamp);
    }

    function testAliasedHelpersKeepTheOriginalGuardSubjects() public {
        HardeningExternalCaller caller = new HardeningExternalCaller();
        AliasedHelperMint token = new AliasedHelperMint(address(this), MAX_SUPPLY);
        assert(!caller.callTarget(address(token), abi.encodeCall(token.mint, (1))));
        token.mint(MAX_SUPPLY);
        assert(token.totalSupply() == MAX_SUPPLY);

        AliasedHelperOracle oracle = new AliasedHelperOracle(60);
        oracle.update(1, block.timestamp);
        assert(oracle.answer() == 1 && oracle.updatedAt() == block.timestamp);
        assert(
            !caller.callTarget(
                address(oracle), abi.encodeCall(oracle.update, (int256(0), block.timestamp))
            )
        );
    }

    function testUncheckedAndReturnExpressionHelpersStillMutateSupply() public {
        UncheckedMint uncheckedToken = new UncheckedMint();
        ReturnHelperMint returnToken = new ReturnHelperMint();

        uncheckedToken.mint(2);
        uint256 returnedSupply = returnToken.mint(3);

        assert(uncheckedToken.totalSupply() == 2);
        assert(returnedSupply == 3 && returnToken.totalSupply() == 3);
    }

    function testConstantFalseRequireRollsBackProtectedMutations() public {
        RequireFalseRollbackMint token = new RequireFalseRollbackMint();
        RequireFalseRollbackOracle oracle = new RequireFalseRollbackOracle();

        (bool mintOk,) = address(token).call(abi.encodeCall(token.mint, (1)));
        (bool updateOk,) =
            address(oracle).call(abi.encodeCall(oracle.update, (int256(1), block.timestamp)));

        assert(!mintOk && token.totalSupply() == 0);
        assert(!updateOk && oracle.answer() == 0 && oracle.updatedAt() == 0);
    }

    function testOnlyTheGuardedAliasPathCanCommit() public {
        PathSpecificRollbackMint token = new PathSpecificRollbackMint(address(this), MAX_SUPPLY);

        (bool bypassOk,) = address(token).call(abi.encodeCall(token.mint, (MAX_SUPPLY + 1, false)));
        assert(!bypassOk && token.totalSupply() == 0);

        token.mint(MAX_SUPPLY, true);
        assert(token.totalSupply() == MAX_SUPPLY);
    }
}
