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
import Link from "next/link";

const WALRUS_PUBLISHER = "/api/upload";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

function getIssFromJwt(jwt: string) { try { return JSON.parse(atob(jwt.split('.')[1])).iss; } catch { return ""; } }

export default function InsurancePage() {
  const { user, logout } = useUserAuth();
  const { isInsurance, insuranceCapId, isLoading: capLoading } = useCapabilities();
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
                
                // 保養廠參數留空 (預設值)
                tx.pure.bool(false),
                tx.pure.vector("string", []),
                tx.pure.option("string", null),
                tx.pure.u64(0),
                
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
                alert(`保險紀錄新增成功!\nDigest: ${res.digest}`);
                setDescription("");
                setMileage("");
                setSelectedFiles([]);
                window.location.reload();
            } else {
                throw new Error("交易失敗");
            }
        } else {
            // === 錢包流程 (修正版) ===
            tx.setSender(user.address);
            
            // 🔴 修正：移除 options 參數，避免 TypeScript 報錯
            signAndExecute(
                { transaction: tx }, 
                { 
                    onSuccess: (res) => { 
                        // 🔴 修正：簡化成功判斷 (不讀取 effects)
                        alert("保險紀錄新增成功!\nDigest: " + res.digest);
                        setDescription("");
                        setMileage("");
                        setSelectedFiles([]);
                        window.location.reload();
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

  if (!user || capLoading || !isInsurance) {
      return (
          <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-4">
              <div className="bg-[#0a1320] border border-[#FF3333]/30 p-8 rounded-lg shadow-[0_0_15px_rgba(255,51,51,0.2)] text-center max-w-md w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,51,51,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,51,51,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  <h1 className="text-2xl font-['Press_Start_2P',_cursive] text-[#FF3333] mb-4 relative z-10">ACCESS DENIED</h1>
                  <p className="text-gray-400 mb-8 font-mono text-sm relative z-10">
                      {capLoading ? "VERIFYING AGENT ID..." : !user ? "AGENT LOGIN REQUIRED" : "INVALID AGENT CLEARANCE"}
                  </p>
                  <Link href="/" className="inline-block w-full py-3 px-4 bg-[#FF3333]/10 hover:bg-[#FF3333] text-[#FF3333] hover:text-black border border-[#FF3333] rounded font-bold transition-all relative z-10 font-mono">
                      RETURN TO HQ
                  </Link>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-['Space_Grotesk',_sans-serif] selection:bg-[#00FF00] selection:text-black overflow-x-hidden relative">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
        
        <header className="w-full border-b-2 border-[#00FF00] bg-[#050b14]/90 backdrop-blur-md sticky top-0 z-40 shadow-[0_0_15px_rgba(0,255,0,0.3)]">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-[#00FF00] hover:text-white transition-colors text-2xl font-bold">←</Link>
                    <div>
                        <h1 className="font-['Press_Start_2P',_cursive] text-xs text-[#00FF00] tracking-widest mb-1">SECURE_LINK::ESTABLISHED</h1>
                        <h2 className="font-bold text-xl text-white tracking-wider">INSURANCE PORTAL v.3.0</h2>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs text-[#00FF00] font-['Press_Start_2P',_cursive]">AGENT</p>
                        <p className="text-sm font-bold font-mono">{user.address.slice(0,6)}...</p>
                    </div>
                    <button onClick={logout} className="text-gray-400 hover:text-[#FF3333] transition-colors font-medium text-sm">LOGOUT</button>
                </div>
            </div>
        </header>

        <main className="relative z-10 w-full max-w-5xl mx-auto px-6 py-10">
            <div className="mb-8 border-l-4 border-[#00FF00] pl-6 py-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00FF00]/10 to-transparent transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700"></div>
                <h2 className="font-['Press_Start_2P',_cursive] text-2xl text-white mb-2">FILE NEW CLAIM</h2>
                <p className="text-[#00FF00] font-mono">Blockchain ledger ready. Enter claim details below.</p>
            </div>

            <div className="bg-[#0a1320] border border-[#00FF00]/30 rounded-lg p-8 relative overflow-hidden shadow-[0_0_20px_rgba(0,255,0,0.1)]">
                
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <label className="block text-xs text-[#00FF00] font-bold tracking-widest uppercase mb-2">Vehicle ID (Object ID)</label>
                        <input className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00FF00] focus:shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all font-mono text-sm" 
                            value={carId} onChange={e => setCarId(e.target.value)} placeholder="0x..." />
                    </div>

                    <div>
                        <label className="block text-xs text-[#00FF00] font-bold tracking-widest uppercase mb-2">Odometer at Incident (KM)</label>
                        <input type="number" className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00FF00] focus:shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all font-mono text-sm" 
                            value={mileage} onChange={e => setMileage(e.target.value)} />
                    </div>
                </div>

                <div className="mb-8">
                    <label className="block text-xs text-[#00FF00] font-bold tracking-widest uppercase mb-2">Claim Description / Accident Report</label>
                    <textarea className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00FF00] focus:shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all font-mono text-sm h-32 resize-none" 
                        value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the incident, damage assessment, and policy coverage..." />
                </div>

                <div className="border-t border-[#1a3548] pt-6 mb-8">
                    <label className="block text-xs text-[#00FF00] font-bold tracking-widest uppercase mb-4">Evidence Upload (Photos/Docs)</label>
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                    
                    <div className="flex gap-4 mb-4">
                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-[#1a3548] hover:bg-[#00FF00] hover:text-black text-[#00FF00] border border-[#00FF00] rounded font-arcade text-xs transition-all">
                            + ATTACH EVIDENCE
                        </button>
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedFiles.map((f, i) => (
                                <div key={i} className="flex justify-between items-center bg-[#050b14] border border-[#1a3548] px-4 py-2 rounded text-xs text-gray-300 font-mono">
                                    <span className="truncate">{f.name}</span>
                                    <button onClick={() => removeFile(i)} className="text-[#FF3333] hover:text-white ml-2">DEL</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleSubmit} 
                    disabled={loading} 
                    className="w-full py-4 bg-[#00FF00]/10 border border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00] hover:text-black font-bold font-['Press_Start_2P',_cursive] text-sm transition-all duration-300 shadow-[0_0_10px_rgba(0,255,0,0.2)] hover:shadow-[0_0_20px_rgba(0,255,0,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "PROCESSING CLAIM..." : "SUBMIT CLAIM RECORD"}
                </button>
            </div>
        </main>
    </div>
  );
}