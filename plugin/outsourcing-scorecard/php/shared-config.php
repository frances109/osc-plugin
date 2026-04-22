<?php
/**
 * php/shared-config.php  —  Outsourcing Readiness Scorecard
 *
 * Unified configuration layer. Loaded in both modes:
 *   - Standalone plugin: required by outsourcing-scorecard.php
 *   - Hub mode:          required by php/rest-routes.php via mhub_load_php_dir_ordered()
 *
 * Defines osc_get_setting() and osc_running_under_hub() exactly once.
 * Every other OSC PHP file calls osc_get_setting() for keys/emails.
 *
 * function_exists() guards make every definition safe to require_once
 * from both the standalone plugin and the hub loader — whichever
 * loads first wins, the second load is a silent no-op.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! function_exists( 'osc_running_under_hub' ) ) :

/**
 * Returns true when Magellan Hub is active and has this project registered.
 *
 * @return bool
 */
function osc_running_under_hub(): bool {
    if ( ! function_exists( 'mhub_get_project_by_slug' ) ) return false;
    $slug    = get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' );
    $project = mhub_get_project_by_slug( $slug );
    return ( $project && $project->status === 'active' );
}

endif;

if ( ! function_exists( 'osc_get_setting' ) ) :

/**
 * Retrieve a setting with three-tier fallback:
 *   1. Plugin-level WP option  (e.g. osc_recaptcha_site_key)
 *   2. Hub global WP option    (e.g. mhub_recaptcha_site)  — only when under hub
 *   3. $default parameter
 *
 * This is the single configuration source for all OSC PHP files.
 * No option keys are read directly anywhere else.
 *
 * @param string $option   WP option key.
 * @param string $default  Fallback value.
 * @return string
 */
function osc_get_setting( string $option, string $default = '' ): string {
    $value = get_option( $option, '' );
    if ( $value !== '' ) return $value;

    if ( osc_running_under_hub() ) {
        switch ( $option ) {
            case 'osc_recaptcha_site_key':
                return get_option( 'mhub_recaptcha_site', $default );
            case 'osc_recaptcha_secret_key':
                return get_option( 'mhub_recaptcha_secret', $default );
            case 'osc_admin_to':
                return get_option( 'mhub_notify_emails', get_option( 'admin_email', $default ) );
        }
    }

    return $default;
}

endif;
