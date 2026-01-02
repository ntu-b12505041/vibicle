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
  
  const [recipient, setRecipient] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("1"); // 1=Service, 2=Insurance
  const [revokeCapId, setRevokeCapId] = useState("");

  const handleGrant = async () => {
    if (!account) return alert("請先連接管理員錢包");
    if (!name || !recipient) return alert("請填寫完整資訊");

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::grant_third_party`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(AUTH_REGISTRY_ID),
        tx.pure.u8(Number(role)),
        tx.pure.string(name),
        tx.pure.address(recipient),
      ],
    });

    signAndExecute({ transaction: tx }, {
        onSuccess: (res) => {
            alert(`授權成功! Digest: ${res.digest}`);
            setRecipient("");
            setName("");
        },
        onError: (err) => alert(`失敗: ${err.message}`)
    });
  };

  const handleRevoke = async () => {
    if (!account) return alert("請先連接管理員錢包");
    if (!revokeCapId) return alert("請輸入 Cap ID");

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::revoke_third_party`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(AUTH_REGISTRY_ID),
        tx.pure.id(revokeCapId)
      ],
    });

    signAndExecute({ transaction: tx }, {
        onSuccess: (res) => {
            alert(`撤銷成功! Digest: ${res.digest}`);
            setRevokeCapId("");
        },
        onError: (err) => alert(`失敗: ${err.message}`)
    });
  };

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-display overflow-x-hidden relative selection:bg-[#00E5FF] selection:text-black">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#112236_1px,transparent_1px),linear-gradient(to_bottom,#112236_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none z-0"></div>
      <div className="fixed inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2))] bg-[size:100%_4px] opacity-15 pointer-events-none z-50"></div>

      <header className="w-full border-b-2 border-[#00E5FF]/30 bg-[#050b14]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link href="/" className="text-[#00E5FF] hover:text-white transition-colors text-2xl font-bold">
                 ←
             </Link>
             <div>
                <h1 className="font-['Press_Start_2P',_cursive] text-sm sm:text-base text-[#00E5FF] tracking-wider drop-shadow-[0_0_5px_rgba(0,229,255,0.7)]">
                    ADMIN // COMMAND_CENTER
                </h1>
                <p className="text-xs text-[#29B6F6]/70 font-mono tracking-widest uppercase">
                    SECURE_CONN :: {account ? "ONLINE" : "OFFLINE"}
                </p>
             </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12">
        
        {/* 操作面板 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* 左側：授權面板 */}
            <section className="bg-[#0a1625] border border-[#00E5FF]/30 p-8 shadow-[0_0_15px_rgba(0,229,255,0.15),inset_0_0_15px_rgba(0,229,255,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="text-8xl text-[#00E5FF]">verified_user</span>
                </div>
                
                <h3 className="font-['Press_Start_2P',_cursive] text-[#00ff41] text-sm mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse shadow-[0_0_8px_#00ff41]"></span>
                    GRANT_ACCESS
                </h3>

                <div className="space-y-6 relative z-10">
                    <div>
                        <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Organization Name</label>
                        <input 
                            className="w-full bg-[#050b14] border border-[#112236] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition-all font-mono text-sm"
                            placeholder="e.g. Toyota Taipei"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Role Type</label>
                        <select 
                            className="w-full bg-[#050b14] border border-[#112236] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] transition-all font-mono text-sm appearance-none cursor-pointer hover:border-[#29B6F6]"
                            value={role}
                            onChange={e => setRole(e.target.value)}
                        >
                            <option value="1">SERVICE (保養廠)</option>
                            <option value="2">INSURANCE (保險公司)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-[#29B6F6] font-bold tracking-widest uppercase mb-2">Wallet Address</label>
                        <input 
                            className="w-full bg-[#050b14] border border-[#112236] text-white px-4 py-3 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition-all font-mono text-sm"
                            placeholder="0x..."
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleGrant}
                        className="w-full bg-[#00E5FF]/10 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black font-bold py-4 px-6 rounded-none text-xs font-['Press_Start_2P',_cursive] transition-all duration-300 shadow-[0_0_10px_rgba(0,229,255,0.1)] hover:shadow-[0_0_20px_rgba(0,229,255,0.6)] mt-4"
                    >
                        EXECUTE_GRANT_PROTOCOL
                    </button>
                </div>
            </section>

            {/* 右側：撤銷面板 */}
            <section className="bg-[#0a1625] border border-[#ff003c]/30 p-8 shadow-[0_0_15px_rgba(255,0,60,0.15),inset_0_0_15px_rgba(255,0,60,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="text-8xl text-[#ff003c]">block</span>
                </div>

                <h3 className="font-['Press_Start_2P',_cursive] text-[#ff003c] text-sm mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#ff003c] rounded-full animate-pulse shadow-[0_0_8px_#ff003c]"></span>
                    REVOKE_ACCESS
                </h3>

                <div className="space-y-6 relative z-10">
                    <div className="p-4 bg-[#ff003c]/10 border border-[#ff003c]/30 text-[#ff003c] text-xs font-mono mb-4">
                        WARNING: This action is irreversible. The target capability will be permanently disabled.
                    </div>

                    <div>
                        <label className="block text-xs text-[#ff003c] font-bold tracking-widest uppercase mb-2">Target Cap ID</label>
                        <input 
                            className="w-full bg-[#050b14] border border-[#112236] text-white px-4 py-3 focus:outline-none focus:border-[#ff003c] focus:shadow-[0_0_10px_rgba(255,0,60,0.3)] transition-all font-mono text-sm"
                            placeholder="0x..."
                            value={revokeCapId}
                            onChange={e => setRevokeCapId(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleRevoke}
                        className="w-full bg-[#ff003c]/10 border border-[#ff003c] text-[#ff003c] hover:bg-[#ff003c] hover:text-white font-bold py-4 px-6 rounded-none text-xs font-['Press_Start_2P',_cursive] transition-all duration-300 shadow-[0_0_10px_rgba(255,0,60,0.1)] hover:shadow-[0_0_20px_rgba(255,0,60,0.6)] mt-auto"
                    >
                        INITIATE_REVOKE_SEQUENCE
                    </button>
                </div>
            </section>

        </div>
      </main>
    </div>
  );
}