// 1. 合約 Package ID
export const PACKAGE_ID = "0xe1f2e12b20ff04bf0874bac730ebe68370bc749702656811b7007393dbdf4322";

// 2. 模組名稱
export const MODULE_NAME = "vehicle";

// 3. Shared Objects
export const CAR_REGISTRY_ID = "0xad8ab6e1faf4d74b7e0c7163f44c175138be87337f4bb3dd685a75e7fdf2f55a";
export const AUTH_REGISTRY_ID = "0x79a99d9bcabf328fcf51b4e2ded2b618d61230c618f45a828ac8a8196a32ffac";

// 4. AdminCap (Owned Object)
export const ADMIN_CAP_ID = "0xde2280baec6a6160605ff3bb03d3200e7bcb1d6f0d71a072107de77edacbecd5";

// 5. 物件類型 (用於權限檢查 Hook)
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::AdminCap`;
export const THIRD_PARTY_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyCap`;

// 6. 事件類型 (用於製作 "合作夥伴清單" 頁面)
export const EVENT_THIRD_PARTY_GRANTED = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyGranted`;
export const EVENT_THIRD_PARTY_REVOKED = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyRevoked`;

// RPC 節點
export const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";