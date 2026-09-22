import type { ModelInfo } from "@/bindings";

/**
 * The one model Tolkovo uses: GigaAM v3 E2E-RNN-T (Russian, with
 * punctuation), default quant from the Handy catalog. The user never sees
 * this name.
 */
export const TOLKOVO_MODEL_ID =
  "handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf";

const MODEL_REPO = "handy-computer/gigaam-v3-e2e-rnnt-gguf/";

/** Find our model in the catalog, tolerating a future default-quant change. */
export const findTolkovoModel = (models: ModelInfo[]): ModelInfo | undefined =>
  models.find((m) => m.id === TOLKOVO_MODEL_ID) ??
  models.find((m) => m.id.startsWith(MODEL_REPO) && !m.name.includes("("));
