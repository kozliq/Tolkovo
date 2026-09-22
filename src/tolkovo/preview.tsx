// Dev-only preview of Tolkovo screens in a plain browser, next to the design
// mockups. Tauri IPC is mocked; not part of the production build.
// Usage: http://localhost:1420/src/tolkovo/preview.html#welcome
//        (#welcome, #download=62, #ready, #settings, #pill=0|100)
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

(window as unknown as Record<string, unknown>).__TAURI_OS_PLUGIN_INTERNALS__ = {
  platform: "macos",
  eol: "\n",
  version: "26.0",
  family: "unix",
};
mockWindows("main");
mockIPC((cmd) => {
  if (cmd.startsWith("plugin:macos-permissions|check"))
    return location.hash.includes("nomic") ? false : true;
  if (cmd === "get_app_settings")
    return {
      bindings: {
        transcribe: { id: "transcribe", current_binding: "option+space" },
      },
      onboarding_completed: false,
      selected_model: "",
      autostart_enabled: true,
      audio_feedback: false,
      paste_method: "ctrl_v",
      selected_microphone: "Default",
    };
  if (cmd === "tolkovo_get_pill_mode") return "always";
  if (cmd === "plugin:app|version") return "0.1.0";
  if (cmd === "get_available_models") return [];
  return null;
});

const { default: React } = await import("react");
const { default: ReactDOM } = await import("react-dom/client");
await import("@/i18n");
const { default: i18n } = await import("@/i18n");
await i18n.changeLanguage("ru");
const { Welcome } = await import("./onboarding/Welcome");
const { Ready } = await import("./onboarding/Ready");
const { Pill } = await import("./components/Pill");
const { useModelStore } = await import("@/stores/modelStore");
const { Download } = await import("./onboarding/Download");
const { TOLKOVO_MODEL_ID } = await import("./model");
await import("./tolkovo.css");

const [screen, arg] = location.hash.slice(1).split("=");
const noop = () => {};

if (screen === "download") {
  const pct = Number(arg ?? 62);
  useModelStore.setState({
    models: [
      {
        id: TOLKOVO_MODEL_ID,
        name: "x",
        is_downloaded: false,
      } as never,
    ],
    downloadingModels: { [TOLKOVO_MODEL_ID]: true },
    downloadProgress: {
      [TOLKOVO_MODEL_ID]: {
        model_id: TOLKOVO_MODEL_ID,
        downloaded: pct,
        total: 100,
        percentage: pct,
      },
    },
    downloadModel: () => new Promise<boolean>(noop),
  } as never);
}

// Fake voice: bursts of level like speech.
const VoicePill = ({ fill }: { fill: number }) => {
  const [level, setLevel] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(
      () => setLevel(Math.random() < 0.3 ? 0.05 : Math.random() * 0.5),
      90,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ transform: "scale(1.6)" }}>
      <Pill width={64} height={140} fill={fill} level={level} />
    </div>
  );
};

const backdrop: React.CSSProperties = {
  width: 1000,
  height: 680,
  position: "relative",
  background:
    "radial-gradient(900px 620px at 16% 20%, #3a2c5c 0%, rgba(58,44,92,0) 62%), radial-gradient(760px 560px at 86% 82%, #5c2231 0%, rgba(92,34,49,0) 60%), radial-gradient(640px 520px at 72% 14%, #1d3c5e 0%, rgba(29,60,94,0) 58%), #0e0e12",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};
const size =
  screen === "settings" || screen === "advanced" ? [640, 600] : [620, 500];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={backdrop}>
    <div
      style={{
        position: "relative",
        width: size[0],
        height: size[1],
        borderRadius: 26,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)",
        backdropFilter: "blur(40px) saturate(170%)",
        transform: "translateZ(0)",
      }}
    >
      <div className="tk-window" style={{ position: "absolute" }}>
        {children}
      </div>
    </div>
  </div>
);

const { Settings } = await import("./settings/Settings");
const { Advanced } = await import("./settings/Advanced");
if (screen === "advanced") {
  const base = { is_downloaded: true, supported_languages: ["ru"] };
  useModelStore.setState({
    models: [
      { ...base, id: TOLKOVO_MODEL_ID, name: "GigaAM v3 E2E-RNN-T" },
      {
        ...base,
        id: "w",
        name: "Whisper Large v3 Turbo",
        is_downloaded: false,
      },
    ],
    currentModel: TOLKOVO_MODEL_ID,
  } as never);
}

const content =
  screen === "download" ? (
    <Download onDone={noop} />
  ) : screen === "ready" ? (
    <Ready onFinish={noop} />
  ) : screen === "settings" ? (
    <Settings />
  ) : screen === "advanced" ? (
    <Advanced onBack={noop} />
  ) : screen === "pill" ? null : (
    <Welcome onNext={noop} />
  );

ReactDOM.createRoot(document.getElementById("root")!).render(
  screen === "pill" ? (
    <div style={{ ...backdrop, width: 500, height: 420 }}>
      <VoicePill fill={Number(arg ?? 0)} />
    </div>
  ) : (
    <Frame>{content}</Frame>
  ),
);
