import { BadRequestException, Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { InvalidRegistrationInputError } from "./domain/errors.js";
import { InvalidLoginInputError } from "./domain/auth-errors.js";
import { InvalidPasswordInputError, InvalidPasswordResetTokenError, InvalidPasswordChangeError } from "./domain/password-errors.js";

// Body-parser can include submitted text in errors before the controller runs.
@Catch(BadRequestException)
export class RegistrationBadRequestFilter implements ExceptionFilter<BadRequestException> {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    // The HTTP adapter is installed after provider creation in testing contexts.
    const defaultFilter = new BaseExceptionFilter(this.adapterHost.httpAdapter);
    const request = host.switchToHttp().getRequest<{ method: string; url: string }>();
    const path = request.url.split("?")[0];
    if (/^\/auth(?:\/|$)/i.test(path)) {
      this.adapterHost.httpAdapter.setHeader(host.switchToHttp().getResponse(), "Cache-Control", "no-store");
    }
    if (request.method === "POST" && /^\/auth\/(?:register|login|refresh|logout|forgot-password|reset-password|change-password)\/?$/i.test(path)
      && !(exception.cause instanceof InvalidRegistrationInputError)
      && !(exception.cause instanceof InvalidLoginInputError)
      && !(exception.cause instanceof InvalidPasswordInputError)
      && !(exception.cause instanceof InvalidPasswordResetTokenError)
      && !(exception.cause instanceof InvalidPasswordChangeError)) {
      defaultFilter.catch(new BadRequestException("La petición es inválida. Revise el formato JSON e intente nuevamente."), host);
      return;
    }
    defaultFilter.catch(exception, host);
  }
}
