"use client";

import { useState, useRef } from "react";
import { useUserAuth } from "../../hooks/useUserAuth";
import { useCapabilities } from "../../hooks/useCapabilities";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_NAME, AUTH_REGISTRY_ID } from "../../constants";
import { SuiClient } from "@mysten/sui/client";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature, computeZkLoginAddressFromSeed } from "@mysten/sui/zklogin";
import { EnokiClient } from "@mysten/enoki";

const WALRUS_PUBLISHER = "/api/upload";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

function getIssFromJwt(jwt: string) { try { return JSON.parse(atob(jwt.split('.')[1])).iss; } catch { return ""; } }

export default function ServicePage() {
  const { user, logout } = useUserAuth();
  const { isService, serviceCapId } = useCapabilities();
  
  const [carId, setCarId] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  
  // 使用 Array 儲存多個檔案
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files);
          setSelectedFiles(prev => [...prev, ...newFiles]);
      }
  };

  const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];
    
    const promises = selectedFiles.map(async (file) => {
        const res = await fetch(WALRUS_PUBLISHER, { method: "PUT", body: file });
        const data = await res.json();
        const blobId = data.newlyCreated?.blobObject.blobId || data.alreadyCertified?.blobId;
        return `${WALRUS_AGGREGATOR}/${blobId}`; 
    });

    return Promise.all(promises);
  };

  const handleSubmit = async () => {
    if (!user) return alert("請先登入");
    if (!isService || !serviceCapId) return alert("錯誤：偵測不到保養廠權限 (ThirdPartyCap)");
    if (!carId) return alert("請輸入車輛 ID");

    setLoading(true);

    try {
        const attachmentUrls = await uploadFiles();
        console.log("附件上傳完成:", attachmentUrls);

        const tx = new Transaction();
        
        tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE_NAME}::add_record`,
            arguments: [
                tx.object(serviceCapId),
                tx.object(AUTH_REGISTRY_ID),
                tx.object(carId),
                tx.pure.u8(1),
                tx.pure.string(description),
                tx.pure.u64(Number(mileage)),
                tx.pure.vector("string", attachmentUrls),
                tx.object("0x6"),
            ]
        });

        // === zkLogin + Shinami 流程 ===
        if (user.type === "zklogin") {
            const session = (user as any).session;
            const keypairBytes = fromB64(session.ephemeralKeyPair);
            const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keypairBytes);
            const pubKey = ephemeralKeyPair.getPublicKey();

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
            const zkp = await zkpResponse.json();
            const trueAddress = computeZkLoginAddressFromSeed(BigInt(zkp.addressSeed), getIssFromJwt(session.jwt));
            tx.setSender(trueAddress);

            const suiClient = new SuiClient({ url: SUI_RPC_URL });
            const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
            const sponsorRes = await fetch("/api/sponsor", {
                method: "POST",
                body: JSON.stringify({ transactionBlockKindBytes: toB64(txBytes), sender: trueAddress })
            });
            const sponsoredData = await sponsorRes.json();

            const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
            const { signature: userSignature } = await sponsoredTx.sign({ client: suiClient, signer: ephemeralKeyPair });
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
                alert(`紀錄新增成功!\nDigest: ${res.digest}`);
                // 🔴 修正這裡：清除狀態使用正確的名稱
                setDescription("");
                setMileage("");
                setSelectedFiles([]); // <--- 改成這個
            } else {
                throw new Error("交易失敗");
            }
        } else {
            // 錢包流程 (暫時省略，邏輯同上)
            alert("請使用 Google 登入以使用保養廠功能");
        }

    } catch (e) {
        console.error(e);
        alert("失敗: " + (e as Error).message);
    } finally {
        setLoading(false);
    }
  };

  if (!user) return <div className="p-8">請先登入</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">🔧 保養廠作業系統</h1>
            <button onClick={logout} className="text-sm text-red-500 hover:underline">登出</button>
        </div>

        <div className="flex flex-col gap-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">車輛 ID (Object ID)</label>
                <input 
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
                    value={carId} 
                    onChange={e => setCarId(e.target.value)} 
                    placeholder="0x..." 
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">最新里程數 (KM)</label>
                <input 
                    type="number" 
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white outline-none" 
                    value={mileage} 
                    onChange={e => setMileage(e.target.value)} 
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">維修內容說明</label>
                <textarea 
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white h-32 resize-none outline-none" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="例如：更換機油、輪胎定位..."
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">附件照片/文件</label>
                
                <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                />

                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition mb-3"
                >
                    📎 選擇檔案 (支援多選)
                </button>

                <div className="space-y-2">
                    {selectedFiles.map((f, i) => (
                        <div key={i} className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded text-sm text-blue-800">
                            <span>{f.name}</span>
                            <button onClick={() => removeFile(i)} className="text-blue-400 hover:text-red-500">✕</button>
                        </div>
                    ))}
                </div>
            </div>

            <button 
                onClick={handleSubmit} 
                disabled={loading} 
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg transition disabled:bg-gray-300"
            >
                {loading ? "資料寫入中..." : "確認送出"}
            </button>
        </div>
    </div>
  );
}