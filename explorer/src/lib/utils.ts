export function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

export function formatWei(wei: string): string {
  const value = BigInt(wei);
  const eth = Number(value) / 1e18;
  if (eth === 0) return '0 ETH';
  if (eth < 0.0001) return '< 0.0001 ETH';
  return `${eth.toFixed(4)} ETH`;
}

export function formatNumber(n: number | string): string {
  return Number(n).toLocaleString();
}

export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
