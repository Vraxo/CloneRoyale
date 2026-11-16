/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_MULTIPLAYER_SERVER_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
