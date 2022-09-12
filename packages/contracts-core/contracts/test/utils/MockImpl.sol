// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract MockImpl {
    bool public fires;

    event Quote(string what);

    function gondor() public {
        fires = true;
        emit Quote("The fires are lit! The fires of Amon Din are lit");
    }

    function witchKing(bool female) public {
        require(female, "No man can kill me");
        emit Quote("I am no man");
    }

    function fallback() external payable {
        emit Quote("Abandon your posts. Run, run for your lives");
    }

    function receive() external payable {
        emit Quote("Nine were given to the kings of men whose heart above all desire Power");
    }
}
