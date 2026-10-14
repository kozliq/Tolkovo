import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

/** Window sizes from the mockups (logical points). */
export const WINDOW_SIZE = {
  onboarding: { width: 620, height: 500 },
  settings: { width: 640, height: 680 },
} as const;

export const resizeWindow = async (kind: keyof typeof WINDOW_SIZE) => {
  const { width, height } = WINDOW_SIZE[kind];
  try {
    const win = getCurrentWindow();
    await win.setMinSize(new LogicalSize(width, height));
    await win.setSize(new LogicalSize(width, height));
  } catch (e) {
    console.warn("Failed to resize window:", e);
  }
};

/** Close the window; the app keeps running in the menu bar. */
export const closeWindow = async () => {
  try {
    await getCurrentWindow().close();
  } catch (e) {
    console.warn("Failed to close window:", e);
  }
};
