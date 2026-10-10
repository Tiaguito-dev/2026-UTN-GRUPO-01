import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { normalizeEmail } from "../domain/email.js";
import { EmailAlreadyRegisteredError } from "../domain/errors.js";
import type { CreateUserInput, UserRepository } from "../domain/user.repository.js";
import type { PublicUser, User } from "../domain/user.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";

// Proyección explícita: passwordHash nunca sale del repositorio en lecturas públicas.
const PUBLIC_FIELDS = { id: true, email: true, displayName: true, role: true, createdAt: true } as const;

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination): Promise<PaginatedResult<PublicUser>> {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        select: PUBLIC_FIELDS,
        orderBy: { createdAt: "asc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.user.count(),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_FIELDS,
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
