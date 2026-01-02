"use client";

import { useState, useEffect, useRef } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { EnokiClient } from "@mysten/enoki";
import { Transaction } from "@mysten/sui/transactions";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature, computeZkLoginAddressFromSeed } from "@mysten/sui/zklogin";
import { PACKAGE_ID, MODULE_NAME, CAR_REGISTRY_ID } from "../constants";
import { useUserAuth } from "../hooks/useUserAuth";

const WALRUS_PUBLISHER = "/api/upload";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

function generateRandomVIN(): string {
    const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 17; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function getIssFromJwt(jwt: string) { try { return JSON.parse(atob(jwt.split('.')[1])).iss; } catch { return ""; } }

export function MintCar() {
  const { user } = useUserAuth();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [vin, setVin] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVin(generateRandomVIN());
  }, []);

  const uploadToWalrus = async (file: File) => {
    setStatus("UPLOADING TO WALRUS...");
    const response = await fetch(WALRUS_PUBLISHER, { method: "PUT", body: file });
    if (!response.ok) throw new Error("UPLOAD FAILED");
    const data = await response.json();
    return data.newlyCreated?.blobObject.blobId || data.alreadyCertified?.blobId;
  };

  const handleMint = async () => {
    if (!user) return alert("PLEASE LOGIN FIRST");
    if (!file) return alert("PLEASE UPLOAD PHOTO");
    if (vin.length !== 17) return alert("INVALID VIN");
    
    setLoading(true);

    try {
      const blobId = await uploadToWalrus(file);
      const imageUrl = `${WALRUS_AGGREGATOR}/${blobId}`;
      setStatus("INITIALIZING MINT PROTOCOL...");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::mint_car`,
        arguments: [
          tx.object(CAR_REGISTRY_ID),
          tx.pure.string(vin),
          tx.pure.string(brand || "Unknown"),
          tx.pure.string(model || "Model"),
          tx.pure.u16(Number(year) || 2024),
          tx.pure.string(imageUrl),
          tx.pure.u64(Number(mileage) || 0),
        ],
      });

      if (user.type === "zklogin") {
        const session = (user as any).session;
        const keypairBytes = fromB64(session.ephemeralKeyPair);
        const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keypairBytes);
        const pubKey = ephemeralKeyPair.getPublicKey();

        setStatus("GENERATING ZK PROOF...");
        const zkpResponse = await fetch("/api/zkp", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jwt: session.jwt, ephemeralPublicKey: pubKey.toBase64(), maxEpoch: session.maxEpoch, randomness: session.randomness, network: "testnet" })
        });
        const zkp = await zkpResponse.json();
        const trueAddress = computeZkLoginAddressFromSeed(BigInt(zkp.addressSeed), getIssFromJwt(session.jwt));
        tx.setSender(trueAddress);

        const suiClient = new SuiClient({ url: SUI_RPC_URL });
        const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

        setStatus("REQUESTING SPONSOR...");
        const sponsorRes = await fetch("/api/sponsor", {
            method: "POST", body: JSON.stringify({ transactionBlockKindBytes: toB64(txBytes), sender: trueAddress })
        });
        const sponsoredData = await sponsorRes.json();
        const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
        const { signature: userSignature } = await sponsoredTx.sign({ client: suiClient, signer: ephemeralKeyPair });
        const zkSignature = getZkLoginSignature({ inputs: { ...zkp, addressSeed: zkp.addressSeed }, maxEpoch: session.maxEpoch, userSignature });

        setStatus("EXECUTING TRANSACTION...");
        const res = await suiClient.executeTransactionBlock({ transactionBlock: sponsoredData.bytes, signature: [zkSignature, sponsoredData.signature], options: { showEffects: true } });

        if (res.effects?.status.status === "failure") throw new Error("TX FAILED");
        if (trueAddress !== user.address) window.localStorage.setItem("demo_zk_session", JSON.stringify({ ...session, address: trueAddress }));

        alert(`MINT SUCCESS!\nDigest: ${res.digest}`);
        window.location.reload();
      } else {
        tx.setSender(user.address);
        signAndExecute({ transaction: tx }, {
            onSuccess: () => { alert("MINT SUCCESS!"); window.location.reload(); },
            onError: (e) => alert("ERROR: " + e.message)
        });
      }
    } catch (e) {
      console.error(e); alert("ERROR: " + (e as Error).message);
    } finally {
      setLoading(false); setStatus(""); setVin(generateRandomVIN());
    }
  };

  if (!user) return null;

  return (
    <section className="w-full flex justify-center">
        <div className="w-full rounded-xl p-8 sm:p-10 border border-[#00E5FF]/40 bg-[linear-gradient(180deg,rgba(0,229,255,0.15)0%,rgba(41,182,246,0.1)100%)] shadow-[0_0_20px_rgba(0,229,255,0.4),inset_0_0_15px_rgba(0,229,255,0.2)] backdrop-blur-md">
            <h1 className="font-['Press_Start_2P',_cursive] text-2xl md:text-3xl leading-snug mb-4 text-[#00E5FF] text-center uppercase" style={{textShadow: "2px 2px 0px #0a1625"}}>
                MINT NEW VEHICLE NFT
            </h1>
            <p className="text-center text-gray-400 mb-8 max-w-md mx-auto text-sm font-['Space_Grotesk',_sans-serif]">
                List your vehicle on the marketplace by minting its unique NFT.
                Fill in the details below to get started.
            </p>

            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-[#00E5FF] mb-2 uppercase tracking-wide">Brand</label>
                        <input className="block w-full px-4 py-2 rounded-md sm:text-sm transition-colors duration-200 bg-[linear-gradient(180deg,rgba(0,229,255,0.05)0%,rgba(41,182,246,0.03)100%)] border border-[#29B6F6]/40 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] focus:shadow-[inset_0_0_8px_rgba(0,229,255,0.4),0_0_5px_rgba(0,229,255,0.3)] placeholder-[#29B6F6]/60" 
                            value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g., Quadra" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#00E5FF] mb-2 uppercase tracking-wide">Model</label>
                        <input className="block w-full px-4 py-2 rounded-md sm:text-sm transition-colors duration-200 bg-[linear-gradient(180deg,rgba(0,229,255,0.05)0%,rgba(41,182,246,0.03)100%)] border border-[#29B6F6]/40 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] focus:shadow-[inset_0_0_8px_rgba(0,229,255,0.4),0_0_5px_rgba(0,229,255,0.3)] placeholder-[#29B6F6]/60" 
                            value={model} onChange={e => setModel(e.target.value)} placeholder="e.g., Type-66" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#00E5FF] mb-2 uppercase tracking-wide">Mileage</label>
                        <div className="relative">
                            <input className="block w-full pr-12 px-4 py-2 rounded-md sm:text-sm transition-colors duration-200 bg-[linear-gradient(180deg,rgba(0,229,255,0.05)0%,rgba(41,182,246,0.03)100%)] border border-[#29B6F6]/40 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] focus:shadow-[inset_0_0_8px_rgba(0,229,255,0.4),0_0_5px_rgba(0,229,255,0.3)] placeholder-[#29B6F6]/60" 
                                value={mileage} onChange={e => setMileage(e.target.value)} placeholder="e.g., 12402" type="number"/>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <span className="text-[#29B6F6] sm:text-sm font-['Press_Start_2P',_cursive]">KM</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#00E5FF] mb-2 uppercase tracking-wide">Year</label>
                        <input className="block w-full px-4 py-2 rounded-md sm:text-sm transition-colors duration-200 bg-[linear-gradient(180deg,rgba(0,229,255,0.05)0%,rgba(41,182,246,0.03)100%)] border border-[#29B6F6]/40 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] focus:shadow-[inset_0_0_8px_rgba(0,229,255,0.4),0_0_5px_rgba(0,229,255,0.3)] placeholder-[#29B6F6]/60" 
                            value={year} onChange={e => setYear(e.target.value)} placeholder="e.g., 2077" type="number"/>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#00E5FF] mb-2 uppercase tracking-wide">Vehicle Secret Code (VIN)</label>
                    <div className="flex items-center space-x-2 bg-[#0a1625] border border-[#29B6F6]/40 rounded-md p-2 shadow-[inset_0_0_8px_rgba(0,229,255,0.3)]">
                        <div className="relative flex-grow">
                            <input className="font-mono bg-transparent text-[#29B6F6] px-2 py-1 rounded-md w-full text-sm select-all cursor-text focus:ring-0 focus:border-transparent outline-none" 
                                readOnly value={vin} />
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(vin)} className="p-2 text-gray-500 hover:text-[#00E5FF] transition-colors duration-200" title="Copy code">
                            📋
                        </button>
                        <button onClick={() => setVin(generateRandomVIN())} className="p-2 text-gray-500 hover:text-[#00E5FF] transition-colors duration-200" title="Regenerate code">
                            🔄
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#00E5FF] mb-2 uppercase tracking-wide">Vehicle Photo</label>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files && setFile(e.target.files[0])} />
                    <div className="flex items-center justify-center w-full">
                        <div onClick={() => fileInputRef.current?.click()} className={`flex flex-col items-center justify-center w-full h-48 rounded-lg cursor-pointer transition-all duration-200 bg-[#0a1625] border-2 border-dashed ${file ? 'border-[#00E5FF] shadow-[inset_0_0_15px_rgba(0,229,255,0.2)]' : 'border-[#29B6F6]/40 hover:border-[#00E5FF]/80'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {file ? (
                                    <p className="text-[#00E5FF] font-['Press_Start_2P',_cursive] text-xs">{file.name}</p>
                                ) : (
                                    <>
                                        <span className="text-4xl text-[#29B6F6] mb-3">📷</span>
                                        <p className="mb-2 text-sm text-[#29B6F6] font-['Press_Start_2P',_cursive]"><span className="font-bold">CLICK TO UPLOAD</span> OR DRAG & DROP</p>
                                        <p className="text-xs text-gray-500 font-sans">SVG, PNG, JPG OR GIF (MAX. 5MB)</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {status && <p className="text-xs text-[#00E5FF] font-mono text-center animate-pulse">{status}</p>}

                <button 
                    onClick={handleMint}
                    disabled={loading}
                    className="w-full bg-[#00E5FF] text-[#050b14] font-bold text-base py-4 px-6 rounded-sm hover:bg-white hover:shadow-[0_0_15px_rgba(0,229,255,0.8)] transition-all transform hover:-translate-y-1 relative overflow-hidden group font-['Press_Start_2P',_cursive] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? "PROCESSING..." : "MINT NFT"} ✨
                    </span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-12"></div>
                </button>
            </div>
        </div>
    </section>
  );
}