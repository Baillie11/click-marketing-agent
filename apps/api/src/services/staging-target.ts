const cleanHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export const validateStagingTarget = (liveBaseUrl: string, stagingBaseUrl: string, nodeEnv: string) => {
  const live = new URL(liveBaseUrl);
  const staging = new URL(stagingBaseUrl);
  if (!['http:', 'https:'].includes(staging.protocol))
    throw new Error('The staging URL must use HTTP or HTTPS');
  if (cleanHost(live) === cleanHost(staging))
    throw new Error('The staging target must not use the live website hostname');
  const isLocal = LOCAL_HOSTS.has(staging.hostname.toLowerCase());
  if (isLocal && nodeEnv === 'production')
    throw new Error('Local staging targets are disabled in production');
  return { url: staging.toString().replace(/\/$/, ''), isLocal };
};

export const stagingExecutionUrl = (liveUrl: string, stagingBaseUrl: string) => {
  const live = new URL(liveUrl);
  const staging = new URL(stagingBaseUrl.endsWith('/') ? stagingBaseUrl : `${stagingBaseUrl}/`);
  const basePath = staging.pathname.replace(/\/$/, '');
  staging.pathname = `${basePath}${live.pathname.startsWith('/') ? live.pathname : `/${live.pathname}`}`;
  staging.search = live.search;
  staging.hash = '';
  return staging.toString();
};
