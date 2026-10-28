import { BookOpen, House, LayoutGrid, MessageSquare, Users, UsersRound, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  inicio: House,
  profesores: Users,
  materias: BookOpen,
  experiencias: MessageSquare,
  comunidad: UsersRound,
  admin: LayoutGrid,
};

export function NavigationIcon({ section }: { section: string }) {
  const Icon = icons[section];
  return Icon ? <Icon size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /> : null;
}
