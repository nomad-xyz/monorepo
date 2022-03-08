// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;
pragma experimental ABIEncoderV2;

import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {TypeCasts} from "../XAppConnectionManager.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract TestGovernanceMessage {
    using TypedMemView for bytes29;
    using TypedMemView for bytes;

    function formatBatch(GovernanceMessage.Call[] calldata _calls)
        external
        view
        returns (bytes memory)
    {
        return GovernanceMessage.formatBatch(_calls);
    }

    function serializeCall(GovernanceMessage.Call calldata _call)
        external
        view
        returns (bytes memory)
    {
        return GovernanceMessage.serializeCall(_call).clone();
    }

    function isValidBatch(bytes memory _msg) external pure returns (bool) {
        return
            GovernanceMessage.isValidBatch(
                _msg.ref(uint40(GovernanceMessage.Types.Batch))
            );
    }
}
