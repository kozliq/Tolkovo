import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type Rule } from "@/bindings";
import { ArrowIcon } from "../components/icons";

/**
 * "Словарь": the user's own replacements (было → стало), as in
 * design/Settings.dc.html. The starter set of common anglicisms works on its
 * own and is only mentioned, not listed.
 */
export const Dictionary = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [starter, setStarter] = useState(0);
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    commands
      .tolkovoDictionaryGet()
      .then(setRules)
      .catch(() => {});
    commands
      .tolkovoDictionaryStarterCount()
      .then(setStarter)
      .catch(() => {});
  }, []);

  const save = (next: Rule[]) => {
    setRules(next);
    commands.tolkovoDictionarySet(next).catch(() => {});
  };

  const add = () => {
    if (!from.trim() || !to.trim()) return;
    save([...rules, { from: from.trim(), to: to.trim() }]);
    setFrom("");
    setTo("");
    setAdding(false);
  };

  return (
    <>
      <div className="tk-section-head">
        <div className="tk-row-text">
          <div className="tk-section-title">
            {t("tolkovo.settings.dictionary.title")}
          </div>
          <div className="tk-row-hint">
            {t("tolkovo.settings.dictionary.hint")}
          </div>
        </div>
        <button
          type="button"
          className="tk-btn-2"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          {t("tolkovo.settings.dictionary.add")}
        </button>
      </div>
      <div className="tk-group tk-dict">
        {adding && (
          <form
            className="tk-dict-row"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              autoFocus
              className="tk-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={t("tolkovo.settings.dictionary.from")}
              aria-label={t("tolkovo.settings.dictionary.from")}
            />
            <ArrowIcon size={16} />
            <input
              className="tk-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={t("tolkovo.settings.dictionary.to")}
              aria-label={t("tolkovo.settings.dictionary.to")}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            />
            <button type="submit" className="tk-btn-2">
              {t("tolkovo.settings.dictionary.save")}
            </button>
          </form>
        )}
        {rules.map((r, i) => (
          <div className="tk-dict-row" key={`${r.from}-${i}`}>
            <div className="tk-dict-from">{r.from}</div>
            <ArrowIcon size={16} />
            <div className="tk-dict-to">{r.to}</div>
            <button
              type="button"
              className="tk-dict-del"
              aria-label={t("tolkovo.settings.dictionary.delete")}
              onClick={() => save(rules.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        {!adding && rules.length === 0 && (
          <div className="tk-empty">
            {t("tolkovo.settings.dictionary.empty")}
          </div>
        )}
      </div>
      {starter > 0 && (
        <div className="tk-row-hint tk-dict-note">
          {t("tolkovo.settings.dictionary.starter", { count: starter })}
        </div>
      )}
    </>
  );
};
