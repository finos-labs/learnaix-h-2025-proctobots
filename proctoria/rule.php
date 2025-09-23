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
 * Main rule class for Proctoria quiz access plugin
 * @package     quizaccess_proctoria
 * @copyright   2025 LearnAIx Team
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/quiz/accessrule/accessrulebase.php');

/**
 * A rule for implementing AI-powered proctoring during quiz attempts.
 */
class quizaccess_proctoria extends quiz_access_rule_base {

    /**
     * Make a rule
     * @param quiz $quizobj
     * @param int $timenow
     * @param bool $canignoretimelimits
     * @return quiz_access_rule_base|null
     */
    public static function make(quiz $quizobj, $timenow, $canignoretimelimits) {
        global $DB;
        
        // Check if proctoring is enabled for this quiz
        $settings = $DB->get_record('quizaccess_proctoria_settings', ['quizid' => $quizobj->get_quizid()]);
        if (!$settings) {
            return null;
        }
        
        return new self($quizobj, $timenow);
    }

    /**
     * Add settings form fields for this quiz access rule.
     */
    public static function add_settings_form_fields(mod_quiz_mod_form $quizform, MoodleQuickForm $mform) {
        $mform->addElement('header', 'proctoriaheader', get_string('proctoringsettings', 'quizaccess_proctoria'));
        
        $mform->addElement('advcheckbox', 'proctoria_enabled', 
            get_string('enableproctoring', 'quizaccess_proctoria'),
            get_string('enableproctoring_desc', 'quizaccess_proctoria'));
        $mform->setDefault('proctoria_enabled', 0);
        
        $mform->addElement('advcheckbox', 'proctoria_face_detection', 
            get_string('facedetection', 'quizaccess_proctoria'),
            get_string('facedetection_desc', 'quizaccess_proctoria'));
        $mform->setDefault('proctoria_face_detection', 1);
        $mform->hideIf('proctoria_face_detection', 'proctoria_enabled', 'notchecked');
        
        $mform->addElement('advcheckbox', 'proctoria_object_detection', 
            get_string('objectdetection', 'quizaccess_proctoria'),
            get_string('objectdetection_desc', 'quizaccess_proctoria'));
        $mform->setDefault('proctoria_object_detection', 1);
        $mform->hideIf('proctoria_object_detection', 'proctoria_enabled', 'notchecked');
        
        $mform->addElement('advcheckbox', 'proctoria_audio_monitoring', 
            get_string('audiomonitoring', 'quizaccess_proctoria'),
            get_string('audiomonitoring_desc', 'quizaccess_proctoria'));
        $mform->setDefault('proctoria_audio_monitoring', 1);
        $mform->hideIf('proctoria_audio_monitoring', 'proctoria_enabled', 'notchecked');
        
        $mform->addElement('advcheckbox', 'proctoria_plagiarism_check', 
            get_string('plagiarismcheck', 'quizaccess_proctoria'),
            get_string('plagiarismcheck_desc', 'quizaccess_proctoria'));
        $mform->setDefault('proctoria_plagiarism_check', 1);
        $mform->hideIf('proctoria_plagiarism_check', 'proctoria_enabled', 'notchecked');
        
        $options = [
            '0.3' => get_string('risklow', 'quizaccess_proctoria'),
            '0.6' => get_string('riskmedium', 'quizaccess_proctoria'),
            '0.8' => get_string('riskhigh', 'quizaccess_proctoria'),
        ];
        $mform->addElement('select', 'proctoria_risk_threshold', 
            get_string('riskthreshold', 'quizaccess_proctoria'), $options);
        $mform->setDefault('proctoria_risk_threshold', '0.6');
        $mform->hideIf('proctoria_risk_threshold', 'proctoria_enabled', 'notchecked');
    }

    /**
     * Save the settings for this quiz access rule.
     */
    public static function save_settings($quiz) {
        global $DB;
        
        if (!isset($quiz->proctoria_enabled) || !$quiz->proctoria_enabled) {
            // Delete settings if proctoring is disabled
            $DB->delete_records('quizaccess_proctoria_settings', ['quizid' => $quiz->id]);
            return;
        }
        
        $record = new stdClass();
        $record->quizid = $quiz->id;
        $record->face_detection = isset($quiz->proctoria_face_detection) ? $quiz->proctoria_face_detection : 1;
        $record->object_detection = isset($quiz->proctoria_object_detection) ? $quiz->proctoria_object_detection : 1;
        $record->audio_monitoring = isset($quiz->proctoria_audio_monitoring) ? $quiz->proctoria_audio_monitoring : 1;
        $record->plagiarism_check = isset($quiz->proctoria_plagiarism_check) ? $quiz->proctoria_plagiarism_check : 1;
        $record->risk_threshold = isset($quiz->proctoria_risk_threshold) ? $quiz->proctoria_risk_threshold : 0.6;
        $record->timecreated = time();
        $record->timemodified = time();
        
        $existing = $DB->get_record('quizaccess_proctoria_settings', ['quizid' => $quiz->id]);
        if ($existing) {
            $record->id = $existing->id;
            $record->timecreated = $existing->timecreated;
            $DB->update_record('quizaccess_proctoria_settings', $record);
        } else {
            $DB->insert_record('quizaccess_proctoria_settings', $record);
        }
    }

    /**
     * Get an appropriate key to show the user next to their attempt.
     */
    public static function get_settings_summary($quiz) {
        global $DB;
        
        $settings = $DB->get_record('quizaccess_proctoria_settings', ['quizid' => $quiz->id]);
        if (!$settings) {
            return '';
        }
        
        $features = [];
        if ($settings->face_detection) {
            $features[] = get_string('facedetection', 'quizaccess_proctoria');
        }
        if ($settings->object_detection) {
            $features[] = get_string('objectdetection', 'quizaccess_proctoria');
        }
        if ($settings->audio_monitoring) {
            $features[] = get_string('audiomonitoring', 'quizaccess_proctoria');
        }
        if ($settings->plagiarism_check) {
            $features[] = get_string('plagiarismcheck', 'quizaccess_proctoria');
        }
        
        return get_string('proctoringsummary', 'quizaccess_proctoria', implode(', ', $features));
    }

    /**
     * Set up this rule for a particular quiz.
     */
    public static function get_instance_settings($quiz) {
        global $DB;
        return $DB->get_record('quizaccess_proctoria_settings', ['quizid' => $quiz->id]);
    }

    /**
     * Whether the user is prevented from starting a new attempt or continuing an attempt now.
     */
    public function prevent_access() {
        global $USER;
        
        // Check if user has verified their identity
        if (!$this->is_user_verified($USER->id)) {
            return get_string('identitynotverified', 'quizaccess_proctoria');
        }
        
        // Check if browser supports required features
        if (!$this->browser_supports_proctoring()) {
            return get_string('browserntsupported', 'quizaccess_proctoria');
        }
        
        return false;
    }

    /**
     * Information about the user's progress through the attempt.
     */
    public function attempt_has_ended() {
        // End session when attempt ends
        $this->end_proctoring_session();
        return false;
    }

    /**
     * Sets up the required JavaScript and HTML for proctoring.
     */
    public function setup_attempt_page($page) {
        global $PAGE, $USER;
        
        // Add proctoring JavaScript
        $PAGE->requires->js_call_amd('quizaccess_proctoria/proctoring', 'init', [
            'sessionId' => $this->get_or_create_session(),
            'userId' => $USER->id,
            'quizId' => $this->quiz->id,
            'apiConfig' => quizaccess_proctoria_get_api_config(),
        ]);
        
        // Add CSS for proctoring interface
        $PAGE->requires->css('/mod/quiz/accessrule/proctoria/styles/proctoring.css');
    }

    /**
     * Check if user has verified their identity
     */
    private function is_user_verified($userid) {
        global $DB;
        
        $identity = $DB->get_record('quizaccess_proctoria_identity', 
            ['userid' => $userid, 'verification_status' => 'verified']);
        
        return !empty($identity);
    }

    /**
     * Check if browser supports proctoring features
     */
    private function browser_supports_proctoring() {
        // This would normally check for WebRTC, getUserMedia, etc.
        // For now, we'll assume modern browsers support it
        return true;
    }

    /**
     * Get or create proctoring session for current attempt
     */
    private function get_or_create_session() {
        global $DB, $USER;
        
        $attemptid = $this->quizobj->get_attempt()->id;
        
        $session = $DB->get_record('quizaccess_proctoria_sessions', ['attemptid' => $attemptid]);
        if ($session) {
            return $session->session_id;
        }
        
        // Create new session
        $sessionid = uniqid('proctoria_', true);
        $record = new stdClass();
        $record->attemptid = $attemptid;
        $record->userid = $USER->id;
        $record->quizid = $this->quiz->id;
        $record->session_id = $sessionid;
        $record->status = QUIZACCESS_PROCTORIA_SESSION_ACTIVE;
        $record->timestarted = time();
        $record->timecreated = time();
        $record->timemodified = time();
        
        $DB->insert_record('quizaccess_proctoria_sessions', $record);
        
        return $sessionid;
    }

    /**
     * End the proctoring session
     */
    private function end_proctoring_session() {
        global $DB;
        
        $attemptid = $this->quizobj->get_attempt()->id;
        $session = $DB->get_record('quizaccess_proctoria_sessions', ['attemptid' => $attemptid]);
        
        if ($session) {
            $session->status = QUIZACCESS_PROCTORIA_SESSION_ENDED;
            $session->timeended = time();
            $session->timemodified = time();
            $DB->update_record('quizaccess_proctoria_sessions', $session);
        }
    }

    /**
     * This is called when the current attempt at the quiz is finished.
     */
    public function current_attempt_finished() {
        $this->end_proctoring_session();
    }
}