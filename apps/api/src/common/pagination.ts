export function parsePagination(
  limit?: string,
  offset?: string,
): { take: number; skip: number } {
  return {
    take: Math.min(Number(limit ?? 25), 100),
    skip: Number(offset ?? 0),
  };
}
