<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleAndPermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Define baseline permissions by module
        $permissions = [
            // Master Data
            'view_master',
            'manage_master',

            // Inventory & Warehouse
            'view_inventory',
            'manage_inventory',
            'approve_requests',

            // Production
            'view_production',
            'manage_production',

            // Sales & Delivery
            'view_sales',
            'manage_sales',
            'view_deliveries',
            'manage_deliveries',

            // Field & Agronomy
            'view_attendance',
            'create_attendance',
            'view_agronomy',
            'manage_agronomy',

            // Stock Opname
            'view_stock_opname',
            'manage_stock_opname',

            // Finance
            'view_finance',
            'manage_finance',
            'approve_finance',

            // Administration & Users
            'view_users',
            'manage_users',
            'view_audit_logs',
        ];

        foreach ($permissions as $permissionName) {
            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'web']);
        }

        // 2. Define roles and assign baseline permissions
        $roleDefinitions = [
            'super_admin' => $permissions, // all permissions

            'admin_bogor' => [
                'view_master', 'manage_master',
                'view_inventory', 'manage_inventory', 'approve_requests',
                'view_production', 'manage_production',
                'view_sales', 'manage_sales', 'view_deliveries', 'manage_deliveries',
                'view_attendance', 'create_attendance',
                'view_stock_opname', 'manage_stock_opname',
                'view_finance',
                'view_users',
            ],

            'admin_nganjuk' => [
                'view_master', 'manage_master',
                'view_inventory', 'manage_inventory', 'approve_requests',
                'view_production', 'manage_production',
                'view_sales', 'manage_sales', 'view_deliveries', 'manage_deliveries',
                'view_attendance', 'create_attendance',
                'view_stock_opname', 'manage_stock_opname',
                'view_finance',
                'view_users',
            ],

            'finance' => [
                'view_master',
                'view_inventory', 'approve_requests',
                'view_sales', 'manage_sales',
                'view_finance', 'manage_finance', 'approve_finance',
                'view_audit_logs',
            ],

            'staff_gudang' => [
                'view_master',
                'view_inventory', 'manage_inventory',
                'view_stock_opname', 'manage_stock_opname',
                'view_deliveries',
            ],

            'staff_produksi' => [
                'view_master',
                'view_inventory',
                'view_production', 'manage_production',
            ],

            'field_sales' => [
                'view_master',
                'view_sales', 'manage_sales',
                'view_attendance', 'create_attendance',
            ],

            'agronomist' => [
                'view_master',
                'view_attendance', 'create_attendance',
                'view_agronomy', 'manage_agronomy',
            ],
        ];

        foreach ($roleDefinitions as $roleName => $rolePermissions) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($rolePermissions);
        }
    }
}
