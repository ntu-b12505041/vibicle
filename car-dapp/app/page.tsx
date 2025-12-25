"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import { MintCar } from "../components/MintCar";
import { MyCars } from "../components/MyCars";
import { LoginSection } from "../components/LoginSection";
import Link from "next/link";
import { useCapabilities } from "../hooks/useCapabilities";

export default function Home() {
  const { isAdmin, isService, isInsurance } = useCapabilities();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:opacity-80">
                Sui Used Car
            </Link>
            
            {/* 導航列 */}
            <nav className="hidden md:flex gap-1 text-sm font-medium">
              {/* 1. 所有人可見 */}
              <Link href="/" className="px-3 py-2 bg-gray-100 rounded-md text-gray-900">
                我的車庫
              </Link>
              <Link href="/market" className="px-3 py-2 hover:bg-gray-100 rounded-md text-gray-600 transition">
                二手車市場
              </Link>

              {/* 2. 角色專屬 */}
              {isService && (
                  <Link href="/service" className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition flex items-center gap-1">
                    🔧 保養廠
                  </Link>
              )}
              
              {isInsurance && (
                  <Link href="/insurance" className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-md transition flex items-center gap-1">
                    🛡️ 保險公司
                  </Link>
              )}

              {isAdmin && (
                  <Link href="/admin" className="px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-md transition flex items-center gap-1">
                    👮 管理員
                  </Link>
              )}
            </nav>
          </div>

          <LoginSection />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 手機版導航 */}
        <div className="md:hidden mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <Link href="/market" className="px-4 py-2 bg-white border rounded-full text-sm">🏪 市場</Link>
            {isService && <Link href="/service" className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">🔧 保養</Link>}
            {isInsurance && <Link href="/insurance" className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm">🛡️ 保險</Link>}
            {isAdmin && <Link href="/admin" className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm">👮 管理</Link>}
        </div>

        {/* 這裡目前放 鑄造 + 我的車庫 (作為 "我的車庫" 頁面的內容) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <div className="sticky top-24">
              <MintCar />
            </div>
          </div>
          <div className="lg:col-span-8">
            <MyCars />
          </div>
        </div>
      </div>
    </main>
  );
}