import { useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { normalizeSuiAddress } from "@mysten/sui/utils"; // 🔴 引入標準化工具
import { CAR_REGISTRY_ID } from "../constants";

const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

function getImageUrl(rawUrl: any) {
    if (!rawUrl) return null;
    const urlStr = String(rawUrl);
    if (urlStr.startsWith("http")) return urlStr;
    return `${WALRUS_AGGREGATOR}/${urlStr}`;
}

export function useCars(ownerFilter?: string) {
  const suiClient = useSuiClient();
  const [cars, setCars] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCars = async () => {
      try {
        // 1. 讀取 CarRegistry
        const registryObj = await suiClient.getObject({
            id: CAR_REGISTRY_ID,
            options: { showContent: true }
        });

        const content = registryObj.data?.content as any;
        const allIds = content?.fields?.all_ids as string[] || [];

        if (allIds.length === 0) {
            setCars([]);
            setIsLoading(false);
            return;
        }

        // 2. 讀取所有車輛
        const carObjects = await suiClient.multiGetObjects({
            ids: allIds,
            options: { showContent: true, showDisplay: true }
        });

        // 3. 整理資料
        const loadedCars = carObjects.map(obj => {
            const fields = (obj.data?.content as any)?.fields;
            const display = obj.data?.display?.data;
            if (!fields) return null;

            let rawImg = display?.image_url || display?.url || fields?.image_url || fields?.url;
            if (typeof rawImg === 'object') rawImg = undefined;

            return {
                id: obj.data?.objectId,
                owner: fields.owner, 
                vin: fields.vin,
                brand: fields.brand,
                model: fields.model,
                year: fields.year,
                mileage: fields.current_mileage,
                imageUrl: getImageUrl(rawImg)
            };
        }).filter(c => c !== null);

        // 4. 過濾 (Address Normalization)
        if (ownerFilter) {
            // 🔴 關鍵修正：將兩邊地址都標準化後再比對
            const target = normalizeSuiAddress(ownerFilter);
            const myCars = loadedCars.filter(c => normalizeSuiAddress(c.owner) === target);
            setCars(myCars);
        } else {
            setCars(loadedCars);
        }

      } catch (e) {
        console.error("Fetch cars failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCars();
    const interval = setInterval(fetchCars, 5000);
    return () => clearInterval(interval);

  }, [suiClient, ownerFilter]);

  return { cars, isLoading };
}