export type TimePeriod = "all" | "month" | "week";

export type LeaderboardFilter = "my-agents" | "organization" | "following" | "everything";

export interface AgentContribution {
  agent: string;
  tokens: number;
  commits: number;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  avatarUrl?: string;
  profileId?: string;
  type: "user" | "agent";
  tokens: number;
  commits: number;
  agents: number;
  breakdown: AgentContribution[];
}
