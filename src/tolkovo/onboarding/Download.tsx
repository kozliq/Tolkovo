import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useModelStore } from "@/stores/modelStore";
import { Pill } from "../components/Pill";
import { Steps } from "../components/Steps";
import { findTolkovoModel } from "../model";

interface DownloadProps {
  onDone: () => void;
}

/**
 * Step 2: the model downloads by itself. The pill fills with burgundy as the
 * progress bar; no model names, no megabytes, no languages.
 */
export const Download = ({ onDone }: DownloadProps) => {
  const { t } = useTranslation();
  const {
    models,
    downloadModel,
    selectModel,
    downloadProgress,
    downloadingModels,
    verifyingModels,
    extractingModels,
  } = useModelStore();
  const model = findTolkovoModel(models);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const selecting = useRef(false);

  const start = useCallback(async () => {
    if (!model) return;
    setFailed(false);
    if (model.is_downloaded) return;
    const ok = await downloadModel(model.id);
    if (!ok) {
      started.current = false;
      setFailed(true);
    }
  }, [model, downloadModel]);

  // Kick off the download as soon as the catalog is loaded.
  useEffect(() => {
    if (!model || started.current) return;
    started.current = true;
    start();
  }, [model, start]);

  const id = model?.id ?? "";
  const busy =
    id in downloadingModels || id in verifyingModels || id in extractingModels;
  const finished = !!model?.is_downloaded && !busy;

  // Once the file is on disk, make it the active model and move on.
  useEffect(() => {
    if (!finished || selecting.current || !model) return;
    selecting.current = true;
    selectModel(model.id).then((ok) => {
      if (ok) {
        onDone();
      } else {
        selecting.current = false;
        setFailed(true);
      }
    });
  }, [finished, model, selectModel, onDone]);

  const raw = downloadProgress[id]?.percentage ?? 0;
  const pct =
    finished || id in verifyingModels || id in extractingModels
      ? 100
      : Math.floor(raw);

  return (
    <div className="tk-onb" style={{ paddingTop: 60 }}>
      <Pill width={76} height={168} fill={pct} settle={0.4} />
      <h1 className="tk-h1" style={{ marginTop: 30 }}>
        {t("tolkovo.download.title")}
      </h1>
      <p className="tk-lead" style={{ maxWidth: 400 }}>
        {t("tolkovo.download.text")}
      </p>
      {failed ? (
        <div className="tk-error">{t("tolkovo.download.failed")}</div>
      ) : (
        <div className="tk-pct">{`${pct}%`}</div>
      )}

      <div className="tk-footer">
        <Steps current={2} />
        {failed ? (
          <button type="button" className="tk-btn" onClick={start}>
            {t("tolkovo.download.retry")}
          </button>
        ) : (
          <button type="button" className="tk-btn" disabled>
            {t("tolkovo.download.almost")}
          </button>
        )}
      </div>
    </div>
  );
};
