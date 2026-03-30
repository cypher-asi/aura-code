import { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";

interface UpdateStatusResponse {
  update: {
    status: string;
    version?: string;
    channel?: string;
    error?: string;
  };
  channel: string;
  current_version: string;
}

interface UpdateBannerData {
  data: UpdateStatusResponse | null;
  enabled: boolean;
}

const POLL_INTERVAL = 5_000;

export function useUpdateBanner(): UpdateBannerData {
  const { features } = useAuraCapabilities();
  const [data, setData] = useState<UpdateStatusResponse | null>(null);

  const poll = useCallback(() => {
    api.getUpdateStatus().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    if (!features.nativeUpdater) return;
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [features.nativeUpdater, poll]);

  return { data, enabled: !!features.nativeUpdater };
}
