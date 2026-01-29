<?php

namespace Anwar\AttendanceSync\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AcknowledgeLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'log_ids' => 'required|array',
            'log_ids.*' => 'required|string',
        ];
    }
}
