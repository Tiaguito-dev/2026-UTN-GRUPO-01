import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { normalizeEmail } from "../domain/email.js";
import { EmailAlreadyRegisteredError } from "../domain/errors.js";
import type { CreateUserInput, UserRepository } from "../domain/user.repository.js";
import type { AuthenticationUser, User } from "../domain/user.js";
import type { UsuarioAdministrativo, UserFilters } from "../domain/user-administration.repository.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";

// Proyección explícita: passwordHash nunca sale del repositorio en lecturas públicas.
const PUBLIC_FIELDS = { id: true, email: true, displayName: true, role: true, createdAt: true } as const;
const combiningMarks = Array.from({ length: 0x70 }, (_, index) => String.fromCodePoint(0x300 + index)).join("");

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination, filters: UserFilters = {}): Promise<PaginatedResult<UsuarioAdministrativo>> {
    const normalizedName = Prisma.sql`lower(translate(normalize(u."displayName", NFD), ${combiningMarks}, ''))`;
    const normalizedEmail = Prisma.sql`lower(translate(normalize(u."email", NFD), ${combiningMarks}, ''))`;
    const conditions: Prisma.Sql[] = [];
    if (filters.rol) conditions.push(Prisma.sql`u."role" = ${filters.rol}::"UserRole"`);
    if (filters.estado) conditions.push(filters.estado === "ACTIVO" ? Prisma.sql`u."disabledAt" IS NULL` : Prisma.sql`u."disabledAt" IS NOT NULL`);
    if (filters.q) {
      const literal = filters.q.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[\\%_]/g, "\\$&");
      const pattern = `%${literal}%`;
      conditions.push(Prisma.sql`(${normalizedName} LIKE ${pattern} OR ${normalizedEmail} LIKE ${pattern})`);
    }
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
    return this.prisma.$transaction(async (tx) => {
      const [items, counts] = await Promise.all([
        tx.$queryRaw<UsuarioAdministrativo[]>(Prisma.sql`SELECT u."id",u."email",u."displayName",u."role",u."createdAt",u."disabledAt" FROM "User" u ${where}
          ORDER BY ${normalizedName},u."email",u."id" LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`),
        tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM "User" u ${where}`),
      ]);
      return { items, total: Number(counts[0]!.total), ...pagination };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async findById(id: string): Promise<AuthenticationUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { ...PUBLIC_FIELDS, emailVerifiedAt: true, disabledAt: true },
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
