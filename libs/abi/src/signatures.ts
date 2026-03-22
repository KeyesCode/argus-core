// keccak256("Transfer(address,address,uint256)")
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// keccak256("Approval(address,address,uint256)")
export const ERC20_APPROVAL_TOPIC =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

// keccak256("Transfer(address,address,uint256)") — same sig for ERC-721
export const ERC721_TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;

// keccak256("TransferSingle(address,address,address,uint256,uint256)")
export const ERC1155_TRANSFER_SINGLE_TOPIC =
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

// keccak256("TransferBatch(address,address,address,uint256[],uint256[])")
export const ERC1155_TRANSFER_BATCH_TOPIC =
  '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
