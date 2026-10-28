import { useQuery } from '@tanstack/react-query';
import createClient from 'openapi-fetch';
import type { components, paths } from './api-types';

// Types come straight from the API document (pnpm gen:api), so the web app and the API cannot drift apart.
type S = components['schemas'];
export type User = S['User'];
export type Sport = S['Sport'];
export type Court = S['Court'];
export type Slot = S['Slot'];
export type Equipment = S['Equipment'];
export type Booking = S['Booking'];
export type BookingSummary = S['BookingSummary'];
export type Payment = S['Payment'];
export type Review = S['Review'];
export type Stats = S['Stats'];
export type BoardRow = S['BoardRow'];
export type EmailSummary = S['EmailSummary'];
export type Email = S['Email'];
export type Settings = S['Settings'];
export type SystemStatus = S['SystemStatus'];

// JSON request body of an endpoint, e.g. Body<'/api/v1/courts', 'post'>
export type Body<P extends keyof paths, M extends 'post' | 'patch'> = paths[P] extends Record<M, { requestBody?: { content: { 'application/json': infer B } } }>
  ? B
  : never;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const api = createClient<paths>({ credentials: 'same-origin' });

type Result<T> = { data?: T; error?: unknown; response: Response };

// openapi-fetch returns { data, error }; turn that into a value or a thrown ApiError for TanStack Query
export async function ok<T>(request: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) {
    const body = (error as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(response.status, body?.code ?? 'ERROR', body?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
  return data as T;
}

// multipart uploads (images, slips) go through plain fetch
export async function upload<T>(path: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('image', file);
  const res = await fetch(path, { method: 'POST', body, credentials: 'same-origin' });
  const json = await res.json();
  if (!res.ok) throw new ApiError(res.status, json.error?.code ?? 'ERROR', json.error?.message ?? 'อัปโหลดไม่สำเร็จ');
  return json as T;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/v1/auth/me');
      return response.ok ? (data ?? null) : null;
    },
    staleTime: 5 * 60_000,
  });
}

// public booking rules (payment window, cancel deadline...) set by the admin
export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => ok(api.GET('/api/v1/settings')), staleTime: 5 * 60_000 });
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
