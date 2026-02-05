import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { IS_DISABLED_TIMEOUT } from '../decorators/disable-timeout.decorator';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutValue: number;

  constructor(
    private configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.timeoutValue = Number(this.configService.get('TIMEOUT', 5000));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isDisabledTimeout = this.reflector.getAllAndOverride<boolean>(
      IS_DISABLED_TIMEOUT,
      [context.getHandler(), context.getClass()],
    );

    if (isDisabledTimeout) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(this.timeoutValue),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `A operacao excedeu o tempo limite de ${this.timeoutValue}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
