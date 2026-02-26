// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {TonPaymentFacilitator} from "../src/TonPaymentFacilitator.sol";

contract ReentrantReceiver {
    TonPaymentFacilitator public target;
    bool public attacked;

    constructor(TonPaymentFacilitator _target) {
        target = _target;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            target.withdraw(msg.value);
        }
    }
}

contract TonPaymentFacilitatorTest is Test {
    TonPaymentFacilitator public facilitator;

    uint256 internal signerKey;
    address internal signer;
    address internal recipient;

    bytes32 internal constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuth(address from,address to,uint256 amount,uint256 deadline,bytes32 nonce)"
    );

    function setUp() public {
        facilitator = new TonPaymentFacilitator();
        signerKey = 0xA11CE;
        signer = vm.addr(signerKey);
        recipient = makeAddr("recipient");
        vm.deal(signer, 100 ether);
    }

    function _sign(
        uint256 pk,
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, amount, deadline, nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            facilitator.domainSeparator(),
            structHash
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ─── Deposit ─────────────────────────────────────────────

    function test_deposit() public {
        vm.prank(signer);
        facilitator.deposit{value: 1 ether}();
        assertEq(facilitator.balances(signer), 1 ether);
    }

    function test_deposit_via_receive() public {
        vm.prank(signer);
        (bool ok, ) = address(facilitator).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(facilitator.balances(signer), 1 ether);
    }

    function test_deposit_reverts_zero() public {
        vm.prank(signer);
        vm.expectRevert(TonPaymentFacilitator.ZeroAmount.selector);
        facilitator.deposit{value: 0}();
    }

    function test_deposit_multiple() public {
        vm.startPrank(signer);
        facilitator.deposit{value: 1 ether}();
        facilitator.deposit{value: 2 ether}();
        vm.stopPrank();
        assertEq(facilitator.balances(signer), 3 ether);
    }

    // ─── Withdraw ────────────────────────────────────────────

    function test_withdraw() public {
        vm.startPrank(signer);
        facilitator.deposit{value: 5 ether}();
        uint256 balBefore = signer.balance;
        facilitator.withdraw(2 ether);
        vm.stopPrank();
        assertEq(facilitator.balances(signer), 3 ether);
        assertEq(signer.balance, balBefore + 2 ether);
    }

    function test_withdraw_insufficient() public {
        vm.startPrank(signer);
        facilitator.deposit{value: 1 ether}();
        vm.expectRevert(TonPaymentFacilitator.InsufficientBalance.selector);
        facilitator.withdraw(2 ether);
        vm.stopPrank();
    }

    // ─── Settle ──────────────────────────────────────────────

    function test_settle_happy_path() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce1");
        uint256 amount = 2 ether;

        bytes memory sig = _sign(signerKey, signer, recipient, amount, deadline, nonce);

        uint256 recipientBalBefore = recipient.balance;
        facilitator.settle(signer, recipient, amount, deadline, nonce, sig);

        assertEq(facilitator.balances(signer), 3 ether);
        assertEq(recipient.balance, recipientBalBefore + amount);
        assertTrue(facilitator.usedNonces(nonce));
    }

    function test_settle_expired() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp - 1;
        bytes32 nonce = keccak256("nonce_expired");
        bytes memory sig = _sign(signerKey, signer, recipient, 1 ether, deadline, nonce);

        vm.expectRevert(TonPaymentFacilitator.Expired.selector);
        facilitator.settle(signer, recipient, 1 ether, deadline, nonce, sig);
    }

    function test_settle_replay() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_replay");
        bytes memory sig = _sign(signerKey, signer, recipient, 1 ether, deadline, nonce);

        facilitator.settle(signer, recipient, 1 ether, deadline, nonce, sig);

        vm.expectRevert(TonPaymentFacilitator.NonceUsed.selector);
        facilitator.settle(signer, recipient, 1 ether, deadline, nonce, sig);
    }

    function test_settle_insufficient_balance() public {
        vm.prank(signer);
        facilitator.deposit{value: 1 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_insuf");
        bytes memory sig = _sign(signerKey, signer, recipient, 5 ether, deadline, nonce);

        vm.expectRevert(TonPaymentFacilitator.InsufficientBalance.selector);
        facilitator.settle(signer, recipient, 5 ether, deadline, nonce, sig);
    }

    function test_settle_wrong_signer() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 wrongKey = 0xBEEF;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_wrong");
        bytes memory sig = _sign(wrongKey, signer, recipient, 1 ether, deadline, nonce);

        vm.expectRevert(TonPaymentFacilitator.InvalidSignature.selector);
        facilitator.settle(signer, recipient, 1 ether, deadline, nonce, sig);
    }

    function test_settle_zero_amount() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_zero");
        bytes memory sig = _sign(signerKey, signer, recipient, 0, deadline, nonce);

        vm.expectRevert(TonPaymentFacilitator.ZeroAmount.selector);
        facilitator.settle(signer, recipient, 0, deadline, nonce, sig);
    }

    // ─── Verify ──────────────────────────────────────────────

    function test_verify_valid() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_verify");
        bytes memory sig = _sign(signerKey, signer, recipient, 1 ether, deadline, nonce);

        (bool valid, string memory reason) = facilitator.verify(
            signer, recipient, 1 ether, deadline, nonce, sig
        );
        assertTrue(valid);
        assertEq(reason, "");
    }

    function test_verify_expired() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp - 1;
        bytes32 nonce = keccak256("nonce_vexp");
        bytes memory sig = _sign(signerKey, signer, recipient, 1 ether, deadline, nonce);

        (bool valid, string memory reason) = facilitator.verify(
            signer, recipient, 1 ether, deadline, nonce, sig
        );
        assertFalse(valid);
        assertEq(reason, "Expired");
    }

    function test_verify_used_nonce() public {
        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_vused");
        bytes memory sig = _sign(signerKey, signer, recipient, 1 ether, deadline, nonce);

        facilitator.settle(signer, recipient, 1 ether, deadline, nonce, sig);

        (bool valid, string memory reason) = facilitator.verify(
            signer, recipient, 1 ether, deadline, nonce, sig
        );
        assertFalse(valid);
        assertEq(reason, "Nonce used");
    }

    function test_verify_insufficient() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_vinsuf");
        bytes memory sig = _sign(signerKey, signer, recipient, 1 ether, deadline, nonce);

        (bool valid, string memory reason) = facilitator.verify(
            signer, recipient, 1 ether, deadline, nonce, sig
        );
        assertFalse(valid);
        assertEq(reason, "Insufficient balance");
    }

    // ─── Reentrancy ──────────────────────────────────────────

    function test_settle_reentrancy() public {
        ReentrantReceiver attacker = new ReentrantReceiver(facilitator);

        vm.prank(signer);
        facilitator.deposit{value: 5 ether}();

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce_reentrant");
        uint256 amount = 2 ether;
        bytes memory sig = _sign(signerKey, signer, address(attacker), amount, deadline, nonce);

        // Settle sends ETH to attacker, which tries to re-enter withdraw.
        // ReentrancyGuard should prevent the reentrant call.
        vm.expectRevert();
        facilitator.settle(signer, address(attacker), amount, deadline, nonce, sig);
    }

    // ─── Fuzz ────────────────────────────────────────────────

    function testFuzz_deposit_withdraw(uint96 depositAmt, uint96 withdrawAmt) public {
        vm.assume(depositAmt > 0);
        vm.assume(withdrawAmt > 0);
        vm.assume(withdrawAmt <= depositAmt);

        vm.deal(signer, uint256(depositAmt));
        vm.startPrank(signer);
        facilitator.deposit{value: depositAmt}();
        assertEq(facilitator.balances(signer), depositAmt);

        facilitator.withdraw(withdrawAmt);
        assertEq(facilitator.balances(signer), uint256(depositAmt) - uint256(withdrawAmt));
        vm.stopPrank();
    }
}
