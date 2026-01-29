<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attendance_employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('business_id')->constrained('businesses');
            $table->foreignId('branch_id')->constrained('branches');
            $table->foreignId('department_id')->nullable()->constrained('departments');
            $table->string('employee_code')->nullable()->unique();
            $table->boolean('face_enrolled')->default(false);
            $table->text('face_embeddings_encrypted')->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->enum('sync_status', ['pending', 'synced', 'failed'])->default('pending');
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('attendance_devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('device_code')->unique();
            $table->string('registration_code')->unique();
            $table->string('device_name')->nullable();
            $table->foreignId('business_id')->constrained('businesses');
            $table->foreignId('branch_id')->constrained('branches');
            $table->text('device_token')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamp('last_active_at')->nullable();
            $table->enum('status', ['active', 'inactive', 'maintenance'])->default('active');
            $table->text('settings_json')->nullable();
            $table->timestamps();
        });

        Schema::create('attendance_shifts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('business_id')->constrained('businesses');
            $table->foreignId('branch_id')->nullable()->constrained('branches');
            $table->string('name');
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('grace_period_minutes')->default(15);
            $table->json('working_days')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        Schema::create('attendance_employee_shifts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('attendance_employee_id');
            $table->unsignedBigInteger('shift_id');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();

            $table->foreign('attendance_employee_id')
                ->references('id')
                ->on('attendance_employees')
                ->onDelete('cascade');
            $table->foreign('shift_id')
                ->references('id')
                ->on('attendance_shifts')
                ->onDelete('cascade');
        });

        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('attendance_employee_id');
            $table->enum('type', ['IN', 'OUT', 'BREAK_START', 'BREAK_END']);
            $table->timestamp('check_time');
            $table->uuid('device_id');
            $table->foreignId('branch_id')->constrained('branches');
            $table->decimal('confidence_score', 3, 2)->nullable();
            $table->decimal('location_lat', 10, 7)->nullable();
            $table->decimal('location_lng', 10, 7)->nullable();
            $table->text('photo_proof_path')->nullable();
            $table->text('notes')->nullable();
            $table->enum('sync_status', ['pending', 'confirmed'])->default('confirmed');
            $table->timestamp('synced_from_device_at')->nullable();
            $table->timestamps();

            $table->foreign('attendance_employee_id')
                ->references('id')
                ->on('attendance_employees')
                ->onDelete('cascade');
            $table->foreign('device_id')
                ->references('id')
                ->on('attendance_devices')
                ->onDelete('cascade');
        });

        Schema::create('attendance_reports_cache', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('business_id')->constrained('businesses');
            $table->foreignId('branch_id')->nullable()->constrained('branches');
            $table->string('report_type');
            $table->date('report_date');
            $table->mediumText('data_json');
            $table->timestamp('generated_at');
        });

        Schema::create('attendance_sync_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('device_id');
            $table->enum('sync_type', ['employee_push', 'log_pull', 'log_ack', 'device_register', 'shift_pull']);
            $table->integer('record_count')->default(0);
            $table->enum('status', ['success', 'partial', 'failed'])->default('success');
            $table->text('error_message')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();

            $table->foreign('device_id')
                ->references('id')
                ->on('attendance_devices')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_sync_logs');
        Schema::dropIfExists('attendance_reports_cache');
        Schema::dropIfExists('attendance_logs');
        Schema::dropIfExists('attendance_employee_shifts');
        Schema::dropIfExists('attendance_shifts');
        Schema::dropIfExists('attendance_devices');
        Schema::dropIfExists('attendance_employees');
    }
};
