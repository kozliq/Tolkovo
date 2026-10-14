import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowIcon } from "../components/icons";
import { monthGen } from "./format";
import { MonthCard } from "./MonthCard";
import type { MonthRecap } from "@/bindings";

interface Props {
  recap: MonthRecap;
  /** Short note under the buttons ("Сохранено в Загрузки"). */
  status?: string;
  onSave: (svg: SVGSVGElement) => void;
  onCopy: (svg: SVGSVGElement) => void;
  onBack: () => void;
}

/** «Итоги месяца»: the card on the left, two buttons on the right. */
export const MonthRecapPage = ({
  recap,
  status,
  onSave,
  onCopy,
  onBack,
}: Props) => {
  const { t } = useTranslation();
  const card = useRef<SVGSVGElement>(null);

  return (
    <div className="tk-page tk-recap">
      <div className="tk-recap-card">
        <MonthCard ref={card} recap={recap} />
      </div>
      <div className="tk-recap-side">
        <button type="button" className="tk-back" onClick={onBack}>
          <span className="tk-back-arrow">
            <ArrowIcon size={14} />
          </span>
          {t("tolkovo.stats.title")}
        </button>
        <h1 className="tk-title">
          {t("tolkovo.recap.title", { month: monthGen(recap.month) })}
        </h1>
        <p className="tk-row-hint">{t("tolkovo.recap.lead")}</p>
        <div className="tk-recap-actions">
          <button
            type="button"
            className="tk-btn"
            onClick={() => card.current && onSave(card.current)}
          >
            {t("tolkovo.recap.save")}
          </button>
          <button
            type="button"
            className="tk-btn-2"
            onClick={() => card.current && onCopy(card.current)}
          >
            {t("tolkovo.recap.copy")}
          </button>
        </div>
        {status && <p className="tk-row-hint">{status}</p>}
      </div>
    </div>
  );
};
