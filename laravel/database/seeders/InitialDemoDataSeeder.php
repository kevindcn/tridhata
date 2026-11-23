<?php

namespace Database\Seeders;

use App\Models\Bom;
use App\Models\BomItem;
use App\Models\Item;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductionTeam;
use App\Models\StockLevel;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class InitialDemoDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Locations (Bogor & Nganjuk)
        $bogor = Location::firstOrCreate(
            ['code' => 'BOGOR'],
            [
                'name' => 'Cabang Bogor (Pusat & Pabrik)',
                'address' => 'Jl. Raya Dramaga No. 12, Bogor, Jawa Barat',
            ]
        );

        $nganjuk = Location::firstOrCreate(
            ['code' => 'NGANJUK'],
            [
                'name' => 'Cabang Nganjuk (Gudang & Distribusi)',
                'address' => 'Jl. Gatot Subroto No. 45, Nganjuk, Jawa Timur',
            ]
        );

        // 2. Pre-provisioned Users with Spatie Roles
        $usersData = [
            [
                'name' => 'Administrator Utama',
                'email' => 'admin@tridhata.com',
                'role' => 'super_admin',
                'division' => 'Direksi',
                'locations' => [$bogor->id, $nganjuk->id],
                'default_location' => $bogor->id,
            ],
            [
                'name' => 'Siti Keuangan',
                'email' => 'finance@tridhata.com',
                'role' => 'finance',
                'division' => 'Keuangan & Akuntansi',
                'locations' => [$bogor->id, $nganjuk->id],
                'default_location' => $bogor->id,
            ],
            [
                'name' => 'Budi Gudang Bogor',
                'email' => 'gudang.bgr@tridhata.com',
                'role' => 'staff_gudang',
                'division' => 'Gudang & Logistik',
                'locations' => [$bogor->id],
                'default_location' => $bogor->id,
            ],
            [
                'name' => 'Agus Gudang Nganjuk',
                'email' => 'gudang.ngj@tridhata.com',
                'role' => 'staff_gudang',
                'division' => 'Gudang & Logistik',
                'locations' => [$nganjuk->id],
                'default_location' => $nganjuk->id,
            ],
            [
                'name' => 'Hendra Supervisor Produksi',
                'email' => 'produksi@tridhata.com',
                'role' => 'staff_produksi',
                'division' => 'Produksi & PPIC',
                'locations' => [$bogor->id],
                'default_location' => $bogor->id,
            ],
            [
                'name' => 'Rina Agronomist & Field Sales',
                'email' => 'sales@tridhata.com',
                'role' => 'field_sales',
                'division' => 'Pemasaran & Agronomi',
                'locations' => [$bogor->id, $nganjuk->id],
                'default_location' => $bogor->id,
            ],
        ];

        foreach ($usersData as $data) {
            $user = User::updateOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make('password123'),
                    'division' => $data['division'],
                    'default_location_id' => $data['default_location'],
                    'active' => true,
                ]
            );

            $user->syncRoles([$data['role']]);
            $user->locations()->sync($data['locations']);
        }

        // 3. Master Data: Items (Bahan Baku & Kemasan)
        $itemsData = [
            ['sku' => 'RAW-NPK-01', 'name' => 'Pupuk NPK 16-16-16', 'category' => 'Bahan Kimia / Pupuk', 'unit' => 'kg', 'min_stock' => 100],
            ['sku' => 'RAW-UREA-01', 'name' => 'Urea Prill Non-Subsidi', 'category' => 'Bahan Kimia / Pupuk', 'unit' => 'kg', 'min_stock' => 50],
            ['sku' => 'RAW-POLY-20', 'name' => 'Polybag Hitam 20x20', 'category' => 'Kemasan', 'unit' => 'pcs', 'min_stock' => 500],
            ['sku' => 'RAW-BOTOL-1L', 'name' => 'Botol Agro HDPE 1 Liter', 'category' => 'Kemasan', 'unit' => 'pcs', 'min_stock' => 200],
            ['sku' => 'RAW-TUTUP-1L', 'name' => 'Tutup Segel Botol 1 Liter', 'category' => 'Kemasan', 'unit' => 'pcs', 'min_stock' => 200],
            ['sku' => 'RAW-BIO-INOK', 'name' => 'Isolat Mikroba Hayati Tridhata', 'category' => 'Bahan Baku RnD', 'unit' => 'liter', 'min_stock' => 20],
        ];

        $items = [];
        foreach ($itemsData as $data) {
            $items[$data['sku']] = Item::updateOrCreate(
                ['sku' => $data['sku']],
                array_merge($data, ['safety_stock' => (int) ($data['min_stock'] * 1.5), 'is_raw_material' => true, 'is_active' => true])
            );
        }

        // 4. Master Data: Products (Produk Jadi)
        $productsData = [
            ['sku' => 'PROD-POC-1L', 'name' => 'Pupuk Organik Cair Tridhata 1L', 'unit' => 'botol', 'selling_price' => 45000, 'cogs_price' => 28000, 'min_stock' => 50],
            ['sku' => 'PROD-HAYATI-500ML', 'name' => 'Bio-Pestisida Hayati Tridhata 500ml', 'unit' => 'botol', 'selling_price' => 65000, 'cogs_price' => 38000, 'min_stock' => 30],
            ['sku' => 'PROD-GRANUL-25KG', 'name' => 'Pupuk Hayati Granul 25kg', 'unit' => 'sak', 'selling_price' => 175000, 'cogs_price' => 120000, 'min_stock' => 20],
        ];

        $products = [];
        foreach ($productsData as $data) {
            $products[$data['sku']] = Product::updateOrCreate(
                ['sku' => $data['sku']],
                array_merge($data, ['is_active' => true])
            );
        }

        // 5. Master Data: Vendors
        $vendorsData = [
            ['code' => 'VND-001', 'name' => 'PT Pupuk Indonesia Agro', 'contact_person' => 'Budi Santoso', 'phone' => '021-5551234', 'email' => 'sales@pupukindonesia.com', 'address' => 'Jakarta Barat', 'payment_terms' => 'TOP 30 Hari'],
            ['code' => 'VND-002', 'name' => 'CV Agro Kemasan Prima', 'contact_person' => 'Dewi Lestari', 'phone' => '0251-888999', 'email' => 'order@agrokemasan.id', 'address' => 'Bogor Selatan', 'payment_terms' => 'Cash On Delivery'],
        ];

        foreach ($vendorsData as $data) {
            Vendor::updateOrCreate(['code' => $data['code']], $data);
        }

        // 6. Production Team & BOM Recipe
        $team = ProductionTeam::firstOrCreate(
            ['name' => 'Tim Produksi Cair A', 'location_id' => $bogor->id],
            [
                'leader_name' => 'Hendra Supardi',
                'member_count' => 6,
                'daily_capacity' => 500,
            ]
        );

        $bom = Bom::updateOrCreate(
            ['code' => 'BOM-POC-1L'],
            [
                'product_id' => $products['PROD-POC-1L']->id,
                'name' => 'Resep Standar POC 1 Liter (Batch 100 Botol)',
                'batch_size' => 100,
                'yield_unit' => 'botol',
                'is_active' => true,
            ]
        );

        BomItem::updateOrCreate(['bom_id' => $bom->id, 'item_id' => $items['RAW-NPK-01']->id], ['quantity' => 20, 'unit' => 'kg']);
        BomItem::updateOrCreate(['bom_id' => $bom->id, 'item_id' => $items['RAW-UREA-01']->id], ['quantity' => 10, 'unit' => 'kg']);
        BomItem::updateOrCreate(['bom_id' => $bom->id, 'item_id' => $items['RAW-BOTOL-1L']->id], ['quantity' => 100, 'unit' => 'pcs']);
        BomItem::updateOrCreate(['bom_id' => $bom->id, 'item_id' => $items['RAW-TUTUP-1L']->id], ['quantity' => 100, 'unit' => 'pcs']);

        // 7. Initial Stock Levels
        // Bogor Warehouse Stocks
        StockLevel::updateOrCreate(['location_id' => $bogor->id, 'item_id' => $items['RAW-NPK-01']->id], ['qty' => 500, 'min_stock' => 100, 'safety_stock' => 150]);
        StockLevel::updateOrCreate(['location_id' => $bogor->id, 'item_id' => $items['RAW-UREA-01']->id], ['qty' => 300, 'min_stock' => 50, 'safety_stock' => 75]);
        StockLevel::updateOrCreate(['location_id' => $bogor->id, 'item_id' => $items['RAW-BOTOL-1L']->id], ['qty' => 1000, 'min_stock' => 200, 'safety_stock' => 300]);
        StockLevel::updateOrCreate(['location_id' => $bogor->id, 'item_id' => $items['RAW-TUTUP-1L']->id], ['qty' => 1000, 'min_stock' => 200, 'safety_stock' => 300]);
        StockLevel::updateOrCreate(['location_id' => $bogor->id, 'product_id' => $products['PROD-POC-1L']->id], ['qty' => 150, 'min_stock' => 50, 'safety_stock' => 75]);

        // Nganjuk Warehouse Stocks
        StockLevel::updateOrCreate(['location_id' => $nganjuk->id, 'product_id' => $products['PROD-POC-1L']->id], ['qty' => 60, 'min_stock' => 30, 'safety_stock' => 45]);
        StockLevel::updateOrCreate(['location_id' => $nganjuk->id, 'product_id' => $products['PROD-HAYATI-500ML']->id], ['qty' => 40, 'min_stock' => 20, 'safety_stock' => 30]);
    }
}

