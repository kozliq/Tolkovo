import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import type { RecordingErrorEvent } from "@/lib/types/events";

/**
 * Engine errors as short human messages. The technical detail stays in the
 * log file (Handy writes it there); the user only sees what to do next.
 */
export const useErrorToasts = () => {
  const { t } = useTranslation();

  useEffect(() => {
    const subs = [
      listen<RecordingErrorEvent>("recording-error", (event) => {
        const { error_type } = event.payload;
        if (error_type === "microphone_permission_denied") {
          toast.error(t("tolkovo.errors.micTitle"), {
            description: t("tolkovo.errors.micText"),
          });
        } else if (error_type === "no_input_device") {
          toast.error(t("tolkovo.errors.noMicTitle"), {
            description: t("tolkovo.errors.noMicText"),
          });
        } else {
          toast.error(t("tolkovo.errors.recordTitle"), {
            description: t("tolkovo.errors.tryAgain"),
          });
        }
      }),
      listen("paste-error", () => {
        toast.error(t("tolkovo.errors.pasteTitle"), {
          description: t("tolkovo.errors.pasteText"),
        });
      }),
      listen("transcription-error", () => {
        toast.error(t("tolkovo.errors.recognizeTitle"), {
          description: t("tolkovo.errors.tryAgain"),
        });
      }),
    ];
    return () => {
      subs.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, [t]);
};
