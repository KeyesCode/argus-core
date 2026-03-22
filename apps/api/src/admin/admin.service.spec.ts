import { AdminService } from './admin.service';
import { BackfillJobStatus } from '@app/db/entities/backfill-job.entity';

describe('AdminService — backfill job state transitions', () => {
  let service: AdminService;
  let mockJobRepo: any;

  const makeRepo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((data: any) => ({ id: 1, ...data })),
    save: jest.fn((data: any) => Promise.resolve({ id: 1, ...data })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  });

  beforeEach(() => {
    mockJobRepo = makeRepo();
    const mockRepo = makeRepo();

    service = new AdminService(
      mockRepo as any, // checkpointRepo
      mockJobRepo as any, // jobRepo
      mockRepo as any, // blockRepo
      mockRepo as any, // txRepo
      mockRepo as any, // logRepo
      mockRepo as any, // transferRepo
      mockRepo as any, // reorgRepo
    );
  });

  it('should create a job with PENDING status', async () => {
    const result = await service.createBackfillJob(100, 200, 10);

    expect(mockJobRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: '100',
        toBlock: '200',
        currentBlock: '100',
        batchSize: 10,
        status: BackfillJobStatus.PENDING,
      }),
    );
    expect(mockJobRepo.save).toHaveBeenCalled();
    expect(result.status).toBe(BackfillJobStatus.PENDING);
  });

  it('should default batch size to 250', async () => {
    await service.createBackfillJob(100, 200);

    expect(mockJobRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ batchSize: 250 }),
    );
  });

  it('should pause a job with PAUSED status', async () => {
    const result = await service.pauseJob(1);

    expect(mockJobRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: BackfillJobStatus.PAUSED }),
    );
    expect(result.message).toContain('paused');
  });

  it('should resume a job with PENDING status', async () => {
    const result = await service.resumeJob(1);

    expect(mockJobRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: BackfillJobStatus.PENDING }),
    );
    expect(result.message).toContain('resumed');
  });

  it('should store block numbers as strings', async () => {
    await service.createBackfillJob(22711828, 22711928);

    expect(mockJobRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: '22711828',
        toBlock: '22711928',
        currentBlock: '22711828',
      }),
    );
  });
});
