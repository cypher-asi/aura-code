/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { FeedEvent, FeedComment } from "../feed/FeedProvider";
import { networkEventToFeedEvent, networkCommentToFeedComment } from "../feed/FeedProvider";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

export interface UserProfileData {
  id?: string;
  networkUserId?: string;
  name: string;
  handle: string;
  bio: string;
  website: string;
  location: string;
  joinedDate: string;
  avatarUrl?: string;
}

export interface ProfileProject {
  id: string;
  name: string;
  repo: string;
}

interface ProfileContextValue {
  profile: UserProfileData;
  updateProfile: (data: Partial<UserProfileData>) => void;
  projects: ProfileProject[];
  events: FeedEvent[];
  filteredEvents: FeedEvent[];
  commitActivity: Record<string, number>;
  totalTokenUsage: number;
  selectedProject: string | null;
  setSelectedProject: (id: string | null) => void;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  getCommentsForEvent: (eventId: string) => FeedComment[];
  addComment: (eventId: string, text: string) => void;
}

const ProfileCtx = createContext<ProfileContextValue | null>(null);

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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

function repoActivityForProject(events: FeedEvent[], repo: string): Record<string, number> {
  const activity: Record<string, number> = {};
  for (const evt of events) {
    if (evt.postType !== "push" || evt.repo !== repo) continue;
    const ts = new Date(evt.timestamp);
    const dateKey = evt.timestamp.slice(0, 10);
    const hourKey = `${dateKey}:${String(ts.getHours()).padStart(2, "0")}`;
    activity[hourKey] = (activity[hourKey] ?? 0) + evt.commits.length;
  }
  return activity;
}

let nextCommentId = 1;

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const zid = user?.primary_zid || "";
  const fetchedRef = useRef(false);

  const [profile, setProfile] = useState<UserProfileData>(() => ({
    name: user?.display_name || "",
    bio: "",
    website: "",
    location: "",
    joinedDate: new Date().toISOString(),
    id: user?.profile_id,
    networkUserId: user?.network_user_id,
    avatarUrl: user?.profile_image || undefined,
    handle: zid ? `@${zid}` : "",
  }));

  const [projects, setProjects] = useState<ProfileProject[]>([]);
  const [liveEvents, setLiveEvents] = useState<FeedEvent[]>([]);
  const [totalTokenUsage, setTotalTokenUsage] = useState(0);
  const [selectedProject, setSelectedProjectRaw] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const loadedCommentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (zid) setProfile((prev) => ({ ...prev, handle: `@${zid}` }));
  }, [zid]);

  // Fetch profile, projects, events, and usage from the API
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    api.users.me().then((networkUser) => {
      const networkName = networkUser.display_name && !isUuid(networkUser.display_name)
        ? networkUser.display_name
        : undefined;

      setProfile((prev) => ({
        ...prev,
        id: networkUser.profile_id ?? prev.id,
        networkUserId: networkUser.id ?? prev.networkUserId,
        name: networkName ?? user?.display_name ?? prev.name,
        bio: networkUser.bio ?? prev.bio,
        location: networkUser.location ?? prev.location,
        website: networkUser.website ?? prev.website,
        avatarUrl: networkUser.avatar_url ?? prev.avatarUrl,
        joinedDate: networkUser.created_at ?? prev.joinedDate,
      }));

      if (networkUser.profile_id) {
        api.feed.getProfilePosts(networkUser.profile_id).then((netEvents) => {
          setLiveEvents(netEvents.map(networkEventToFeedEvent));
        }).catch(() => {});
      }
    }).catch(() => {});

    api.listProjects().then((apiProjects) => {
      setProjects(
        apiProjects.map((p) => {
          const repo = p.orbit_owner && p.orbit_repo
            ? `${p.orbit_owner}/${p.orbit_repo}`
            : p.git_repo_url ?? "";
          return { id: p.project_id, name: p.name, repo };
        }),
      );
    }).catch(() => {});

    api.usage.personal("all").then((stats) => {
      setTotalTokenUsage(stats.total_tokens);
    }).catch(() => {});
  }, [user?.display_name]);

  // Load comments from API when a post is selected
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

  const updateProfile = useCallback((data: Partial<UserProfileData>) => {
    setProfile((prev) => ({ ...prev, ...data }));

    const networkFields: Record<string, string | undefined> = {};
    if (data.name !== undefined) networkFields.display_name = data.name;
    if (data.bio !== undefined) networkFields.bio = data.bio;
    if (data.avatarUrl !== undefined) networkFields.avatar_url = data.avatarUrl;
    if (data.location !== undefined) networkFields.location = data.location;
    if (data.website !== undefined) networkFields.website = data.website;
    if (Object.keys(networkFields).length > 0) {
      api.users.updateMe(networkFields).catch(() => {});
    }
  }, []);

  const events = useMemo(
    () =>
      [...liveEvents]
        .map((evt) => {
          if (profile.avatarUrl && evt.author.type === "user") {
            return { ...evt, author: { ...evt.author, name: profile.name || evt.author.name, avatarUrl: profile.avatarUrl } };
          }
          return evt;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [liveEvents, profile.avatarUrl, profile.name],
  );

  const filteredEvents = useMemo(() => {
    if (!selectedProject) return events;
    const project = projects.find((p) => p.id === selectedProject);
    if (!project) return events;
    return events.filter((e) => e.repo === project.repo);
  }, [events, selectedProject, projects]);

  const commitActivity = useMemo(() => {
    if (!selectedProject) return commitActivityFromEvents(events);
    const project = projects.find((p) => p.id === selectedProject);
    if (!project) return commitActivityFromEvents(events);
    return repoActivityForProject(events, project.repo);
  }, [events, selectedProject, projects]);

  const setSelectedProject = useCallback((id: string | null) => {
    setSelectedProjectRaw(id);
    setSelectedEventId(null);
  }, []);

  const selectEvent = useCallback((id: string | null) => setSelectedEventId(id), []);

  const getCommentsForEvent = useCallback(
    (eventId: string) =>
      comments
        .filter((c) => c.eventId === eventId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [comments],
  );

  const addComment = useCallback((eventId: string, text: string) => {
    const authorName = user?.display_name || "You";
    const makeLocal = (): FeedComment => ({
      id: `p-cmt-${nextCommentId++}`,
      eventId,
      author: { name: authorName, type: "user", avatarUrl: profile.avatarUrl },
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
  }, [user?.display_name, profile.avatarUrl]);

  const value = useMemo(
    () => ({
      profile,
      updateProfile,
      projects,
      events,
      filteredEvents,
      commitActivity,
      totalTokenUsage,
      selectedProject,
      setSelectedProject,
      selectedEventId,
      selectEvent,
      getCommentsForEvent,
      addComment,
    }),
    [profile, updateProfile, projects, events, filteredEvents, commitActivity, totalTokenUsage, selectedProject, setSelectedProject, selectedEventId, selectEvent, getCommentsForEvent, addComment],
  );

  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
