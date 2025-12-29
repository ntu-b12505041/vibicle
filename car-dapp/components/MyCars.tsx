"use client";

import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Transaction } from "@mysten/sui/transactions";
import { useCars } from "../hooks/useCars";
import { PACKAGE_ID, MODULE_NAME } from "../constants";
import { useUserAuth } from "../hooks/useUserAuth";

// zkLogin & Shinami
import { EnokiClient } from "@mysten/enoki";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature } from "@mysten/sui/zklogin";

const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

export function MyCars() {
  const { user } = useUserAuth();
  const { cars, isLoading } = useCars(user?.address);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [isProcessing, setIsProcessing] = useState(false);

  // zkLogin 交易執行器
  const executeZkTransaction = async (tx: Transaction, successMessage: string) => {
    setIsProcessing(true);
    try {
        const session = (user as any).session;
        if (!session) throw new Error("Session 無效");

        const keypairBytes = fromB64(session.ephemeralKeyPair);
        const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keypairBytes);
        const pubKey = ephemeralKeyPair.getPublicKey();

        // ZKP
        const zkpResponse = await fetch("/api/zkp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jwt: session.jwt,
                ephemeralPublicKey: pubKey.toBase64(),
                maxEpoch: session.maxEpoch,
                randomness: session.randomness,
                network: "testnet"
            })
        });
        if (!zkpResponse.ok) throw new Error("ZK Proof 生成失敗");
        const zkp = await zkpResponse.json();

        tx.setSender(user!.address);

        // Sponsor
        const suiClient = new SuiClient({ url: SUI_RPC_URL });
        const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

        const sponsorRes = await fetch("/api/sponsor", {
            method: "POST",
            body: JSON.stringify({
                transactionBlockKindBytes: toB64(txBytes),
                sender: user!.address
            })
        });
        if (!sponsorRes.ok) throw new Error("Shinami 贊助失敗");
        const sponsoredData = await sponsorRes.json();

        // Sign & Execute
        const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
        const { signature: userSignature } = await sponsoredTx.sign({
            client: suiClient,
            signer: ephemeralKeyPair
        });

        const zkSignature = getZkLoginSignature({
            inputs: { ...zkp, addressSeed: zkp.addressSeed },
            maxEpoch: session.maxEpoch,
            userSignature,
        });

        const res = await suiClient.executeTransactionBlock({
            transactionBlock: sponsoredData.bytes,
            signature: [zkSignature, sponsoredData.signature],
            options: { showEffects: true }
        });

        if (res.effects?.status.status === "success") {
            alert(`${successMessage}\nDigest: ${res.digest}`);
            window.location.reload();
        } else {
            throw new Error("鏈上執行失敗");
        }

    } catch (e) {
        console.error(e);
        alert("操作失敗: " + (e as Error).message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- 動作：過戶 ---
  const handleTransfer = async (carId: string) => {
      const recipient = prompt("請輸入接收者的錢包地址 (0x...):");
      if (!recipient) return;
      
      const tx = new Transaction();
      tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_car`,
          arguments: [ tx.object(carId), tx.pure.address(recipient) ]
      });

      if (user?.type === "zklogin") {
          await executeZkTransaction(tx, "過戶成功！車輛已移出您的車庫。");
      } else {
          tx.setSender(user!.address);
          signAndExecute({ transaction: tx }, {
            onSuccess: () => { alert("過戶成功！車輛已移出您的車庫。"); window.location.reload(); },
            onError: (e) => alert("過戶失敗: " + e.message)
          });
      }
  };

  // --- 動作：上下架 (含價格設定) ---
  const handleListing = async (carId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    let priceInMist = 0; // 預設為 0

    // 如果是要上架，詢問價格
    if (newStatus) {
        const inputPrice = prompt("請輸入出售價格 (SUI):", "0.1");
        if (inputPrice === null) return; // 取消
        
        const price = parseFloat(inputPrice);
        if (isNaN(price) || price <= 0) return alert("請輸入有效的價格");
        
        priceInMist = Math.floor(price * 1_000_000_000);
    }
    
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::update_listing`,
        arguments: [
            tx.object(carId),
            tx.pure.bool(newStatus),
            // 🔴 修正：無論上架或下架，都必須傳入一個 u64 數字
            tx.pure.u64(priceInMist) 
        ]
    });

    if (user?.type === "zklogin") {
        await executeZkTransaction(tx, newStatus ? "已上架！" : "已下架！");
    } else {
        tx.setSender(user!.address);
        signAndExecute({ transaction: tx }, {
          onSuccess: () => { alert(newStatus ? "已上架！" : "已下架！"); window.location.reload(); },
          onError: (e) => alert("操作失敗: " + e.message)
        });
    }
  };

  if (!user) return null;

  if (isLoading) return <div className="text-center p-8 text-gray-500">載入車庫中...</div>;

  if (cars.length === 0) {
    return (
      <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300 mt-8">
        <p className="text-gray-500 font-medium">你的車庫是空的</p>
        <p className="text-sm text-gray-400 mt-1">地址: {user.address.slice(0,6)}...{user.address.slice(-4)}</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
        我的車庫 ({cars.length})
        {isProcessing && <span className="text-sm text-blue-600 animate-pulse">(處理交易中...)</span>}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cars.map((car) => (
            <div key={car.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col">
              
              <Link href={`/car/${car.id}`} className="block relative group">
                  <div className="h-48 w-full bg-gray-100 relative overflow-hidden">
                    {car.imageUrl ? (
                      <img src={car.imageUrl} alt={car.model} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">無圖片</div>
                    )}
                    
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold shadow-sm ${
                        car.isListed ? "bg-green-500 text-white" : "bg-gray-800 text-white"
                    }`}>
                        {car.isListed ? "出售中" : "私有"}
                    </div>

                    {/* 顯示目前價格 */}
                    {car.isListed && car.price && (
                        <div className="absolute bottom-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-green-700 shadow-sm">
                            {(Number(car.price) / 1_000_000_000).toLocaleString()} SUI
                        </div>
                    )}
                  </div>
                  
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-gray-900">{car.brand} {car.model}</h3>
                    <p className="text-sm text-gray-500">{car.year} 年式</p>
                    <div className="mt-2 text-xs text-gray-400 font-mono">VIN: {car.vin}</div>
                  </div>
              </Link>

              <div className="px-5 pb-5 pt-0 mt-auto flex gap-2">
                  <button 
                    onClick={() => handleListing(car.id, car.isListed)}
                    disabled={isProcessing}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition ${
                        car.isListed 
                        ? "border-red-200 text-red-600 hover:bg-red-50" 
                        : "border-blue-200 text-blue-600 hover:bg-blue-50"
                    } disabled:opacity-50`}
                  >
                    {car.isListed ? "下架" : "上架"}
                  </button>
                  
                  <button 
                    onClick={() => handleTransfer(car.id)}
                    disabled={isProcessing}
                    className="flex-1 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    🎁 過戶
                  </button>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}