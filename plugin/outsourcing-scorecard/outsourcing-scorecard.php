<?php
/**
 * Plugin Name:  Outsourcing Readiness Scorecard
 * Plugin URI:   https://magellan-solutions.com
 * Description:  Multi-step outsourcing readiness quiz with CF7 + reCAPTCHA v3 + Flamingo.
 *               Completely overrides the active theme — zero theme CSS interference.
 *               All assets loaded from plugin/dist/ (npm packages bundled — no CDN).
 * Version:      1.0.0
 * Author:       Magellan Solutions
 * License:      GPL-2.0+
 * Text Domain:  outsourcing-scorecard
 *
 * Required plugins:
 *   - Contact Form 7         (form processing, spam protection hooks)
 *   - CF7 reCAPTCHA v3       (or the built-in CF7 reCAPTCHA integration)
 *   - Flamingo               (saves inbound messages + address book)
 *   - WP Mail SMTP           (reliable email delivery)
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'OSC_VERSION',    '1.0.0' );
define( 'OSC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'OSC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'OSC_DIST_URL',   OSC_PLUGIN_URL . 'dist/' );
define( 'OSC_PDF_URL',    OSC_PLUGIN_URL . 'pdf/' );
define( 'OSC_ASSETS_URL', OSC_PLUGIN_URL . 'assets/' );

require_once OSC_PLUGIN_DIR . 'php/quiz-email-builder.php';


/* ═══════════════════════════════════════════════════════════════
   1. FULL DOCUMENT OVERRIDE
   Intercepts the quiz page slug and renders its own HTML document,
   bypassing the active theme entirely (same pattern as otg plugin).
═══════════════════════════════════════════════════════════════ */
add_action( 'template_redirect', 'osc_maybe_render_page', 1 );

function osc_maybe_render_page(): void {
    $slug = get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' );
    if ( ! is_page( $slug ) ) return;

    while ( ob_get_level() ) ob_end_clean();
    include OSC_PLUGIN_DIR . 'templates/page-scorecard.php';
    exit;
}


/* ═══════════════════════════════════════════════════════════════
   2. SETTINGS PAGE
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
    $opts = [
        'osc_quiz_page_slug',      // WP page slug the plugin intercepts
        'osc_recaptcha_site_key',  // reCAPTCHA v3 site key  (for <script> tag)
        'osc_recaptcha_secret_key',// reCAPTCHA v3 secret key (server-side verify)
        'osc_cf7_form_id',         // CF7 form ID to piggyback for Flamingo routing
        'osc_admin_to',            // comma-separated notification email(s)
        'osc_admin_cc',
        'osc_admin_reply_to',
        'osc_user_cc',
    ];
    foreach ( $opts as $opt ) {
        register_setting( 'osc_settings', $opt );
    }
} );

function osc_settings_page(): void { ?>
<div class="wrap">
    <h1>Outsourcing Scorecard – Settings</h1>
    <form method="post" action="options.php">
        <?php settings_fields( 'osc_settings' ); ?>
        <table class="form-table">
            <tr>
                <th>Quiz Page Slug</th>
                <td>
                    <input type="text" name="osc_quiz_page_slug"
                        value="<?php echo esc_attr( get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' ) ); ?>"
                        class="regular-text">
                    <p class="description">
                        Create a blank WordPress page with this slug.
                        The plugin renders its own full HTML — page title/content are ignored.
                    </p>
                </td>
            </tr>
            <tr>
                <th>reCAPTCHA v3 Site Key</th>
                <td>
                    <input type="text" name="osc_recaptcha_site_key"
                        value="<?php echo esc_attr( get_option( 'osc_recaptcha_site_key', '' ) ); ?>"
                        class="regular-text">
                    <p class="description">Public key — injected into the page HTML.</p>
                </td>
            </tr>
            <tr>
                <th>reCAPTCHA v3 Secret Key</th>
                <td>
                    <input type="text" name="osc_recaptcha_secret_key"
                        value="<?php echo esc_attr( get_option( 'osc_recaptcha_secret_key', '' ) ); ?>"
                        class="regular-text">
                    <p class="description">Secret key — used server-side only, never exposed in HTML.</p>
                </td>
            </tr>
            <tr>
                <th>CF7 Form ID <span style="font-weight:400">(optional)</span></th>
                <td>
                    <input type="number" name="osc_cf7_form_id"
                        value="<?php echo esc_attr( get_option( 'osc_cf7_form_id', '' ) ); ?>"
                        class="small-text">
                    <p class="description">
                        If set, Flamingo messages are saved under this CF7 form's channel,
                        so they appear alongside other CF7 submissions in the WP dashboard.
                        Leave blank to use the plugin's own "Outsourcing Scorecard" channel.
                    </p>
                </td>
            </tr>
            <tr>
                <th>Admin Notification Email(s)</th>
                <td>
                    <input type="text" name="osc_admin_to"
                        value="<?php echo esc_attr( get_option( 'osc_admin_to', get_option( 'admin_email' ) ) ); ?>"
                        class="large-text" placeholder="sales@company.com, manager@company.com">
                    <p class="description">
                        Receives the full-answers admin notification AND a copy of the user
                        results email (with PDF attached). Separate multiple addresses with commas.
                    </p>
                </td>
            </tr>
            <tr>
                <th>Admin CC</th>
                <td>
                    <input type="text" name="osc_admin_cc"
                        value="<?php echo esc_attr( get_option( 'osc_admin_cc', '' ) ); ?>"
                        class="large-text">
                </td>
            </tr>
            <tr>
                <th>Admin Reply-To</th>
                <td>
                    <input type="text" name="osc_admin_reply_to"
                        value="<?php echo esc_attr( get_option( 'osc_admin_reply_to', '' ) ); ?>"
                        class="regular-text">
                    <p class="description">Leave blank — automatically uses the submitter's email.</p>
                </td>
            </tr>
            <tr>
                <th>User Results CC</th>
                <td>
                    <input type="text" name="osc_user_cc"
                        value="<?php echo esc_attr( get_option( 'osc_user_cc', '' ) ); ?>"
                        class="large-text">
                </td>
            </tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
<?php }


/* ═══════════════════════════════════════════════════════════════
   3. REST ENDPOINTS
   POST /wp-json/outsourcing-scorecard/v1/submit
   GET  /wp-json/outsourcing-scorecard/v1/cta
   (CF7 also handles its own form processing — see section 5)
═══════════════════════════════════════════════════════════════ */
add_action( 'rest_api_init', function (): void {

    register_rest_route( 'outsourcing-scorecard/v1', '/submit', [
        'methods'             => 'POST',
        'callback'            => 'osc_handle_submission',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( 'outsourcing-scorecard/v1', '/cta', [
        'methods'             => 'GET',
        'callback'            => 'osc_handle_email_cta',
        'permission_callback' => '__return_true',
    ] );

} );


/* ═══════════════════════════════════════════════════════════════
   4. MAIN SUBMISSION HANDLER
═══════════════════════════════════════════════════════════════ */
function osc_handle_submission( WP_REST_Request $request ): WP_REST_Response|WP_Error {

    $data = $request->get_json_params();

    // ── reCAPTCHA v3 ─────────────────────────────────────────
    $token  = sanitize_text_field( $data['recaptcha_token'] ?? '' );
    $recap  = osc_verify_recaptcha( $token );
    if ( is_wp_error( $recap ) ) {
        return new WP_REST_Response( [ 'success' => false, 'message' => $recap->get_error_message() ], 403 );
    }

    // ── Sanitize contact fields ───────────────────────────────
    $fullname     = sanitize_text_field(     $data['fullname']     ?? '' );
    $email        = sanitize_email(          $data['email']        ?? '' );
    $phone        = sanitize_text_field(     $data['phone']        ?? '' );
    $company      = sanitize_text_field(     $data['company']      ?? '' );
    $tier         = sanitize_text_field(     $data['tier']         ?? '' );
    $tier_body    = sanitize_textarea_field( $data['tier_body']    ?? '' );
    $goal_line    = sanitize_textarea_field( $data['goal_line']    ?? '' );
    $score        = intval(                  $data['score']        ?? 0  );
    $answers      = is_array( $data['answers']  ?? null ) ? $data['answers']  : [];
    $insights     = is_array( $data['insights'] ?? null )
                        ? array_map( 'sanitize_text_field', $data['insights'] )
                        : [];
    $ctas         = is_array( $data['ctas']     ?? null ) ? $data['ctas']     : [];
    $pdf_base64   = sanitize_text_field( $data['pdf_base64']   ?? '' );
    $pdf_filename = sanitize_file_name(  $data['pdf_filename'] ?? 'Magellan-Readiness-Results.pdf' );

    if ( ! $fullname || ! is_email( $email ) || ! $company ) {
        return new WP_REST_Response( [ 'success' => false, 'message' => 'Required fields missing.' ], 400 );
    }

    // ── Route: CTA popup click vs full quiz submit ────────────
    $is_cta     = ! empty( $data['is_cta'] );
    $cta_action = sanitize_text_field( $answers['cta_action'] ?? '' );

    if ( $is_cta ) {
        $admin_sent = osc_send_cta_email( $fullname, $email, $phone, $company, $tier, $cta_action );
        $user_sent  = false;
    } else {
        $goal_answer = osc_q14_label( sanitize_text_field( $data['goal_answer'] ?? '' ) );

        // (a) Admin full-answers notification
        $admin_sent = osc_send_admin_email( $fullname, $email, $phone, $company, $tier, $score, $answers );

        // (b) User results email with personalised PDF attached
        $user_sent  = osc_send_user_email(
            $fullname, $email, $company, $tier, $tier_body, $goal_line,
            $goal_answer, $insights, $ctas, $pdf_base64, $pdf_filename
        );

        // (c) Save to Flamingo (via CF7 channel if configured)
        osc_save_to_flamingo( $fullname, $email, $phone, $company, $tier, $tier_body, $score, $answers, $insights );
    }

    return rest_ensure_response( [ 'success' => true, 'admin_sent' => $admin_sent, 'user_sent' => $user_sent ] );
}


/* ═══════════════════════════════════════════════════════════════
   5. CF7 INTEGRATION
   The quiz uses its own REST endpoint for submission, but integrates
   with CF7 in three ways:
     (a) Uses CF7's Flamingo channel if osc_cf7_form_id is set,
         so submissions appear alongside CF7 forms in the dashboard.
     (b) Hooks into wpcf7_spam_score if CF7 Honeypot is active.
     (c) Exposes a CF7-style nonce so the WP REST nonce and CF7 nonce
         both work for the same endpoint.
═══════════════════════════════════════════════════════════════ */

/**
 * Save submission to Flamingo.
 * If a CF7 form ID is configured, the inbound message is saved under
 * that form's channel so it appears in Flamingo > Inbound Messages
 * alongside CF7 form submissions.
 */
function osc_save_to_flamingo(
    string $fullname,
    string $email,
    string $phone,
    string $company,
    string $tier,
    string $tier_body,
    int    $score,
    array  $answers,
    array  $insights
): void {

    $email    = strtolower( trim( $email ) );
    $fullname = trim( $fullname );
    if ( empty( $email ) ) return;

    // ── Determine channel ─────────────────────────────────────
    // Use CF7 form title as channel if a form ID is configured.
    $cf7_id  = intval( get_option( 'osc_cf7_form_id', 0 ) );
    $channel = 'Outsourcing Scorecard';
    if ( $cf7_id > 0 ) {
        $cf7_post = get_post( $cf7_id );
        if ( $cf7_post && $cf7_post->post_type === 'wpcf7_contact_form' ) {
            $channel = $cf7_post->post_title ?: $channel;
        }
    }

    // ── Build ordered fields ──────────────────────────────────
    $labels = osc_field_labels();
    $skip   = [ 'fullname', 'email', 'phone', 'company', 'score', 'tier' ];

    $ordered_fields = [
        'Full Name'          => $fullname,
        'Email'              => $email,
        'Phone Number'       => $phone,
        'Company Name'       => $company,
        'Result Tier'        => $tier,
        'Result Description' => $tier_body,
        'Score'              => (string) $score,
        'Key Insights'       => implode( ' | ', $insights ),
    ];

    foreach ( $labels as $key => $label ) {
        if ( in_array( $key, $skip, true ) ) continue;
        if ( ! array_key_exists( $key, $answers ) ) continue;
        $val = $answers[ $key ];
        $ordered_fields[ $label ] = is_array( $val ) ? implode( ', ', $val ) : (string) $val;
    }

    $subject = "New Assessment — {$fullname} ({$company})";

    // ── Flamingo_Inbound_Message ──────────────────────────────
    if ( class_exists( 'Flamingo_Inbound_Message' ) ) {
        Flamingo_Inbound_Message::add( [
            'channel'    => $channel,
            'subject'    => $subject,
            'from'       => "{$fullname} <{$email}>",
            'from_name'  => $fullname,
            'from_email' => $email,
            'fields'     => $ordered_fields,
            'meta'       => [
                'remote_ip'  => sanitize_text_field( $_SERVER['REMOTE_ADDR']     ?? '' ),
                'user_agent' => sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ?? '' ),
            ],
        ] );
    } else {
        // Flamingo not active — save as private WP post fallback
        osc_save_as_post( $fullname, $email, $phone, $company, $tier, $score, $ordered_fields );
    }

    // ── Flamingo_Contact (address book) ───────────────────────
    if ( class_exists( 'Flamingo_Contact' ) ) {
        $existing = Flamingo_Contact::search_by_email( $email );
        $props    = $existing ? (array) $existing->props : [];

        $props['company'] = $company ?: ( $props['company'] ?? '' );
        $props['phone']   = $phone   ?: ( $props['phone']   ?? '' );
        $props['tier']    = $tier;
        $props['channel'] = $channel;

        Flamingo_Contact::add( [
            'email'          => $email,
            'name'           => $fullname,
            'props'          => $props,
            'last_contacted' => current_time( 'mysql' ),
            'channel'        => $channel,
        ] );
    }
}

/** Fallback when Flamingo is not active */
function osc_save_as_post(
    string $fullname,
    string $email,
    string $phone,
    string $company,
    string $tier,
    int    $score,
    array  $ordered_fields
): void {
    if ( ! post_type_exists( 'osc_submission' ) ) {
        register_post_type( 'osc_submission', [
            'label'    => 'Scorecard Submissions',
            'public'   => false,
            'show_ui'  => true,
            'supports' => [ 'title', 'custom-fields' ],
        ] );
    }

    $meta = [];
    foreach ( $ordered_fields as $label => $value ) {
        $meta[ '_osc_' . sanitize_key( $label ) ] = $value;
    }

    wp_insert_post( [
        'post_type'   => 'osc_submission',
        'post_title'  => "{$fullname} — {$company}",
        'post_status' => 'private',
        'meta_input'  => $meta,
    ] );
}


/* ═══════════════════════════════════════════════════════════════
   6. RECAPTCHA v3
   Standalone verify — does NOT require CF7 reCAPTCHA plugin.
   If osc_recaptcha_secret_key is empty (dev), verification is skipped.
═══════════════════════════════════════════════════════════════ */
function osc_verify_recaptcha( string $token ): true|WP_Error {
    $secret = get_option( 'osc_recaptcha_secret_key', '' );

    // Dev bypass when no key is configured
    if ( empty( $secret ) ) return true;

    if ( empty( $token ) ) {
        return new WP_Error( 'recaptcha_missing', 'reCAPTCHA token missing.' );
    }

    $res = wp_remote_post( 'https://www.google.com/recaptcha/api/siteverify', [
        'body' => [ 'secret' => $secret, 'response' => $token ],
    ] );

    if ( is_wp_error( $res ) ) {
        return new WP_Error( 'recaptcha_failed', 'reCAPTCHA request failed.' );
    }

    $body = json_decode( wp_remote_retrieve_body( $res ), true );

    if ( empty( $body['success'] ) ) {
        return new WP_Error( 'recaptcha_invalid', 'reCAPTCHA validation failed.' );
    }
    if ( isset( $body['score'] ) && $body['score'] < 0.5 ) {
        return new WP_Error( 'recaptcha_score', 'reCAPTCHA score too low. Please try again.' );
    }

    return true;
}


/* ═══════════════════════════════════════════════════════════════
   7. EMAIL CTA HANDLER  (GET /outsourcing-scorecard/v1/cta)
   Validates HMAC token, sends CTA email, then redirects.
═══════════════════════════════════════════════════════════════ */
function osc_handle_email_cta( WP_REST_Request $request ): never {
    $action  = sanitize_text_field( $request->get_param( 'action'  ) ?? '' );
    $email   = sanitize_email(      $request->get_param( 'email'   ) ?? '' );
    $name    = sanitize_text_field( $request->get_param( 'name'    ) ?? '' );
    $phone   = sanitize_text_field( $request->get_param( 'phone'   ) ?? '' );
    $company = sanitize_text_field( $request->get_param( 'company' ) ?? '' );
    $tier    = sanitize_text_field( $request->get_param( 'tier'    ) ?? '' );
    $token   = sanitize_text_field( $request->get_param( 'token'   ) ?? '' );

    $expected = osc_cta_token( $action, $email, $tier );
    if ( ! hash_equals( $expected, $token ) ) {
        wp_die( 'Invalid or expired link.', 'Error', [ 'response' => 403 ] );
    }

    osc_send_cta_email( $name, $email, $phone, $company, $tier, $action );

    wp_safe_redirect( home_url( '/' . get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' ) . '?cta=sent' ) );
    exit;
}

function osc_cta_token( string $action, string $email, string $tier ): string {
    return hash_hmac( 'sha256', "{$action}|{$email}|{$tier}", wp_salt( 'auth' ) );
}


/* ═══════════════════════════════════════════════════════════════
   8. DATA HELPERS
═══════════════════════════════════════════════════════════════ */
function osc_field_labels(): array {
    return [
        'q1'  => '1. What best describes your role?',
        'q2'  => '2. Company size?',
        'q3'  => '3. Primary industry?',
        'q4'  => '4. Which areas take up most of your time?',
        'q5'  => '5. What is your biggest operational frustration right now?',
        'q6'  => '6. How severe are these challenges?',
        'q7'  => '7. Do you currently have documented processes?',
        'q8'  => '8. Do you use collaboration tools for remote work?',
        'q9'  => '9. Have you outsourced before?',
        'q10' => '10. What is your main concern about outsourcing?',
        'q11' => '11. How comfortable are you with change and risk in operations?',
        'q12' => '12. Do you have budget allocated for outsourcing?',
        'q13' => '13. Timeline for outsourcing?',
        'q14' => '14. What is your primary goal for outsourcing?',
        'q15' => '15. Are you the final decision-maker for outsourcing?',
    ];
}

function osc_q14_label( string $value ): string {
    return [
        'cost'      => 'Cost reduction',
        'scale'     => 'Scalability',
        'focus'     => 'Focus on core business',
        'expertise' => 'Access to expertise',
    ][ $value ] ?? ucwords( str_replace( '_', ' ', $value ) );
}

function osc_split_addresses( string $raw ): array {
    return array_values( array_filter(
        array_map( 'trim', explode( ',', $raw ) ),
        'is_email'
    ) );
}
