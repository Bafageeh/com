<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function com_json(string $url): array
{
    $body = @file_get_contents($url);
    $json = json_decode($body ?: '', true);
    if (! is_array($json)) return [];
    $data = $json['data'] ?? $json;
    return is_array($data) ? $data : [];
}

function com_num($value): float
{
    if ($value === null || $value === '') return 0.0;
    return (float) str_replace(',', '', (string) $value);
}

function com_pick(array $row, array $keys): float
{
    foreach ($keys as $key) {
        if (isset($row[$key]) && com_num($row[$key]) != 0.0) return com_num($row[$key]);
    }
    return 0.0;
}

function com_expense(array $row): float
{
    $amount = com_num($row['amount_sar'] ?? 0);
    $cycle = strtolower((string) ($row['billing_cycle'] ?? 'yearly'));
    return in_array($cycle, ['monthly', 'شهري'], true) ? $amount * 12 : $amount;
}

$hostings = com_json('https://com.pm.sa/api/hostings');
$expenses = com_json('https://com.pm.sa/api/expenses');

$domainAnnual = 0.0;
$hostingAnnual = 0.0;
$manualAnnual = 0.0;

foreach ($hostings as $row) {
    if (! is_array($row)) continue;
    $domainAnnual += com_pick($row, ['domain_renewal_cost_sar','domain_renewal_cost','domain_cost_sar','domain_cost','renewal_cost_sar','domain_renewal_price','domain_price']);
    $hostingAnnual += com_pick($row, ['hosting_cost_sar','hosting_cost','hosting_renewal_cost_sar','hosting_renewal_cost','hosting_price','host_cost_sar','host_cost']);
}

foreach ($expenses as $row) {
    if (is_array($row)) $manualAnnual += com_expense($row);
}

$annualExpenses = $manualAnnual + $domainAnnual;
$annualNet = $hostingAnnual - $annualExpenses;
$monthlyPersonNet = round($annualNet / 24, 2);

$response = [
    'data' => [
        'income' => [
            'com_monthly_person_net' => $monthlyPersonNet,
            'com_annual_net' => round($annualNet, 2),
            'com_hosting_annual_income' => round($hostingAnnual, 2),
            'com_annual_expenses' => round($annualExpenses, 2),
        ],
        'com_monthly_person_net' => $monthlyPersonNet,
        'synced_at' => date('c'),
        'source' => 'COM',
    ],
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
