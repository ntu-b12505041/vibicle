"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import { useUserAuth } from "../hooks/useUserAuth"; // 🔴 引入我們寫的 Hook

export function NavBar() {
  // 🔴 從 Hook 取得 login 方法 (這個方法才會正確儲存 zk_login_pending)
  const { user, login, logout } = useUserAuth();

  return (
    <nav className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🚗</span>
        <h1 className="text-xl font-bold text-gray-800">Sui Used Car Market</h1>
      </div>

      <div>
        {user?.type === "zklogin" ? (
          <div className="flex items-center gap-4">
            <div className="text-right">
                <span className="block text-xs text-gray-500">Google zkLogin</span>
                <span className="block text-sm font-bold text-green-600">
                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                </span>
            </div>
            <button onClick={logout} className="text-sm text-red-500 hover:underline">登出</button>
          </div>
        ) : user?.type === "wallet" ? (
          <ConnectButton />
        ) : (
          <div className="flex gap-2">
            {/* 🔴 這裡點擊時，會執行 useUserAuth 裡的 login，產生並儲存鑰匙 */}
            <button 
                onClick={login} 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
                {/* Google Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#ffffff"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff"/>
                </svg>
                Google 登入
            </button>
            <ConnectButton connectText="錢包登入" />
          </div>
        )}
      </div>
    </nav>
  );
}