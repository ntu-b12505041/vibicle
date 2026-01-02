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

export default function ServicePage() {
  const { user, logout } = useUserAuth();
  const { isService, serviceCapId, isLoading: capLoading } = useCapabilities();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction(); 
  
  const [carId, setCarId] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [nextDueKm, setNextDueKm] = useState(""); 
  
  const [isReset, setIsReset] = useState(false); 
  const [dtcCodes, setDtcCodes] = useState(""); 
  const [batterySn, setBatterySn] = useState(""); 
  
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
    if (!isService || !serviceCapId) return alert("錯誤：偵測不到保養廠權限");
    if (!carId) return alert("請輸入車輛 ID");

    setLoading(true);

    try {
        const attachmentUrls = await uploadFiles();
        
        const dtcList = dtcCodes.split(",").map(s => s.trim()).filter(s => s !== "");
        const batteryOpt = batterySn.trim() === "" ? null : batterySn.trim(); 

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
                tx.pure.bool(isReset),
                tx.pure.vector("string", dtcList),
                tx.pure.option("string", batteryOpt),
                tx.pure.u64(Number(nextDueKm) || 0),
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

            if (res.effects?.status.status === "failure") {
                throw new Error("鏈上拒絕: " + res.effects.status.error);
            }

            alert(`紀錄新增成功!\nDigest: ${res.digest}`);
            window.location.reload();

        } else {
            tx.setSender(user.address);
            signAndExecute(
                { transaction: tx }, 
                { 
                    onSuccess: (res) => { 
                       alert("成功"); 
                       window.location.reload(); 
                    },
                    onError: (e) => alert("錢包錯誤: " + e.message)
                }
            );
        }

    } catch (e) {
        console.error("❌ 流程崩潰:", e);
        alert("操作失敗: " + (e as Error).message);
    } finally {
        setLoading(false);
    }
  };

  if (!user || capLoading || !isService) {
      return (
          <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-4">
              <div className="bg-[#0a1320] border border-[#00E5FF]/30 p-8 rounded-lg shadow-[0_0_15px_rgba(0,229,255,0.2)] text-center max-w-md w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  <h1 className="text-2xl font-['Press_Start_2P',_cursive] text-[#00E5FF] mb-4 relative z-10">ACCESS DENIED</h1>
                  <p className="text-gray-400 mb-8 font-mono text-sm relative z-10">
                      {capLoading ? "VERIFYING CREDENTIALS..." : !user ? "PLEASE LOGIN" : "INVALID CLEARANCE LEVEL"}
                  </p>
                  <Link href="/" className="inline-block w-full py-3 px-4 bg-[#00E5FF]/10 hover:bg-[#00E5FF] text-[#00E5FF] hover:text-black border border-[#00E5FF] rounded font-bold transition-all relative z-10">
                      RETURN TO BASE
                  </Link>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-['Space_Grotesk',_sans-serif] selection:bg-[#00E5FF] selection:text-black overflow-x-hidden relative">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,229,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
        <div className="fixed inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1))] bg-[size:100%_4px] pointer-events-none z-50 opacity-20"></div>

        <header className="w-full border-b-2 border-[#00E5FF] bg-[#050b14]/90 backdrop-blur-md sticky top-0 z-40 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-[#00E5FF] hover:text-white transition-colors text-2xl font-bold">←</Link>
                    <div>
                        <h1 className="font-['Press_Start_2P',_cursive] text-xs text-[#00E5FF] tracking-widest mb-1">SYSTEM ONLINE</h1>
                        <h2 className="font-bold text-xl text-white tracking-wider">SERVICE STATION v.3.0</h2>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs text-[#00FF00] font-['Press_Start_2P',_cursive]">OPERATOR</p>
                        <p className="text-sm font-bold font-mono">{user.address.slice(0,6)}...</p>
                    </div>
                    <button onClick={logout} className="text-gray-400 hover:text-[#FF3333] transition-colors font-medium text-sm">LOGOUT</button>
                </div>
            </div>
        </header>

        <main className="relative z-10 w-full max-w-5xl mx-auto px-6 py-10">
            <div className="mb-8 border-l-4 border-[#00FF00] pl-6 py-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00FF00]/10 to-transparent transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700"></div>
                <h2 className="font-['Press_Start_2P',_cursive] text-2xl text-white mb-2">NEW SERVICE ENTRY</h2>
                <p className="text-[#29B6F6] font-mono">Secure connection established. Ready to write immutable record.</p>
            </div>

            <div className="bg-[#0a1320] border border-[#00E5FF]/30 rounded-lg p-8 relative overflow-hidden shadow-[0_0_20px_rgba(0,229,255,0.1)]">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Basic Info */}
                    <div className="space-y-6">
                        <h3 className="text-[#00E5FF] font-['Press_Start_2P',_cursive] text-xs mb-4 uppercase border-b border-[#00E5FF]/30 pb-2">Vehicle Identification</h3>
                        
                        <div>
                            <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Target Object ID</label>
                            <input className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition-all font-mono text-sm" 
                                value={carId} onChange={e => setCarId(e.target.value)} placeholder="0x..." />
                        </div>

                        <div>
                            <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Current Odometer (KM)</label>
                            <input type="number" className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition-all font-mono text-sm" 
                                value={mileage} onChange={e => setMileage(e.target.value)} />
                        </div>

                        <div>
                            <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Service Description</label>
                            <textarea className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition-all font-mono text-sm h-32 resize-none" 
                                value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter detailed service log..." />
                        </div>
                    </div>

                    {/* Technical Data */}
                    <div className="space-y-6">
                        <h3 className="text-[#00E5FF] font-['Press_Start_2P',_cursive] text-xs mb-4 uppercase border-b border-[#00E5FF]/30 pb-2">Technical Diagnostics</h3>
                        
                        <div>
                            <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Next Service Due (KM)</label>
                            <input type="number" className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] transition-all font-mono text-sm" 
                                value={nextDueKm} onChange={e => setNextDueKm(e.target.value)} placeholder="Recommended next visit" />
                        </div>

                        <div>
                            <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">DTC Codes (Comma Separated)</label>
                            <input className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] transition-all font-mono text-sm uppercase" 
                                value={dtcCodes} onChange={e => setDtcCodes(e.target.value)} placeholder="P0300, P0171..." />
                        </div>

                        <div>
                            <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Battery S/N (Optional)</label>
                            <input className="w-full bg-[#050b14] border border-[#1a3548] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] transition-all font-mono text-sm" 
                                value={batterySn} onChange={e => setBatterySn(e.target.value)} placeholder="N/A" />
                        </div>

                        <div className="flex items-center gap-3 pt-4">
                            <input type="checkbox" id="reset" className="w-5 h-5 bg-[#050b14] border-[#00E5FF] text-[#00E5FF] focus:ring-0 rounded" 
                                checked={isReset} onChange={e => setIsReset(e.target.checked)} />
                            <label htmlFor="reset" className="text-sm text-gray-300 cursor-pointer select-none">Maintenance Light Reset Performed</label>
                        </div>
                    </div>
                </div>

                {/* Evidence Upload */}
                <div className="border-t border-[#1a3548] pt-6 mb-8">
                    <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-4">Digital Evidence (Walrus)</label>
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                    
                    <div className="flex gap-4 mb-4">
                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-[#1a3548] hover:bg-[#29B6F6] hover:text-black text-[#29B6F6] border border-[#29B6F6] rounded font-arcade text-xs transition-all">
                            + UPLOAD FILES
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
                    className="w-full py-4 bg-[#00E5FF]/10 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black font-bold font-['Press_Start_2P',_cursive] text-sm transition-all duration-300 shadow-[0_0_10px_rgba(0,229,255,0.2)] hover:shadow-[0_0_20px_rgba(0,229,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "PROCESSING..." : "COMMIT TO BLOCKCHAIN"}
                </button>
            </div>
        </main>
    </div>
  );
}