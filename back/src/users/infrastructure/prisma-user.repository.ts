import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { normalizeEmail } from "../domain/email.js";
import { EmailAlreadyRegisteredError } from "../domain/errors.js";
import type { CreateUserInput, UserRepository } from "../domain/user.repository.js";
import type { PublicUser, User } from "../domain/user.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: { ...input, email: normalizeEmail(input.email) },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }
}
