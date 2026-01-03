"use client";

import Link from "next/link";
import { LoginSection } from "../../components/LoginSection";
import { useCars } from "../../hooks/useCars";
import Home from "../page";

export default function MarketPage() {
  const { cars, isLoading, refetch } = useCars(undefined, true);; // 核心邏輯：抓取資料

  return (
    // 全局背景設定
    <div className="min-h-screen bg-[#050b14] text-white relative font-sans selection:bg-[#06e0f9] selection:text-black">
      
      {/* 背景網格特效 (CSS 轉寫為 Inline Style 以確保生效) */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
            backgroundSize: '40px 40px',
            backgroundImage: 'linear-gradient(to right, rgba(41, 182, 246, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(41, 182, 246, 0.05) 1px, transparent 1px)',
            maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)'
        }}
      />

      {/* Header */}
      <header className="w-full border-b-2 border-[#06e0f9]/30 bg-[#050b14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-4 group cursor-pointer">
                <div className="w-8 h-8 text-[#06e0f9] animate-pulse flex items-center justify-center">
                    <span className="text-2xl">⇦</span>
                </div>
                <h2 className="text-[#06e0f9] font-['Press_Start_2P',_cursive] text-sm md:text-base leading-tight tracking-wider group-hover:text-white transition-colors">
                    Home
                </h2>
            </Link>
            <div className="flex items-center gap-4">
                {/* 裝飾用的 Network 標籤 */}
                <div className="hidden md:flex text-xs text-[#29B6F6] font-mono items-center gap-2 px-3 py-1 border border-[#29B6F6]/30 rounded bg-[#0a161f]">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    NETWORK: SUI TESTNET
                </div>
                {/* 保留原本的功能性登入按鈕 */}
                <LoginSection />
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
        
        {/* 標題區 */}
        <div className="flex flex-col items-center justify-center pb-6">
            <h1 className="font-['Press_Start_2P',_cursive] text-3xl md:text-4xl lg:text-5xl text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-[#29B6F6] drop-shadow-[0_0_10px_rgba(6,224,249,0.5)] mb-2">
                MARKETPLACE
            </h1>
            <div className="h-1 w-24 bg-[#06e0f9] shadow-[0_0_10px_#06e0f9] rounded-full mt-4"></div>
        </div>

        {/* 搜尋與篩選區 (UI 展示用，暫無功能) */}
        <section className="w-full bg-[#0a161f] border-2 border-[#112233] rounded-xl p-6 shadow-lg relative overflow-hidden group">
            {/* 角落裝飾 */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#06e0f9]"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#06e0f9]"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#06e0f9]"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#06e0f9]"></div>

            <div className="flex flex-col lg:flex-row gap-4 items-end">
                {/* Search */}
                <label className="flex flex-col flex-[2] w-full gap-2">
                    <span className="text-xs text-[#06e0f9] font-bold tracking-widest uppercase ml-1">Vehicle Identifier</span>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#29B6F6]">
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            strokeWidth={2} 
                            stroke="currentColor" 
                            className="w-5 h-5"
                        >
                            <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" 
                            />
                        </svg>
                        </span>
                        <input className="w-full rounded-lg border-2 border-[#112233] bg-[#050b14] text-white focus:border-[#06e0f9] focus:ring-0 focus:shadow-[0_0_5px_#06e0f9] placeholder:text-gray-600 h-12 pl-12 pr-4 font-mono text-sm transition-all outline-none" placeholder="Search Make, Model, or VIN..." />
                    </div>
                </label>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-[3] w-full">
                    <label className="flex flex-col gap-2">
                        <span className="text-xs text-[#29B6F6] font-bold tracking-widest uppercase ml-1">Budget (SUI)</span>
                        <select className="w-full rounded-lg border-2 border-[#112233] bg-[#050b14] text-white focus:border-[#06e0f9] focus:ring-0 h-12 px-4 font-mono text-sm cursor-pointer hover:border-[#29B6F6] transition-colors outline-none">
                            <option>Any Price</option>
                            <option>0 - 100</option>
                            <option>100+</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-xs text-[#29B6F6] font-bold tracking-widest uppercase ml-1">Year</span>
                        <select className="w-full rounded-lg border-2 border-[#112233] bg-[#050b14] text-white focus:border-[#06e0f9] focus:ring-0 h-12 px-4 font-mono text-sm cursor-pointer hover:border-[#29B6F6] transition-colors outline-none">
                            <option>All Years</option>
                            <option>2024</option>
                            <option>2023</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-xs text-[#29B6F6] font-bold tracking-widest uppercase ml-1">Body</span>
                        <select className="w-full rounded-lg border-2 border-[#112233] bg-[#050b14] text-white focus:border-[#06e0f9] focus:ring-0 h-12 px-4 font-mono text-sm cursor-pointer hover:border-[#29B6F6] transition-colors outline-none">
                            <option>All Types</option>
                            <option>Sedan</option>
                            <option>SUV</option>
                        </select>
                    </label>
                </div>
                {/* Button */}
                <button
                type="button"
                onClick={refetch}
                disabled={isLoading}
                className="w-full lg:w-auto min-w-[140px] h-12 bg-[#06e0f9] text-[#050b14] font-['Press_Start_2P',_cursive] text-xs flex items-center justify-center gap-2 hover:bg-white hover:shadow-[0_0_10px_#06e0f9] transition-all duration-200 rounded-lg lg:ml-2 mt-4 lg:mt-0 disabled:opacity-50"
                >
                {isLoading ? "SCANNING..." : "SCAN"}
                </button>

            </div>
        </section>

        {/* 狀態列 */}
        <div className="flex justify-between items-end border-b border-[#112233] pb-2">
            <span className="font-mono text-[#29B6F6] text-sm">Found <span className="text-[#06e0f9] font-bold">{cars.length}</span> vehicles on-chain</span>
            <div className="flex gap-2">
                <button className="p-1 hover:text-[#06e0f9] transition-colors">▦</button>
                <button className="p-1 text-gray-600 hover:text-[#06e0f9] transition-colors">☰</button>
            </div>
        </div>

        {/* 車輛列表 (核心邏輯區) */}
        {isLoading ? (
            <div className="flex justify-center p-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#06e0f9]"></div>
            </div>
        ) : cars.length === 0 ? (
            <div className="text-center p-20 bg-[#0a161f] rounded-xl border border-[#112233]">
                <p className="text-gray-500 font-mono text-lg">NO VEHICLES FOUND</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {cars.map((car) => (
                    <Link key={car.id} href={`/car/${car.id}`} className="block group">
                        <article className="h-full relative bg-[#0a161f] border border-[#112233] hover:border-[#06e0f9] rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_10px_rgba(6,224,249,0.3)] flex flex-col">
                            
                            {/* 圖片區 */}
                            <div className="relative h-48 w-full overflow-hidden bg-black">
                                <div className="absolute top-3 right-3 z-10 bg-[#06e0f9]/90 text-black font-['Press_Start_2P',_cursive] text-[10px] px-2 py-1 rounded shadow-lg border border-white">
                                    FOR SALE
                                </div>
                                {car.imageUrl ? (
                                    <img 
                                        src={car.imageUrl} 
                                        alt={car.model} 
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-transform duration-500" 
                                        onError={(e) => e.currentTarget.src = "https://placehold.co/600x400?text=No+Image"}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-600 font-mono">NO IMAGE</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a161f] via-transparent to-transparent"></div>
                            </div>

                            {/* 內容區 */}
                            <div className="p-5 flex flex-col flex-grow relative">
                                {/* 全息分隔線 */}
                                <div className="absolute top-0 left-5 right-5 h-[1px] bg-gradient-to-r from-transparent via-[#06e0f9]/50 to-transparent"></div>
                                
                                <div className="mb-4">
                                    <h3 className="text-white text-lg font-bold tracking-wide mb-1 group-hover:text-[#06e0f9] transition-colors uppercase">
                                        {car.brand} {car.model}
                                    </h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-400 font-mono">
                                        <span className="flex items-center gap-1">📅 {car.year}</span>
                                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                        <span className="flex items-center gap-1">⚡ {Number(car.mileage).toLocaleString()} km</span>
                                    </div>
                                </div>

                                {/* 底部價格與按鈕 */}
                                <div className="mt-auto flex items-end justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase text-[#29B6F6] tracking-widest mb-1">Current Price</span>
                                        <span className="font-['Press_Start_2P',_cursive] text-[#06e0f9] text-sm lg:text-base">
                                            {car.price ? (Number(car.price) / 1_000_000_000).toLocaleString() : "N/A"} SUI
                                        </span>
                                    </div>
                                    <button className="bg-[#06e0f9]/10 border border-[#06e0f9] text-[#06e0f9] group-hover:bg-[#06e0f9] group-hover:text-black font-bold py-2 px-4 rounded text-xs font-['Press_Start_2P',_cursive] transition-all duration-300">
                                        DETAILS
                                    </button>
                                </div>
                            </div>
                        </article>
                    </Link>
                ))}
            </div>
        )}

        {/* 分頁 (UI 展示用) */}
        <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-[#112233]">
            <button className="flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-[#112233] hover:border-[#06e0f9] text-gray-400 hover:text-white transition-all font-['Press_Start_2P',_cursive] text-xs">
                PREV
            </button>
            <div className="flex gap-2">
                <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#06e0f9] text-black font-bold border-2 border-[#06e0f9] shadow-[0_0_5px_#06e0f9] font-['Press_Start_2P',_cursive] text-xs">1</button>
                <button className="w-10 h-10 flex items-center justify-center rounded-lg border-2 border-[#112233] hover:border-[#29B6F6] text-gray-400 hover:text-white font-['Press_Start_2P',_cursive] text-xs transition-colors">2</button>
            </div>
            <button className="flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-[#112233] hover:border-[#06e0f9] text-gray-400 hover:text-white transition-all font-['Press_Start_2P',_cursive] text-xs">
                NEXT
            </button>
        </div>

      </main>
      
      {/* Footer */}
      <footer className="w-full bg-[#0a161f] border-t border-[#112233] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500 font-mono">© 2077 NEON MOTORS MARKETPLACE. POWERED BY SUI.</p>
        </div>
      </footer>
    </div>
  );
}