import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { platform } from "@tauri-apps/plugin-os";
import {
  checkAccessibilityPermission,
  checkMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { commands } from "@/bindings";
import { useSettingsStore } from "@/stores/settingsStore";
import { Welcome } from "./onboarding/Welcome";
import { Download } from "./onboarding/Download";
import { Ready } from "./onboarding/Ready";
import { Settings } from "./settings/Settings";
import { Advanced } from "./settings/Advanced";
import { useErrorToasts } from "./useErrorToasts";
import { closeWindow, resizeWindow } from "./window";
import "./tolkovo.css";

type Stage =
  | "loading"
  | "welcome"
  | "download"
  | "ready"
  | "settings"
  | "advanced";

const hasPermissions = async (): Promise<boolean> => {
  if (platform() !== "macos") return true;
  try {
    const [a, m] = await Promise.all([
      checkAccessibilityPermission(),
      checkMicrophonePermission(),
    ]);
    return a && m;
  } catch {
    return true;
  }
};

/**
 * Tolkovo's own face on top of the Handy engine: first run (three screens)
 * and settings. Handy's screens are not shown.
 */
export const TolkovoApp = () => {
  const { i18n } = useTranslation();
  const [stage, setStage] = useState<Stage>("loading");
  const [modelReady, setModelReady] = useState(false);
  const engineStarted = useRef(false);
  const refreshAudioDevices = useSettingsStore((s) => s.refreshAudioDevices);
  const refreshOutputDevices = useSettingsStore((s) => s.refreshOutputDevices);

  useErrorToasts();

  // The interface is Russian only.
  useEffect(() => {
    if (i18n.language !== "ru") i18n.changeLanguage("ru");
  }, [i18n]);

  // Paste + hotkeys need the accessibility permission, so they start only
  // once it is granted (same order as Handy).
  const startEngine = useCallback(() => {
    if (engineStarted.current) return;
    engineStarted.current = true;
    Promise.all([
      commands.initializeEnigo(),
      commands.initializeShortcuts(),
    ]).catch((e) => console.warn("Failed to initialize:", e));
    refreshAudioDevices();
    refreshOutputDevices();
  }, [refreshAudioDevices, refreshOutputDevices]);

  useEffect(() => {
    (async () => {
      const result = await commands.getAppSettings();
      const s = result.status === "ok" ? result.data : null;
      const onboarded = !!s?.onboarding_completed && !!s?.selected_model;
      setModelReady(onboarded);
      const permitted = await hasPermissions();
      if (onboarded && permitted) {
        startEngine();
        setStage("settings");
        return;
      }
      if (!permitted) {
        // Missing permissions: the window must be seen even when the app
        // started hidden.
        commands.showMainWindowCommand().catch(() => {});
      }
      setStage("welcome");
    })();
  }, [startEngine]);

  useEffect(() => {
    if (stage === "loading") return;
    resizeWindow(
      stage === "settings" || stage === "advanced" ? "settings" : "onboarding",
    );
  }, [stage]);

  const afterWelcome = () => {
    startEngine();
    if (modelReady) {
      // Returning user who only had to re-grant permissions.
      closeWindow();
      setStage("settings");
    } else {
      setStage("download");
    }
  };

  const finish = () => {
    closeWindow();
    setStage("settings");
  };

  let content = null;
  if (stage === "welcome") content = <Welcome onNext={afterWelcome} />;
  else if (stage === "download")
    content = (
      <Download
        onDone={() => {
          setStage("ready");
          // The first run is done: the pill appears now.
          commands.tolkovoOnboardingFinished().catch(() => {});
        }}
      />
    );
  else if (stage === "ready") content = <Ready onFinish={finish} />;
  else if (stage === "settings")
    content = <Settings onAdvanced={() => setStage("advanced")} />;
  else if (stage === "advanced")
    content = <Advanced onBack={() => setStage("settings")} />;

  return (
    <div className="tk-window">
      <div className="tk-drag" data-tauri-drag-region />
      <Toaster theme="dark" position="bottom-center" />
      {content}
    </div>
  );
};

export default TolkovoApp;
