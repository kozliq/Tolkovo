import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type MonthRecap } from "@/bindings";
import { ArrowIcon } from "../components/icons";
import { monthGen } from "./format";
import { MonthRecapPage } from "./MonthRecapPage";
import { svgToPng } from "./png";

/** «Итоги месяца» wired to the Rust recap: save to Downloads or copy. */
export const RecapScreen = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const [recap, setRecap] = useState<MonthRecap | null | undefined>(undefined);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    commands
      .tolkovoStatsRecap()
      .then(setRecap)
      .catch(() => setRecap(null));
  }, []);

  if (recap === undefined) return null;
  if (recap === null)
    return (
      <div className="tk-page">
        <button type="button" className="tk-back" onClick={onBack}>
          <span className="tk-back-arrow">
            <ArrowIcon size={14} />
          </span>
          {t("tolkovo.stats.title")}
        </button>
        <div className="tk-empty">{t("tolkovo.recap.empty")}</div>
      </div>
    );

  const name = t("tolkovo.recap.fileName", {
    month: monthGen(recap.month),
    year: recap.year,
  });

  const save = async (svg: SVGSVGElement) => {
    try {
      const res = await commands.tolkovoSavePng(name, await svgToPng(svg));
      setStatus(
        res.status === "ok"
          ? t("tolkovo.recap.savedTo")
          : t("tolkovo.recap.failed"),
      );
    } catch {
      setStatus(t("tolkovo.recap.failed"));
    }
  };

  const copy = async (svg: SVGSVGElement) => {
    try {
      const res = await commands.tolkovoCopyPng(await svgToPng(svg));
      setStatus(
        res.status === "ok"
          ? t("tolkovo.recap.copied")
          : t("tolkovo.recap.failed"),
      );
    } catch {
      setStatus(t("tolkovo.recap.failed"));
    }
  };

  return (
    <MonthRecapPage
      recap={recap}
      status={status}
      onSave={save}
      onCopy={copy}
      onBack={onBack}
    />
  );
};
