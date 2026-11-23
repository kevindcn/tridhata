<?php

namespace App\Services;

use App\Models\Approval;
use App\Models\Location;
use App\Models\Request as ErpRequest;
use App\Models\RequestItem;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ApprovalService
{
    /**
     * Threshold for multi-step approval requiring director authorization (in IDR).
     */
    public const DEFAULT_THRESHOLD = 5000000;

    /**
     * Generate unique sequential request code (e.g. REQ-202611-0001).
     */
    public function generateRequestCode(): string
    {
        $prefix = 'REQ-' . date('Ym') . '-';
        $latest = ErpRequest::where('code', 'like', "{$prefix}%")
            ->orderBy('code', 'desc')
            ->value('code');

        $nextNumber = 1;
        if ($latest && preg_match('/^REQ-\d{6}-(\d{4})$/', $latest, $matches)) {
            $nextNumber = (int) $matches[1] + 1;
        }

        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Determine if a request requires 2-step (Director) approval.
     */
    public function requiresDirectorApproval(ErpRequest $request): bool
    {
        $threshold = config('erp.approval_threshold', self::DEFAULT_THRESHOLD);

        return (float) $request->amount > $threshold || in_array($request->type, ['RAW_MATERIAL', 'RND']);
    }

    /**
     * Validate whether a user has authority to approve a given step.
     */
    public function canApproveStep(User $user, int $step): bool
    {
        if (method_exists($user, 'hasRole')) {
            try {
                if ($user->hasRole('super_admin')) {
                    return true;
                }
            } catch (\Throwable) {
            }
        }

        if ($step === 1) {
            if (method_exists($user, 'hasRole')) {
                try {
                    if ($user->hasRole('finance') || $user->hasRole('super_admin')) {
                        return true;
                    }
                } catch (\Throwable) {
                }
            }

            try {
                if ($user->can('approve_finance')) {
                    return true;
                }
            } catch (\Throwable) {
            }

            return strtolower($user->division ?? '') === 'finance';
        }

        if ($step === 2) {
            if (method_exists($user, 'hasRole')) {
                try {
                    if ($user->hasRole('director') || $user->hasRole('super_admin')) {
                        return true;
                    }
                } catch (\Throwable) {
                }
            }

            try {
                if ($user->can('approve_director')) {
                    return true;
                }
            } catch (\Throwable) {
            }

            return in_array(strtolower($user->division ?? ''), ['director', 'direksi']);
        }

        return false;
    }

    /**
     * Check if user can view requests across all branches.
     */
    public function canViewAllBranches(User $user): bool
    {
        if (method_exists($user, 'hasRole')) {
            try {
                if ($user->hasRole('super_admin') || $user->hasRole('finance') || $user->hasRole('director')) {
                    return true;
                }
            } catch (\Throwable) {
            }
        }

        return in_array(strtolower($user->division ?? ''), ['finance', 'director', 'direksi']);
    }

    /**
     * Get accessible location IDs for a user.
     */
    public function getUserLocationIds(User $user): array
    {
        $locationIds = $user->locations()->pluck('locations.id')->all();
        if ($user->default_location_id) {
            $locationIds[] = $user->default_location_id;
        }

        return array_unique(array_filter($locationIds));
    }

    /**
     * Submit a new request with line items.
     */
    public function submitRequest(array $data, User $requester): ErpRequest
    {
        return DB::transaction(function () use ($data, $requester) {
            $code = $data['code'] ?? $this->generateRequestCode();
            $locationId = $data['location_id'] ?? $requester->default_location_id ?? $requester->locations()->first()?->id;

            $itemsData = $data['items'] ?? [];
            $calculatedAmount = 0;

            foreach ($itemsData as $item) {
                $qty = (float) ($item['qty'] ?? 1);
                $estimatedPrice = (float) ($item['estimated_price'] ?? 0);
                $totalPrice = isset($item['total_price']) ? (float) $item['total_price'] : ($qty * $estimatedPrice);
                $calculatedAmount += $totalPrice;
            }

            $amount = isset($data['amount']) ? (float) $data['amount'] : $calculatedAmount;

            $request = ErpRequest::create([
                'code' => $code,
                'requester_id' => $requester->id,
                'location_id' => $locationId,
                'type' => $data['type'] ?? 'RAW_MATERIAL',
                'title' => $data['title'] ?? 'Pengajuan',
                'amount' => $amount,
                'status' => 'PENDING',
                'current_approval_step' => 1,
                'notes' => $data['notes'] ?? null,
                'receipt_path' => $data['receipt_path'] ?? null,
            ]);

            foreach ($itemsData as $item) {
                $qty = (float) ($item['qty'] ?? 1);
                $estimatedPrice = (float) ($item['estimated_price'] ?? 0);
                $totalPrice = isset($item['total_price']) ? (float) $item['total_price'] : ($qty * $estimatedPrice);

                $request->items()->create([
                    'item_id' => $item['item_id'] ?? null,
                    'qty' => $qty,
                    'estimated_price' => $estimatedPrice,
                    'total_price' => $totalPrice,
                ]);
            }

            activity('request')
                ->performedOn($request)
                ->causedBy($requester)
                ->withProperties([
                    'code' => $request->code,
                    'type' => $request->type,
                    'amount' => $request->amount,
                    'location_id' => $request->location_id,
                ])
                ->log("Pengajuan {$request->code} berhasil dibuat");

            return $request->load(['items', 'requester', 'location']);
        });
    }

    /**
     * Process an approval or rejection decision.
     */
    public function processDecision(ErpRequest $request, User $approver, int $step, string $decision, ?string $notes = null): Approval
    {
        return DB::transaction(function () use ($request, $approver, $step, $decision, $notes) {
            $request = ErpRequest::where('id', $request->id)->lockForUpdate()->firstOrFail();

            $normalizedDecision = strtoupper($decision);
            if (! in_array($normalizedDecision, ['APPROVED', 'REJECTED'])) {
                throw new \InvalidArgumentException("Keputusan harus APPROVED atau REJECTED.");
            }

            if ($request->status !== 'PENDING') {
                throw new \InvalidArgumentException("Pengajuan sudah berstatus {$request->status} dan tidak dapat diproses.");
            }

            if ((int) $request->current_approval_step !== (int) $step) {
                throw new \InvalidArgumentException("Tahap persetujuan tidak sesuai. Tahap saat ini adalah {$request->current_approval_step}.");
            }

            if (! $this->canApproveStep($approver, $step)) {
                throw new AuthorizationException("Pengguna tidak memiliki wewenang untuk menyetujui tahap {$step}.");
            }

            if ($normalizedDecision === 'REJECTED') {
                $request->status = 'REJECTED';
                $request->decided_at = now();
                $request->save();
            } else {
                if ($step === 1 && $this->requiresDirectorApproval($request)) {
                    $request->current_approval_step = 2;
                    $request->save();
                } else {
                    $request->status = 'APPROVED';
                    $request->decided_at = now();
                    $request->save();
                }
            }

            $approval = Approval::create([
                'request_id' => $request->id,
                'approver_id' => $approver->id,
                'step' => $step,
                'decision' => $normalizedDecision,
                'notes' => $notes,
                'decided_at' => now(),
            ]);

            activity('approval')
                ->performedOn($request)
                ->causedBy($approver)
                ->withProperties([
                    'step' => $step,
                    'decision' => $normalizedDecision,
                    'notes' => $notes,
                    'request_status' => $request->status,
                ])
                ->log("Keputusan tahap {$step} untuk pengajuan {$request->code}: {$normalizedDecision}");

            return $approval;
        });
    }

    /**
     * Attach a receipt / nota file to a request.
     */
    public function attachReceipt(ErpRequest $request, UploadedFile|string $file): string
    {
        if ($file instanceof UploadedFile) {
            $path = $file->store('requests', 'public');
        } else {
            $path = $file;
        }

        $request->update([
            'receipt_path' => $path,
        ]);

        activity('request')
            ->performedOn($request)
            ->causedBy(auth()->user())
            ->withProperties(['receipt_path' => $path])
            ->log("Upload bukti transfer/nota untuk pengajuan {$request->code}");

        return $path;
    }

    /**
     * Get count of pending approvals waiting for the specified user.
     */
    public function getPendingApprovalsCount(User $user): int
    {
        $steps = [];
        if ($this->canApproveStep($user, 1)) {
            $steps[] = 1;
        }
        if ($this->canApproveStep($user, 2)) {
            $steps[] = 2;
        }

        if (empty($steps)) {
            return 0;
        }

        $query = ErpRequest::where('status', 'PENDING')->whereIn('current_approval_step', $steps);

        if (! $this->canViewAllBranches($user)) {
            $locationIds = $this->getUserLocationIds($user);
            if (empty($locationIds)) {
                return 0;
            }
            $query->whereIn('location_id', $locationIds);
        }

        return $query->count();
    }
}
