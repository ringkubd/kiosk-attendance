<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('orgs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('api_base_url')->nullable();
            $table->string('sync_token')->nullable();
            $table->timestamps();
        });

        Schema::create('branches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('org_id');
            $table->string('name');
            $table->string('timezone')->default('Asia/Dhaka');
            $table->timestamps();

            $table->foreign('org_id')->references('id')->on('orgs')->onDelete('cascade');
        });

        Schema::create('devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('org_id');
            $table->uuid('branch_id');
            $table->string('name');
            $table->timestamp('registered_at');
            $table->timestamp('last_sync_at')->nullable();

            $table->foreign('org_id')->references('id')->on('orgs')->onDelete('cascade');
            $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('org_id');
            $table->uuid('branch_id');
            $table->string('code')->nullable();
            $table->string('name');
            $table->string('status')->default('active');
            $table->binary('embedding_avg')->nullable();
            $table->text('embeddings_json')->nullable();
            $table->string('profile_image_path')->nullable();
            $table->string('sync_state')->default('dirty');
            $table->timestamp('updated_at');

            $table->foreign('org_id')->references('id')->on('orgs')->onDelete('cascade');
            $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
            $table->unique(['org_id', 'code']);
        });

        Schema::create('shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('org_id');
            $table->uuid('branch_id')->nullable();
            $table->string('name');
            $table->string('start_time');
            $table->string('end_time');
            $table->integer('grace_in_min')->default(0);
            $table->integer('grace_out_min')->default(0);
            $table->boolean('break_allowed')->default(false);
            $table->boolean('ot_allowed')->default(false);
            $table->integer('ot_start_after_min')->default(0);
            $table->integer('ot_rounding_min')->default(0);
            $table->integer('min_work_for_present_min')->default(0);
            $table->string('sync_state')->default('dirty');
            $table->timestamp('updated_at');

            $table->foreign('org_id')->references('id')->on('orgs')->onDelete('cascade');
            $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
        });

        Schema::create('employee_shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('org_id');
            $table->uuid('employee_id');
            $table->uuid('shift_id');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->foreign('org_id')->references('id')->on('orgs')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('cascade');
        });

        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('org_id');
            $table->uuid('branch_id');
            $table->uuid('device_id');
            $table->uuid('employee_id');
            $table->string('type');
            $table->bigInteger('ts_local');
            $table->float('confidence');
            $table->boolean('synced')->default(false);
            $table->string('server_id')->nullable();
            $table->timestamp('created_at');

            $table->foreign('org_id')->references('id')->on('orgs')->onDelete('cascade');
            $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
            $table->foreign('device_id')->references('id')->on('devices')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
        });

        Schema::create('daily_summaries', function (Blueprint $table) {
            $table->uuid('org_id');
            $table->uuid('branch_id');
            $table->uuid('employee_id');
            $table->date('date');
            $table->uuid('shift_id')->nullable();
            $table->bigInteger('first_in_ts')->nullable();
            $table->bigInteger('last_out_ts')->nullable();
            $table->integer('work_min')->default(0);
            $table->integer('late_min')->default(0);
            $table->integer('early_min')->default(0);
            $table->integer('ot_min')->default(0);
            $table->string('status');
            $table->timestamp('updated_at');

            $table->primary(['org_id', 'branch_id', 'employee_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_summaries');
        Schema::dropIfExists('attendance_logs');
        Schema::dropIfExists('employee_shifts');
        Schema::dropIfExists('shifts');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('devices');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('orgs');
    }
};
