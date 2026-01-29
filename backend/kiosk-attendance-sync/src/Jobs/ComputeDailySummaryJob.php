<?php

namespace Anwar\AttendanceSync\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class ComputeDailySummaryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private string $orgId;
    private string $branchId;
    private string $employeeId;
    private int $timestamp;

    public function __construct(string $orgId, string $branchId, string $employeeId, int $timestamp)
    {
        $this->orgId = $orgId;
        $this->branchId = $branchId;
        $this->employeeId = $employeeId;
        $this->timestamp = $timestamp;
    }

    public function handle(): void
    {
        $date = date('Y-m-d', (int) ($this->timestamp / 1000));

        $logs = DB::table('attendance_logs')
            ->where('org_id', $this->orgId)
            ->where('branch_id', $this->branchId)
            ->where('employee_id', $this->employeeId)
            ->whereBetween('ts_local', [
                strtotime($date . ' 00:00:00') * 1000,
                strtotime($date . ' 23:59:59') * 1000,
            ])
            ->orderBy('ts_local')
            ->get();

        if ($logs->isEmpty()) {
            return;
        }

        $firstIn = $logs->where('type', 'IN')->min('ts_local');
        $lastOut = $logs->where('type', 'OUT')->max('ts_local');

        $workMin = 0;
        if ($firstIn && $lastOut && $lastOut > $firstIn) {
            $workMin = (int) floor(($lastOut - $firstIn) / 60000);
        }

        DB::table('daily_summaries')->updateOrInsert(
            [
                'org_id' => $this->orgId,
                'branch_id' => $this->branchId,
                'employee_id' => $this->employeeId,
                'date' => $date,
            ],
            [
                'first_in_ts' => $firstIn,
                'last_out_ts' => $lastOut,
                'work_min' => $workMin,
                'late_min' => 0,
                'early_min' => 0,
                'ot_min' => 0,
                'status' => $firstIn ? 'PRESENT' : 'ABSENT',
                'updated_at' => now(),
            ]
        );
    }
}
