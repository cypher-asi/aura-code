export type TimePeriod = "all" | "month" | "week";

export interface LeaderboardUser {
  id: string;
  name: string;
  avatarUrl?: string;
  tokens: number;
  commits: number;
  agents: number;
}

const allTimeData: LeaderboardUser[] = [
  { id: "u1", name: "Alice Chen", tokens: 4_821_300, commits: 312, agents: 8 },
  { id: "u2", name: "Marcus Webb", tokens: 3_540_900, commits: 287, agents: 6 },
  { id: "u3", name: "Priya Sharma", tokens: 2_910_400, commits: 245, agents: 7 },
  { id: "u4", name: "Jordan Blake", tokens: 2_104_700, commits: 198, agents: 5 },
  { id: "u5", name: "Tomoko Sato", tokens: 1_875_200, commits: 176, agents: 4 },
  { id: "u6", name: "Leo Martínez", tokens: 1_632_100, commits: 154, agents: 5 },
  { id: "u7", name: "Ava Okonkwo", tokens: 1_280_600, commits: 132, agents: 3 },
  { id: "u8", name: "Ethan Novak", tokens: 984_300, commits: 97, agents: 3 },
  { id: "u9", name: "Sofia Petrov", tokens: 721_500, commits: 68, agents: 2 },
  { id: "u10", name: "Kai Tanaka", tokens: 415_200, commits: 41, agents: 1 },
];

const monthData: LeaderboardUser[] = [
  { id: "u3", name: "Priya Sharma", tokens: 620_100, commits: 54, agents: 7 },
  { id: "u1", name: "Alice Chen", tokens: 580_400, commits: 48, agents: 8 },
  { id: "u5", name: "Tomoko Sato", tokens: 412_300, commits: 39, agents: 4 },
  { id: "u2", name: "Marcus Webb", tokens: 395_800, commits: 35, agents: 6 },
  { id: "u6", name: "Leo Martínez", tokens: 310_200, commits: 28, agents: 5 },
  { id: "u4", name: "Jordan Blake", tokens: 274_600, commits: 22, agents: 5 },
  { id: "u8", name: "Ethan Novak", tokens: 198_400, commits: 19, agents: 3 },
  { id: "u7", name: "Ava Okonkwo", tokens: 145_300, commits: 14, agents: 3 },
  { id: "u9", name: "Sofia Petrov", tokens: 102_700, commits: 11, agents: 2 },
  { id: "u10", name: "Kai Tanaka", tokens: 58_900, commits: 6, agents: 1 },
];

const weekData: LeaderboardUser[] = [
  { id: "u5", name: "Tomoko Sato", tokens: 142_800, commits: 14, agents: 4 },
  { id: "u1", name: "Alice Chen", tokens: 128_500, commits: 12, agents: 8 },
  { id: "u3", name: "Priya Sharma", tokens: 115_200, commits: 11, agents: 7 },
  { id: "u6", name: "Leo Martínez", tokens: 98_400, commits: 9, agents: 5 },
  { id: "u2", name: "Marcus Webb", tokens: 87_100, commits: 8, agents: 6 },
  { id: "u4", name: "Jordan Blake", tokens: 64_300, commits: 5, agents: 5 },
  { id: "u8", name: "Ethan Novak", tokens: 51_200, commits: 5, agents: 3 },
  { id: "u9", name: "Sofia Petrov", tokens: 32_100, commits: 3, agents: 2 },
  { id: "u7", name: "Ava Okonkwo", tokens: 24_600, commits: 2, agents: 3 },
  { id: "u10", name: "Kai Tanaka", tokens: 11_800, commits: 1, agents: 1 },
];

const dataByPeriod: Record<TimePeriod, LeaderboardUser[]> = {
  all: allTimeData,
  month: monthData,
  week: weekData,
};

export function getLeaderboard(period: TimePeriod): LeaderboardUser[] {
  return dataByPeriod[period];
}
