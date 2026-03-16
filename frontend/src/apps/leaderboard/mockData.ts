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
  type: "user" | "agent";
  tokens: number;
  commits: number;
  agents: number;
  breakdown: AgentContribution[];
}

const CURRENT_USER = "real-n3o";

const allTimeData: LeaderboardUser[] = [
  { id: "u1", name: "Alice Chen", type: "user", tokens: 4_821_300, commits: 312, agents: 8, breakdown: [
    { agent: "Atlas", tokens: 1_620_000, commits: 105 },
    { agent: "Cipher", tokens: 1_380_000, commits: 89 },
    { agent: "Nova", tokens: 1_021_300, commits: 66 },
    { agent: "Bolt", tokens: 800_000, commits: 52 },
  ]},
  { id: "u2", name: "Marcus Webb", type: "user", tokens: 3_540_900, commits: 287, agents: 6, breakdown: [
    { agent: "Cipher", tokens: 1_240_000, commits: 100 },
    { agent: "Atlas", tokens: 1_100_900, commits: 89 },
    { agent: "Nova", tokens: 700_000, commits: 57 },
    { agent: "Bolt", tokens: 500_000, commits: 41 },
  ]},
  { id: "u3", name: "Priya Sharma", type: "user", tokens: 2_910_400, commits: 245, agents: 7, breakdown: [
    { agent: "Nova", tokens: 1_210_400, commits: 102 },
    { agent: "Atlas", tokens: 950_000, commits: 80 },
    { agent: "Cipher", tokens: 750_000, commits: 63 },
  ]},
  { id: "a1", name: "Atlas", type: "agent", tokens: 2_650_800, commits: 230, agents: 0, breakdown: [
    { agent: "Atlas", tokens: 2_650_800, commits: 230 },
  ]},
  { id: "u4", name: "Jordan Blake", type: "user", tokens: 2_104_700, commits: 198, agents: 5, breakdown: [
    { agent: "Atlas", tokens: 840_000, commits: 79 },
    { agent: "Nova", tokens: 720_700, commits: 68 },
    { agent: "Cipher", tokens: 544_000, commits: 51 },
  ]},
  { id: "a2", name: "Cipher", type: "agent", tokens: 1_980_500, commits: 185, agents: 0, breakdown: [
    { agent: "Cipher", tokens: 1_980_500, commits: 185 },
  ]},
  { id: "u5", name: "Tomoko Sato", type: "user", tokens: 1_875_200, commits: 176, agents: 4, breakdown: [
    { agent: "Cipher", tokens: 680_200, commits: 64 },
    { agent: "Nova", tokens: 620_000, commits: 58 },
    { agent: "Atlas", tokens: 575_000, commits: 54 },
  ]},
  { id: "a3", name: "Nova", type: "agent", tokens: 1_720_300, commits: 162, agents: 0, breakdown: [
    { agent: "Nova", tokens: 1_720_300, commits: 162 },
  ]},
  { id: "u6", name: "Leo Martínez", type: "user", tokens: 1_632_100, commits: 154, agents: 5, breakdown: [
    { agent: "Atlas", tokens: 612_100, commits: 58 },
    { agent: "Cipher", tokens: 540_000, commits: 51 },
    { agent: "Nova", tokens: 480_000, commits: 45 },
  ]},
  { id: "u7", name: "Ava Okonkwo", type: "user", tokens: 1_280_600, commits: 132, agents: 3, breakdown: [
    { agent: "Nova", tokens: 520_600, commits: 54 },
    { agent: "Atlas", tokens: 440_000, commits: 45 },
    { agent: "Cipher", tokens: 320_000, commits: 33 },
  ]},
  { id: "u8", name: "Ethan Novak", type: "user", tokens: 984_300, commits: 97, agents: 3, breakdown: [
    { agent: "Cipher", tokens: 424_300, commits: 42 },
    { agent: "Atlas", tokens: 320_000, commits: 31 },
    { agent: "Nova", tokens: 240_000, commits: 24 },
  ]},
  { id: "u9", name: "Sofia Petrov", type: "user", tokens: 721_500, commits: 68, agents: 2, breakdown: [
    { agent: "Atlas", tokens: 421_500, commits: 40 },
    { agent: "Nova", tokens: 300_000, commits: 28 },
  ]},
  { id: "u10", name: "Kai Tanaka", type: "user", tokens: 415_200, commits: 41, agents: 1, breakdown: [
    { agent: "Cipher", tokens: 415_200, commits: 41 },
  ]},
];

const monthData: LeaderboardUser[] = [
  { id: "a1", name: "Atlas", type: "agent", tokens: 640_200, commits: 56, agents: 0, breakdown: [
    { agent: "Atlas", tokens: 640_200, commits: 56 },
  ]},
  { id: "u3", name: "Priya Sharma", type: "user", tokens: 620_100, commits: 54, agents: 7, breakdown: [
    { agent: "Nova", tokens: 260_100, commits: 23 },
    { agent: "Atlas", tokens: 210_000, commits: 18 },
    { agent: "Cipher", tokens: 150_000, commits: 13 },
  ]},
  { id: "u1", name: "Alice Chen", type: "user", tokens: 580_400, commits: 48, agents: 8, breakdown: [
    { agent: "Atlas", tokens: 220_400, commits: 18 },
    { agent: "Cipher", tokens: 190_000, commits: 16 },
    { agent: "Nova", tokens: 170_000, commits: 14 },
  ]},
  { id: "a2", name: "Cipher", type: "agent", tokens: 490_300, commits: 42, agents: 0, breakdown: [
    { agent: "Cipher", tokens: 490_300, commits: 42 },
  ]},
  { id: "u5", name: "Tomoko Sato", type: "user", tokens: 412_300, commits: 39, agents: 4, breakdown: [
    { agent: "Cipher", tokens: 172_300, commits: 16 },
    { agent: "Nova", tokens: 140_000, commits: 13 },
    { agent: "Atlas", tokens: 100_000, commits: 10 },
  ]},
  { id: "u2", name: "Marcus Webb", type: "user", tokens: 395_800, commits: 35, agents: 6, breakdown: [
    { agent: "Cipher", tokens: 165_800, commits: 15 },
    { agent: "Atlas", tokens: 130_000, commits: 11 },
    { agent: "Nova", tokens: 100_000, commits: 9 },
  ]},
  { id: "a3", name: "Nova", type: "agent", tokens: 350_100, commits: 30, agents: 0, breakdown: [
    { agent: "Nova", tokens: 350_100, commits: 30 },
  ]},
  { id: "u6", name: "Leo Martínez", type: "user", tokens: 310_200, commits: 28, agents: 5, breakdown: [
    { agent: "Atlas", tokens: 130_200, commits: 12 },
    { agent: "Cipher", tokens: 100_000, commits: 9 },
    { agent: "Nova", tokens: 80_000, commits: 7 },
  ]},
  { id: "u4", name: "Jordan Blake", type: "user", tokens: 274_600, commits: 22, agents: 5, breakdown: [
    { agent: "Atlas", tokens: 114_600, commits: 9 },
    { agent: "Nova", tokens: 90_000, commits: 7 },
    { agent: "Cipher", tokens: 70_000, commits: 6 },
  ]},
  { id: "u8", name: "Ethan Novak", type: "user", tokens: 198_400, commits: 19, agents: 3, breakdown: [
    { agent: "Cipher", tokens: 98_400, commits: 9 },
    { agent: "Atlas", tokens: 60_000, commits: 6 },
    { agent: "Nova", tokens: 40_000, commits: 4 },
  ]},
  { id: "u7", name: "Ava Okonkwo", type: "user", tokens: 145_300, commits: 14, agents: 3, breakdown: [
    { agent: "Nova", tokens: 65_300, commits: 6 },
    { agent: "Atlas", tokens: 50_000, commits: 5 },
    { agent: "Cipher", tokens: 30_000, commits: 3 },
  ]},
  { id: "u9", name: "Sofia Petrov", type: "user", tokens: 102_700, commits: 11, agents: 2, breakdown: [
    { agent: "Atlas", tokens: 62_700, commits: 7 },
    { agent: "Nova", tokens: 40_000, commits: 4 },
  ]},
  { id: "u10", name: "Kai Tanaka", type: "user", tokens: 58_900, commits: 6, agents: 1, breakdown: [
    { agent: "Cipher", tokens: 58_900, commits: 6 },
  ]},
];

const weekData: LeaderboardUser[] = [
  { id: "a1", name: "Atlas", type: "agent", tokens: 158_400, commits: 16, agents: 0, breakdown: [
    { agent: "Atlas", tokens: 158_400, commits: 16 },
  ]},
  { id: "u5", name: "Tomoko Sato", type: "user", tokens: 142_800, commits: 14, agents: 4, breakdown: [
    { agent: "Cipher", tokens: 52_800, commits: 5 },
    { agent: "Nova", tokens: 50_000, commits: 5 },
    { agent: "Atlas", tokens: 40_000, commits: 4 },
  ]},
  { id: "u1", name: "Alice Chen", type: "user", tokens: 128_500, commits: 12, agents: 8, breakdown: [
    { agent: "Atlas", tokens: 48_500, commits: 4 },
    { agent: "Cipher", tokens: 45_000, commits: 4 },
    { agent: "Nova", tokens: 35_000, commits: 4 },
  ]},
  { id: "u3", name: "Priya Sharma", type: "user", tokens: 115_200, commits: 11, agents: 7, breakdown: [
    { agent: "Nova", tokens: 55_200, commits: 5 },
    { agent: "Atlas", tokens: 35_000, commits: 3 },
    { agent: "Cipher", tokens: 25_000, commits: 3 },
  ]},
  { id: "a2", name: "Cipher", type: "agent", tokens: 108_700, commits: 10, agents: 0, breakdown: [
    { agent: "Cipher", tokens: 108_700, commits: 10 },
  ]},
  { id: "u6", name: "Leo Martínez", type: "user", tokens: 98_400, commits: 9, agents: 5, breakdown: [
    { agent: "Atlas", tokens: 38_400, commits: 3 },
    { agent: "Cipher", tokens: 35_000, commits: 3 },
    { agent: "Nova", tokens: 25_000, commits: 3 },
  ]},
  { id: "a3", name: "Nova", type: "agent", tokens: 92_100, commits: 8, agents: 0, breakdown: [
    { agent: "Nova", tokens: 92_100, commits: 8 },
  ]},
  { id: "u2", name: "Marcus Webb", type: "user", tokens: 87_100, commits: 8, agents: 6, breakdown: [
    { agent: "Cipher", tokens: 37_100, commits: 3 },
    { agent: "Atlas", tokens: 30_000, commits: 3 },
    { agent: "Nova", tokens: 20_000, commits: 2 },
  ]},
  { id: "u4", name: "Jordan Blake", type: "user", tokens: 64_300, commits: 5, agents: 5, breakdown: [
    { agent: "Atlas", tokens: 24_300, commits: 2 },
    { agent: "Nova", tokens: 22_000, commits: 2 },
    { agent: "Cipher", tokens: 18_000, commits: 1 },
  ]},
  { id: "u8", name: "Ethan Novak", type: "user", tokens: 51_200, commits: 5, agents: 3, breakdown: [
    { agent: "Cipher", tokens: 21_200, commits: 2 },
    { agent: "Atlas", tokens: 18_000, commits: 2 },
    { agent: "Nova", tokens: 12_000, commits: 1 },
  ]},
  { id: "u9", name: "Sofia Petrov", type: "user", tokens: 32_100, commits: 3, agents: 2, breakdown: [
    { agent: "Atlas", tokens: 20_100, commits: 2 },
    { agent: "Nova", tokens: 12_000, commits: 1 },
  ]},
  { id: "u7", name: "Ava Okonkwo", type: "user", tokens: 24_600, commits: 2, agents: 3, breakdown: [
    { agent: "Nova", tokens: 14_600, commits: 1 },
    { agent: "Atlas", tokens: 10_000, commits: 1 },
  ]},
  { id: "u10", name: "Kai Tanaka", type: "user", tokens: 11_800, commits: 1, agents: 1, breakdown: [
    { agent: "Cipher", tokens: 11_800, commits: 1 },
  ]},
];

const dataByPeriod: Record<TimePeriod, LeaderboardUser[]> = {
  all: allTimeData,
  month: monthData,
  week: weekData,
};

function applyFilter(users: LeaderboardUser[], filter: LeaderboardFilter): LeaderboardUser[] {
  switch (filter) {
    case "my-agents":
      return users.filter((u) => u.type === "agent");
    case "following":
      return users.filter((u) => u.name === CURRENT_USER);
    case "organization":
    case "everything":
    default:
      return users;
  }
}

export function getLeaderboard(period: TimePeriod, filter: LeaderboardFilter = "everything"): LeaderboardUser[] {
  return applyFilter(dataByPeriod[period], filter);
}
