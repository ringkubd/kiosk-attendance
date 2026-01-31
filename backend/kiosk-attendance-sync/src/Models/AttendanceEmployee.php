<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Anwar\AttendanceSync\Models\ConfigurableUser;

class AttendanceEmployee extends Model
{
    use SoftDeletes;

    protected $table = 'attendance_employees';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'business_id',
        'branch_id',
        'department_id',
        'employee_code',
        'face_enrolled',
        'face_embeddings_encrypted',
        'status',
        'sync_status',
        'last_synced_at',
    ];

    protected $casts = [
        'face_enrolled' => 'boolean',
        'last_synced_at' => 'datetime',
    ];

    public function user()
    {
        $foreignKey = config('attendance-sync.user.foreign_key', 'user_id');
        $ownerKey = config('attendance-sync.user.owner_key', 'id');

        $userModel = config('attendance-sync.user.model') ?: config('auth.providers.users.model');
        if ($userModel) {
            return $this->belongsTo($userModel, $foreignKey, $ownerKey);
        }

        if (config('attendance-sync.user.table')) {
            return $this->belongsTo(ConfigurableUser::class, $foreignKey, $ownerKey);
        }

        return null;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        if (config('attendance-sync.employee.relations')) {
            $relations = explode(',', config('attendance-sync.employee.relations'));
            static::addGlobalScope('with_relations', function ($builder) use ($relations) {
                $builder->with($relations);
            });
        }
    }
}
