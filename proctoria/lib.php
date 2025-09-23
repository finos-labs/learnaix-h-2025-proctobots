<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Define constants and reusable logic for Proctoria plugin
 * @package     quizaccess_proctoria
 * @copyright   2025 LearnAIx Team
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

// API Configuration
const QUIZACCESS_PROCTORIA_API_URL = 'http://localhost:8000';
const QUIZACCESS_PROCTORIA_API_PREFIX = 'api/v1';

// WebSocket Configuration
const QUIZACCESS_PROCTORIA_WEBSOCKET_URL = 'ws://localhost:8003';

// Analytics Configuration
const QUIZACCESS_PROCTORIA_ANALYTICS_URL = 'http://localhost:8001';

// Plagiarism Configuration
const QUIZACCESS_PROCTORIA_PLAGIARISM_URL = 'http://localhost:8002';

// Risk Score Thresholds
const QUIZACCESS_PROCTORIA_RISK_LOW = 0.3;
const QUIZACCESS_PROCTORIA_RISK_MEDIUM = 0.6;
const QUIZACCESS_PROCTORIA_RISK_HIGH = 0.8;

// Violation Types
const QUIZACCESS_PROCTORIA_VIOLATION_FACE_NOT_DETECTED = 'face_not_detected';
const QUIZACCESS_PROCTORIA_VIOLATION_MULTIPLE_FACES = 'multiple_faces';
const QUIZACCESS_PROCTORIA_VIOLATION_PHONE_DETECTED = 'phone_detected';
const QUIZACCESS_PROCTORIA_VIOLATION_BOOK_DETECTED = 'book_detected';
const QUIZACCESS_PROCTORIA_VIOLATION_SUSPICIOUS_AUDIO = 'suspicious_audio';
const QUIZACCESS_PROCTORIA_VIOLATION_GAZE_DEVIATION = 'gaze_deviation';
const QUIZACCESS_PROCTORIA_VIOLATION_TAB_SWITCH = 'tab_switch';
const QUIZACCESS_PROCTORIA_VIOLATION_COPY_PASTE = 'copy_paste';

// Session Status
const QUIZACCESS_PROCTORIA_SESSION_ACTIVE = 'active';
const QUIZACCESS_PROCTORIA_SESSION_PAUSED = 'paused';
const QUIZACCESS_PROCTORIA_SESSION_ENDED = 'ended';
const QUIZACCESS_PROCTORIA_SESSION_FLAGGED = 'flagged';

// Configuration Keys
const QUIZACCESS_PROCTORIA_CONFIG_API_TOKEN = 'api_token';
const QUIZACCESS_PROCTORIA_CONFIG_FACE_DETECTION = 'enable_face_detection';
const QUIZACCESS_PROCTORIA_CONFIG_OBJECT_DETECTION = 'enable_object_detection';
const QUIZACCESS_PROCTORIA_CONFIG_AUDIO_MONITORING = 'enable_audio_monitoring';
const QUIZACCESS_PROCTORIA_CONFIG_PLAGIARISM_CHECK = 'enable_plagiarism_check';

// File Paths
const QUIZACCESS_PROCTORIA_REPORT_FILE_PATH = '/mod/quiz/accessrule/proctoria/report.php';
const QUIZACCESS_PROCTORIA_DASHBOARD_PATH = '/mod/quiz/accessrule/proctoria/dashboard.php';
const QUIZACCESS_PROCTORIA_SETTINGS_PATH = '/mod/quiz/accessrule/proctoria/settings.php';

/**
 * Get Proctoria API configuration
 */
function quizaccess_proctoria_get_api_config() {
    return [
        'api_url' => get_config('quizaccess_proctoria', 'api_url') ?: QUIZACCESS_PROCTORIA_API_URL,
        'api_token' => get_config('quizaccess_proctoria', QUIZACCESS_PROCTORIA_CONFIG_API_TOKEN),
        'websocket_url' => get_config('quizaccess_proctoria', 'websocket_url') ?: QUIZACCESS_PROCTORIA_WEBSOCKET_URL,
    ];
}

/**
 * Get proctoring settings for a quiz
 */
function quizaccess_proctoria_get_quiz_settings($quizid) {
    global $DB;
    
    $settings = $DB->get_record('quizaccess_proctoria_settings', ['quizid' => $quizid]);
    if (!$settings) {
        return [
            'face_detection' => true,
            'object_detection' => true,
            'audio_monitoring' => true,
            'plagiarism_check' => true,
            'risk_threshold' => QUIZACCESS_PROCTORIA_RISK_MEDIUM,
        ];
    }
    
    return [
        'face_detection' => $settings->face_detection,
        'object_detection' => $settings->object_detection,
        'audio_monitoring' => $settings->audio_monitoring,
        'plagiarism_check' => $settings->plagiarism_check,
        'risk_threshold' => $settings->risk_threshold,
    ];
}

/**
 * Calculate risk score based on violations
 */
function quizaccess_proctoria_calculate_risk_score($violations) {
    $score = 0;
    $weights = [
        QUIZACCESS_PROCTORIA_VIOLATION_FACE_NOT_DETECTED => 0.8,
        QUIZACCESS_PROCTORIA_VIOLATION_MULTIPLE_FACES => 0.9,
        QUIZACCESS_PROCTORIA_VIOLATION_PHONE_DETECTED => 0.7,
        QUIZACCESS_PROCTORIA_VIOLATION_BOOK_DETECTED => 0.6,
        QUIZACCESS_PROCTORIA_VIOLATION_SUSPICIOUS_AUDIO => 0.8,
        QUIZACCESS_PROCTORIA_VIOLATION_GAZE_DEVIATION => 0.4,
        QUIZACCESS_PROCTORIA_VIOLATION_TAB_SWITCH => 0.5,
        QUIZACCESS_PROCTORIA_VIOLATION_COPY_PASTE => 0.9,
    ];
    
    foreach ($violations as $violation) {
        $weight = $weights[$violation->type] ?? 0.5;
        $score += $weight * $violation->confidence;
    }
    
    return min($score, 1.0);
}

/**
 * Make API request to Proctoria backend
 */
function quizaccess_proctoria_api_request($endpoint, $data = null, $method = 'GET') {
    $config = quizaccess_proctoria_get_api_config();
    $url = $config['api_url'] . '/' . QUIZACCESS_PROCTORIA_API_PREFIX . '/' . $endpoint;
    
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $config['api_token'],
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("API request failed with status code: $httpCode");
    }
    
    return json_decode($response, true);
}