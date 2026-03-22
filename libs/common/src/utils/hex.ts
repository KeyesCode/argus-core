export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function normalizeHash(hash: string): string {
  return hash.toLowerCase();
}

export function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}
