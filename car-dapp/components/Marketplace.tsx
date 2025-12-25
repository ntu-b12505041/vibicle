"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { CAR_REGISTRY_ID } from "../constants";

export function Marketplace() {
  const suiClient = useSuiClient();
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        // 1. 讀取 Registry，拿到所有 ID
        const registryObj = await suiClient.getObject({
            id: CAR_REGISTRY_ID,
            options: { showContent: true }
        });

        if (!registryObj.data || !registryObj.data.content) return;

        const fields = (registryObj.data.content as any).fields;
        const allIds = fields.all_ids as string[];

        if (!allIds || allIds.length === 0) {
            setLoading(false);
            return;
        }

        // 2. 批量讀取所有車輛詳細資料 (Sui RPC 強大之處)
        // 注意：一次最多抓 50 筆，如果超過要分批，Demo 暫時不考慮
        const objects = await suiClient.multiGetObjects({
            ids: allIds,
            options: { showContent: true, showDisplay: true }
        });

        // 3. 整理資料
        const carList = objects.map((obj) => {
            if (!obj.data || !obj.data.content) return null;
            const f = (obj.data.content as any).fields;
            const display = obj.data.display?.data;
            return {
                id: obj.data.objectId,
                vin: f.vin,
                brand: f.brand,
                model: f.model,
                year: f.year,
                mileage: f.current_mileage,
                imageUrl: display?.image_url || f.image_url,
                display: display
            };
        }).filter(Boolean);

        // 反向排序 (最新的在前面)
        setCars(carList.reverse());

      } catch (e) {
        console.error("Fetch market failed:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchMarket();
  }, [suiClient]);

  if (loading) return <div className="p-8 text-center text-gray-500">正在載入市場數據...</div>;

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 px-4">二手車市場 ({cars.length})</h2>
      
      {cars.length === 0 ? (
        <div className="text-center p-10 bg-gray-50 rounded-lg mx-4">目前市場上沒有車輛</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
          {cars.map((car) => (
            <div key={car.id} className="bg-white rounded-xl shadow-md overflow-hidden border hover:shadow-lg transition">
              <div className="h-48 w-full bg-gray-200 relative">
                {car.imageUrl ? (
                    <img src={car.imageUrl} alt={car.model} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{car.brand} {car.model}</h3>
                        <p className="text-sm text-gray-500">{car.year} 年式</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {Number(car.mileage).toLocaleString()} km
                    </span>
                </div>
                <div className="mt-4 pt-3 border-t flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-mono">{car.vin}</span>
                    <button className="text-blue-600 font-medium hover:underline">查看詳情</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}