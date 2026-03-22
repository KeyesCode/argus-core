import { SearchService } from './search.service';

describe('SearchService — query classification', () => {
  let service: SearchService;

  // Create service with mock repos that always return null
  const mockRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(
      mockRepo as any, // blockRepo
      mockRepo as any, // txRepo
      mockRepo as any, // tokenRepo
    );
  });

  it('should classify 66-char hex string as tx hash lookup', async () => {
    const hash = '0x' + 'a'.repeat(64);
    await service.search(hash);

    // Should try tx lookup first
    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { hash: hash.toLowerCase() } });
  });

  it('should fall through to block hash when tx not found', async () => {
    const hash = '0x' + 'b'.repeat(64);
    await service.search(hash);

    // Called twice: once for tx, once for block
    expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { hash: hash.toLowerCase() } });
  });

  it('should classify 42-char hex string as address lookup', async () => {
    const addr = '0x' + 'c'.repeat(40);
    await service.search(addr);

    // Should try token first, then address tx lookup
    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { address: addr.toLowerCase() } });
  });

  it('should classify pure digits as block number lookup', async () => {
    await service.search('12345');

    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { number: '12345' } });
  });

  it('should not try block number for hex strings', async () => {
    await service.search('0xabc');

    // 0xabc is only 5 chars, not 42 or 66, and starts with 0x
    // so it should fall through to none without block number lookup
    const calls = mockRepo.findOne.mock.calls;
    const blockNumberCall = calls.find(
      (c: any) => c[0]?.where?.number !== undefined,
    );
    expect(blockNumberCall).toBeUndefined();
  });

  it('should return none for empty-ish input', async () => {
    const result = await service.search('   something_random   ');

    expect(result.type).toBe('none');
    expect(result.result).toBeNull();
  });

  it('should lowercase input before querying', async () => {
    const addr = '0x' + 'A'.repeat(40);
    await service.search(addr);

    const calls = mockRepo.findOne.mock.calls;
    for (const call of calls) {
      const where = call[0]?.where;
      if (where?.address) {
        expect(where.address).toBe(addr.toLowerCase());
      }
    }
  });

  it('should return found tx when match exists', async () => {
    const fakeTx = { hash: '0x' + 'a'.repeat(64), blockNumber: '1' };
    const txRepo = {
      findOne: jest.fn().mockResolvedValue(fakeTx),
    };
    const svc = new SearchService(mockRepo as any, txRepo as any, mockRepo as any);

    const result = await svc.search('0x' + 'a'.repeat(64));

    expect(result.type).toBe('transaction');
    expect(result.result).toBe(fakeTx);
  });
});
