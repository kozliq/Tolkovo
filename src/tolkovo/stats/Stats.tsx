import { useTranslation } from "react-i18next";
import { Segmented, Switch } from "../components/Controls";
import { ArrowIcon } from "../components/icons";
import { dayLabel, duration, num, savedMinutes } from "./format";
import type { Counted, StatsPeriod, StatsSummary } from "@/bindings";

interface StatsProps {
  period: StatsPeriod;
  onPeriod: (p: StatsPeriod) => void;
  stats: StatsSummary;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  /** Asked once ("Точно сбросить?") before the counters are wiped. */
  resetArmed: boolean;
  onReset: () => void;
  onBack: () => void;
}

const Chips = ({ items, suffix }: { items: Counted[]; suffix?: boolean }) => (
  <div className="tk-chips">
    {items.map((c) => (
      <span key={c.name} className="tk-chip">
        {suffix ? `«${c.name}»` : c.name}
        <b>× {num(c.count)}</b>
      </span>
    ))}
  </div>
);

/** "Статистика": big numbers, minimum text (TOLKOVO.md, 5_STATS). */
export const Stats = ({
  period,
  onPeriod,
  stats,
  enabled,
  onEnabled,
  resetArmed,
  onReset,
  onBack,
}: StatsProps) => {
  const { t } = useTranslation();
  const maxApp = Math.max(1, ...stats.ai_apps.map((a) => a.count));

  return (
    <div className="tk-page">
      <button type="button" className="tk-back" onClick={onBack}>
        <span className="tk-back-arrow">
          <ArrowIcon size={14} />
        </span>
        {t("tolkovo.settings.title")}
      </button>

      <div className="tk-section-head">
        <h1 className="tk-title">{t("tolkovo.stats.title")}</h1>
        <Segmented<StatsPeriod>
          label={t("tolkovo.stats.period")}
          value={period}
          onChange={onPeriod}
          options={(["today", "week", "month", "all"] as const).map((p) => ({
            value: p,
            label: t(`tolkovo.stats.periods.${p}`),
          }))}
        />
      </div>

      <div className="tk-group tk-hero">
        <div className="tk-hero-main">
          <span className="tk-big">{num(stats.words)}</span>
          <span className="tk-big-unit">
            {t("tolkovo.stats.words", { count: stats.words })}
          </span>
        </div>
        <div className="tk-hero-side">
          <div>
            <div className="tk-mid">{duration(savedMinutes(stats.words))}</div>
            <div className="tk-label">{t("tolkovo.stats.saved")}</div>
          </div>
          <div>
            <div className="tk-mid">{num(stats.dictations)}</div>
            <div className="tk-label">
              {t("tolkovo.stats.dictations", { count: stats.dictations })}
            </div>
          </div>
        </div>
      </div>

      <div className="tk-tiles">
        <div className="tk-group tk-tile">
          <div className="tk-mid">
            {t("tolkovo.stats.days", { count: stats.streak_days })}
          </div>
          <div className="tk-label">{t("tolkovo.stats.streak")}</div>
        </div>
        <div className="tk-group tk-tile">
          <div className="tk-mid">
            {t("tolkovo.stats.wordsN", {
              count: stats.longest_dictation_words,
              n: num(stats.longest_dictation_words),
            })}
          </div>
          <div className="tk-label">{t("tolkovo.stats.longest")}</div>
        </div>
        <div className="tk-group tk-tile">
          <div className="tk-mid">
            {stats.top_day
              ? t("tolkovo.stats.wordsN", {
                  count: stats.top_day.words,
                  n: num(stats.top_day.words),
                })
              : "—"}
          </div>
          <div className="tk-label">
            {stats.top_day
              ? t("tolkovo.stats.topDay", { day: dayLabel(stats.top_day.date) })
              : t("tolkovo.stats.topDayEmpty")}
          </div>
        </div>
      </div>

      <div className="tk-section-head">
        <div className="tk-section-title">{t("tolkovo.stats.fillers")}</div>
        <div className="tk-row-hint">{t("tolkovo.stats.fillersHint")}</div>
      </div>
      {stats.fillers.length ? (
        <Chips items={stats.fillers} suffix />
      ) : (
        <div className="tk-row-hint">{t("tolkovo.stats.fillersEmpty")}</div>
      )}

      <div className="tk-section-head">
        <div className="tk-section-title">{t("tolkovo.stats.ai")}</div>
        <div className="tk-mid">{num(stats.ai_prompts)}</div>
      </div>
      <div className="tk-group tk-bars">
        {!stats.ai_apps.length && (
          <div className="tk-row-hint">{t("tolkovo.stats.aiEmpty")}</div>
        )}
        {stats.ai_apps.map((a) => (
          <div key={a.name} className="tk-bar-row">
            <span className="tk-bar-name">{a.name}</span>
            <span className="tk-bar">
              <span style={{ width: `${(a.count / maxApp) * 100}%` }} />
            </span>
            <span className="tk-bar-n">{num(a.count)}</span>
          </div>
        ))}
      </div>

      <div className="tk-section-head">
        <div className="tk-section-title">{t("tolkovo.stats.topWords")}</div>
      </div>
      {stats.top_words.length ? (
        <Chips items={stats.top_words} />
      ) : (
        <div className="tk-row-hint">{t("tolkovo.stats.topWordsEmpty")}</div>
      )}

      <div className="tk-group">
        <div className="tk-row">
          <div className="tk-row-text">
            <div className="tk-row-title">{t("tolkovo.stats.enabled")}</div>
            <div className="tk-row-hint">{t("tolkovo.stats.private")}</div>
          </div>
          <Switch
            label={t("tolkovo.stats.enabled")}
            checked={enabled}
            onChange={onEnabled}
          />
        </div>
        <div className="tk-divider tk-divider-row" />
        <div className="tk-row">
          <div className="tk-row-title">{t("tolkovo.stats.reset")}</div>
          <button type="button" className="tk-link" onClick={onReset}>
            {resetArmed
              ? t("tolkovo.stats.resetConfirm")
              : t("tolkovo.stats.resetAction")}
          </button>
        </div>
      </div>

      <div className="tk-about">{t("tolkovo.stats.formula")}</div>
    </div>
  );
};
