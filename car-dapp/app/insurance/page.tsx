"use client";

import { useState, useRef } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useUserAuth } from "../../hooks/useUserAuth";
import { useCapabilities } from "../../hooks/useCapabilities";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_NAME, AUTH_REGISTRY_ID } from "../../constants";
import { SuiClient } from "@mysten/sui/client";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature, computeZkLoginAddressFromSeed } from "@mysten/sui/zklogin";
import { EnokiClient } from "@mysten/enoki";
// 🔴 新增：引入 Link
import Link from "next/link";

const WALRUS_PUBLISHER = "/api/upload";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

function getIssFromJwt(jwt: string) { try { return JSON.parse(atob(jwt.split('.')[1])).iss; } catch { return ""; } }

export default function InsurancePage() {
  const { user, logout } = useUserAuth();
  const { isInsurance, insuranceCapId } = useCapabilities();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction(); 
  
  const [carId, setCarId] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  
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
    if (!isInsurance || !insuranceCapId) return alert("錯誤：偵測不到保險公司權限");
    if (!carId) return alert("請輸入車輛 ID");

    setLoading(true);

    try {
        const attachmentUrls = await uploadFiles();
        console.log("附件上傳完成:", attachmentUrls);

        const tx = new Transaction();
        
        tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE_NAME}::add_record`,
            arguments: [
                tx.object(insuranceCapId),
                tx.object(AUTH_REGISTRY_ID),
                tx.object(carId),
                tx.pure.u8(2),                // record_type (2=Insurance)
                tx.pure.string(description),
                tx.pure.u64(Number(mileage)),
                tx.pure.vector("string", attachmentUrls),
                
                tx.pure.bool(false),
                tx.pure.vector("string", []),
                tx.pure.option("string", null),
                tx.pure.u64(0),
                
                tx.object("0x6"),
            ]
        });

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
                alert(`保險紀錄新增成功!\nDigest: ${res.digest}`);
                setDescription("");
                setMileage("");
                setSelectedFiles([]);
            } else {
                throw new Error("交易失敗");
            }
        } else {
            tx.setSender(user.address);
            signAndExecute(
                { transaction: tx, options: { showEffects: true } }, 
                { 
                    onSuccess: (res) => { 
                        if (res.effects?.status.status === "success") {
                            alert("成功"); 
                        } else {
                            alert("交易失敗");
                        }
                    },
                    onError: (e) => alert("錢包錯誤: " + e.message)
                }
            );
        }

    } catch (e) {
        console.error(e);
        alert("失敗: " + (e as Error).message);
    } finally {
        setLoading(false);
    }
  };

  // 🔴 優化：未登入時的 UI
  if (!user) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">🛡️ 保險公司後台</h1>
                  <p className="text-gray-500 mb-6">此頁面僅限授權的保險專員存取</p>
                  
                  <div className="flex flex-col gap-3">
                      <Link href="/" className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition">
                          ← 返回首頁登入
                      </Link>
                  </div>
              </div>
          </div>
      );
  }

  // 🔴 優化：主畫面 UI
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
        <div className="p-8 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-900 transition flex items-center gap-1 font-medium">
                        ← 首頁
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">🛡️ 保險公司作業系統</h1>
                </div>
                
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border">
                        {user.address.slice(0,6)}...
                    </span>
                    <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium underline">
                        登出
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                {/* 表單內容與之前相同 */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">車輛 ID (Object ID)</label>
                    <input 
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition" 
                        value={carId} 
                        onChange={e => setCarId(e.target.value)} 
                        placeholder="0x..." 
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">核保/出險時里程數 (KM)</label>
                    <input 
                        type="number" 
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white outline-none" 
                        value={mileage} 
                        onChange={e => setMileage(e.target.value)} 
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">出險/理賠說明</label>
                    <textarea 
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white h-32 resize-none outline-none" 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        placeholder="例如：右前保桿擦傷出險、定期續保..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">事故照片/理賠單據</label>
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition mb-3">
                        📎 選擇檔案 (支援多選)
                    </button>
                    <div className="space-y-2">
                        {selectedFiles.map((f, i) => (
                            <div key={i} className="flex justify-between items-center bg-green-50 px-3 py-2 rounded text-sm text-green-800">
                                <span>{f.name}</span>
                                <button onClick={() => removeFile(i)} className="text-green-600 hover:text-red-500">✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:shadow-lg transition disabled:bg-gray-300">
                    {loading ? "資料寫入中..." : "確認送出"}
                </button>
            </div>
        </div>
    </div>
  );
}