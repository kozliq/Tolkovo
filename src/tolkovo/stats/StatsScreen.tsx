import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, type StatsPeriod, type StatsSummary } from "@/bindings";
import { Stats } from "./Stats";

const EMPTY: StatsSummary = {
  words: 0,
  dictations: 0,
  streak_days: 0,
  longest_dictation_words: 0,
  top_day: null,
  fillers: [],
  ai_prompts: 0,
  ai_apps: [],
  top_words: [],
};

/** «Статистика» wired to the Rust counters; refreshes after each dictation. */
export const StatsScreen = ({ onBack }: { onBack: () => void }) => {
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [stats, setStats] = useState<StatsSummary>(EMPTY);
  const [enabled, setEnabled] = useState(true);
  const [resetArmed, setResetArmed] = useState(false);
  const disarm = useRef<number | undefined>(undefined);

  const load = useCallback(() => {
    commands
      .tolkovoStatsSummary(period)
      .then(setStats)
      .catch(() => {});
  }, [period]);

  useEffect(() => {
    load();
    const off = listen("tk-stats-changed", load);
    return () => {
      off.then((f) => f());
    };
  }, [load]);

  useEffect(() => {
    commands
      .tolkovoStatsGetEnabled()
      .then(setEnabled)
      .catch(() => {});
    return () => window.clearTimeout(disarm.current);
  }, []);

  const changeEnabled = (v: boolean) => {
    setEnabled(v);
    commands.tolkovoStatsSetEnabled(v).catch(() => {});
  };

  const reset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      disarm.current = window.setTimeout(() => setResetArmed(false), 4000);
      return;
    }
    window.clearTimeout(disarm.current);
    setResetArmed(false);
    commands
      .tolkovoStatsReset()
      .then(load)
      .catch(() => {});
  };

  return (
    <Stats
      period={period}
      onPeriod={setPeriod}
      stats={stats}
      enabled={enabled}
      onEnabled={changeEnabled}
      resetArmed={resetArmed}
      onReset={reset}
      onBack={onBack}
    />
  );
};
