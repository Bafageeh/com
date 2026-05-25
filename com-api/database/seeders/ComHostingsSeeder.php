<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ComHostingsSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('hostings')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE hostings MODIFY current_space_mb DECIMAL(12,2) NOT NULL DEFAULT 0');
            DB::statement('ALTER TABLE hostings MODIFY allowed_space_mb VARCHAR(50) NULL');
        }

        $rows = [
            ['company_name' => 'asaheeb.com.sa', 'domain' => 'asaheeb.com.sa', 'current_space_mb' => 444600.00, 'allowed_space_mb' => 'مفتوحة', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 4000.00, 'tax_sar' => 600.00, 'domain_renewal_date' => '2026-12-30', 'hosting_renewal_date' => '2025-11-01'],
            ['company_name' => 'firstmohra.com.sa', 'domain' => 'firstmohra.com.sa', 'current_space_mb' => 1549.54, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 1100.00, 'tax_sar' => 165.00, 'domain_renewal_date' => '2026-09-22', 'hosting_renewal_date' => '2025-09-01'],
            ['company_name' => 'newerasteel.com', 'domain' => 'newerasteel.com', 'current_space_mb' => 150835.71, 'allowed_space_mb' => 'مفتوحة', 'domain_renewal_cost_sar' => 0.00, 'hosting_cost_sar' => 4750.00, 'tax_sar' => 712.50, 'domain_renewal_date' => null, 'hosting_renewal_date' => '2026-02-09'],
            ['company_name' => 'alghareef.com', 'domain' => 'alghareef.com', 'current_space_mb' => 41219.31, 'allowed_space_mb' => 'مفتوحة', 'domain_renewal_cost_sar' => 32.57, 'hosting_cost_sar' => 4000.00, 'tax_sar' => 600.00, 'domain_renewal_date' => '2026-02-15', 'hosting_renewal_date' => '2025-09-01'],
            ['company_name' => 'atlantic-ul.com', 'domain' => 'atlantic-ul.com', 'current_space_mb' => 112634.32, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 33.88, 'hosting_cost_sar' => 1500.00, 'tax_sar' => 225.00, 'domain_renewal_date' => '2026-04-02', 'hosting_renewal_date' => '2025-02-15'],
            ['company_name' => 'iconexpo.sa', 'domain' => 'iconexpo.sa', 'current_space_mb' => 6008.00, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 1500.00, 'tax_sar' => 225.00, 'domain_renewal_date' => '2026-05-28', 'hosting_renewal_date' => '2025-05-15'],
            ['company_name' => 'getsa.net', 'domain' => 'getsa.net', 'current_space_mb' => 13509.90, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 1600.00, 'tax_sar' => 240.00, 'domain_renewal_date' => '2026-12-11', 'hosting_renewal_date' => '2025-08-01'],
            ['company_name' => 'almuttasil.sa', 'domain' => 'almuttasil.sa', 'current_space_mb' => 9984.72, 'allowed_space_mb' => '50', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 2500.00, 'tax_sar' => 375.00, 'domain_renewal_date' => '2026-12-30', 'hosting_renewal_date' => '2025-02-15'],
            ['company_name' => 'mobilines.net', 'domain' => 'mobilines.net', 'current_space_mb' => 366.61, 'allowed_space_mb' => '1', 'domain_renewal_cost_sar' => 0.00, 'hosting_cost_sar' => 500.00, 'tax_sar' => 75.00, 'domain_renewal_date' => '2031-01-16', 'hosting_renewal_date' => null],
            ['company_name' => 'mobilines.sa', 'domain' => 'mobilines.sa', 'current_space_mb' => 0.00, 'allowed_space_mb' => '0', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 0.00, 'tax_sar' => 0.00, 'domain_renewal_date' => null, 'hosting_renewal_date' => null],
            ['company_name' => 'ideas-more.com.sa', 'domain' => 'ideas-more.com.sa', 'current_space_mb' => 5356.18, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 300.00, 'tax_sar' => 45.00, 'domain_renewal_date' => '2026-12-30', 'hosting_renewal_date' => '2025-01-01'],
            ['company_name' => 'eitezaz.com.sa', 'domain' => 'eitezaz.com.sa', 'current_space_mb' => 5356.18, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 300.00, 'tax_sar' => 45.00, 'domain_renewal_date' => '2026-08-22', 'hosting_renewal_date' => '2025-07-01'],
            ['company_name' => 'استضافة افكار واعتزاز', 'domain' => 'استضافة افكار واعتزاز', 'current_space_mb' => 0.00, 'allowed_space_mb' => null, 'domain_renewal_cost_sar' => 0.00, 'hosting_cost_sar' => 500.00, 'tax_sar' => 75.00, 'domain_renewal_date' => '2026-08-22', 'hosting_renewal_date' => '2025-01-01'],
            ['company_name' => 'ze.sa', 'domain' => 'ze.sa', 'current_space_mb' => 5130.63, 'allowed_space_mb' => '10', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 1250.00, 'tax_sar' => 187.50, 'domain_renewal_date' => '2027-02-01', 'hosting_renewal_date' => '2026-02-01'],
            ['company_name' => 'icfe.sa', 'domain' => 'icfe.sa', 'current_space_mb' => 4041.11, 'allowed_space_mb' => '50', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 1500.00, 'tax_sar' => 225.00, 'domain_renewal_date' => '2026-05-28', 'hosting_renewal_date' => '2025-09-15'],
            ['company_name' => 'soqooraltanmiyah.sa', 'domain' => 'soqooraltanmiyah.sa', 'current_space_mb' => 3339.89, 'allowed_space_mb' => '5', 'domain_renewal_cost_sar' => 99.00, 'hosting_cost_sar' => 750.00, 'tax_sar' => 112.50, 'domain_renewal_date' => '2026-08-28', 'hosting_renewal_date' => '2025-08-01'],
            ['company_name' => 'ycc-logistics.com', 'domain' => 'ycc-logistics.com', 'current_space_mb' => 1093.14, 'allowed_space_mb' => '5', 'domain_renewal_cost_sar' => 32.57, 'hosting_cost_sar' => 650.00, 'tax_sar' => 97.50, 'domain_renewal_date' => '2026-11-19', 'hosting_renewal_date' => '2025-02-15'],
            ['company_name' => 'ycc-sa.com', 'domain' => 'ycc-sa.com', 'current_space_mb' => 0.00, 'allowed_space_mb' => null, 'domain_renewal_cost_sar' => 32.57, 'hosting_cost_sar' => 300.00, 'tax_sar' => 45.00, 'domain_renewal_date' => '2026-05-28', 'hosting_renewal_date' => '2025-10-01'],
        ];

        foreach ($rows as $row) {
            DB::table('hostings')->updateOrInsert(
                ['domain' => $row['domain']],
                array_merge($row, [
                    'record_date' => now()->toDateString(),
                    'notes' => 'تم الإدخال من جدول تكاليف السيرفرات - تبويب الاستضافة',
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }
    }
}
