import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { commands } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsStore } from "@/stores/settingsStore";
import { useModelStore } from "@/stores/modelStore";
import { Row, Select, Switch } from "../components/Controls";
import { ArrowIcon } from "../components/icons";
import { findTolkovoModel } from "../model";

interface AdvancedProps {
  onBack: () => void;
}

const PASTE_METHODS = ["ctrl_v", "direct", "none"] as const;

/**
 * "Дополнительно": the technical bits kept out of the main settings —
 * recognition model, microphone, paste method, sounds, data folder.
 */
export const Advanced = ({ onBack }: AdvancedProps) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const audioDevices = useSettingsStore((s) => s.audioDevices);
  const refreshAudioDevices = useSettingsStore((s) => s.refreshAudioDevices);
  const {
    models,
    currentModel,
    selectModel,
    downloadModel,
    deleteModel,
    downloadProgress,
    downloadingModels,
  } = useModelStore();
  const [pending, setPending] = useState<string | null>(null);
  const switching = useRef(false);

  useEffect(() => {
    refreshAudioDevices();
  }, [refreshAudioDevices]);

  const standard = findTolkovoModel(models);

  // Models that understand Russian; the standard one first.
  const russian = useMemo(
    () =>
      models
        .filter(
          (m) =>
            m.supported_languages.includes("ru") &&
            (!m.name.includes("(") || m.is_downloaded),
        )
        .sort((a, b) =>
          a.id === standard?.id
            ? -1
            : b.id === standard?.id
              ? 1
              : Number(b.is_downloaded) - Number(a.is_downloaded) ||
                b.accuracy_score - a.accuracy_score,
        ),
    [models, standard?.id],
  );

  const modelLabel = (id: string) => {
    const m = models.find((x) => x.id === id);
    if (!m) return id;
    if (id in downloadingModels)
      return t("tolkovo.advanced.model.downloading", {
        pct: Math.floor(downloadProgress[id]?.percentage ?? 0),
      });
    if (id === standard?.id) return t("tolkovo.advanced.model.standard");
    if (!m.is_downloaded)
      return t("tolkovo.advanced.model.notDownloaded", { name: m.name });
    return m.name;
  };

  // Once a model picked here finishes downloading, switch to it.
  useEffect(() => {
    if (!pending || switching.current) return;
    const m = models.find((x) => x.id === pending);
    if (!m?.is_downloaded || pending in downloadingModels) return;
    switching.current = true;
    selectModel(pending).then((ok) => {
      switching.current = false;
      setPending(null);
      if (!ok) toast.error(t("tolkovo.advanced.model.failed"));
    });
  }, [pending, models, downloadingModels, selectModel, t]);

  const pickModel = async (id: string) => {
    const m = models.find((x) => x.id === id);
    if (!m) return;
    setPending(id);
    if (!m.is_downloaded) {
      const ok = await downloadModel(id);
      if (!ok) {
        setPending(null);
        toast.error(t("tolkovo.advanced.model.failed"));
      }
    }
  };

  const others = models.filter(
    (m) => m.is_downloaded && m.id !== currentModel && !m.is_custom,
  );
  const cleanup = async () => {
    for (const m of others) await deleteModel(m.id);
  };

  const mic = getSetting("selected_microphone") ?? "Default";
  const micOptions = [
    { value: "Default", label: t("tolkovo.advanced.mic.system") },
    ...audioDevices
      .filter((d) => d.name !== "Default" && d.name !== "default")
      .map((d) => ({ value: d.name, label: d.name })),
  ];

  const paste = getSetting("paste_method") ?? "ctrl_v";

  return (
    <div className="tk-page">
      <button type="button" className="tk-back" onClick={onBack}>
        <span className="tk-back-arrow">
          <ArrowIcon size={14} />
        </span>
        {t("tolkovo.advanced.back")}
      </button>
      <h1 className="tk-title">{t("tolkovo.advanced.title")}</h1>

      <div className="tk-group">
        <Row
          title={t("tolkovo.advanced.model.title")}
          hint={t("tolkovo.advanced.model.hint")}
        >
          <Select
            label={t("tolkovo.advanced.model.title")}
            value={pending ?? currentModel}
            disabled={pending !== null}
            onChange={pickModel}
            options={russian.map((m) => ({
              value: m.id,
              label: modelLabel(m.id),
            }))}
          />
        </Row>
        {others.length > 0 && (
          <>
            <div className="tk-divider tk-divider-row" />
            <Row
              title={t("tolkovo.advanced.model.cleanup")}
              hint={t("tolkovo.advanced.model.cleanupHint")}
            >
              <button type="button" className="tk-btn-2" onClick={cleanup}>
                {t("tolkovo.advanced.model.cleanup")}
              </button>
            </Row>
          </>
        )}
      </div>

      <div className="tk-group">
        <Row title={t("tolkovo.advanced.mic.title")}>
          <Select
            label={t("tolkovo.advanced.mic.title")}
            value={mic}
            onChange={(v) => updateSetting("selected_microphone", v)}
            options={micOptions}
          />
        </Row>
        <div className="tk-divider tk-divider-row" />
        <Row title={t("tolkovo.advanced.paste.title")}>
          <Select
            label={t("tolkovo.advanced.paste.title")}
            value={paste}
            onChange={(v) =>
              updateSetting("paste_method", v as (typeof PASTE_METHODS)[number])
            }
            options={PASTE_METHODS.map((m) => ({
              value: m,
              label: t(`tolkovo.advanced.paste.${m}`),
            }))}
          />
        </Row>
        <div className="tk-divider tk-divider-row" />
        <Row title={t("tolkovo.advanced.sounds")}>
          <Switch
            label={t("tolkovo.advanced.sounds")}
            checked={getSetting("audio_feedback") ?? false}
            onChange={(v) => updateSetting("audio_feedback", v)}
          />
        </Row>
        <div className="tk-divider tk-divider-row" />
        <Row title={t("tolkovo.advanced.data.title")}>
          <button
            type="button"
            className="tk-btn-2"
            onClick={() => commands.openAppDataDir().catch(() => {})}
          >
            {t("tolkovo.advanced.data.open")}
          </button>
        </Row>
      </div>
    </div>
  );
};
