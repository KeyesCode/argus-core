import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationQueryDto, LimitQueryDto } from './pagination';

describe('PaginationQueryDto', () => {
  it('should use defaults when no values provided', async () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(0);
  });

  it('should accept valid limit and offset', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 50, offset: 10 });
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(10);
  });

  it('should transform string values to numbers', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: '30', offset: '5' });
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(30);
    expect(dto.offset).toBe(5);
  });

  it('should reject limit above 100', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 200 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('should reject limit below 1', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 0 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('should reject negative offset', async () => {
    const dto = plainToInstance(PaginationQueryDto, { offset: -1 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('offset');
  });
});

describe('LimitQueryDto', () => {
  it('should default to 25', async () => {
    const dto = plainToInstance(LimitQueryDto, {});
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(25);
  });

  it('should reject limit above 100', async () => {
    const dto = plainToInstance(LimitQueryDto, { limit: 101 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
