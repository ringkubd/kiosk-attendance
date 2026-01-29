<?php

namespace Anwar\AttendanceSync\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FaceEnrollmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => 'required|uuid',
            'embeddings_encrypted' => 'required|string',
            'enrolled_at' => 'nullable|date',
        ];
    }
}
