import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090e] text-white p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-mono text-2xl font-bold mb-4">
        404
      </div>
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        The requested resource or page could not be located in Autonomous AI Knowledge Worker.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
