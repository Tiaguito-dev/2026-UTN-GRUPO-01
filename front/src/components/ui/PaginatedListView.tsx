"use client";

import type { ReactNode } from "react";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import type { PaginatedResult } from "@/services/pagination";
import { Notice } from "./Notice";
import { Pagination } from "./Pagination";

/**
 * Loading, error, empty and data states of a paginated list, plus its pagination. The screen owns
 * the heading and the page (usually from `useUrlPagination`). On a 404, `notFoundAction` replaces
 * "Reintentar". `children` renders the items of a non-empty page.
 */
export function PaginatedListView<T>({ fetchPage, resetKey, page, onPageChange, loadingMessage, errorMessage, notFoundAction, empty, children }: {
  fetchPage: (page: number) => Promise<PaginatedResult<T>>;
  resetKey: string;
  page: number;
  onPageChange: (page: number) => void;
  loadingMessage: string;
  errorMessage?: ReactNode;
  notFoundAction?: ReactNode;
  empty: ReactNode;
  children: (result: PaginatedResult<T>) => ReactNode;
}) {
  const { state, retry } = usePaginatedFetch(resetKey, fetchPage, page);
  if (state.status === "loading") return <p role="status">{loadingMessage}</p>;
  if (state.status === "error") return <Notice tone="error">
    {errorMessage ? <>{errorMessage} <span>{state.error}</span></> : state.error}{" "}
    {state.notFound && notFoundAction ? notFoundAction : <button className="button" type="button" onClick={retry}>Reintentar</button>}
  </Notice>;
  if (state.data.items.length === 0) return empty;
  return <>
    {children(state.data)}
    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={onPageChange} />
  </>;
}
