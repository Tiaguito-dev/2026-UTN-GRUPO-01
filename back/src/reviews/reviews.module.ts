import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { SharedModule } from "../shared/shared.module.js";
import { FeedbackService } from "./application/feedback.service.js";
import { FEEDBACK_REPOSITORY, type FeedbackRepository } from "./application/ports/feedback.repository.js";
import { PrismaFeedbackRepository } from "./infrastructure/prisma-feedback.repository.js";
import { ReviewsController } from "./reviews.controller.js";
import { FeedbackFeedService } from "./application/feedback-feed.service.js";
import { FEEDBACK_FEED_REPOSITORY, type FeedbackFeedRepository } from "./application/ports/feedback-feed.repository.js";
import { PrismaFeedbackFeedRepository } from "./infrastructure/prisma-feedback-feed.repository.js";
import { FeedbackLikeService } from "./application/feedback-like.service.js";
import { FEEDBACK_LIKE_REPOSITORY, type FeedbackLikeRepository } from "./application/ports/feedback-like.repository.js";
import { PrismaFeedbackLikeRepository } from "./infrastructure/prisma-feedback-like.repository.js";

@Module({
  imports: [AuthModule, PrismaModule, SharedModule],
  controllers: [ReviewsController],
  providers: [
    { provide: FEEDBACK_LIKE_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaFeedbackLikeRepository(prisma), inject: [PrismaService] },
    { provide: FeedbackLikeService, useFactory: (repository: FeedbackLikeRepository) => new FeedbackLikeService(repository), inject: [FEEDBACK_LIKE_REPOSITORY] },
    { provide: FEEDBACK_FEED_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaFeedbackFeedRepository(prisma), inject: [PrismaService] },
    { provide: FeedbackFeedService, useFactory: (repository: FeedbackFeedRepository) => new FeedbackFeedService(repository), inject: [FEEDBACK_FEED_REPOSITORY] },
    { provide: FEEDBACK_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaFeedbackRepository(prisma), inject: [PrismaService] },
    { provide: FeedbackService, useFactory: (repository: FeedbackRepository) => new FeedbackService(repository), inject: [FEEDBACK_REPOSITORY] },
  ],
})
export class ReviewsModule {}
