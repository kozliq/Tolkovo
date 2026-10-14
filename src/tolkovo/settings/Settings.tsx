import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { commands, type PillMode } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { Row, Segmented, Switch } from "../components/Controls";
import { HotkeyButton } from "../components/HotkeyButton";
import { Dictionary } from "./Dictionary";

interface SettingsProps {
  onAdvanced?: () => void;
  onStats?: () => void;
}

/** The one settings window (design/Settings.dc.html). */
export const Settings = ({ onAdvanced, onStats }: SettingsProps) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const [pillMode, setPillMode] = useState<PillMode>("always");
  const [version, setVersion] = useState("");
  const [period, setPeriod] = useState(true);

  useEffect(() => {
    commands
      .tolkovoGetPillMode()
      .then(setPillMode)
      .catch(() => {});
    commands
      .tolkovoGetTrailingPeriod()
      .then(setPeriod)
      .catch(() => {});
    getVersion()
      // "0.1.0" reads as "0.1", like the mockup.
      .then((v) => setVersion(v.replace(/\.0$/, "")))
      .catch(() => {});
  }, []);

  const changePeriod = (v: boolean) => {
    setPeriod(v);
    commands.tolkovoSetTrailingPeriod(v).catch(() => {});
  };

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
        <div className="tk-divider tk-divider-row" />
        <Row
          title={t("tolkovo.settings.period.title")}
          hint={t("tolkovo.settings.period.hint")}
        >
          <Switch
            label={t("tolkovo.settings.period.title")}
            checked={period}
            onChange={changePeriod}
          />
        </Row>
        <div className="tk-divider tk-divider-row" />
        <Row
          title={t("tolkovo.settings.copy.title")}
          hint={t("tolkovo.settings.copy.hint")}
        >
          <Switch
            label={t("tolkovo.settings.copy.title")}
            checked={getSetting("clipboard_handling") === "copy_to_clipboard"}
            onChange={(v) =>
              updateSetting(
                "clipboard_handling",
                v ? "copy_to_clipboard" : "dont_modify",
              )
            }
          />
        </Row>
      </div>

      <Dictionary />

      <div className="tk-page-footer">
        <div className="tk-links">
          <button type="button" className="tk-link" onClick={onStats}>
            {t("tolkovo.settings.statsLink")}
          </button>
          <button type="button" className="tk-link" onClick={onAdvanced}>
            {t("tolkovo.settings.advancedLink")}
          </button>
        </div>
        <div className="tk-about">
          {t("tolkovo.settings.about", { version })}
        </div>
      </div>
    </div>
  );
};
