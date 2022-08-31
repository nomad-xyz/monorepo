// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {MockWeth} from "./utils/MockWeth.sol";
import "forge-std/Test.sol";

// Tests are largely based on ERC20Test from solmate
// Thank you t11s et al.

contract BridgeTokenTest is Test {
    MockWeth token;
    // TODO:
    // - test owner functions
    // - test details functions
    // - test transfer/relinquish ownership functions

    bytes32 constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    function setUp() public {
        token = new MockWeth();
        token.setDetails("FAKE", "FK", 18);
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

    function test_setDetailsHash(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes(name).length,
                name,
                bytes(symbol).length,
                symbol,
                decimals
            )
        );
        token.setDetailsHash(hash);
        vm.expectEmit(true, true, true, false);
        emit UpdateDetails(name, symbol, decimals);
        token.setDetails(name, symbol, decimals);
    }

    function test_setDetailsHashOwner() public {
        bytes32 hash = "hash";
        vm.prank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.setDetailsHash(hash);
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
        token.renounceOwnership();
        uint256 gasAfter = gasleft();
        // hardcoded gas for noop after testing
        assertEq(gasAfter, 9223372036854747154);
    }

    function test_approve() public {
        assertTrue(token.approve(address(0xBEEF), 1e18));
        assertEq(token.allowance(address(this), address(0xBEEF)), 1e18);
    }

    function test_transfer() public {
        token.mint(address(this), 1e18);

        assertTrue(token.transfer(address(0xBEEF), 1e18));
        assertEq(token.totalSupply(), 1e18);

        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18);
    }

    function test_transferFrom() public {
        address from = address(0xABCD);

        token.mint(from, 1e18);

        vm.prank(from);
        token.approve(address(this), 1e18);

        assertTrue(token.transferFrom(from, address(0xBEEF), 1e18));
        assertEq(token.totalSupply(), 1e18);

        assertEq(token.allowance(from, address(this)), 0);

        assertEq(token.balanceOf(from), 0);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18);
    }

    function test_infiniteApproveTransferFrom() public {
        address from = address(0xABCD);

        token.mint(from, 1e18);

        vm.prank(from);
        token.approve(address(this), type(uint256).max);

        assertTrue(token.transferFrom(from, address(0xBEEF), 1e18));
        assertEq(token.totalSupply(), 1e18);

        assertEq(
            token.allowance(from, address(this)),
            type(uint256).max - 1e18
        );

        assertEq(token.balanceOf(from), 0);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18);
    }

    function test_permit() public {
        uint256 privateKey = 0xBEEF;
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            address(0xCAFE),
                            1e18,
                            0,
                            block.timestamp
                        )
                    )
                )
            )
        );

        token.permit(owner, address(0xCAFE), 1e18, block.timestamp, v, r, s);

        assertEq(token.allowance(owner, address(0xCAFE)), 1e18);
        assertEq(token.nonces(owner), 1);
    }

    function test_transferInsufficientBalance() public {
        token.mint(address(this), 0.9e18);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        token.transfer(address(0xBEEF), 1e18);
    }

    function test_transferFromInsufficientAllowance() public {
        address from = address(0xABCD);

        token.mint(from, 1e18);

        vm.prank(from);
        token.approve(address(this), 0.9e18);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        token.transferFrom(from, address(0xBEEF), 1e18);
    }

    function test_transferFromInsufficientBalance() public {
        address from = address(0xABCD);

        token.mint(from, 0.9e18);

        vm.prank(from);
        token.approve(address(this), 1e18);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        token.transferFrom(from, address(0xBEEF), 1e18);
    }

    function test_notPermitBadNonce() public {
        uint256 privateKey = 0xBEEF;
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            address(0xCAFE),
                            1e18,
                            1,
                            block.timestamp
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, address(0xCAFE), 1e18, block.timestamp, v, r, s);
    }

    function test_notPermitBadDeadline() public {
        uint256 privateKey = 0xBEEF;
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            address(0xCAFE),
                            1e18,
                            0,
                            block.timestamp
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(
            owner,
            address(0xCAFE),
            1e18,
            block.timestamp + 1,
            v,
            r,
            s
        );
    }

    function test_notPermitPastDeadline() public {
        uint256 privateKey = 0xBEEF;
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            address(0xCAFE),
                            1e18,
                            0,
                            block.timestamp - 1
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: expired deadline");
        token.permit(
            owner,
            address(0xCAFE),
            1e18,
            block.timestamp - 1,
            v,
            r,
            s
        );
    }

    function test_permitReplay() public {
        uint256 privateKey = 0xBEEF;
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            address(0xCAFE),
                            1e18,
                            0,
                            block.timestamp
                        )
                    )
                )
            )
        );

        token.permit(owner, address(0xCAFE), 1e18, block.timestamp, v, r, s);
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, address(0xCAFE), 1e18, block.timestamp, v, r, s);
    }

    function test_metadata(
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) public {
        MockWeth tkn = new MockWeth();
        tkn.setDetails(name, symbol, decimals);
        assertEq(tkn.name(), name);
        assertEq(tkn.symbol(), symbol);
        assertEq(uint256(tkn.decimals()), uint256(decimals));
    }

    function test_mint(address from, uint256 amount) public {
        vm.assume(from != address(0));
        token.mint(from, amount);

        assertEq(token.totalSupply(), amount);
        assertEq(token.balanceOf(from), amount);
    }

    function test_notBurn(
        address from,
        uint256 mintAmount,
        uint256 burnAmount
    ) public {
        vm.assume(from != address(0));
        vm.assume(burnAmount > mintAmount);

        token.mint(from, mintAmount);
        vm.expectRevert("ERC20: burn amount exceeds balance");
        token.burn(from, burnAmount);
    }

    function test_approve(address to, uint256 amount) public {
        vm.assume(to != address(0));
        assertTrue(token.approve(to, amount));

        assertEq(token.allowance(address(this), to), amount);
    }

    function test_transfer(address from, uint256 amount) public {
        vm.assume(from != address(0));
        token.mint(address(this), amount);

        assertTrue(token.transfer(from, amount));
        assertEq(token.totalSupply(), amount);

        if (address(this) == from) {
            assertEq(token.balanceOf(address(this)), amount);
        } else {
            assertEq(token.balanceOf(address(this)), 0);
            assertEq(token.balanceOf(from), amount);
        }
    }

    function test_transferFrom(
        address to,
        uint256 approval,
        uint256 amount
    ) public {
        vm.assume(to != address(0));
        vm.assume(approval > amount);

        address from = address(0xABCD);

        token.mint(from, amount);

        vm.prank(from);
        token.approve(address(this), approval);
        assertTrue(token.transferFrom(from, to, amount));
        assertEq(token.totalSupply(), amount);

        assertEq(token.allowance(from, address(this)), approval - amount);

        if (from == to) {
            assertEq(token.balanceOf(from), amount);
        } else {
            assertEq(token.balanceOf(from), 0);
            assertEq(token.balanceOf(to), amount);
        }
    }

    function test_permit(
        uint248 privKey,
        address to,
        uint256 amount,
        uint256 deadline
    ) public {
        vm.assume(to != address(0));
        vm.assume(deadline > block.timestamp);
        vm.assume(privKey > 0);
        uint256 privateKey = privKey;

        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            to,
                            amount,
                            0,
                            deadline
                        )
                    )
                )
            )
        );

        token.permit(owner, to, amount, deadline, v, r, s);

        assertEq(token.allowance(owner, to), amount);
        assertEq(token.nonces(owner), 1);
    }

    function test_notBurnInsufficientBalance(
        address to,
        uint256 mintAmount,
        uint256 burnAmount
    ) public {
        vm.assume(to != address(0));
        vm.assume(burnAmount > mintAmount);
        token.mint(to, mintAmount);
        vm.expectRevert("ERC20: burn amount exceeds balance");
        token.burn(to, burnAmount);
    }

    function test_notTansferInsufficientBalance(
        address to,
        uint256 mintAmount,
        uint256 sendAmount
    ) public {
        vm.assume(to != address(0));
        vm.assume(sendAmount > mintAmount);

        token.mint(address(this), mintAmount);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        token.transfer(to, sendAmount);
    }

    function test_notTransferFromInsufficientAllowance(
        address to,
        uint256 approval,
        uint256 amount
    ) public {
        vm.assume(to != address(0));
        vm.assume(amount > approval);

        address from = address(0xABCD);

        token.mint(from, amount);

        vm.prank(from);
        token.approve(address(this), approval);

        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        token.transferFrom(from, to, amount);
    }

    function test_notTransferFromInsufficientBalance(
        address to,
        uint256 mintAmount,
        uint256 sendAmount
    ) public {
        vm.assume(to != address(0));
        vm.assume(sendAmount > mintAmount);

        address from = address(0xABCD);

        token.mint(from, mintAmount);

        vm.prank(from);
        token.approve(address(this), sendAmount);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        token.transferFrom(from, to, sendAmount);
    }

    function test_notPermitBadNonce(
        uint256 privateKey,
        address to,
        uint256 amount,
        uint256 deadline,
        uint256 nonce
    ) public {
        vm.assume(deadline > block.timestamp);
        vm.assume(
            privateKey != 0 &&
                privateKey <
                115792089237316195423570985008687907852837564279074904382605163141518161494337
        );
        vm.assume(nonce != 0);

        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            to,
                            amount,
                            nonce,
                            deadline
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, to, amount, deadline, v, r, s);
    }

    function test_notPermitBadDeadline(
        uint256 privateKey,
        address to,
        uint256 amount,
        uint256 deadline
    ) public {
        vm.assume(deadline > block.timestamp && deadline < type(uint256).max);
        vm.assume(
            privateKey != 0 &&
                privateKey <
                115792089237316195423570985008687907852837564279074904382605163141518161494337
        );
        vm.assume(to != address(0));
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            to,
                            amount,
                            0,
                            deadline
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, to, amount, deadline + 1, v, r, s);
    }

    function test_notPermitPastDeadline(
        uint256 privateKey,
        address to,
        uint256 amount,
        uint256 deadline
    ) public {
        vm.assume(deadline < block.timestamp);
        vm.assume(
            privateKey != 0 &&
                privateKey <
                115792089237316195423570985008687907852837564279074904382605163141518161494337
        );
        vm.assume(to != address(0));
        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            to,
                            amount,
                            0,
                            deadline
                        )
                    )
                )
            )
        );
        vm.expectRevert("ERC20Permit: expired deadline");
        token.permit(owner, to, amount, deadline, v, r, s);
    }

    function test_notPermitReplay(
        uint256 privateKey,
        address to,
        uint256 amount,
        uint256 deadline
    ) public {
        vm.assume(to != address(0));
        vm.assume(deadline > block.timestamp);
        vm.assume(
            privateKey != 0 &&
                privateKey <
                115792089237316195423570985008687907852837564279074904382605163141518161494337
        );

        address owner = vm.addr(privateKey);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.domainSeparator(),
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            to,
                            amount,
                            0,
                            deadline
                        )
                    )
                )
            )
        );

        token.permit(owner, to, amount, deadline, v, r, s);
        vm.expectRevert("ERC20Permit: invalid signature");
        token.permit(owner, to, amount, deadline, v, r, s);
    }
}
