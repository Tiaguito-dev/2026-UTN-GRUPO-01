import { Module } from "@nestjs/common";
import { APP_FILTER, HttpAdapterHost } from "@nestjs/core";
import { UnhandledErrorFilter } from "./presentation/unhandled-error.filter.js";

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useFactory: (adapter: HttpAdapterHost) => new UnhandledErrorFilter(adapter),
      inject: [HttpAdapterHost],
    },
  ],
})
export class SharedModule {}
