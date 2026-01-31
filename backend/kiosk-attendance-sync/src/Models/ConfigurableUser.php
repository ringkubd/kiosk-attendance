<?php

namespace Anwar\AttendanceSync\Models;

use Illuminate\Database\Eloquent\Model;

class ConfigurableUser extends Model
{
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $table = config('attendance-sync.user.table');
        if ($table) {
            $this->setTable($table);
        }
    }

    public function usesTimestamps()
    {
        $timestamps = config('attendance-sync.user.timestamps');
        if ($timestamps === null) {
            return parent::usesTimestamps();
        }

        return (bool) $timestamps;
    }
}
