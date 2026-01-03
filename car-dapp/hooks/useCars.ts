import { useSuiClient } from "@mysten/dapp-kit";
import { useCallback, useEffect, useState } from "react";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { CAR_REGISTRY_ID } from "../constants";

const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

function getImageUrl(rawUrl: any) {
  if (!rawUrl) return null;
  const urlStr = String(rawUrl);
  if (urlStr.startsWith("http")) return urlStr;
  return `${WALRUS_AGGREGATOR}/${urlStr}`;
}

export function useCars(ownerFilter?: string, isMarketView: boolean = false) {
  const suiClient = useSuiClient();
  const [cars, setCars] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1) 讀取 CarRegistry
      const registryObj = await suiClient.getObject({
        id: CAR_REGISTRY_ID,
        options: { showContent: true },
      });

      const content = registryObj.data?.content as any;
      const allIds = (content?.fields?.all_ids as string[]) || [];

      if (allIds.length === 0) {
        setCars([]);
        return;
      }

      // 2) 讀取所有車輛
      const carObjects = await suiClient.multiGetObjects({
        ids: allIds,
        options: { showContent: true, showDisplay: true },
      });

      // 3) 整理資料
      const loadedCars = carObjects
        .map((obj) => {
          const fields = (obj.data?.content as any)?.fields;
          const display = obj.data?.display?.data;
          if (!fields) return null;

          let rawImg = display?.image_url || display?.url || fields?.image_url || fields?.url;
          if (typeof rawImg === "object") rawImg = undefined;

          const price =
            fields.price !== null && fields.price !== undefined ? fields.price : null;

          return {
            id: obj.data?.objectId,
            owner: fields.owner,
            vin: fields.vin,
            brand: fields.brand,
            model: fields.model,
            year: fields.year,
            mileage: fields.current_mileage,
            imageUrl: getImageUrl(rawImg),
            isListed: fields.is_listed,
            price,
          };
        })
        .filter((c) => c !== null);

      // 4) 過濾邏輯
      if (ownerFilter) {
        // A. 我的車庫：只看 Owner
        const target = normalizeSuiAddress(ownerFilter);
        setCars(loadedCars.filter((c) => normalizeSuiAddress(c.owner) === target));
      } else if (isMarketView) {
        // B. 二手市場：只看 isListed
        setCars(loadedCars.filter((c) => c.isListed === true));
      } else {
        // C. 未就緒或無權限：不顯示
        setCars([]);
      }
      
    } catch (e) {
      console.error("Fetch cars failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, ownerFilter, isMarketView]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // 定期刷新
  useEffect(() => {
    const interval = setInterval(() => {
        // 只有當參數有效時才刷新，節省資源
        if (ownerFilter || isMarketView) refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch, ownerFilter, isMarketView]);

  return { cars, isLoading, refetch };
}