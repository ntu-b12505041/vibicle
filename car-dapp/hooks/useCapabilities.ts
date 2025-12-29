import { useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { ADMIN_CAP_TYPE, THIRD_PARTY_CAP_TYPE, AUTH_REGISTRY_ID } from "../constants";
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
            // 1. 先取得 AuthRegistry 裡面的 permissions Table ID
            const authRegistryObj = await suiClient.getObject({
                id: AUTH_REGISTRY_ID,
                options: { showContent: true }
            });
            
            // 解析 Table ID
            // 結構通常是: content.fields.permissions.fields.id.id
            const fields = (authRegistryObj.data?.content as any)?.fields;
            const tableId = fields?.permissions?.fields?.id?.id;

            if (!tableId) {
                console.error("無法讀取權限表 ID，請檢查合約或常數");
                return;
            }

            // 2. 找出使用者擁有的權限物件
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

            // 3. 逐一檢查
            for (const obj of ownedObjects.data) {
                const type = obj.data?.type;
                const content = obj.data?.content as any;
                const objectId = obj.data?.objectId!;

                // A. AdminCap
                if (type === ADMIN_CAP_TYPE) {
                    isAdmin = true;
                }

                // B. ThirdPartyCap (需查表驗證)
                if (type === THIRD_PARTY_CAP_TYPE) {
                    const orgType = content?.fields?.org_type;
                    
                    try {
                        // 🔴 修正：使用 tableId 作為 parentId，而不是 AUTH_REGISTRY_ID
                        const checkRegistry = await suiClient.getDynamicFieldObject({
                            parentId: tableId, // <--- 這裡改了
                            name: {
                                type: '0x2::object::ID',
                                value: objectId
                            }
                        });

                        const isValid = (checkRegistry.data?.content as any)?.fields?.value;

                        if (isValid === true) {
                            console.log(`✅ 權限驗證通過: ${objectId}`);
                            if (Number(orgType) === 1) {
                                isService = true;
                                serviceCapId = objectId;
                            } else if (Number(orgType) === 2) {
                                isInsurance = true;
                                insuranceCapId = objectId;
                            }
                        } else {
                            console.warn(`權限憑證 ${objectId} 已被撤銷 (值為 false)`);
                        }
                    } catch (e) {
                        // 查不到 key 代表無效 (或是被移除了)
                        console.warn(`權限憑證 ${objectId} 無效 (Table 中查無此 Key)`);
                    }
                }
            }

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