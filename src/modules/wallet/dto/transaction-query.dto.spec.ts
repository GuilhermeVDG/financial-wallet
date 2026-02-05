import { plainToInstance } from 'class-transformer';
import { TransactionQueryDto } from './transaction-query.dto';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';

describe('TransactionQueryDto', () => {
  it('should have default page=1 and limit=20', () => {
    const dto = new TransactionQueryDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.type).toBeUndefined();
  });

  it('should transform string values to numbers via @Type', () => {
    const dto = plainToInstance(TransactionQueryDto, {
      page: '3',
      limit: '50',
    });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('should preserve type enum when provided', () => {
    const dto = plainToInstance(TransactionQueryDto, {
      type: TransactionType.DEPOSIT,
    });

    expect(dto.type).toBe(TransactionType.DEPOSIT);
  });
});
