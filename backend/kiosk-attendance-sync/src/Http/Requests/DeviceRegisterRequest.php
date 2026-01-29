<?php

namespace Anwar\AttendanceSync\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeviceRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'registration_code' => 'required|string',
            'device_info' => 'required|array',
            'device_info.model' => 'nullable|string',
            'device_info.os_version' => 'nullable|string',
            'device_info.app_version' => 'nullable|string',
        ];
    }
}
