// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract MockImpl {
    bool public fires;

    event Quote(string what);

    function gondor() public {
        fires = true;
        emit Quote("The fires are lit! The fires of Amon din are lit");
    }

    function roahan() public {
        if (fires) {
            emit Quote("An Rohan will answer. Master the Rohirim");
        }
    }

    function witchKing(bool female) public {
        require(female, "No man can kill me");
        emit Quote("I am no man");
    }
}
