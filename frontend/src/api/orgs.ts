import type { Org, OrgMember, OrgInvite, OrgBilling, OrgRole, CreditTier, CreditBalance, CheckoutSessionResponse } from "../types";
import { apiFetch } from "./core";

export const orgsApi = {
  list: () => apiFetch<Org[]>("/api/orgs"),
  create: (name: string) =>
    apiFetch<Org>("/api/orgs", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  get: (orgId: string) => apiFetch<Org>(`/api/orgs/${orgId}`),
  update: (orgId: string, name: string) =>
    apiFetch<Org>(`/api/orgs/${orgId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  listMembers: (orgId: string) =>
    apiFetch<OrgMember[]>(`/api/orgs/${orgId}/members`),
  updateMemberRole: (orgId: string, userId: string, role: OrgRole) =>
    apiFetch<OrgMember>(`/api/orgs/${orgId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  removeMember: (orgId: string, userId: string) =>
    apiFetch<void>(`/api/orgs/${orgId}/members/${userId}`, {
      method: "DELETE",
    }),
  createInvite: (orgId: string) =>
    apiFetch<OrgInvite>(`/api/orgs/${orgId}/invites`, { method: "POST" }),
  listInvites: (orgId: string) =>
    apiFetch<OrgInvite[]>(`/api/orgs/${orgId}/invites`),
  revokeInvite: (orgId: string, inviteId: string) =>
    apiFetch<void>(`/api/orgs/${orgId}/invites/${inviteId}`, {
      method: "DELETE",
    }),
  acceptInvite: (token: string) =>
    apiFetch<OrgMember>(`/api/invites/${token}/accept`, { method: "POST" }),
  getBilling: (orgId: string) =>
    apiFetch<OrgBilling | null>(`/api/orgs/${orgId}/billing`),
  setBilling: (orgId: string, billing_email: string | null, plan: string) =>
    apiFetch<Org>(`/api/orgs/${orgId}/billing`, {
      method: "PUT",
      body: JSON.stringify({ billing_email, plan }),
    }),
  getCreditTiers: (orgId: string) =>
    apiFetch<CreditTier[]>(`/api/orgs/${orgId}/credits/tiers`),
  getCreditBalance: (orgId: string) =>
    apiFetch<CreditBalance>(`/api/orgs/${orgId}/credits/balance`),
  createCreditCheckout: (orgId: string, tierId?: string, customCredits?: number) =>
    apiFetch<CheckoutSessionResponse>(`/api/orgs/${orgId}/credits/checkout`, {
      method: "POST",
      body: JSON.stringify({ tier_id: tierId, credits: customCredits }),
    }),
};
