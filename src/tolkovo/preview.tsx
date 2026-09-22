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
    };
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
const size = screen === "settings" ? [640, 600] : [620, 500];

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

const Settings =
  screen === "settings"
    ? (await import("./settings/Settings")).Settings
    : () => null;

const content =
  screen === "download" ? (
    <Download onDone={noop} />
  ) : screen === "ready" ? (
    <Ready onFinish={noop} />
  ) : screen === "settings" ? (
    <Settings />
  ) : screen === "pill" ? null : (
    <Welcome onNext={noop} />
  );

ReactDOM.createRoot(document.getElementById("root")!).render(
  screen === "pill" ? (
    <div style={{ ...backdrop, width: 400, height: 300 }}>
      <Pill width={64} height={140} fill={Number(arg ?? 0)} />
    </div>
  ) : (
    <Frame>{content}</Frame>
  ),
);
