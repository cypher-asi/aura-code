import { ProjectsApp } from "./projects/ProjectsApp";
import { AgentsApp } from "./agents/AgentsApp";
import { FeedApp } from "./feed/FeedApp";
import { LeaderboardApp } from "./leaderboard/LeaderboardApp";
import type { AuraApp } from "./types";

export const apps: AuraApp[] = [ProjectsApp, AgentsApp, FeedApp, LeaderboardApp];
