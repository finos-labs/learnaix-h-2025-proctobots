<?php
// This file is part of Moodle - http://moodle.org/
//
// Proctoria plugin for Moodle - Quick setup configuration

defined('MOODLE_INTERNAL') || die();

// Proctoria plugin quick configuration
// Copy these values to your Moodle admin interface

return [
    // Basic plugin information
    'plugin_name' => 'Proctoria AI Proctoring',
    'plugin_version' => '1.0.0',
    'moodle_version' => '4.0',
    
    // API Configuration
    'api_settings' => [
        'backend_url' => 'http://localhost:8000',
        'analytics_url' => 'http://localhost:3001',
        'plagiarism_url' => 'http://localhost:8080',
        'websocket_url' => 'http://localhost:3003',
        'api_key' => 'proctoria_api_key_2024',
        'jwt_secret' => 'proctoria_jwt_secret_2024',
        'api_timeout' => 30,
    ],
    
    // Default proctoring settings
    'proctoring_defaults' => [
        'face_detection' => 1,
        'audio_monitoring' => 1,
        'screen_recording' => 1,
        'plagiarism_check' => 1,
        'browser_lockdown' => 1,
        'violation_threshold' => 'medium',
        'auto_flag_violations' => 1,
        'real_time_alerts' => 1,
    ],
    
    // Recording configuration
    'recording_settings' => [
        'video_quality' => 'medium',
        'audio_quality' => 'standard',
        'retention_period' => 30, // days
        'encryption_enabled' => 1,
        'storage_path' => '/var/proctoria/recordings',
    ],
    
    // Notification settings
    'notifications' => [
        'email_enabled' => 1,
        'sms_enabled' => 0,
        'dashboard_alerts' => 1,
        'violation_threshold_critical' => 1,
        'violation_threshold_warning' => 1,
    ],
    
    // Security settings
    'security' => [
        'require_https' => 1,
        'cors_enabled' => 1,
        'rate_limiting' => 1,
        'session_timeout' => 7200, // 2 hours
    ],
    
    // Feature flags
    'features' => [
        'ml_face_detection' => 1,
        'pose_analysis' => 1,
        'object_detection' => 1,
        'audio_analysis' => 1,
        'behavior_analytics' => 1,
        'plagiarism_detection' => 1,
        'real_time_monitoring' => 1,
    ],
    
    // Integration settings
    'integration' => [
        'gradebook_sync' => 1,
        'calendar_sync' => 1,
        'user_enrollment_sync' => 1,
        'course_backup_include' => 1,
    ],
    
    // Advanced settings
    'advanced' => [
        'debug_mode' => 0,
        'logging_level' => 'info',
        'performance_monitoring' => 1,
        'analytics_enabled' => 1,
        'telemetry_enabled' => 0,
    ],
];
?>