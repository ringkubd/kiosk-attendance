<?php

namespace Kiosk\AttendanceSync\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'org_id' => 'required|uuid',
            'branch_id' => 'required|uuid',
            'device_id' => 'required|uuid',
            'logs' => 'required|array',
            'logs.*.id' => 'required|string',
            'logs.*.employee_id' => 'required|uuid',
            'logs.*.type' => 'required|in:IN,OUT,BREAK_START,BREAK_END',
            'logs.*.ts_local' => 'required|integer',
            'logs.*.confidence' => 'required|numeric',
        ];
    }
}
