import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last line of defence: without this, any render error unmounts the whole app
 * and leaves a black page with no way forward.
 */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[App] Render failed:', error.message, info.componentStack?.split('\n').slice(0, 4).join('\n'));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center rounded-2xl border border-white/10 bg-white/[.04] p-8">
          <img src="/logo.png" alt="" width={44} height={44} className="mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-white/60 mb-6">The page couldn't load. This usually happens right after the site is updated. Reloading fixes it.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="rounded-full bg-[#dc143c] hover:bg-[#b80f31] px-5 py-2.5 text-sm font-bold">Reload</button>
            <a href="/" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5">Back to the home page</a>
          </div>
        </div>
      </div>
    );
  }
}
