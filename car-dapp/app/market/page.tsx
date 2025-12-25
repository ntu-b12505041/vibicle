"use client";
import Link from "next/link";
import { LoginSection } from "../../components/LoginSection";
import { useCars } from "../../hooks/useCars";

export default function MarketPage() {
  const { cars, isLoading } = useCars(); // 抓取所有車輛

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Link href="/" className="font-bold text-xl text-gray-900 hover:text-blue-600 transition">
                    Sui Used Car
                </Link>
                <span className="text-gray-300">/</span>
                <span className="font-medium text-gray-600">二手車市場</span>
            </div>
            <LoginSection />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">全網車輛列表</h1>
            <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                共 {cars.length} 台
            </span>
        </div>
        
        {isLoading ? (
            <div className="flex justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        ) : cars.length === 0 ? (
            <div className="text-center p-20 bg-white rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-lg">目前市場上沒有任何車輛</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {cars.map((car) => (
                    <div key={car.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 group">
                        {/* 圖片區 */}
                        <div className="h-56 w-full bg-gray-100 relative overflow-hidden">
                            {car.imageUrl ? (
                                <img 
                                    src={car.imageUrl} 
                                    alt={car.model} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                    onError={(e) => e.currentTarget.src = "https://placehold.co/600x400?text=No+Image"}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                                    <span className="text-sm">無圖片</span>
                                </div>
                            )}
                            
                            {/* 狀態標籤 (範例) */}
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">
                                {car.year} 年式
                            </div>
                        </div>

                        {/* 資訊區 */}
                        <div className="p-5">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">{car.brand} {car.model}</h3>
                            
                            {/* 🔴 關鍵修正：檢查 owner 是否存在 */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500"></div>
                                <p className="text-xs text-gray-500 font-mono truncate">
                                    車主: {car.owner ? `${car.owner.slice(0,6)}...${car.owner.slice(-4)}` : "Unknown"}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                                <div className="text-gray-500">
                                    <span className="block text-xs text-gray-400">里程數</span>
                                    <span className="font-semibold text-gray-700">{Number(car.mileage).toLocaleString()} km</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs text-gray-400">VIN</span>
                                    <span className="font-mono text-gray-600">{car.vin}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}