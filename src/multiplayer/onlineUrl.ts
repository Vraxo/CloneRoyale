type BrowserLocation = Pick<Location, "protocol" | "hostname" | "port">;

export function resolveOnlineUrl(
  configuredUrl: string | undefined,
  location: BrowserLocation,
  isDevelopment: boolean
): string {
  if (configuredUrl) {
    return configuredUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
  }

  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  const port = isDevelopment ? ":3001" : location.port ? ":" + location.port : "";
  return protocol + location.hostname + port + "/ws";
}
