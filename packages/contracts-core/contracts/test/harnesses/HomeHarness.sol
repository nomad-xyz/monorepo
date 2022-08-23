// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Home} from "../../Home.sol";

contract HomeHarness is Home {
    constructor(uint32 _localDomain) Home(_localDomain) {}

    function exposed_destinationAndNonce(uint32 _destination, uint32 _nonce)
        public
        pure
        returns (uint64)
    {
        return _destinationAndNonce(_destination, _nonce);
    }
}
