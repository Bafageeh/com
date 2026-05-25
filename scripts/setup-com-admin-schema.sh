#!/usr/bin/env bash
set -uo pipefail
PROJECT_PATH="${COM_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/com}"
API_DIR="$PROJECT_PATH/com-api"
APP_USER="${COM_APP_USER:-pmsa}"
PHP_BIN="$(command -v php || echo /usr/bin/php)"

log(){ printf '\n[COM schema] %s\n' "$1"; }

if [ ! -d "$API_DIR" ]; then
  echo "API directory not found: $API_DIR"
  exit 0
fi

cd "$API_DIR" || exit 0
mkdir -p database/migrations routes app/Http/Controllers/Api

log "Writing migration"
cat > database/migrations/2026_05_25_010000_create_com_admin_tables.php <<'PHP'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('hetzner_costs')) {
            Schema::create('hetzner_costs', function (Blueprint $table) {
                $table->id();
                $table->date('cost_date');
                $table->decimal('cost_eur', 12, 2)->default(0);
                $table->decimal('cost_sar', 12, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('cpanel_server_costs')) {
            Schema::create('cpanel_server_costs', function (Blueprint $table) {
                $table->id();
                $table->date('cost_date');
                $table->decimal('cost_usd', 12, 2)->default(0);
                $table->decimal('cost_sar', 12, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('expenses')) {
            Schema::create('expenses', function (Blueprint $table) {
                $table->id();
                $table->date('expense_date');
                $table->string('expense_type');
                $table->decimal('amount_sar', 12, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('hostings')) {
            Schema::create('hostings', function (Blueprint $table) {
                $table->id();
                $table->string('company_name');
                $table->string('domain')->unique();
                $table->unsignedInteger('current_space_mb')->default(0);
                $table->unsignedInteger('allowed_space_mb')->default(0);
                $table->decimal('domain_renewal_cost_sar', 12, 2)->default(0);
                $table->decimal('hosting_cost_sar', 12, 2)->default(0);
                $table->date('record_date')->nullable();
                $table->decimal('tax_sar', 12, 2)->default(0);
                $table->date('hosting_renewal_date')->nullable();
                $table->date('domain_renewal_date')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hostings');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('cpanel_server_costs');
        Schema::dropIfExists('hetzner_costs');
    }
};
PHP

log "Writing simple API controller"
cat > app/Http/Controllers/Api/ComAdminController.php <<'PHP'
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ComAdminController extends Controller
{
    private array $map = [
        'hetzner-costs' => 'hetzner_costs',
        'cpanel-server-costs' => 'cpanel_server_costs',
        'expenses' => 'expenses',
        'hostings' => 'hostings',
    ];

    public function dashboard()
    {
        return response()->json([
            'ok' => true,
            'totals' => [
                'hetzner_sar' => (float) DB::table('hetzner_costs')->sum('cost_sar'),
                'cpanel_sar' => (float) DB::table('cpanel_server_costs')->sum('cost_sar'),
                'expenses_sar' => (float) DB::table('expenses')->sum('amount_sar'),
                'hosting_sar' => (float) DB::table('hostings')->sum('hosting_cost_sar'),
                'domains_sar' => (float) DB::table('hostings')->sum('domain_renewal_cost_sar'),
                'tax_sar' => (float) DB::table('hostings')->sum('tax_sar'),
                'hostings_count' => (int) DB::table('hostings')->count(),
            ],
        ]);
    }

    public function index(string $resource)
    {
        $table = $this->table($resource);
        return response()->json(['data' => DB::table($table)->orderByDesc('id')->get()]);
    }

    public function show(string $resource, int $id)
    {
        $row = DB::table($this->table($resource))->find($id);
        abort_if(!$row, 404, 'Record not found');
        return response()->json(['data' => $row]);
    }

    public function store(Request $request, string $resource)
    {
        $data = $this->validateData($request, $resource);
        $id = DB::table($this->table($resource))->insertGetId(array_merge($data, ['created_at' => now(), 'updated_at' => now()]));
        return response()->json(['data' => DB::table($this->table($resource))->find($id)], 201);
    }

    public function update(Request $request, string $resource, int $id)
    {
        $table = $this->table($resource);
        abort_if(!DB::table($table)->where('id', $id)->exists(), 404, 'Record not found');
        $data = $this->validateData($request, $resource);
        DB::table($table)->where('id', $id)->update(array_merge($data, ['updated_at' => now()]));
        return response()->json(['data' => DB::table($table)->find($id)]);
    }

    public function destroy(string $resource, int $id)
    {
        $table = $this->table($resource);
        abort_if(!DB::table($table)->where('id', $id)->exists(), 404, 'Record not found');
        DB::table($table)->where('id', $id)->delete();
        return response()->json(['deleted' => true]);
    }

    private function table(string $resource): string
    {
        abort_unless(isset($this->map[$resource]), 404, 'Unknown resource');
        return $this->map[$resource];
    }

    private function validateData(Request $request, string $resource): array
    {
        $rules = match ($resource) {
            'hetzner-costs' => ['cost_date' => 'required|date', 'cost_eur' => 'required|numeric|min:0', 'cost_sar' => 'required|numeric|min:0', 'notes' => 'nullable|string'],
            'cpanel-server-costs' => ['cost_date' => 'required|date', 'cost_usd' => 'required|numeric|min:0', 'cost_sar' => 'required|numeric|min:0', 'notes' => 'nullable|string'],
            'expenses' => ['expense_date' => 'required|date', 'expense_type' => 'required|string|max:255', 'amount_sar' => 'required|numeric|min:0', 'notes' => 'nullable|string'],
            'hostings' => ['company_name' => 'required|string|max:255', 'domain' => 'required|string|max:255', 'current_space_mb' => 'nullable|integer|min:0', 'allowed_space_mb' => 'nullable|integer|min:0', 'domain_renewal_cost_sar' => 'nullable|numeric|min:0', 'hosting_cost_sar' => 'nullable|numeric|min:0', 'record_date' => 'nullable|date', 'tax_sar' => 'nullable|numeric|min:0', 'hosting_renewal_date' => 'nullable|date', 'domain_renewal_date' => 'nullable|date', 'notes' => 'nullable|string'],
            default => [],
        };
        return Validator::make($request->all(), $rules)->validate();
    }
}
PHP

log "Writing routes"
cat > routes/api.php <<'PHP'
<?php

use App\Http\Controllers\Api\ComAdminController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['ok' => true, 'app' => 'COM API', 'version' => 'v1']));
Route::get('/dashboard', [ComAdminController::class, 'dashboard']);
Route::get('/{resource}', [ComAdminController::class, 'index']);
Route::post('/{resource}', [ComAdminController::class, 'store']);
Route::get('/{resource}/{id}', [ComAdminController::class, 'show']);
Route::put('/{resource}/{id}', [ComAdminController::class, 'update']);
Route::delete('/{resource}/{id}', [ComAdminController::class, 'destroy']);
PHP

log "Ensuring bootstrap/app.php loads API routes"
if [ -f bootstrap/app.php ]; then
  cp bootstrap/app.php bootstrap/app.php.bak.$(date +%Y%m%d%H%M%S) || true
  cat > bootstrap/app.php <<'PHP'
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
PHP
fi

log "Running migrate"
"$PHP_BIN" artisan optimize:clear || true
"$PHP_BIN" artisan config:clear || true
"$PHP_BIN" artisan route:clear || true
"$PHP_BIN" artisan migrate --force || true
"$PHP_BIN" artisan route:list | grep -E 'health|dashboard|hostings|expenses|hetzner|cpanel' || true

chown -R "$APP_USER:$APP_USER" "$API_DIR" || true
log "Done"
exit 0
