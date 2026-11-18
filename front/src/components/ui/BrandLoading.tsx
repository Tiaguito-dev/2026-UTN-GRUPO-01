import { BrandMark } from "@/components/BrandMark";

export function BrandLoading({ message = "Cargando…", className }: { message?: string; className?: string }) {
  return <p role="status" className={className ? "brand-loading " + className : "brand-loading"}>
    <span className="brand-loading-mark" aria-hidden="true"><BrandMark /></span>
    <span>{message}</span>
  </p>;
}
