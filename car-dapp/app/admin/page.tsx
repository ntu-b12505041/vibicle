"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_NAME, AUTH_REGISTRY_ID, ADMIN_CAP_ID } from "../../constants";
import { ConnectButton } from "@mysten/dapp-kit";
import Link from "next/link";

export default function AdminPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Grant Form
  const [recipient, setRecipient] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("1"); // 1=Service, 2=Insurance

  // Revoke Form
  const [revokeCapId, setRevokeCapId] = useState("");

  const handleGrant = async () => {
    if (!account) return alert("請先連接管理員錢包");
    if (!ADMIN_CAP_ID) return alert("請在 constants.ts 設定 ADMIN_CAP_ID");

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::grant_third_party`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(AUTH_REGISTRY_ID), // 傳入權限表
        tx.pure.u8(Number(role)),
        tx.pure.string(name),
        tx.pure.address(recipient),
      ],
    });

    signAndExecute({ transaction: tx }, {
        onSuccess: (res) => alert(`授權成功! Digest: ${res.digest}`),
        onError: (err) => alert(`失敗: ${err.message}`)
    });
  };

  const handleRevoke = async () => {
    if (!account) return alert("請先連接管理員錢包");
    if (!revokeCapId) return alert("請輸入要撤銷的 Cap ID");

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::revoke_third_party`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(AUTH_REGISTRY_ID),
        tx.pure.id(revokeCapId) // 傳入要撤銷的 ID
      ],
    });

    signAndExecute({ transaction: tx }, {
        onSuccess: (res) => alert(`撤銷成功! Digest: ${res.digest}`),
        onError: (err) => alert(`失敗: ${err.message}`)
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-900">← 回首頁</Link>
            <h1 className="text-2xl font-bold text-gray-900">管理員後台</h1>
          </div>
          <ConnectButton />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            {/* 左邊：發放權限 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <h2 className="text-lg font-bold mb-4 text-green-700 flex items-center gap-2">
                    ✅ 發放權限 (Grant)
                </h2>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">機構名稱</label>
                        <input className="border p-2 w-full rounded" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Toyota 新竹廠" />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">角色類型</label>
                        <select className="border p-2 w-full rounded" value={role} onChange={e => setRole(e.target.value)}>
                            <option value="1">保養廠 (Service)</option>
                            <option value="2">保險公司 (Insurance)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600 mb-1">接收者地址</label>
                        <input className="border p-2 w-full rounded" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x..." />
                    </div>

                    <button onClick={handleGrant} className="bg-black text-white p-3 rounded hover:bg-gray-800 transition">
                        發放 ThirdPartyCap
                    </button>
                </div>
            </div>

            {/* 右邊：撤銷權限 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <h2 className="text-lg font-bold mb-4 text-red-700 flex items-center gap-2">
                    🚫 撤銷權限 (Revoke)
                </h2>
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500">
                        輸入要撤銷的 ThirdPartyCap ID。撤銷後，該機構將無法再上傳任何紀錄。
                    </p>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Target Cap ID</label>
                        <input className="border p-2 w-full rounded" value={revokeCapId} onChange={e => setRevokeCapId(e.target.value)} placeholder="0x..." />
                    </div>

                    <button onClick={handleRevoke} className="bg-red-600 text-white p-3 rounded hover:bg-red-700 transition">
                        立即撤銷權限
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}