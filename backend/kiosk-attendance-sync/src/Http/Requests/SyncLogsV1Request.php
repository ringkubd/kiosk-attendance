<?php

namespace Anwar\AttendanceSync\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncLogsV1Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'device_id' => 'required|uuid',
            'branch_id' => 'required|integer',
            'logs' => 'required|array',
            'logs.*.id' => 'required|string',
            'logs.*.employee_id' => 'required|uuid',
            'logs.*.type' => 'required|in:IN,OUT,BREAK_START,BREAK_END',
            'logs.*.check_time' => 'required|date',
            'logs.*.confidence_score' => 'nullable|numeric',
            'logs.*.location_lat' => 'nullable|numeric',
            'logs.*.location_lng' => 'nullable|numeric',
            'logs.*.photo_proof_path' => 'nullable|string',
            'logs.*.notes' => 'nullable|string',
        ];
    }
}
