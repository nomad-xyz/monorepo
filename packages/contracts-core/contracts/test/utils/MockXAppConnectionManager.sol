// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "@nomad-xyz/contracts-core/contracts/Home.sol";

contract MockXAppConnectionManager {
    Home public home;
    address private replica;

    constructor(address _home, address _replica) {
        home = Home(_home);
        replica = _replica;
    }

    // returns true for one replica provided at deploy time
    function isReplica(address _rep) public view returns (bool) {
        return _rep == replica;
    }

    function localDomain() public view returns (uint32) {
        return home.localDomain();
    }

    function domainToReplica(uint32) public view returns (address) {
        return replica;
    }

    fallback() external {
        revert("Mock does not support function");
    }
}
