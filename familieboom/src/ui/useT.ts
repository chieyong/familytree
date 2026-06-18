import { messages, type Messages } from './i18n';
import { guides, type GuideContent } from './guideContent';
import { useAppStore } from './store';

/** Vaste UI-teksten in de actieve taal. Gebruik: `const t = useT(); t.edit.save`. */
export function useT(): Messages {
  const lang = useAppStore((s) => s.lang);
  return messages[lang];
}

/** Welkomst- en gidsteksten in de actieve taal. */
export function useGuide(): GuideContent {
  const lang = useAppStore((s) => s.lang);
  return guides[lang];
}
