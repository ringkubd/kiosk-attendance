<?php

namespace Kiosk\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $table = 'employees';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'org_id',
        'branch_id',
        'code',
        'name',
        'status',
        'embedding_avg',
        'embeddings_json',
        'profile_image_path',
        'updated_at',
        'sync_state',
    ];

    protected $casts = [
        'updated_at' => 'datetime',
    ];
}
