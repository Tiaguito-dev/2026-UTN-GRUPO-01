import { z } from "zod";
import { validateId } from "./academic-id.js";
import { InvalidAcademicInputError, MateriaNotFoundError } from "./errors.js";
import type { PublicSubjectRepository } from "./ports/public-subject.repository.js";

const querySchema = z.object({
  q: z.string().refine((value) => ![...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  })).transform((value) => value.trim()).refine((value) => [...value].length <= 150).optional(),
});

export class ExplorarMaterias {
  constructor(private readonly subjects: PublicSubjectRepository) {}

  async list(query: unknown) {
    const result = querySchema.safeParse(query);
    if (!result.success) throw new InvalidAcademicInputError("La búsqueda debe tener hasta 150 caracteres y no contener caracteres de control.");
    return { items: await this.subjects.findAll(result.data.q ?? "") };
  }

  async recentExperiences(id: string) {
    const items = await this.subjects.findRecentExperiences(validateId(id));
    if (items === null) throw new MateriaNotFoundError();
    return { items };
  }
}
