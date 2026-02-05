import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToClass(metatype, value);
    const errors = await validate(object, { skipNullProperties: true });
    if (errors && errors.length > 0) {
      const translatedError = await this.transformError(errors);
      throw new UnprocessableEntityException(translatedError);
    }
    return value;
  }

  async transformError(errors: ValidationError[]) {
    const result = [];
    for (const error of errors) {
      if (error.children && error.children.length > 0) {
        result.push(...(await this.transformError(error.children)));
      } else {
        result.push({
          property: error.property,
          constraints: error.constraints,
        });
      }
    }
    return result;
  }

  private toValidate(metatype: unknown): boolean {
    const types: unknown[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
