import { useSettings } from "@/hooks/useSettings";

/** Human form of a Handy binding string, e.g. "option+space" → "⌥ Space". */
export const formatHotkey = (binding: string | undefined): string => {
  const names: Record<string, string> = {
    option: "⌥",
    alt: "⌥",
    command: "⌘",
    cmd: "⌘",
    super: "⌘",
    meta: "⌘",
    control: "⌃",
    ctrl: "⌃",
    shift: "⇧",
    fn: "fn",
    space: "Space",
  };
  return (binding || "option+space")
    .split("+")
    .map((part) => {
      // Handy keys records side-specific modifiers ("option_left").
      const key = part
        .trim()
        .toLowerCase()
        .replace(/_(left|right)$/, "");
      return names[key] ?? (key.length === 1 ? key.toUpperCase() : part);
    })
    .join(" ");
};

export const useHotkeyLabel = (): string => {
  const { getSetting } = useSettings();
  const bindings = getSetting("bindings");
  return formatHotkey(bindings?.transcribe?.current_binding);
};
