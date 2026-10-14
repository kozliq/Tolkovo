import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { duration, monthName, num, savedMinutes } from "./format";
import type { MonthRecap } from "@/bindings";

/** Product name, not translated. */
const BRAND = "Tolkovo";
const W = 1080;
const H = 1920;
const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif";

/**
 * The month card, drawn once at story size (1080×1920) and scaled on screen,
 * so the saved PNG is exactly what the user sees. No links, no calls to
 * action — only a small "Tolkovo" signature.
 */
export const MonthCard = forwardRef<SVGSVGElement, { recap: MonthRecap }>(
  ({ recap }, ref) => {
    const { t } = useTranslation();
    const stats = recap.summary;
    const filler = stats.fillers[0];
    const topWord = stats.top_words[0];
    const rows: [string, string, boolean?][] = [
      [t("tolkovo.recap.saved"), duration(savedMinutes(stats.words))],
      [t("tolkovo.recap.ai"), num(stats.ai_prompts)],
      ...(filler
        ? ([
            [
              t("tolkovo.recap.filler", { word: filler.name }),
              t("tolkovo.stats.timesN", {
                count: filler.count,
                n: num(filler.count),
              }),
              true,
            ],
          ] as [string, string, boolean][])
        : []),
      ...(topWord
        ? ([[t("tolkovo.recap.topWord"), `«${topWord.name}»`]] as [
            string,
            string,
          ][])
        : []),
      [
        t("tolkovo.recap.streak"),
        t("tolkovo.stats.days", { count: stats.streak_days }),
      ],
    ];
    const rowTop = 940;
    const rowH = 150;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        fontFamily={FONT}
        className="tk-card"
      >
        <defs>
          <radialGradient id="rc1" cx="12%" cy="10%" r="70%">
            <stop offset="0" stopColor="#3a2c5c" />
            <stop offset="1" stopColor="#3a2c5c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rc2" cx="90%" cy="92%" r="75%">
            <stop offset="0" stopColor="#6a2236" />
            <stop offset="1" stopColor="#6a2236" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rc3" cx="85%" cy="6%" r="50%">
            <stop offset="0" stopColor="#1d3c5e" />
            <stop offset="1" stopColor="#1d3c5e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rcLiq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C23A52" />
            <stop offset="1" stopColor="#7A1A30" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#0f0f13" />
        <rect width={W} height={H} fill="url(#rc1)" />
        <rect width={W} height={H} fill="url(#rc3)" />
        <rect width={W} height={H} fill="url(#rc2)" />

        <text
          x="96"
          y="250"
          fontSize="52"
          fontWeight="600"
          fill="rgba(255,255,255,.64)"
        >
          {t("tolkovo.recap.heading", { month: monthName(recap.month) })}
        </text>
        <text
          x="90"
          y="560"
          fontSize="250"
          fontWeight="800"
          letterSpacing="-10"
          fill="#fff"
        >
          {num(stats.words)}
        </text>
        <text x="96" y="660" fontSize="64" fill="rgba(255,255,255,.64)">
          {t("tolkovo.stats.words", { count: stats.words })}
        </text>

        {rows.map(([label, value, accent], i) => {
          const y = rowTop + i * rowH;
          return (
            <g key={label}>
              <rect
                x="96"
                y={y - 92}
                width={W - 192}
                height="2"
                fill="rgba(255,255,255,.1)"
              />
              <text x="96" y={y} fontSize="48" fill="rgba(255,255,255,.64)">
                {label}
              </text>
              <text
                x={W - 96}
                y={y}
                textAnchor="end"
                fontSize="52"
                fontWeight="700"
                fill={accent ? "#E0566E" : "#fff"}
              >
                {value}
              </text>
            </g>
          );
        })}

        <g transform={`translate(96 ${H - 150})`}>
          <rect
            width="26"
            height="56"
            rx="13"
            fill="rgba(255,255,255,.12)"
            stroke="rgba(255,255,255,.35)"
            strokeWidth="2"
          />
          <rect y="22" width="26" height="34" rx="13" fill="url(#rcLiq)" />
          <text
            x="48"
            y="42"
            fontSize="40"
            fontWeight="700"
            fill="rgba(255,255,255,.8)"
          >
            {BRAND}
          </text>
        </g>
      </svg>
    );
  },
);
MonthCard.displayName = "MonthCard";
