import 'vite';

declare module 'vite' {
  interface FSWatcher {
    ref(): this;
    unref(): this;
  }
}
