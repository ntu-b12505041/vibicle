import { useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { ADMIN_CAP_TYPE, THIRD_PARTY_CAP_TYPE } from "../constants";
import { useUserAuth } from "./useUserAuth";

export function useCapabilities() {
  const { user } = useUserAuth();
  const address = user?.address;
  const suiClient = useSuiClient();

  const [caps, setCaps] = useState({
    isAdmin: false,
    isService: false,
    isInsurance: false,
    serviceCapId: "", 
    insuranceCapId: ""
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkCaps = async () => {
        if (!address) {
            setCaps({ isAdmin: false, isService: false, isInsurance: false, serviceCapId: "", insuranceCapId: "" });
            setIsLoading(false);
            return;
        }

        try {
            // 1. 找出使用者擁有的權限物件
            const ownedObjects = await suiClient.getOwnedObjects({
                owner: address,
                filter: {
                    MatchAny: [
                        { StructType: ADMIN_CAP_TYPE },
                        { StructType: THIRD_PARTY_CAP_TYPE }
                    ]
                },
                options: { showContent: true, showType: true }
            });

            let isAdmin = false;
            let isService = false;
            let isInsurance = false;
            let serviceCapId = "";
            let insuranceCapId = "";

            ownedObjects.data.forEach(obj => {
                const type = obj.data?.type;
                const content = obj.data?.content as any;
                const objectId = obj.data?.objectId!;

                // A. 檢查 AdminCap
                if (type === ADMIN_CAP_TYPE) {
                    isAdmin = true;
                }

                // B. 檢查 ThirdPartyCap
                // 🔴 修正：不再去查 AuthRegistry (Table 讀取太複雜且易錯)
                // 只要使用者持有這個 Cap，前端就先顯示入口
                // 如果該 Cap 已被撤銷，等到發送交易時合約會擋，這樣最穩
                if (type === THIRD_PARTY_CAP_TYPE) {
                    const orgType = content?.fields?.org_type;
                    
                    if (Number(orgType) === 1) {
                        isService = true;
                        serviceCapId = objectId;
                    } else if (Number(orgType) === 2) {
                        isInsurance = true;
                        insuranceCapId = objectId;
                    }
                }
            });

            setCaps({ isAdmin, isService, isInsurance, serviceCapId, insuranceCapId });

        } catch (e) {
            console.error("權限檢查失敗:", e);
        } finally {
            setIsLoading(false);
        }
    };

    checkCaps();
  }, [address, suiClient]);

  return { isLoading, ...caps };
}