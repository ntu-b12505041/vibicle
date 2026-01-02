"use client";

import { MintCar } from "../components/MintCar";
import { MyCars } from "../components/MyCars";
import { LoginSection } from "../components/LoginSection";
import { LandingLogin } from "../components/LandingLogin"; 
import Link from "next/link";
import { useCapabilities } from "../hooks/useCapabilities";
import { useUserAuth } from "../hooks/useUserAuth"; 

export default function Home() {
  const { user, isLoading: authLoading } = useUserAuth(); 
  const { isAdmin, isService, isInsurance } = useCapabilities();

  // 1. 載入中狀態 (避免畫面閃爍)
  if (authLoading) {
      return (
          <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00E5FF]"></div>
          </div>
      );
  }

  // 2. 未登入狀態：顯示全螢幕登入卡片
  if (!user) {
      return <LandingLogin />;
  }

  // 3. 已登入狀態：顯示完整儀表板
  return (
    <div className="min-h-screen bg-[#050b14] text-white font-['Space_Grotesk',_sans-serif] selection:bg-[#00E5FF] selection:text-black overflow-x-hidden relative">
      
      {/* 背景特效 */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,229,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
      <div className="fixed inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1))] bg-[size:100%_4px] pointer-events-none z-50 opacity-15"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b-2 border-[#00E5FF]/50 bg-[#050b14]/90 backdrop-blur-md shadow-[0_0_15px_rgba(0,229,255,0.2)]">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="text-[#00E5FF] group-hover:animate-pulse text-3xl filter drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]">
                🚗
              </div>
              <div>
                <h1 className="font-['Press_Start_2P',_cursive] text-xs text-[#00E5FF] tracking-widest mb-1">SYSTEM ONLINE</h1>
                <h2 className="font-bold text-xl text-white tracking-wider group-hover:text-[#00E5FF] transition-colors">VIBICLE</h2>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link 
                href="/" 
                className="px-4 py-2 bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/50 rounded font-bold text-sm tracking-wide shadow-[0_0_10px_rgba(0,229,255,0.2)]"
              >
                MY GARAGE
              </Link>
              <Link 
                href="/market" 
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all text-sm font-medium tracking-wide"
              >
                MARKET
              </Link>
              <Link 
                href="/partners" 
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all text-sm font-medium tracking-wide"
              >
                PARTNERS
              </Link>

              {/* 角色專屬連結 */}
              {(isService || isInsurance || isAdmin) && <div className="h-6 w-px bg-gray-700 mx-2"></div>}

              {isService && (
                <Link 
                  href="/service" 
                  className="flex items-center gap-2 px-4 py-2 text-[#29B6F6] hover:bg-[#29B6F6]/10 rounded transition-all text-sm font-bold tracking-wide"
                >
                  <span>🔧</span> SERVICE
                </Link>
              )}
              
              {isInsurance && (
                <Link 
                  href="/insurance" 
                  className="flex items-center gap-2 px-4 py-2 text-[#00ff41] hover:bg-[#00ff41]/10 rounded transition-all text-sm font-bold tracking-wide"
                >
                  <span>🛡️</span> INSURANCE
                </Link>
              )}

              {isAdmin && (
                <Link 
                  href="/admin" 
                  className="flex items-center gap-2 px-4 py-2 text-[#a855f7] hover:bg-[#a855f7]/10 rounded transition-all text-sm font-bold tracking-wide"
                >
                  <span>👮</span> ADMIN
                </Link>
              )}
            </nav>
          </div>

          {/* 右側 User */}
          <div className="flex items-center gap-4">
            <LoginSection />
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="lg:hidden border-b border-[#1a3548] bg-[#0a1520] sticky top-[74px] z-30">
        <div className="px-4 py-3 overflow-x-auto no-scrollbar">
          <div className="flex gap-3 whitespace-nowrap">
            <Link href="/market" className="px-4 py-2 border border-[#00E5FF]/30 rounded text-[#00E5FF] text-xs font-bold font-['Press_Start_2P',_cursive]">MARKET</Link>
            <Link href="/partners" className="px-4 py-2 border border-[#29B6F6]/30 rounded text-[#29B6F6] text-xs font-bold font-['Press_Start_2P',_cursive]">PARTNERS</Link>
            {isService && <Link href="/service" className="px-4 py-2 border border-[#29B6F6]/30 bg-[#29B6F6]/10 rounded text-[#29B6F6] text-xs font-bold">🔧 SERVICE</Link>}
            {isInsurance && <Link href="/insurance" className="px-4 py-2 border border-[#00ff41]/30 bg-[#00ff41]/10 rounded text-[#00ff41] text-xs font-bold">🛡️ INSURANCE</Link>}
            {isAdmin && <Link href="/admin" className="px-4 py-2 border border-[#a855f7]/30 bg-[#a855f7]/10 rounded text-[#a855f7] text-xs font-bold">👮 ADMIN</Link>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          
          {/* 左側：鑄造表單 */}
          <div className="lg:col-span-4 order-2 lg:order-1">
            <div className="sticky top-32">
              <MintCar />
            </div>
          </div>
          
          {/* 右側：我的車庫 */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <MyCars />
          </div>
          
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1a3548] bg-[#020408] mt-12 py-8 relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[10px] text-slate-500 font-mono">
                SYSTEM.VER.4.0.2 | SECURE CONNECTION ESTABLISHED
            </div>
            <div className="flex gap-4">
                <span className="h-1 w-8 bg-[#29B6F6]/30 rounded"></span>
                <span className="h-1 w-8 bg-[#00E5FF]/30 rounded"></span>
                <span className="h-1 w-8 bg-[#00ff41]/30 rounded"></span>
            </div>
            <p className="text-xs text-gray-600 font-mono">
                © 2077 VIBICLE NETWORK. ALL RIGHTS RESERVED.
            </p>
        </div>
      </footer>
    </div>
  );
}