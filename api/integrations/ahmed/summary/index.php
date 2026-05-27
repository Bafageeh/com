<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$baseUrl = 'https://com.pm.sa/api';

function com_fetch_json(string $url): array
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'header' => "Accept: application/json\r\n",
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        return [];
    }

    $json = json_decode($body, true);
    if (! is_array($json)) {
        return [];
    }

    $data = $json['data'] ?? $json;
    return is_array($data) ? $data : [];
}

function com_number($value): float
{
    if ($value === null || $value === '') {
        return 0.0;
    }

    if (is_numeric($value)) {
        return (float) $value;
    }

    return (float) str_replace(',', '', (string) $value);
}

function com_pick(array $row, array $keys): float
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $row)) {
            $number = com_number($row[$key]);
            if (abs($number) > 0.0001) {
                return $number;
            }
        }
    }

    return 0.0;
}

function com_annual_expense(array $row): float
{
    $amount = com_number($row['amount_sar'] ?? 0);
    $cycle = strtolower((string) ($row['billing_cycle'] ?? 'yearly'));
    return in_array($cycle, ['monthly', 'شهري'], true) ? $amount * 12 : $amount;
}

$hostings = com_fetch_json($baseUrl . '/hostings');
$expenses = com_fetch_json($baseUrl . '/expenses');

$domainAnnual = 0.0;
$hostingAnnual = 0.0;
$manualExpensesAnnual = 0.0;

foreach ($hostings as $hosting) {
    if (! is_array($hosting)) {
        continue;
    }

    $domainAnnual += com_pick($hosting, [
        'domain_renewal_cost_sar',
        'domain_renewal_cost',
        'domain_cost_sar',
        'domain_cost',
        'renewal_cost_sar',
        'domain_renewal_price',
        'domain_price',
    ]);

    $hostingAnnual += com_pick($hosting, [
        'hosting_cost_sar',
        'hosting_cost',
        'hosting_renewal_cost_sar',
        'hosting_renewal_cost',
        'hosting_price',
        'host_cost_sar',
        'host_cost',
    ]);
}

foreach ($expenses as $expense) {
    if (! is_array($expense)) {
        continue;
    }

    $manualExpensesAnnual += com_annual_expense($expense);
}

$annualExpenses = $manualExpensesAnnual + $domainAnnual;
$annualNet = $hostingAnnual - $annualExpenses;
$monthlyNet = $annualNet / 12;
$monthlyPersonNet = $annualNet / 24;

$response = [
    'data' => [
        'income' => [
            'com_monthly_person_net' => round($monthlyPersonNet, 2),
            'com_monthly_net' => round($monthlyNet, 2),
            'com_annual_net' => round($annualNet, 2),
            'com_hosting_annual_income' => round($hostingAnnual, 2),
            'com_annual_expenses' => round($annualExpenses, 2),
            'com_domain_annual_expenses' => round($domainAnnual, 2),
            'com_manual_annual_expenses' => round($manualExpensesAnnual, 2),
        ],
        'com_monthly_person_net' => round($monthlyPersonNet, 2),
        'synced_at' => date('c'),
        'source' => 'COM',
        'formula' => '(hosting annual income - annual expenses) / 24',
    ],
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
