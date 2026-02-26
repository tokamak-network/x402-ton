export const FACILITATOR_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verify",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [
      { name: "valid", type: "bool" },
      { name: "reason", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balances",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usedNonces",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "domainSeparator",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PAYMENT_AUTH_TYPEHASH",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaymentSettled",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "error",
    name: "Expired",
    inputs: [],
  },
  {
    type: "error",
    name: "NonceUsed",
    inputs: [],
  },
  {
    type: "error",
    name: "InsufficientBalance",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAmount",
    inputs: [],
  },
  { type: "receive", stateMutability: "payable" },
] as const;

const USER_OP_COMPONENTS = [
  { name: "sender", type: "address" },
  { name: "nonce", type: "uint256" },
  { name: "initCode", type: "bytes" },
  { name: "callData", type: "bytes" },
  { name: "callGasLimit", type: "uint256" },
  { name: "verificationGasLimit", type: "uint256" },
  { name: "preVerificationGas", type: "uint256" },
  { name: "maxFeePerGas", type: "uint256" },
  { name: "maxPriorityFeePerGas", type: "uint256" },
  { name: "paymasterAndData", type: "bytes" },
  { name: "signature", type: "bytes" },
] as const;

export const ENTRY_POINT_ABI = [
  {
    type: "function",
    name: "getNonce",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserOpHash",
    inputs: [{ name: "userOp", type: "tuple", components: USER_OP_COMPONENTS }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "handleOps",
    inputs: [
      { name: "ops", type: "tuple[]", components: USER_OP_COMPONENTS },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "depositTo",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

export const STEALTH_ACCOUNT_FACTORY_ABI = [
  {
    type: "function",
    name: "createAccount",
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_salt", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAddress",
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_salt", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const STEALTH_ACCOUNT_ABI = [
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
