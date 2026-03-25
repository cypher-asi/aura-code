import type { RemoteVmState } from "../types"
import { apiFetch } from "./core"

export const swarmApi = {
  getRemoteAgentState: (agentId: string) =>
    apiFetch<RemoteVmState>(`/api/agents/${agentId}/remote_agent/state`),
}
