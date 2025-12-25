"use client";

import { useUserAuth } from "../hooks/useUserAuth";
import { useCars } from "../hooks/useCars";

export function MyCars() {
  const { user } = useUserAuth();
  // 傳入 user.address 進行過濾
  const { cars, isLoading } = useCars(user?.address);

  if (!user) return null;

  if (isLoading) return <div className="text-center p-4">載入車庫中...</div>;

  if (cars.length === 0) {
    return (
      <div className="text-center p-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 mt-8">
        <p className="text-gray-500 font-medium">你的車庫是空的</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
        我的車庫 ({cars.length})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cars.map((car) => (
            <div key={car.id} className="bg-white rounded-xl shadow-md border overflow-hidden">
              <div className="h-48 w-full bg-gray-100 relative">
                {car.imageUrl ? (
                  <img src={car.imageUrl} alt={car.model} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">無圖片</div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold text-gray-900">{car.brand} {car.model}</h3>
                <p className="text-sm text-gray-500">{car.year} 年式</p>
                <div className="mt-2 text-xs text-gray-400 font-mono flex justify-between">
                    <span>VIN: {car.vin}</span>
                    <span>{Number(car.mileage).toLocaleString()} km</span>
                </div>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}