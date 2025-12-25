"use client";

import { useUserAuth } from "../hooks/useUserAuth"; // 🔴 復用這個最強 Hook
import { ConnectButton } from "@mysten/dapp-kit";
import { useState } from "react";

export function LoginSection() {
  // 直接使用我們修復好的 Hook，確保地址跟 MintCar 一致
  const { user, login, logout, isLoading } = useUserAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (user?.address) {
      await navigator.clipboard.writeText(user.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // 2秒後恢復
    }
  };

  if (isLoading) return <div className="text-sm text-gray-400">載入中...</div>;

  // 1. zkLogin 登入狀態
  if (user?.type === "zklogin") {
    return (
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-0.5">Google zkLogin</p>
          
          {/* 🔴 點擊即可複製完整地址 */}
          <button 
            onClick={handleCopy}
            className="group flex items-center gap-2 text-sm font-bold text-gray-800 hover:text-blue-600 transition"
            title={user.address} // 滑鼠移上去顯示完整地址
          >
            <span className="font-mono">
              {/* 顯示縮略地址，保持版面整潔 */}
              {user.address.slice(0, 6)}...{user.address.slice(-4)}
            </span>
            
            {/* 複製 Icon / 成功提示 */}
            {copied ? (
                <span className="text-xs text-green-600 font-normal bg-green-100 px-1 rounded">已複製!</span>
            ) : (
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
            )}
          </button>
        </div>

        <button 
            onClick={logout} 
            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition border border-red-100"
        >
          登出
        </button>
      </div>
    );
  }

  // 2. 傳統錢包狀態 (Sui Wallet)
  if (user?.type === "wallet") {
    return <ConnectButton />;
  }

  // 3. 未登入
  return (
    <div className="flex items-center gap-3">
      <button 
        onClick={login} 
        className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition shadow-sm"
      >
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
        Google 登入
      </button>
      
      <span className="text-gray-400 text-sm">或</span>
      
      <ConnectButton connectText="連接錢包" />
    </div>
  );
}