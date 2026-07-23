"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4" aria-hidden="true">⚠️</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {t("error.title")}
        </h1>
        <p className="text-gray-600 mb-6">
          {t("error.default_message")}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6">{error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          {t("error.try_again")}
        </button>
      </div>
    </div>
  );
}
