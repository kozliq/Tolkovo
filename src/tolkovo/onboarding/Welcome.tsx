import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { platform } from "@tauri-apps/plugin-os";
import {
  checkAccessibilityPermission,
  checkMicrophonePermission,
  requestAccessibilityPermission,
  requestMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { Pill } from "../components/Pill";
import { Steps } from "../components/Steps";
import { CheckIcon, KeyboardIcon, MicIcon } from "../components/icons";
import { useHotkeyLabel } from "../components/Hotkey";

type Status = "checking" | "needed" | "waiting" | "granted";

interface WelcomeProps {
  onNext: () => void;
}

/** Step 1: hello + the two permissions (microphone, accessibility). */
export const Welcome = ({ onNext }: WelcomeProps) => {
  const { t } = useTranslation();
  const hotkey = useHotkeyLabel();
  const isMac = platform() === "macos";
  const [mic, setMic] = useState<Status>(isMac ? "checking" : "granted");
  const [access, setAccess] = useState<Status>(isMac ? "checking" : "granted");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!isMac) return;
    try {
      const [a, m] = await Promise.all([
        checkAccessibilityPermission(),
        checkMicrophonePermission(),
      ]);
      setAccess((prev) =>
        a ? "granted" : prev === "waiting" ? prev : "needed",
      );
      setMic((prev) => (m ? "granted" : prev === "waiting" ? prev : "needed"));
    } catch (e) {
      console.warn("Failed to check permissions:", e);
    }
  }, [isMac]);

  useEffect(() => {
    refresh();
    // macOS gives no callback when the user flips a switch in System
    // Settings, so poll while this screen is open.
    pollRef.current = setInterval(refresh, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const askMic = async () => {
    setMic("waiting");
    try {
      await requestMicrophonePermission();
    } catch (e) {
      console.warn("Failed to request microphone permission:", e);
    }
    refresh();
  };

  const askAccess = async () => {
    setAccess("waiting");
    try {
      await requestAccessibilityPermission();
    } catch (e) {
      console.warn("Failed to request accessibility permission:", e);
    }
  };

  const allGranted = mic === "granted" && access === "granted";

  const renderState = (status: Status, onAsk: () => void) => {
    if (status === "granted") {
      return (
        <div className="tk-done">
          <div className="tk-check">
            <CheckIcon size={13} />
          </div>
          {t("tolkovo.welcome.granted")}
        </div>
      );
    }
    return (
      <button
        type="button"
        className="tk-btn-2"
        onClick={onAsk}
        disabled={status === "checking"}
      >
        {status === "waiting"
          ? t("tolkovo.welcome.waiting")
          : t("tolkovo.welcome.allow")}
      </button>
    );
  };

  return (
    <div className="tk-onb">
      <Pill width={40} height={88} fill={0} />
      <h1 className="tk-h1">{t("tolkovo.welcome.title")}</h1>
      <p className="tk-lead">{t("tolkovo.welcome.text", { hotkey })}</p>

      <div className="tk-group" style={{ marginTop: 22 }}>
        <div className="tk-perm">
          <div className="tk-perm-icon">
            <MicIcon size={18} />
          </div>
          <div className="tk-perm-body">
            <div className="tk-perm-title">
              {t("tolkovo.welcome.mic.title")}
            </div>
            <div className="tk-perm-text">{t("tolkovo.welcome.mic.text")}</div>
          </div>
          {renderState(mic, askMic)}
        </div>
        <div className="tk-divider" />
        <div className="tk-perm">
          <div className="tk-perm-icon">
            <KeyboardIcon size={18} />
          </div>
          <div className="tk-perm-body">
            <div className="tk-perm-title">
              {t("tolkovo.welcome.paste.title")}
            </div>
            <div className="tk-perm-text">
              {t("tolkovo.welcome.paste.text")}
            </div>
          </div>
          {renderState(access, askAccess)}
        </div>
      </div>

      <div className="tk-footer">
        <Steps current={1} />
        <button
          type="button"
          className="tk-btn"
          disabled={!allGranted}
          onClick={onNext}
        >
          {t("tolkovo.welcome.next")}
        </button>
      </div>
    </div>
  );
};
