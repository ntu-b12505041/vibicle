module vehicle_contract::vehicle {
    use std::string::{Self, String};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::display;
    use sui::package;
    use sui::dynamic_object_field as dof;
    use sui::dynamic_field as df;

    // --- 錯誤碼 ---
    const E_INVALID_VIN_LENGTH: u64 = 1;
    const E_NOT_AUTHORIZED: u64 = 2;
    const E_MILEAGE_ROLLBACK: u64 = 3;
    const E_VIN_ALREADY_EXISTS: u64 = 4;
    const E_TYPE_MISMATCH: u64 = 5;
    const E_NOT_OWNER: u64 = 6;
    const E_CAP_NOT_FOUND: u64 = 7;

    // --- 機構與紀錄類型常數 ---
    const ORG_TYPE_SERVICE: u8 = 1;     
    const ORG_TYPE_INSURANCE: u8 = 2;   

    const REC_TYPE_MAINTENANCE: u8 = 1; 
    const REC_TYPE_ACCIDENT: u8 = 2;    

    // --- 核心結構 ---

    public struct VEHICLE has drop {}

    public struct AdminCap has key, store { id: UID }

    public struct ThirdPartyCap has key, store {
        id: UID,
        org_type: u8, 
        name: String,
    }

    public struct AuthRegistry has key {
        id: UID,
        permissions: Table<ID, bool>
    }

    public struct CarRegistry has key {
        id: UID,
        cars: Table<String, ID>,
        all_ids: vector<ID>
    }

    // Shared Object
    public struct CarNFT has key, store {
        id: UID,
        owner: address, 
        vin: String,
        brand: String,
        model: String,
        year: u16,
        image_url: String,
        initial_mileage: u64,
        current_mileage: u64,
        is_listed: bool,
        price: Option<u64>,
        passport: DigitalPassport,
        comment_count: u64
    }

    #[allow(lint(missing_key))]
    public struct DigitalPassport has store {
        id: UID,
        record_count: u64
    }

    // 基礎紀錄物件
    public struct Record has key, store {
        id: UID,
        record_type: u8,
        provider: String,
        description: String,
        mileage: u64,
        timestamp: u64,
        attachments: vector<String>
    }

    // 專業保養廠服務紀錄
    // 包含車載電腦操作 (On-Board) 與內部維修管理 (CRM)
    public struct WorkshopServiceRecord has key, store {
        id: UID,
        is_maintenance_reset: bool,
        dtc_codes_cleared: vector<String>,
        battery_registration: Option<String>,
        next_service_due_km: u64
    }

    // 使用 dynamic field 掛上留言
    public struct Comment has store, drop {
        sender: address,
        message: String,
        timestamp: u64
    }

    // --- 事件 ---
    public struct CarMinted has copy, drop { 
        car_id: ID,
        vin: String,
        creator: address
    }
    public struct RecordAdded has copy, drop {
        car_id: ID,
        record_type: u8,
        provider: String
    }
    public struct ThirdPartyGranted has copy, drop { 
        cap_id: ID, 
        recipient: address,
        org_type: u8, 
        name: String 
    }

    public struct ThirdPartyRevoked has copy, drop { 
        cap_id: ID 
    }

    public struct CarTransferred has copy, drop {
        car_id: ID,
        from: address,
        to: address
    }

    public struct ListingUpdated has copy, drop {
        car_id: ID,
        is_listed: bool,
        price: Option<u64>
    }

    public struct CommentPosted has copy, drop { 
        car_id: ID, 
        sender: address, 
        message: String 
    }

    // --- 初始化 ---
    fun init(otw: VEHICLE, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let publisher = package::claim(otw, ctx);

        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"link"),
            string::utf8(b"project_url"),
        ];
        let values = vector[
            string::utf8(b"{brand} {model} ({year})"),
            string::utf8(b"VIN: {vin} | Mileage: {current_mileage} km"),
            string::utf8(b"{image_url}"),
            string::utf8(b"https://sui-car-demo.vercel.app/car/{id}"),
            string::utf8(b"https://sui-car-demo.vercel.app"),
        ];
        let mut display = display::new_with_fields<CarNFT>(
            &publisher, keys, values, ctx
        );
        display::update_version(&mut display);

        transfer::share_object(AuthRegistry {
            id: object::new(ctx),
            permissions: table::new(ctx)
        });

        transfer::share_object(CarRegistry {
            id: object::new(ctx),
            cars: table::new(ctx),
            all_ids: vector::empty()
        });

        transfer::public_transfer(publisher, sender);
        transfer::public_transfer(display, sender);
        transfer::public_transfer(AdminCap { id: object::new(ctx) }, sender);
    }

    // --- 功能 ---

    public fun grant_third_party(
        _admin: &AdminCap,
        auth_registry: &mut AuthRegistry,
        org_type: u8,
        name: String,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let id = object::new(ctx);
        let cap_id = object::uid_to_inner(&id);
        let cap = ThirdPartyCap { id, org_type, name };
        table::add(&mut auth_registry.permissions, cap_id, true);
        transfer::public_transfer(cap, recipient);
        event::emit(ThirdPartyGranted { 
            cap_id, 
            recipient, 
            org_type, 
            name 
        });
    }

    public fun revoke_third_party(
        _admin: &AdminCap,
        auth_registry: &mut AuthRegistry,
        target_cap_id: ID
    ) {
        assert!(table::contains(&auth_registry.permissions, target_cap_id), E_CAP_NOT_FOUND);
        
        let status = table::borrow_mut(&mut auth_registry.permissions, target_cap_id);
        *status = false;

        event::emit(ThirdPartyRevoked { cap_id: target_cap_id });
    }

    public fun mint_car(
        car_registry: &mut CarRegistry, 
        vin: String,
        brand: String,
        model: String,
        year: u16,
        image_url: String,
        initial_mileage: u64,
        ctx: &mut TxContext
    ) {
        assert!(string::length(&vin) == 17, E_INVALID_VIN_LENGTH);
        assert!(!table::contains(&car_registry.cars, vin), E_VIN_ALREADY_EXISTS);

        let id = object::new(ctx);
        let car_id = object::uid_to_inner(&id);
        let sender = tx_context::sender(ctx);

        let passport = DigitalPassport { id: object::new(ctx), record_count: 0 };

        let car = CarNFT {
            id,
            owner: sender, 
            vin: vin, 
            brand,
            model,
            year,
            image_url,
            initial_mileage,
            current_mileage: initial_mileage,
            is_listed: false,
            price: option::none(),
            passport,
            comment_count: 0
        };

        table::add(&mut car_registry.cars, vin, car_id);
        vector::push_back(&mut car_registry.all_ids, car_id);

        event::emit(CarMinted { car_id, vin, creator: sender });
        transfer::share_object(car);
    }

    public fun transfer_car(
        car: &mut CarNFT, 
        recipient: address, 
        ctx: &TxContext
    ) {
        assert!(car.owner == tx_context::sender(ctx), E_NOT_OWNER);
        let old_owner = car.owner;
        car.owner = recipient;
        car.is_listed = false;
        car.price = option::none();
        event::emit(CarTransferred { 
            car_id: object::uid_to_inner(&car.id), 
            from: old_owner,
            to: recipient 
        });
    }

    // 切換上架狀態
    public fun update_listing(
        car: &mut CarNFT,
        is_listed: bool,
        new_price: u64,
        ctx: &TxContext
    ) {
        // 只有車主能決定是否上架
        assert!(car.owner == tx_context::sender(ctx), E_NOT_OWNER);
        
        car.is_listed = is_listed;
        
        if (is_listed) {
            car.price = option::some(new_price);
        } else {
            car.price = option::none<u64>();
        };

        event::emit(ListingUpdated {
            car_id: object::uid_to_inner(&car.id),
            is_listed,
            price: car.price
        });
    }

    // 新增紀錄
    public fun add_record(
        cap: &ThirdPartyCap,
        auth_registry: &AuthRegistry,
        car: &mut CarNFT,
        
        record_type: u8,
        description: String,
        mileage: u64,
        attachments: vector<String>,
        
        // 保養廠專用參數
        is_maintenance_reset: bool,
        dtc_codes_cleared: vector<String>,
        battery_registration: Option<String>,
        next_service_due_km: u64,

        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 檢查 1: Cap 有效性
        let cap_id = object::id(cap);
        assert!(table::contains(&auth_registry.permissions, cap_id), E_NOT_AUTHORIZED);
        let is_active = *table::borrow(&auth_registry.permissions, cap_id);
        assert!(is_active == true, E_NOT_AUTHORIZED);

        // 檢查 2: 權限細部控管
        if (record_type == REC_TYPE_ACCIDENT) {
            assert!(cap.org_type == ORG_TYPE_INSURANCE, E_TYPE_MISMATCH);
        } else if (record_type == REC_TYPE_MAINTENANCE) {
            assert!(cap.org_type == ORG_TYPE_SERVICE, E_TYPE_MISMATCH);
        };

        assert!(mileage >= car.current_mileage, E_MILEAGE_ROLLBACK);
        car.current_mileage = mileage;

        let timestamp = clock::timestamp_ms(clock);

        let mut record = Record {
            id: object::new(ctx),
            record_type,
            provider: cap.name,
            description,
            mileage,
            timestamp,
            attachments
        };

        if (record_type == REC_TYPE_MAINTENANCE) {
            let workshop_detail = WorkshopServiceRecord {
                id: object::new(ctx),
                is_maintenance_reset,
                dtc_codes_cleared,
                battery_registration,
                next_service_due_km,
            };
            dof::add(&mut record.id, string::utf8(b"workshop_detail"), workshop_detail);
        };

        let count = car.passport.record_count;
        dof::add(&mut car.passport.id, count, record);
        car.passport.record_count = car.passport.record_count + 1;

        event::emit(RecordAdded { car_id: object::id(car), record_type, provider: cap.name });
    }

    // 每台車輛的公共留言版
    public fun post_comment(
        car: &mut CarNFT,
        message: String,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);
        
        let comment = Comment {
            sender,
            message,
            timestamp
        };

        // 使用 comment_count 作為 Dynamic Field 的 Key
        df::add(&mut car.id, car.comment_count, comment);
        
        car.comment_count = car.comment_count + 1;

        event::emit(CommentPosted { 
            car_id: object::uid_to_inner(&car.id), 
            sender, 
            message 
        });
    }
}