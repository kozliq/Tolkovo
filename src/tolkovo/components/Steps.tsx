import { useTranslation } from "react-i18next";

export const Steps = ({ current }: { current: 1 | 2 | 3 }) => {
  const { t } = useTranslation();
  return (
    <div
      className="tk-steps"
      aria-label={t("tolkovo.step", { current, total: 3 })}
    >
      {[1, 2, 3].map((n) => (
        <div key={n} data-active={n === current ? "" : undefined} />
      ))}
    </div>
  );
};
