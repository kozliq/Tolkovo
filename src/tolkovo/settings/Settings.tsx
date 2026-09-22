import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { commands, type PillMode } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { Row, Segmented, Switch } from "../components/Controls";
import { HotkeyButton } from "../components/HotkeyButton";

interface SettingsProps {
  onAdvanced?: () => void;
}

/** The one settings window (design/Settings.dc.html). */
export const Settings = ({ onAdvanced }: SettingsProps) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const [pillMode, setPillMode] = useState<PillMode>("always");
  const [version, setVersion] = useState("");

  useEffect(() => {
    commands
      .tolkovoGetPillMode()
      .then(setPillMode)
      .catch(() => {});
    getVersion()
      // "0.1.0" reads as "0.1", like the mockup.
      .then((v) => setVersion(v.replace(/\.0$/, "")))
      .catch(() => {});
  }, []);

  const changePillMode = (mode: PillMode) => {
    setPillMode(mode);
    commands.tolkovoSetPillMode(mode).catch(() => {});
  };

  return (
    <div className="tk-page">
      <h1 className="tk-title">{t("tolkovo.settings.title")}</h1>

      <div className="tk-group">
        <Row
          title={t("tolkovo.settings.hotkey.title")}
          hint={t("tolkovo.settings.hotkey.hint")}
        >
          <HotkeyButton />
        </Row>
        <div className="tk-divider tk-divider-row" />
        <Row title={t("tolkovo.settings.pill.title")}>
          <Segmented<PillMode>
            label={t("tolkovo.settings.pill.label")}
            value={pillMode}
            onChange={changePillMode}
            options={[
              { value: "always", label: t("tolkovo.settings.pill.always") },
              {
                value: "while_recording",
                label: t("tolkovo.settings.pill.recording"),
              },
            ]}
          />
        </Row>
        <div className="tk-divider tk-divider-row" />
        <Row title={t("tolkovo.settings.autostart")}>
          <Switch
            label={t("tolkovo.settings.autostart")}
            checked={getSetting("autostart_enabled") ?? true}
            onChange={(v) => updateSetting("autostart_enabled", v)}
          />
        </Row>
      </div>

      <div className="tk-section-head">
        <div className="tk-row-text">
          <div className="tk-section-title">
            {t("tolkovo.settings.dictionary.title")}
          </div>
          <div className="tk-row-hint">
            {t("tolkovo.settings.dictionary.hint")}
          </div>
        </div>
        <button type="button" className="tk-btn-2" disabled>
          {t("tolkovo.settings.dictionary.add")}
        </button>
      </div>
      <div className="tk-group tk-empty">
        {t("tolkovo.settings.dictionary.empty")}
      </div>

      <div className="tk-page-footer">
        <button type="button" className="tk-link" onClick={onAdvanced}>
          {t("tolkovo.settings.advancedLink")}
        </button>
        <div className="tk-about">
          {t("tolkovo.settings.about", { version })}
        </div>
      </div>
    </div>
  );
};
