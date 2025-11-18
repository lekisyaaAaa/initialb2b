export const resolveHomeAssistantUrl = (): string => {
  const envUrl = (process.env.REACT_APP_HOME_ASSISTANT_URL
    || process.env.VITE_HOME_ASSISTANT_URL
    || process.env.NEXT_PUBLIC_HOME_ASSISTANT_URL
    || '').toString();

  const globalUrl = typeof window !== 'undefined' && (window as any).__HOME_ASSISTANT_URL__
    ? String((window as any).__HOME_ASSISTANT_URL__)
    : '';

  const candidate = envUrl || globalUrl;
  if (candidate) {
    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }
    if (typeof window !== 'undefined' && window.location) {
      const base = window.location.origin.replace(/\/$/, '');
      const normalized = candidate.startsWith('/') ? candidate : `/${candidate}`;
      return `${base}${normalized}`;
    }
    return candidate;
  }

  return 'http://192.168.8.142:8123/';
};

export default resolveHomeAssistantUrl;
