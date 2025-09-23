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
 * External services for Proctoria plugin
 * @package     quizaccess_proctoria
 * @copyright   2025 LearnAIx Team
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    'quizaccess_proctoria_start_session' => [
        'classname'   => 'quizaccess_proctoria_external',
        'methodname'  => 'start_session',
        'classpath'   => 'mod/quiz/accessrule/proctoria/classes/external.php',
        'description' => 'Start a proctoring session for a quiz attempt',
        'type'        => 'write',
        'ajax'        => true,
        'capabilities' => 'quizaccess/proctoria:startsession',
    ],
    'quizaccess_proctoria_end_session' => [
        'classname'   => 'quizaccess_proctoria_external',
        'methodname'  => 'end_session',
        'classpath'   => 'mod/quiz/accessrule/proctoria/classes/external.php',
        'description' => 'End a proctoring session',
        'type'        => 'write',
        'ajax'        => true,
        'capabilities' => 'quizaccess/proctoria:startsession',
    ],
    'quizaccess_proctoria_report_violation' => [
        'classname'   => 'quizaccess_proctoria_external',
        'methodname'  => 'report_violation',
        'classpath'   => 'mod/quiz/accessrule/proctoria/classes/external.php',
        'description' => 'Report a proctoring violation',
        'type'        => 'write',
        'ajax'        => true,
        'capabilities' => 'quizaccess/proctoria:startsession',
    ],
    'quizaccess_proctoria_get_session_status' => [
        'classname'   => 'quizaccess_proctoria_external',
        'methodname'  => 'get_session_status',
        'classpath'   => 'mod/quiz/accessrule/proctoria/classes/external.php',
        'description' => 'Get current session status and risk score',
        'type'        => 'read',
        'ajax'        => true,
        'capabilities' => 'quizaccess/proctoria:startsession',
    ],
    'quizaccess_proctoria_get_violations' => [
        'classname'   => 'quizaccess_proctoria_external',
        'methodname'  => 'get_violations',
        'classpath'   => 'mod/quiz/accessrule/proctoria/classes/external.php',
        'description' => 'Get violations for a session',
        'type'        => 'read',
        'ajax'        => true,
        'capabilities' => 'quizaccess/proctoria:viewreport',
    ],
    'quizaccess_proctoria_update_analytics' => [
        'classname'   => 'quizaccess_proctoria_external',
        'methodname'  => 'update_analytics',
        'classpath'   => 'mod/quiz/accessrule/proctoria/classes/external.php',
        'description' => 'Update analytics data for a session',
        'type'        => 'write',
        'ajax'        => true,
        'capabilities' => 'quizaccess/proctoria:startsession',
    ],
];

$services = [
    'Proctoria API' => [
        'functions' => [
            'quizaccess_proctoria_start_session',
            'quizaccess_proctoria_end_session',
            'quizaccess_proctoria_report_violation',
            'quizaccess_proctoria_get_session_status',
            'quizaccess_proctoria_get_violations',
            'quizaccess_proctoria_update_analytics',
        ],
        'restrictedusers' => 0,
        'enabled' => 1,
        'shortname' => 'proctoria_api',
    ],
];