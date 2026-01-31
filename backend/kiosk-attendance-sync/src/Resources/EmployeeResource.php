<?php
namespace Anwar\AttendanceSync\Resources;

use Illuminate\Http\Resources\Json\JsonResource;


class EmployeeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->user?->first_name . ' ' . $this->user?->last_name,
            'email' => $this->user?->email,
            'phone_number' => $this->user?->phone_number,
            'user_id' => $this->user_id,
            'business_id' => $this->business_id,
            'employee_code' => $this->employee_code,
            'face_embeddings_encrypted' => $this->face_embeddings_encrypted,
            'branch_id' => $this->branch_id,
            'face_enrolled' => $this->face_enrolled,
            'sync_status' => $this->sync_status,
            'last_synced_at' => $this->last_synced_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            // Add other necessary fields here
        ];
    }
}