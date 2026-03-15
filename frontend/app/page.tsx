"use client";
import { useState } from "react";
import NewsSection from "./components/NewsSection";
import SearchSection from "./components/SearchSection";
import StockSection from "./components/StockSection";
import ReportSection from "./components/ReportSection";
import FileUpload from "./components/FileUpload";
import LoginForm from "./components/LoginForm";
import HistorySection from "./components/HistorySection";
import { LogOut, Brain } from "lucide-react";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 🔐 Login Protection
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-secondary border-b border-light sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary">
                  Autonomous AI Knowledge Worker
                </h1>
                <p className="text-xs text-muted">
                  AI-powered insights and research
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <HistorySection compact={true} limit={5} />
              <button
                onClick={() => setIsLoggedIn(false)}
                className="btn btn-ghost flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Independent Scrolling Sections */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8 relative">
        {/* Glow Effects behind layout */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Left Column - News (2/3 width) - Independent Scroll */}
          <div className="lg:col-span-2 flex flex-col h-full">
            <div className="card flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                  <span className="text-xl">📰</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">Latest News</h2>
              </div>
              {/* Independent scrolling container for news */}
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <NewsSection infiniteScroll={true} />
              </div>
            </div>
          </div>

          {/* Right Column - Controls (1/3 width) - Independent Scroll */}
          <div className="flex flex-col h-full overflow-y-auto space-y-6 pr-2 -mr-2">
            {/* Search Section - Takes more space */}
            <div className="card flex flex-col min-h-[400px]">
              <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                  <span className="text-xl">🔍</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">Search</h2>
              </div>
              {/* Search section with its own scroll */}
              <div className="flex-1 overflow-hidden">
                <SearchSection infiniteScroll={true} />
              </div>
            </div>

            {/* Stock Market */}
            <div className="card flex-shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                  <span className="text-xl">📈</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">Stock Market</h2>
              </div>
              <StockSection />
            </div>

            {/* Reports */}
            <div className="card flex-shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                  <span className="text-xl">📊</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">Reports</h2>
              </div>
              <ReportSection />
            </div>

            {/* File Upload */}
            <div className="card flex-shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                  <span className="text-xl">📁</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">File Upload</h2>
              </div>
              <FileUpload />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-light bg-secondary mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="text-center">
            <p className="text-sm text-muted">
              © {new Date().getFullYear()} Autonomous AI Knowledge Worker. All
              rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
