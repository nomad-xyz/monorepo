// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Merkle} from "murky/Merkle.sol";
import {NomadTest} from "./NomadTest.sol";

contract MerkleTest is NomadTest {

    Merkle tree;

    bytes32 commitedRoot;

    function setUp(){
        tree = new Merkle();
        bytes32[] memory data =
        commitedRoot = "commited Root";
    }

    function getRoot(bytes32[] memory data) returns(bytes32){
        return tree.getRoot(data);
    }

    function getProof(bytes32[] memory data, uint256 index) returns (bytes32[] memory){
        return tree.getProof(data, index);
    }

    function verify(bytes32 root, bytes32[] proof, bytes32 leaf) returns(bool){
        return tree.verifyProof(root, poof, leaf);

    }



}
