export async function copyReplayLink(url: string): Promise<void> {
  try { await navigator.clipboard.writeText(url); }
  catch { window.prompt("Copy this replay link:", url); }
}

export function createPublicReplayLink(replayId: string): string {
  return new URL("/?replay=" + encodeURIComponent(replayId), window.location.origin).toString();
}
