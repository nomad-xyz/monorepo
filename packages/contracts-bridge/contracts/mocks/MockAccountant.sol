// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {NFTRecoveryAccountant} from "../accountants/NFTAccountant.sol";

contract MockNftAccountant is NFTRecoveryAccountant {
    mapping(address => bool) public allowList;

    constructor() NFTRecoveryAccountant(address(0), address(1)) {}

    function exposed_increaseTotalAffected(address _asset) public {
        if (totalAffected[_asset] == 0) {
            totalAffected[_asset] = 5000 ether;
        } else {
            totalAffected[_asset] = totalAffected[_asset] + 10 ether;
        }
    }

    function exposed_record(
        address _asset,
        address _user,
        uint256 _amount
    ) external {
        _record(_asset, _user, _amount);
    }

    modifier onlyAllowed() {
        require(allowList[msg.sender], "not allowed");
        _;
    }

    function recover(uint256 _id) external onlyAllowed {
        address _user = ownerOf(_id);
        require(_user == msg.sender, "only NFT holder can recover");
        Record memory _rec = records[_id];
        uint256 _amount = 0.5 ether;
        _rec.recovered += uint96(_amount);
        emit Recovery(_id, _rec.asset, _user, _amount);
    }

    function allow(address who) external {
        allowList[who] = true;
    }

    function disallow(address who) external {
        allowList[who] = false;
    }

    function allow(address[] calldata _who) external {
        for (uint256 i = 0; i < _who.length; i++) {
            allowList[_who[i]] = true;
        }
    }

    function disallow(address[] calldata _who) external {
        for (uint256 i = 0; i < _who.length; i++) {
            allowList[_who[i]] = false;
        }
    }

    function info(uint256 _id)
        external
        view
        returns (
            address _holder,
            bool _isAllowed,
            string memory _uri,
            address _asset,
            uint256 _originalAmount,
            address _originalUser,
            uint256 _recovered,
            uint256 _recoverable
        )
    {
        _holder = ownerOf(_id);
        _isAllowed = allowList[_holder];
        _uri = tokenURI(_id);
        Record memory _rec = records[_id];
        _asset = _rec.asset;
        _originalAmount = uint256(_rec.amount);
        _originalUser = _rec.originalUser;
        _recovered = uint256(_rec.recovered);
        _recoverable = 0.05 ether;
    }
}
