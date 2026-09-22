import { useTranslation } from "react-i18next";
import { Steps } from "../components/Steps";
import { useHotkeyLabel } from "../components/Hotkey";

interface ReadyProps {
  onFinish: () => void;
}

/** Step 3: "Готово. Говори." with the hotkey drawn as keycaps. */
export const Ready = ({ onFinish }: ReadyProps) => {
  const { t } = useTranslation();
  const keys = useHotkeyLabel().split(" ");

  return (
    <div className="tk-onb" style={{ paddingTop: 72 }}>
      <div className="tk-keys">
        {keys.map((key, i) => (
          <div key={`${key}-${i}`} className="tk-keys">
            {i > 0 && (
              <div className="tk-key-plus">{t("tolkovo.keys.plus")}</div>
            )}
            <div className={`tk-key ${key.length > 2 ? "tk-key-wide" : ""}`}>
              {key}
            </div>
          </div>
        ))}
      </div>
      <h1 className="tk-h1" style={{ marginTop: 34 }}>
        {t("tolkovo.ready.title")}
      </h1>
      <p className="tk-lead">{t("tolkovo.ready.text")}</p>

      <div className="tk-footer">
        <Steps current={3} />
        <button type="button" className="tk-btn" onClick={onFinish}>
          {t("tolkovo.ready.try")}
        </button>
      </div>
    </div>
  );
};
