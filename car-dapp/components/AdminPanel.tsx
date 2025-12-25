"use client";

import { useState } from "react";
import { useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useUserAuth } from "../hooks/useUserAuth";
import { PACKAGE_ID, MODULE_NAME, ADMIN_CAP_ID, AUTH_REGISTRY_ID } from "../constants";

export function AdminPanel() {
  const { user } = useUserAuth();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [recipient, setRecipient] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // 檢查是否擁有 AdminCap
  const { data } = useSuiClientQuery("getOwnedObjects", {
    owner: user?.address || "",
    filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::AdminCap` }
  });

  const isAdmin = data?.data && data.data.length > 0;

  const handleGrant = () => {
    if (!recipient || !name) return alert("請輸入完整資訊");
    setLoading(true);

    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::grant_third_party`,
        arguments: [
            tx.object(data!.data[0].data!.objectId), // AdminCap ID
            tx.object(AUTH_REGISTRY_ID),             // Auth Registry
            tx.pure.u8(1),                           // Type 1 = 保養廠 (Demo 固定)
            tx.pure.string(name),                    // 機構名稱
            tx.pure.address(recipient)               // 接收者地址
        ]
    });

    signAndExecute({ transaction: tx, options: { showEffects: true } }, {
        onSuccess: () => { alert("授權成功！"); setLoading(false); },
        onError: (e) => { alert("失敗: " + e.message); setLoading(false); }
    });
  };

  if (!user || !isAdmin) return null; // 不是 Admin 就不顯示

  return (
    <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl shadow-sm mb-8">
      <h2 className="text-xl font-bold mb-4 text-purple-800">👑 管理員後台</h2>
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium">授權第三方機構 (保養廠)</label>
        <input 
            type="text" 
            placeholder="機構名稱 (例如: Toyota 原廠)" 
            className="border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
        />
        <input 
            type="text" 
            placeholder="接收者錢包地址 (0x...)" 
            className="border p-2 rounded font-mono"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
        />
        <button 
            onClick={handleGrant} 
            disabled={loading}
            className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
        >
            {loading ? "處理中..." : "發放權限 (Grant Cap)"}
        </button>
      </div>
    </div>
  );
}