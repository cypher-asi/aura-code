import type { AuthSession, ApiKeyInfo } from "../types";
import { apiFetch } from "./core";

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    apiFetch<AuthSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getSession: () => apiFetch<AuthSession>("/api/auth/session"),
  validate: () =>
    apiFetch<AuthSession>("/api/auth/validate", { method: "POST" }),
  logout: () =>
    apiFetch<void>("/api/auth/logout", { method: "POST" }),
};

export const settingsApi = {
  getApiKeyInfo: () => apiFetch<ApiKeyInfo>("/api/settings/api-key"),
  getFeeSchedule: () =>
    apiFetch<{ model: string; input_cost_per_million: number; output_cost_per_million: number; effective_date: string }[]>(
      "/api/settings/fee-schedule",
    ),
  putFeeSchedule: (entries: { model: string; input_cost_per_million: number; output_cost_per_million: number; effective_date: string }[]) =>
    apiFetch<{ model: string; input_cost_per_million: number; output_cost_per_million: number; effective_date: string }[]>(
      "/api/settings/fee-schedule",
      { method: "PUT", body: JSON.stringify(entries) },
    ),
};
