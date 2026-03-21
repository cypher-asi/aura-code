/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { useEventContext } from "../../context/EventContext";
import { useFollow } from "../../context/FollowContext";
import { api } from "../../api/client";
import type { FeedEventDto } from "../../api/social";
import type { EngineEvent } from "../../types/events";

export type PostType = "post" | "push" | "event";

export interface FeedCommit {
  sha: string;
  message: string;
}

export interface FeedEvent {
  id: string;
  postType: PostType;
  title: string;
  author: { name: string; avatarUrl?: string; type: "user" | "agent" };
  repo: string;
  branch: string;
  commits: FeedCommit[];
  commitIds: string[];
  pushId?: string;
  timestamp: string;
  summary?: string;
  eventType: string;
}

export interface FeedComment {
  id: string;
  eventId: string;
  author: { name: string; avatarUrl?: string; type: "user" | "agent" };
  text: string;
  timestamp: string;
}

export type FeedFilter = "my-agents" | "organization" | "following" | "everything";

export interface FeedSelectedProfile {
  name: string;
  type: "user" | "agent";
  avatarUrl?: string;
  profileId?: string;
}

interface FeedContextValue {
  events: FeedEvent[];
  filteredEvents: FeedEvent[];
  commitActivity: Record<string, number>;
  filter: FeedFilter;
  setFilter: (filter: FeedFilter) => void;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  selectedProfile: FeedSelectedProfile | null;
  selectProfile: (profile: FeedSelectedProfile | null) => void;
  getCommentsForEvent: (eventId: string) => FeedComment[];
  addComment: (eventId: string, text: string) => void;
  createPost: (title: string, summary?: string) => Promise<void>;
}

const FeedCtx = createContext<FeedContextValue | null>(null);

const CURRENT_USER = "real-n3o";

function applyFilter(
  events: FeedEvent[],
  filter: FeedFilter,
  followedNames?: Set<string>,
): FeedEvent[] {
  switch (filter) {
    case "my-agents":
      return events.filter((e) => e.author.type === "agent");
    case "following":
      if (!followedNames || followedNames.size === 0) return [];
      return events.filter((e) => followedNames.has(e.author.name));
    case "organization":
    case "everything":
    default:
      return events;
  }
}

function commitActivityFromEvents(events: FeedEvent[]): Record<string, number> {
  const activity: Record<string, number> = {};
  for (const evt of events) {
    if (evt.postType !== "push") continue;
    const ts = new Date(evt.timestamp);
    const dateKey = evt.timestamp.slice(0, 10);
    const hourKey = `${dateKey}:${String(ts.getHours()).padStart(2, "0")}`;
    activity[hourKey] = (activity[hourKey] ?? 0) + evt.commits.length;
  }
  return activity;
}

export function networkEventToFeedEvent(net: FeedEventDto): FeedEvent {
  const meta = net.metadata ?? {};
  const postType = (net.post_type ?? "push") as PostType;
  const title = net.title ?? (meta.summary as string) ?? "";
  const summary = net.summary ?? (meta.summary as string) ?? undefined;

  const authorName = (meta.author_name as string) || (meta.profileName as string) || "Unknown";
  const authorAvatar = (meta.author_avatar as string) || (meta.avatarUrl as string) || undefined;
  const authorType = ((meta.author_type as string) || (meta.profileType as string) || "user") as "user" | "agent";

  const repo = (meta.repo as string) || (meta.repository as string) || "";
  const branch = (meta.branch as string) || "main";
  const rawCommits = (meta.commits as Array<{ sha?: string; message?: string }>) || [];
  const commits: FeedCommit[] = rawCommits.map((c) => ({
    sha: c.sha || "",
    message: c.message || "",
  }));
  const commitIds = net.commit_ids ?? [];
  const pushId = net.push_id ?? undefined;

  return {
    id: net.id,
    postType,
    title,
    author: { name: authorName, avatarUrl: authorAvatar, type: authorType },
    repo,
    branch,
    commits,
    commitIds,
    pushId,
    timestamp: net.created_at || new Date().toISOString(),
    summary,
    eventType: net.event_type,
  };
}

interface NetworkComment {
  id: string;
  activity_event_id: string;
  profile_id: string;
  content: string;
  created_at: string | null;
}

export function networkCommentToFeedComment(net: NetworkComment): FeedComment {
  return {
    id: net.id,
    eventId: net.activity_event_id,
    author: { name: net.profile_id, type: "user" },
    text: net.content,
    timestamp: net.created_at || new Date().toISOString(),
  };
}

let nextCommentId = 1;

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { subscribe } = useEventContext();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<FeedSelectedProfile | null>(null);
  const [filter, setFilterRaw] = useState<FeedFilter>("my-agents");
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [liveEvents, setLiveEvents] = useState<FeedEvent[] | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>(undefined);
  const { follows } = useFollow();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loadedCommentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api.feed
      .list()
      .then((netEvents) => {
        if (cancelled) return;
        const mapped = netEvents.map(networkEventToFeedEvent);
        for (const e of mapped) seenIdsRef.current.add(e.id);
        setLiveEvents(mapped);
      })
      .catch(() => {
        setLiveEvents([]);
      });

    api.users.me().then((u) => {
      if (!cancelled && u.avatar_url) setUserAvatarUrl(u.avatar_url);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    if (loadedCommentIdsRef.current.has(selectedEventId)) return;
    loadedCommentIdsRef.current.add(selectedEventId);

    api.feed.getComments(selectedEventId).then((netComments) => {
      const mapped = netComments.map(networkCommentToFeedComment);
      if (mapped.length > 0) {
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const fresh = mapped.filter((c) => !existingIds.has(c.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }
    }).catch(() => {});
  }, [selectedEventId]);

  useEffect(() => {
    const handleGitPushed = (event: EngineEvent) => {
      if (event.type !== "git_pushed") return;
      const feedEvent: FeedEvent = {
        id: `git-push-${event.spec_id ?? Date.now()}`,
        postType: "push",
        title: event.summary ?? "Code pushed",
        author: { name: "Agent", type: "agent" },
        repo: event.repo ?? "",
        branch: event.branch ?? "main",
        commits: (event.commits ?? []).map((c) => ({ sha: c.sha, message: c.message })),
        commitIds: (event.commits ?? []).map((c) => c.sha),
        timestamp: new Date().toISOString(),
        summary: event.summary,
        eventType: "push",
      };
      if (seenIdsRef.current.has(feedEvent.id)) return;
      seenIdsRef.current.add(feedEvent.id);
      setLiveEvents((prev) => [feedEvent, ...(prev ?? [])]);
    };

    const handleNetworkEvent = (event: EngineEvent) => {
      if (event.type !== "network_event") return;
      const payload = event.payload;
      if (!payload) return;
      const wsType = (payload.type as string) ?? "";
      if (wsType !== "activity.new") return;
      const data = payload.data as FeedEventDto | undefined;
      if (!data || !data.id) return;
      if (seenIdsRef.current.has(data.id)) return;
      seenIdsRef.current.add(data.id);
      const feedEvent = networkEventToFeedEvent(data);
      setLiveEvents((prev) => [feedEvent, ...(prev ?? [])]);
    };

    const unsub1 = subscribe("git_pushed", handleGitPushed);
    const unsub2 = subscribe("network_event", handleNetworkEvent);
    return () => { unsub1(); unsub2(); };
  }, [subscribe]);

  const followedNames = useMemo(
    () => new Set(follows.map((f) => f.target_profile_id)),
    [follows],
  );

  const currentUserAvatar = userAvatarUrl || (user?.profile_image && user.profile_image.startsWith("http") ? user.profile_image : undefined);
  const currentUserName = user?.display_name;

  const events = useMemo(
    () => {
      const source = liveEvents ?? [];
      return [...source].map((evt) => {
        if (currentUserAvatar && evt.author.type === "user" && evt.author.name === CURRENT_USER) {
          return { ...evt, author: { ...evt.author, name: currentUserName || evt.author.name, avatarUrl: currentUserAvatar } };
        }
        return evt;
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    [liveEvents, currentUserAvatar, currentUserName],
  );

  const filteredEvents = useMemo(
    () => applyFilter(events, filter, followedNames),
    [events, filter, followedNames],
  );

  const commitActivity = useMemo(
    () => commitActivityFromEvents(filteredEvents),
    [filteredEvents],
  );

  const selectEvent = useCallback((id: string | null) => {
    setSelectedEventId(id);
    if (id) setSelectedProfile(null);
  }, []);

  const selectProfile = useCallback((profile: FeedSelectedProfile | null) => {
    setSelectedProfile(profile);
    if (profile) setSelectedEventId(null);
  }, []);

  const setFilter = useCallback((f: FeedFilter) => setFilterRaw(f), []);

  const getCommentsForEvent = useCallback(
    (eventId: string) =>
      comments
        .filter((c) => c.eventId === eventId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [comments],
  );

  const addComment = useCallback((eventId: string, text: string) => {
    const authorName = currentUserName || CURRENT_USER;
    const makeLocal = (): FeedComment => ({
      id: `cmt-${nextCommentId++}`,
      eventId,
      author: { name: authorName, type: "user", avatarUrl: currentUserAvatar },
      text,
      timestamp: new Date().toISOString(),
    });

    api.feed
      .addComment(eventId, text)
      .then((net) => {
        setComments((prev) => [...prev, networkCommentToFeedComment(net)]);
      })
      .catch(() => {
        setComments((prev) => [...prev, makeLocal()]);
      });
  }, [currentUserName, currentUserAvatar]);

  const createPost = useCallback(async (title: string, summary?: string) => {
    const post = await api.feed.createPost({ title, summary, post_type: "post" });
    const feedEvent = networkEventToFeedEvent(post);
    seenIdsRef.current.add(feedEvent.id);
    setLiveEvents((prev) => [feedEvent, ...(prev ?? [])]);
  }, []);

  const value = useMemo(
    () => ({ events, filteredEvents, commitActivity, filter, setFilter, selectedEventId, selectEvent, selectedProfile, selectProfile, getCommentsForEvent, addComment, createPost }),
    [events, filteredEvents, commitActivity, filter, setFilter, selectedEventId, selectEvent, selectedProfile, selectProfile, getCommentsForEvent, addComment, createPost],
  );

  return <FeedCtx.Provider value={value}>{children}</FeedCtx.Provider>;
}

export function useFeed() {
  const ctx = useContext(FeedCtx);
  if (!ctx) throw new Error("useFeed must be used within FeedProvider");
  return ctx;
}
