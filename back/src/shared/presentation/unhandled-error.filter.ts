import { STATUS_CODES } from "node:http";
import { BadRequestException, Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { DomainError } from "../domain/domain-error.js";
import { RegistrationBadRequestFilter } from "../../auth/registration-bad-request.filter.js";

function bodyFor(statusCode: number, message: string): { statusCode: number; message: string; error: string } {
  return { statusCode, message, error: STATUS_CODES[statusCode] ?? "Error" };
}

@Catch()
export class UnhandledErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger("UnhandledError");

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const defaultFilter = new BaseExceptionFilter(this.adapterHost.httpAdapter);

    if (exception instanceof DomainError) {
      defaultFilter.catch(new HttpException(bodyFor(exception.httpStatus, exception.message), exception.httpStatus), host);
      return;
    }
    if (exception instanceof BadRequestException) {
      new RegistrationBadRequestFilter(this.adapterHost).catch(exception, host);
      return;
    }
    if (exception instanceof HttpException) {
      defaultFilter.catch(exception, host);
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : exception);
    defaultFilter.catch(new HttpException(bodyFor(500, "Internal server error"), 500), host);
  }
}
