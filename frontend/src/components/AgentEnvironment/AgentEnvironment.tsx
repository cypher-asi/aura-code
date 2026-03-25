import { useState, useRef, useEffect, useCallback } from "react"
import { useEnvironmentInfo } from "../../hooks/use-environment-info"
import { api } from "../../api/client"
import type { RemoteVmState } from "../../types"
import { VmStatusBadge } from "../VmStatusBadge"
import styles from "./AgentEnvironment.module.css"

interface AgentEnvironmentProps {
  machineType: "local" | "remote"
  agentId?: string
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const POLL_INTERVAL = 15_000

export function AgentEnvironment({ machineType, agentId }: AgentEnvironmentProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { data } = useEnvironmentInfo()
  const isLocal = machineType === "local"
  const isRemote = machineType === "remote" && !!agentId

  const [vmState, setVmState] = useState<RemoteVmState | null>(null)

  useEffect(() => {
    if (!isRemote) return

    let cancelled = false

    const fetchState = () => {
      api.swarm
        .getRemoteAgentState(agentId!)
        .then((state) => {
          if (!cancelled) setVmState(state)
        })
        .catch(() => {})
    }

    fetchState()
    const interval = setInterval(fetchState, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isRemote, agentId])

  const handleMouseEnter = useCallback(() => setOpen(true), [])
  const handleMouseLeave = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={styles.indicator}>
        <span className={`${styles.dot} ${isLocal ? styles.dotLocal : styles.dotRemote}`} />
        {isLocal ? "Local" : "Remote"}
      </span>

      {open && (
        <div className={styles.statusCard}>
          {isRemote && vmState ? (
            <>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Status</span>
                <span className={styles.statusValue}>
                  <VmStatusBadge state={vmState.state} />
                </span>
              </div>
              {vmState.endpoint && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>IP</span>
                  <span className={styles.statusValue}>{vmState.endpoint}</span>
                </div>
              )}
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Uptime</span>
                <span className={styles.statusValue}>{formatUptime(vmState.uptime_seconds)}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Sessions</span>
                <span className={styles.statusValue}>{vmState.active_sessions}</span>
              </div>
              {vmState.runtime_version && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Runtime</span>
                  <span className={styles.statusValue}>{vmState.runtime_version}</span>
                </div>
              )}
              {(vmState.cpu_millicores || vmState.memory_mb) && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Resources</span>
                  <span className={styles.statusValue}>
                    {vmState.cpu_millicores ? `${vmState.cpu_millicores}m CPU` : ""}
                    {vmState.cpu_millicores && vmState.memory_mb ? " · " : ""}
                    {vmState.memory_mb ? `${vmState.memory_mb}MB RAM` : ""}
                  </span>
                </div>
              )}
              {vmState.isolation && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Isolation</span>
                  <span className={styles.statusValue}>
                    {vmState.isolation === "micro_vm" ? "MicroVM" : "Container"}
                  </span>
                </div>
              )}
              {vmState.agent_id && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Agent ID</span>
                  <span className={styles.statusValue}>{vmState.agent_id.slice(0, 12)}…</span>
                </div>
              )}
              {vmState.error_message && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Error</span>
                  <span className={styles.statusValue}>{vmState.error_message}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Status</span>
                <span className={styles.statusValue}>{isLocal ? "Running locally" : "Remote agent"}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>IP</span>
                <span className={styles.statusValue}>{data?.ip ?? "—"}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>File Path</span>
                <span className={styles.statusValue}>{data?.cwd ?? "—"}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>OS</span>
                <span className={styles.statusValue}>
                  {data ? `${data.os} (${data.architecture})` : "—"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
