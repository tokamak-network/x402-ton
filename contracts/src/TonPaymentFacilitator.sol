// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TonPaymentFacilitator is EIP712, ReentrancyGuard {
    bytes32 public constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuth(address from,address to,uint256 amount,uint256 deadline,bytes32 nonce)"
    );

    mapping(bytes32 => bool) public usedNonces;
    mapping(address => uint256) public balances;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event PaymentSettled(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 indexed nonce
    );

    error Expired();
    error NonceUsed();
    error InsufficientBalance();
    error InvalidSignature();
    error TransferFailed();
    error ZeroAmount();

    constructor() EIP712("x402-TON Payment Facilitator", "1") {}

    /// @notice Deposit ETH into the facilitator
    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw deposited ETH
    /// @param amount Wei to withdraw
    function withdraw(uint256 amount) external nonReentrant {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Settle a payment using an EIP-712 signed authorization
    /// @param from Payer who signed the authorization
    /// @param to Payment recipient
    /// @param amount Wei to transfer
    /// @param deadline Unix timestamp after which the authorization expires
    /// @param nonce Unique identifier to prevent replay
    /// @param signature EIP-712 signature from `from`
    function settle(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp > deadline) revert Expired();
        if (usedNonces[nonce]) revert NonceUsed();
        if (balances[from] < amount) revert InsufficientBalance();
        if (amount == 0) revert ZeroAmount();

        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, amount, deadline, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != from) revert InvalidSignature();

        usedNonces[nonce] = true;
        balances[from] -= amount;

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PaymentSettled(from, to, amount, nonce);
    }

    /// @notice Verify whether a payment authorization is valid without executing it
    /// @param from Payer who signed the authorization
    /// @param to Payment recipient
    /// @param amount Wei to transfer
    /// @param deadline Unix timestamp after which the authorization expires
    /// @param nonce Unique identifier to prevent replay
    /// @param signature EIP-712 signature from `from`
    /// @return valid Whether the authorization is valid
    /// @return reason Human-readable reason if invalid
    function verify(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external view returns (bool valid, string memory reason) {
        if (block.timestamp > deadline) return (false, "Expired");
        if (usedNonces[nonce]) return (false, "Nonce used");
        if (balances[from] < amount) return (false, "Insufficient balance");
        if (amount == 0) return (false, "Zero amount");

        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH, from, to, amount, deadline, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != from) return (false, "Invalid signature");

        return (true, "");
    }

    /// @notice Returns the EIP-712 domain separator
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
