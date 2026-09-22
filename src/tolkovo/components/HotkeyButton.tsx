import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { commands } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { formatHotkey, useHotkeyLabel } from "./Hotkey";

interface HandyKeysEvent {
  modifiers: string[];
  key: string | null;
  is_key_down: boolean;
  hotkey_string: string;
}

const BINDING = "transcribe";

/**
 * The hotkey as a button; click it and press a new combination. Uses the
 * engine's key recorder (Handy keys) and commits on the key's release,
 * the same rules as Handy's shortcut field.
 */
export const HotkeyButton = () => {
  const { t } = useTranslation();
  const { updateBinding } = useSettings();
  const label = useHotkeyLabel();
  const [recording, setRecording] = useState(false);
  const [live, setLive] = useState("");
  const keyed = useRef("");
  const modsOnly = useRef("");
  const ref = useRef<HTMLButtonElement | null>(null);

  const stop = useCallback(async () => {
    await commands.stopHandyKeysRecording().catch(() => {});
    setRecording(false);
    setLive("");
    keyed.current = "";
    modsOnly.current = "";
  }, []);

  const commit = useCallback(
    async (binding: string) => {
      try {
        await updateBinding(BINDING, binding);
      } catch {
        toast.error(t("tolkovo.settings.hotkey.failed"));
      }
      await stop();
    },
    [updateBinding, stop, t],
  );

  useEffect(() => {
    if (!recording) return;
    let active = true;
    const sub = listen<HandyKeysEvent>("handy-keys-event", (event) => {
      if (!active) return;
      const { hotkey_string, is_key_down, key, modifiers } = event.payload;
      if (is_key_down && hotkey_string) {
        if (key) keyed.current = hotkey_string;
        else modsOnly.current = hotkey_string;
        setLive(hotkey_string);
      } else if (!is_key_down && key) {
        const binding = keyed.current || hotkey_string;
        if (binding) commit(binding);
      } else if (
        !is_key_down &&
        !key &&
        modifiers.length === 0 &&
        !keyed.current &&
        modsOnly.current
      ) {
        commit(modsOnly.current);
      }
    });
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) stop();
    };
    window.addEventListener("click", onClickOutside);
    return () => {
      active = false;
      sub.then((fn) => fn());
      window.removeEventListener("click", onClickOutside);
    };
  }, [recording, commit, stop]);

  // Never leave the engine's key recorder running.
  useEffect(() => () => void commands.stopHandyKeysRecording(), []);

  const start = async () => {
    if (recording) return;
    const result = await commands.startHandyKeysRecording(BINDING);
    if (result.status === "error") {
      toast.error(
        String(result.error).includes("secure-input-active")
          ? t("tolkovo.settings.hotkey.blocked")
          : t("tolkovo.settings.hotkey.failed"),
      );
      return;
    }
    setRecording(true);
  };

  return (
    <button
      ref={ref}
      type="button"
      className="tk-btn-2 tk-hotkey"
      data-recording={recording ? "" : undefined}
      onClick={start}
    >
      {recording
        ? live
          ? formatHotkey(live)
          : t("tolkovo.settings.hotkey.press")
        : label}
    </button>
  );
};
