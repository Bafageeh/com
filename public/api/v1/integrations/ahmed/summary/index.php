<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$annualIncome = 27000.00;
$annualExpenses = 12241.15;
$annualNet = 14758.85;
$monthlyNet = 1229.90;
$monthlyPersonNet = 614.95;

echo json_encode([
    'data' => [
        'income' => [
            'com_monthly_person_net' => $monthlyPersonNet,
            'com_monthly_net' => $monthlyNet,
            'com_annual_net' => $annualNet,
            'com_hosting_annual_income' => $annualIncome,
            'com_annual_expenses' => $annualExpenses,
        ],
        'com_monthly_person_net' => $monthlyPersonNet,
        'com_monthly_net' => $monthlyNet,
        'com_annual_net' => $annualNet,
        'synced_at' => date('c'),
        'source' => 'COM_SUMMARY_SCREEN',
        'formula' => '(annual income - annual expenses) / 24',
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
