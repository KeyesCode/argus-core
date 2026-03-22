// ERC-4626 Tokenized Vault Standard events

// Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
export const ERC4626_DEPOSIT_TOPIC =
  '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7';

// Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
export const ERC4626_WITHDRAW_TOPIC =
  '0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db';

export const PROTOCOL_NAME = 'ERC4626';

export const ALL_ERC4626_TOPICS = [
  ERC4626_DEPOSIT_TOPIC,
  ERC4626_WITHDRAW_TOPIC,
];
