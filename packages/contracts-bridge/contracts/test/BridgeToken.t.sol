// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {MockWeth} from "./utils/MockWeth.sol";
import "forge-std/Test.sol";

contract BridgeTokenTest is Test {
    MockWeth token;

    bytes32 constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    function setUp() public {
        token = new MockWeth();
        token.initialize();
    }

    function test_mint() public {
        token.mint(address(0xBEEF), 1e18);
        assertEq(token.totalSupply(), 1e18);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18);
    }

    function test_mintOnlyOwner() public {
        token.mint(address(0xBEEF), 1e18);
        vm.startPrank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.mint(address(0xBEEF), 1e18);
        vm.stopPrank();
    }

    function test_burn() public {
        token.mint(address(0xBEEF), 1e18);
        token.burn(address(0xBEEF), 0.9e18);

        assertEq(token.totalSupply(), 1e18 - 0.9e18);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18 - 0.9e18);
    }

    function test_burnOnlyOwner() public {
        token.mint(address(0xBEEF), 1e18);
        vm.startPrank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.burn(address(0xBEEF), 0.9e18);
        vm.stopPrank();
    }

    event UpdateDetails(
        string indexed name,
        string indexed symbol,
        uint8 indexed decimals
    );

    function test_setDetailsHashAndSetDetails(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public {
        vm.assume(
            decimals != 0 ||
                bytes(symbol).length != 0 ||
                bytes(name).length != 0
        );
        bytes32 h = keccak256(
            abi.encodePacked(
                bytes(name).length,
                name,
                bytes(symbol).length,
                symbol,
                decimals
            )
        );
        // set initial details
        token.setDetails("a", "b", 33);
        require(keccak256(bytes(token.name())) == keccak256(bytes("a")));
        require(keccak256(bytes(token.symbol())) == keccak256(bytes("b")));
        require(token.decimals() == 33);
        // test event emission on second details
        token.setDetailsHash(h);
        vm.expectEmit(true, true, true, false);
        emit UpdateDetails(name, symbol, decimals);
        token.setDetails(name, symbol, decimals);
        require(keccak256(bytes(token.name())) == keccak256(bytes(name)));
        require(keccak256(bytes(token.symbol())) == keccak256(bytes(symbol)));
        require(token.decimals() == decimals);
    }

    function test_setDailtsFailSecondTime() public {
        token.setDetails("", "", 1);
        string memory name = "Numenor";
        string memory symbol = "NM";
        uint8 decimals = 19;
        vm.expectRevert("!committed details");
        token.setDetails(name, symbol, decimals);
    }

    function test_setDetailsHashOwner() public {
        bytes32 h = "hash";
        vm.prank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.setDetailsHash(h);
    }

    function test_domainSeperator() public {
        uint256 _chainId;
        assembly {
            _chainId := chainid()
        }
        bytes32 sep = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(token.name())),
                keccak256(bytes("1")),
                _chainId,
                address(token)
            )
        );
        assertEq(sep, token.domainSeparator());
    }

    function test_permitSuccess() public {
        uint256 key = 123;
        address owner = vm.addr(key);
        address toPermit = address(0xBEEF);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            key,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            toPermit,
                            1e18,
                            0,
                            block.timestamp
                        )
                    )
                )
            )
        );
        token.permit(owner, toPermit, 1e18, block.timestamp, v, r, s);
        assertEq(token.allowance(owner, toPermit), uint256(1e18));
        assertEq(token.nonces(owner), uint256(1));
    }

    function test_permitRevertsBadNonce() public {
        uint256 key = 123;
        address owner = vm.addr(key);
        address toPermit = address(0xBEEF);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            key,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            toPermit,
                            1e18,
                            1,
                            block.timestamp
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, toPermit, 1e18, block.timestamp, v, r, s);
    }

    function test_permitRevertsBadDeadline() public {
        uint256 key = 123;
        address owner = vm.addr(key);
        address toPermit = address(0xBEEF);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            key,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            toPermit,
                            1e18,
                            0,
                            block.timestamp
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, toPermit, 1e18, block.timestamp + 1, v, r, s);
    }

    function test_permitRevertsPastDeadline() public {
        uint256 key = 123;
        address owner = vm.addr(key);
        address toPermit = address(0xBEEF);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            key,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            toPermit,
                            1e18,
                            0,
                            block.timestamp - 1
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: expired deadline");
        token.permit(owner, toPermit, 1e18, block.timestamp - 1, v, r, s);
    }

    function test_permitRevertsOnReplay() public {
        uint256 key = 123;
        address owner = vm.addr(key);
        address toPermit = address(0xBEEF);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            key,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            toPermit,
                            1e18,
                            0,
                            block.timestamp
                        )
                    )
                )
            )
        );
        token.permit(owner, toPermit, 1e18, block.timestamp, v, r, s);
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, toPermit, 1e18, block.timestamp, v, r, s);
    }

    function test_transferOwnership() public {
        address newOwner = address(0xBEEF);
        token.transferOwnership(newOwner);
        assertEq(token.owner(), newOwner);
    }

    function test_transferOwnershipOnlyOwner() public {
        address newOwner = address(0xBEEF);
        vm.startPrank(newOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        token.transferOwnership(newOwner);
        vm.stopPrank();
    }

    function test_renounceOwnershipNoOp() public {
        address userA = token.owner();
        token.renounceOwnership();
        assertEq(token.owner(), userA);
    }
}
