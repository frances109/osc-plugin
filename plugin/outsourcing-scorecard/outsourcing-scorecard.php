<?php
/**
 * Plugin Name:  Outsourcing Readiness Scorecard
 * Plugin URI:   https://magellan-solutions.com
 * Description:  Multi-step outsourcing readiness quiz with reCAPTCHA v3 + Flamingo.
 *               Works standalone OR as a Magellan Hub project (auto-detected).
 *               Completely overrides the active theme — zero theme CSS interference.
 *               All assets loaded from plugin/dist/ (npm packages bundled — no CDN).
 * Version:      1.2.0
 * Author:       Magellan Solutions
 * License:      GPL-2.0+
 * Text Domain:  outsourcing-scorecard
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'OSC_VERSION',    '1.2.0' );
define( 'OSC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'OSC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'OSC_DIST_URL',   OSC_PLUGIN_URL . 'dist/' );
define( 'OSC_PDF_URL',    OSC_PLUGIN_URL . 'pdf/' );
define( 'OSC_ASSETS_URL', OSC_PLUGIN_URL . 'assets/' );

/*
 * Load shared config first — defines osc_get_setting() and osc_running_under_hub().
 * Must come before rest-routes.php and quiz-email-builder.php.
 */
require_once OSC_PLUGIN_DIR . 'php/shared-config.php';

/*
 * Load email builders — defines osc_send_admin_email(), osc_send_user_email(), etc.
 * Must come before rest-routes.php which calls these functions.
 */
require_once OSC_PLUGIN_DIR . 'php/quiz-email-builder.php';

/*
 * Load REST routes — defines all register_rest_route() calls and handler functions.
 * Uses function_exists() guards so it is safe if the hub also loads this file.
 */
require_once OSC_PLUGIN_DIR . 'php/rest-routes.php';


/* ═══════════════════════════════════════════════════════════════
   FULL DOCUMENT OVERRIDE  (standalone mode only)
   Skipped when running under Magellan Hub — the hub handles rendering.
═══════════════════════════════════════════════════════════════ */
add_action( 'template_redirect', 'osc_maybe_render_page', 1 );

function osc_maybe_render_page(): void {
    if ( osc_running_under_hub() ) return;

    $slug = get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' );
    if ( ! is_page( $slug ) ) return;

    while ( ob_get_level() ) ob_end_clean();
    include OSC_PLUGIN_DIR . 'templates/page-scorecard.php';
    exit;
}


/* ═══════════════════════════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════════════════════════ */
add_action( 'admin_menu', function (): void {
    add_options_page(
        'Outsourcing Scorecard Settings',
        'Outsourcing Scorecard',
        'manage_options',
        'outsourcing-scorecard',
        'osc_settings_page'
    );
} );

add_action( 'admin_init', function (): void {
    foreach ( [ 'osc_quiz_page_slug', 'osc_recaptcha_site_key', 'osc_recaptcha_secret_key', 'osc_admin_to', 'osc_admin_cc' ] as $opt ) {
        register_setting( 'osc_settings', $opt );
    }
} );

function osc_settings_page(): void {
    $under_hub = osc_running_under_hub();
    $saved     = isset( $_GET['settings-updated'] );
    ?>
<div class="wrap">
    <h1>Outsourcing Scorecard – Settings</h1>

    <?php if ( $saved ) : ?>
    <div class="notice notice-success is-dismissible"><p>&#10003; Settings saved.</p></div>
    <?php endif; ?>

    <?php if ( $under_hub ) : ?>
    <div class="notice notice-info">
        <p>
            <strong>Running under Magellan Hub.</strong>
            reCAPTCHA keys and notification emails are inherited from
            <a href="<?php echo esc_url( admin_url( 'admin.php?page=magellan-hub-settings' ) ); ?>">Magellan Hub → Settings</a>
            when left blank below.
        </p>
    </div>
    <?php
    if ( get_option( 'osc_recaptcha_site_key', '' ) === '' || get_option( 'osc_recaptcha_secret_key', '' ) === '' ) : ?>
    <div class="notice notice-warning">
        <p>
            <strong>⚠ reCAPTCHA keys not set for this site.</strong>
            Falling back to hub shared keys registered for a <em>different domain</em>.
            This causes <strong>reCAPTCHA score too low</strong> errors.<br>
            <strong>Fix:</strong> Enter keys registered for
            <code><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></code>.
        </p>
    </div>
    <?php endif; ?>
    <?php endif; ?>

    <form method="post" action="options.php">
        <?php settings_fields( 'osc_settings' ); ?>
        <table class="form-table">
            <tr>
                <th>Quiz Page Slug</th>
                <td><input type="text" name="osc_quiz_page_slug" value="<?php echo esc_attr( get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' ) ); ?>" class="regular-text"></td>
            </tr>
            <tr>
                <th>reCAPTCHA v3 Site Key</th>
                <td>
                    <input type="text" name="osc_recaptcha_site_key" value="<?php echo esc_attr( get_option( 'osc_recaptcha_site_key', '' ) ); ?>" class="regular-text" <?php if ( $under_hub ) echo 'placeholder="Inherited from hub if blank"'; ?>>
                    <p class="description">Must be registered for: <strong><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></strong></p>
                </td>
            </tr>
            <tr>
                <th>reCAPTCHA v3 Secret Key</th>
                <td><input type="password" name="osc_recaptcha_secret_key" value="<?php echo esc_attr( get_option( 'osc_recaptcha_secret_key', '' ) ); ?>" class="regular-text" <?php if ( $under_hub ) echo 'placeholder="Inherited from hub if blank"'; ?>></td>
            </tr>
            <tr>
                <th>Admin Notification Email(s)</th>
                <td><input type="text" name="osc_admin_to" value="<?php echo esc_attr( get_option( 'osc_admin_to', '' ) ); ?>" class="large-text" <?php if ( $under_hub ) echo 'placeholder="Inherited from hub if blank"'; else echo 'placeholder="sales@company.com"'; ?>></td>
            </tr>
            <tr>
                <th>Admin CC</th>
                <td><input type="text" name="osc_admin_cc" value="<?php echo esc_attr( get_option( 'osc_admin_cc', '' ) ); ?>" class="large-text"></td>
            </tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
<?php }
