export const PUBLIC_SUBJECT_REPOSITORY = Symbol("PUBLIC_SUBJECT_REPOSITORY");

export interface PublicSubjectSummary {
  id: string;
  nombre: string;
}

export interface PublicExperience {
  id: string;
  texto: string;
  createdAt: Date;
  materia: PublicSubjectSummary;
}

export interface PublicSubjectRepository {
  findAll(q: string): Promise<PublicSubjectSummary[]>;
  findRecentExperiences(subjectId: string): Promise<PublicExperience[] | null>;
}
