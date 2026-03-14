import { useState, useEffect, useRef } from "react";
import { Button, Text, ModalConfirm } from "@cypher-asi/zui";
import { Play, Pause, Square, Wifi, WifiOff } from "lucide-react";
import { api } from "../api/client";
import { useEventContext } from "../context/EventContext";
import { useSidekick } from "../context/SidekickContext";
import { StatusBadge } from "./StatusBadge";
import type { ProjectId } from "../types";
import styles from "./Sidekick.module.css";

type AutomationStatus = "idle" | "starting" | "active" | "paused" | "stopped";

interface AutomationBarProps {
  projectId: ProjectId;
}

function ConnectionDot({ connected, lastEventAt }: { connected: boolean; lastEventAt: number | null }) {
  const [stale, setStale] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (connected && lastEventAt) {
        setStale(Date.now() - lastEventAt > 10_000);
      } else {
        setStale(false);
      }
    }, 2_000);
    return () => clearInterval(intervalRef.current);
  }, [connected, lastEventAt]);

  if (!connected) {
    return (
      <span className={styles.connectionDot} title="Disconnected — reconnecting...">
        <WifiOff size={12} style={{ color: "var(--color-danger, #e55)" }} />
      </span>
    );
  }
  if (stale) {
    return (
      <span className={styles.connectionDot} title="Connected but no events received recently">
        <Wifi size={12} style={{ color: "var(--color-warning, #ea0)" }} />
      </span>
    );
  }
  return (
    <span className={styles.connectionDot} title="Connected — receiving events">
      <Wifi size={12} style={{ color: "var(--color-success, #4c9)" }} />
    </span>
  );
}

export function AutomationBar({ projectId }: AutomationBarProps) {
  const { subscribe, connected, lastEventAt } = useEventContext();
  const { setActiveTab } = useSidekick();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  useEffect(() => {
    const unsubs = [
      subscribe("loop_started", () => {
        setRunning(true);
        setPaused(false);
        setStarting(false);
      }),
      subscribe("loop_paused", () => {
        setPaused(true);
      }),
      subscribe("loop_stopped", () => {
        setRunning(false);
        setPaused(false);
        setStarting(false);
      }),
      subscribe("loop_finished", () => {
        setRunning(false);
        setPaused(false);
        setStarting(false);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [subscribe]);

  let status: AutomationStatus = "idle";
  if (starting) status = "starting";
  else if (paused) status = "paused";
  else if (running) status = "active";

  const handleStart = async () => {
    try {
      setStarting(true);
      setActiveTab("tasks");
      await api.startLoop(projectId);
      setRunning(true);
      setPaused(false);
    } catch (err) {
      setStarting(false);
      console.error("Failed to start loop", err);
    }
  };

  const handlePause = async () => {
    try {
      await api.pauseLoop(projectId);
    } catch (err) {
      console.error("Failed to pause loop", err);
    }
  };

  const handleStop = () => {
    setConfirmStop(true);
  };

  const handleStopConfirm = async () => {
    setConfirmStop(false);
    try {
      await api.stopLoop(projectId);
    } catch (err) {
      console.error("Failed to stop loop", err);
    }
  };

  const canPlay = (!running && !paused && !starting) || paused;
  const canPause = running && !paused;
  const canStop = running || paused;

  return (
    <>
      <div className={styles.automationBar}>
        <div className={styles.automationLabel}>
          <Text size="sm" style={{ fontWeight: 600 }}>Automation</Text>
          <StatusBadge status={status} />
          <ConnectionDot connected={connected} lastEventAt={lastEventAt} />
        </div>
        <div className={styles.automationControls}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<Play size={14} />}
            onClick={handleStart}
            disabled={!canPlay}
            title={paused ? "Resume" : "Start"}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<Pause size={14} />}
            onClick={handlePause}
            disabled={!canPause}
            title="Pause"
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<Square size={14} />}
            onClick={handleStop}
            disabled={!canStop}
            title="Stop"
          />
        </div>
      </div>

      <ModalConfirm
        isOpen={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={handleStopConfirm}
        title="Stop Execution"
        message="Stop autonomous execution? The current task will complete first."
        confirmLabel="Stop"
        cancelLabel="Cancel"
        danger
      />
    </>
  );
}
