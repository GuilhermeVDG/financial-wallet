import { ArgumentMetadata, UnprocessableEntityException } from '@nestjs/common';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomValidationPipe } from './custom-validation.pipe';

class TestDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

class ChildDto {
  @IsNotEmpty()
  @IsString()
  value: string;
}

class ParentDto {
  @ValidateNested()
  @Type(() => ChildDto)
  child: ChildDto;
}

describe('CustomValidationPipe', () => {
  let pipe: CustomValidationPipe;

  beforeEach(() => {
    pipe = new CustomValidationPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should return value when no metatype is provided', async () => {
    const metadata: ArgumentMetadata = { type: 'body' };
    const result = await pipe.transform('test', metadata);
    expect(result).toBe('test');
  });

  it('should return value for primitive metatypes (String, Number, etc.)', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: String };
    const result = await pipe.transform('test', metadata);
    expect(result).toBe('test');
  });

  it('should return value for Boolean metatype', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: Boolean };
    const result = await pipe.transform(true, metadata);
    expect(result).toBe(true);
  });

  it('should return value for Number metatype', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: Number };
    const result = await pipe.transform(42, metadata);
    expect(result).toBe(42);
  });

  it('should return value for Array metatype', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: Array };
    const value = [1, 2, 3];
    const result = await pipe.transform(value, metadata);
    expect(result).toBe(value);
  });

  it('should return value for Object metatype', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: Object };
    const value = { key: 'val' };
    const result = await pipe.transform(value, metadata);
    expect(result).toBe(value);
  });

  it('should return value when validation passes', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
    const value = { name: 'valid' };
    const result = await pipe.transform(value, metadata);
    expect(result).toEqual(value);
  });

  it('should throw UnprocessableEntityException when validation fails', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
    const value = { name: '' };

    await expect(pipe.transform(value, metadata)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('should format errors with property and constraints', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto };
    const value = { name: '' };

    try {
      await pipe.transform(value, metadata);
      fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      const response = (error as UnprocessableEntityException).getResponse();
      expect((response as any).message).toEqual(
        expect.arrayContaining([expect.objectContaining({ property: 'name' })]),
      );
    }
  });

  it('should handle nested validation errors recursively', async () => {
    const metadata: ArgumentMetadata = { type: 'body', metatype: ParentDto };
    const value = { child: { value: '' } };

    try {
      await pipe.transform(value, metadata);
      fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      const response = (error as UnprocessableEntityException).getResponse();
      expect((response as any).message).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'value' }),
        ]),
      );
    }
  });
});
