// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Home} from "../../Home.sol";

contract HomeHarness is Home {
    constructor(uint32 _localDomain) Home(_localDomain) {}
}
