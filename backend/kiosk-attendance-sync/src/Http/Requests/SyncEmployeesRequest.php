<?php

namespace Anwar\AttendanceSync\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncEmployeesRequest extends FormRequest
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
            'employees' => 'required|array',
            'employees.*.id' => 'required|uuid',
            'employees.*.code' => 'nullable|string',
            'employees.*.name' => 'required|string',
            'employees.*.status' => 'required|in:active,inactive',
            'employees.*.embedding_avg' => 'nullable|string',
            'employees.*.profile_image' => 'nullable|string',
        ];
    }
}
