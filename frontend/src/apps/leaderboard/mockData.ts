export type TimePeriod = "all" | "month" | "week";

export interface LeaderboardUser {
  id: string;
  name: string;
  avatarUrl?: string;
  tokens: number;
  cost: number;
  commits: number;
  agents: number;
}

const allTimeData: LeaderboardUser[] = [
  { id: "u1", name: "Alice Chen", tokens: 4_821_300, cost: 62.68, commits: 312, agents: 8 },
  { id: "u2", name: "Marcus Webb", tokens: 3_540_900, cost: 46.03, commits: 287, agents: 6 },
  { id: "u3", name: "Priya Sharma", tokens: 2_910_400, cost: 37.84, commits: 245, agents: 7 },
  { id: "u4", name: "Jordan Blake", tokens: 2_104_700, cost: 27.36, commits: 198, agents: 5 },
  { id: "u5", name: "Tomoko Sato", tokens: 1_875_200, cost: 24.38, commits: 176, agents: 4 },
  { id: "u6", name: "Leo Martínez", tokens: 1_632_100, cost: 21.22, commits: 154, agents: 5 },
  { id: "u7", name: "Ava Okonkwo", tokens: 1_280_600, cost: 16.65, commits: 132, agents: 3 },
  { id: "u8", name: "Ethan Novak", tokens: 984_300, cost: 12.80, commits: 97, agents: 3 },
  { id: "u9", name: "Sofia Petrov", tokens: 721_500, cost: 9.38, commits: 68, agents: 2 },
  { id: "u10", name: "Kai Tanaka", tokens: 415_200, cost: 5.40, commits: 41, agents: 1 },
];

const monthData: LeaderboardUser[] = [
  { id: "u3", name: "Priya Sharma", tokens: 620_100, cost: 8.06, commits: 54, agents: 7 },
  { id: "u1", name: "Alice Chen", tokens: 580_400, cost: 7.55, commits: 48, agents: 8 },
  { id: "u5", name: "Tomoko Sato", tokens: 412_300, cost: 5.36, commits: 39, agents: 4 },
  { id: "u2", name: "Marcus Webb", tokens: 395_800, cost: 5.14, commits: 35, agents: 6 },
  { id: "u6", name: "Leo Martínez", tokens: 310_200, cost: 4.03, commits: 28, agents: 5 },
  { id: "u4", name: "Jordan Blake", tokens: 274_600, cost: 3.57, commits: 22, agents: 5 },
  { id: "u8", name: "Ethan Novak", tokens: 198_400, cost: 2.58, commits: 19, agents: 3 },
  { id: "u7", name: "Ava Okonkwo", tokens: 145_300, cost: 1.89, commits: 14, agents: 3 },
  { id: "u9", name: "Sofia Petrov", tokens: 102_700, cost: 1.34, commits: 11, agents: 2 },
  { id: "u10", name: "Kai Tanaka", tokens: 58_900, cost: 0.77, commits: 6, agents: 1 },
];

const weekData: LeaderboardUser[] = [
  { id: "u5", name: "Tomoko Sato", tokens: 142_800, cost: 1.86, commits: 14, agents: 4 },
  { id: "u1", name: "Alice Chen", tokens: 128_500, cost: 1.67, commits: 12, agents: 8 },
  { id: "u3", name: "Priya Sharma", tokens: 115_200, cost: 1.50, commits: 11, agents: 7 },
  { id: "u6", name: "Leo Martínez", tokens: 98_400, cost: 1.28, commits: 9, agents: 5 },
  { id: "u2", name: "Marcus Webb", tokens: 87_100, cost: 1.13, commits: 8, agents: 6 },
  { id: "u4", name: "Jordan Blake", tokens: 64_300, cost: 0.84, commits: 5, agents: 5 },
  { id: "u8", name: "Ethan Novak", tokens: 51_200, cost: 0.67, commits: 5, agents: 3 },
  { id: "u9", name: "Sofia Petrov", tokens: 32_100, cost: 0.42, commits: 3, agents: 2 },
  { id: "u7", name: "Ava Okonkwo", tokens: 24_600, cost: 0.32, commits: 2, agents: 3 },
  { id: "u10", name: "Kai Tanaka", tokens: 11_800, cost: 0.15, commits: 1, agents: 1 },
];

const dataByPeriod: Record<TimePeriod, LeaderboardUser[]> = {
  all: allTimeData,
  month: monthData,
  week: weekData,
};

export function getLeaderboard(period: TimePeriod): LeaderboardUser[] {
  return dataByPeriod[period];
}
