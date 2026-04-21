<?php
/**
 * Plugin Name:  Outsourcing Readiness Scorecard
 * Plugin URI:   https://magellan-solutions.com
 * Description:  Multi-step outsourcing readiness quiz with reCAPTCHA v3 + Flamingo.
 *               Works standalone OR as a Magellan Hub project (auto-detected).
 *               Completely overrides the active theme — zero theme CSS interference.
 *               All assets loaded from plugin/dist/ (npm packages bundled — no CDN).
 * Version:      1.1.3
 * Author:       Magellan Solutions
 * License:      GPL-2.0+
 * Text Domain:  outsourcing-scorecard
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'OSC_VERSION',    '1.1.3' );
define( 'OSC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'OSC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'OSC_DIST_URL',   OSC_PLUGIN_URL . 'dist/' );
define( 'OSC_PDF_URL',    OSC_PLUGIN_URL . 'pdf/' );
define( 'OSC_ASSETS_URL', OSC_PLUGIN_URL . 'assets/' );

require_once OSC_PLUGIN_DIR . 'php/quiz-email-builder.php';

/* ═══════════════════════════════════════════════════════════════
   DUAL-MODE DETECTION
═══════════════════════════════════════════════════════════════ */

function osc_running_under_hub(): bool {
    if ( ! function_exists( 'mhub_get_project_by_slug' ) ) return false;
    $slug    = get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' );
    $project = mhub_get_project_by_slug( $slug );
    return ( $project && $project->status === 'active' );
}

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


/* ═══════════════════════════════════════════════════════════════
   1. FULL DOCUMENT OVERRIDE
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
        'osc_quiz_page_slug',
        'osc_recaptcha_site_key',
        'osc_recaptcha_secret_key',
        'osc_admin_to',
        'osc_admin_cc',
    ];
    foreach ( $opts as $opt ) {
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
            <a href="<?php echo esc_url( admin_url( 'admin.php?page=magellan-hub-settings' ) ); ?>">Magellan Hub &rarr; Settings</a>
            when left blank below.
        </p>
    </div>
    <?php
    $site_key_raw   = get_option( 'osc_recaptcha_site_key', '' );
    $secret_key_raw = get_option( 'osc_recaptcha_secret_key', '' );
    if ( $site_key_raw === '' || $secret_key_raw === '' ) : ?>
    <div class="notice notice-warning">
        <p>
            <strong>&#9888; reCAPTCHA keys not set for this site.</strong>
            The plugin is falling back to Magellan Hub&rsquo;s shared keys,
            which are registered for a <em>different domain</em>.
            This will cause <strong>reCAPTCHA score too low</strong> errors.<br>
            <strong>Fix:</strong> Enter the site key and secret key registered for
            <code><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></code>
            in the fields below.
        </p>
    </div>
    <?php endif; ?>
    <?php endif; ?>

    <form method="post" action="options.php">
        <?php settings_fields( 'osc_settings' ); ?>
        <table class="form-table">
            <tr>
                <th>Quiz Page Slug</th>
                <td>
                    <input type="text" name="osc_quiz_page_slug"
                        value="<?php echo esc_attr( get_option( 'osc_quiz_page_slug', 'outsourcing-scorecard' ) ); ?>"
                        class="regular-text">
                </td>
            </tr>
            <tr>
                <th>reCAPTCHA v3 Site Key</th>
                <td>
                    <input type="text" name="osc_recaptcha_site_key"
                        value="<?php echo esc_attr( get_option( 'osc_recaptcha_site_key', '' ) ); ?>"
                        class="regular-text"
                        <?php if ( $under_hub ) echo 'placeholder="Inherited from Magellan Hub if blank"'; ?>>
                    <p class="description">Must be registered for domain: <strong><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></strong></p>
                </td>
            </tr>
            <tr>
                <th>reCAPTCHA v3 Secret Key</th>
                <td>
                    <input type="password" name="osc_recaptcha_secret_key"
                        value="<?php echo esc_attr( get_option( 'osc_recaptcha_secret_key', '' ) ); ?>"
                        class="regular-text"
                        <?php if ( $under_hub ) echo 'placeholder="Inherited from Magellan Hub if blank"'; ?>>
                </td>
            </tr>
            <tr>
                <th>Admin Notification Email(s)</th>
                <td>
                    <input type="text" name="osc_admin_to"
                        value="<?php echo esc_attr( get_option( 'osc_admin_to', '' ) ); ?>"
                        class="large-text"
                        <?php if ( $under_hub ) echo 'placeholder="Inherited from Magellan Hub if blank"'; else echo 'placeholder="sales@company.com, manager@company.com"'; ?>>
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
        </table>
        <?php submit_button(); ?>
    </form>
</div>
<?php }


/* ═══════════════════════════════════════════════════════════════
   3. REST ENDPOINTS
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

    register_rest_route( 'outsourcing-scorecard/v1', '/geo', [
        'methods'             => 'GET',
        'callback'            => 'osc_geo_lookup',
        'permission_callback' => '__return_true',
    ] );

} );


/* ═══════════════════════════════════════════════════════════════
   4. MAIN SUBMISSION HANDLER
═══════════════════════════════════════════════════════════════ */
function osc_handle_submission( WP_REST_Request $request ): WP_REST_Response|WP_Error {

    $data = $request->get_json_params();

    $token = sanitize_text_field( $data['recaptcha_token'] ?? '' );
    $recap = osc_verify_recaptcha( $token );
    if ( is_wp_error( $recap ) ) {
        return new WP_REST_Response( [ 'success' => false, 'message' => $recap->get_error_message() ], 403 );
    }

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

    $is_cta     = ! empty( $data['is_cta'] );
    $cta_action = sanitize_text_field( $answers['cta_action'] ?? '' );

    if ( $is_cta ) {
        $admin_sent = osc_send_cta_email( $fullname, $email, $phone, $company, $tier, $cta_action );
        $user_sent  = false;
    } else {
        $goal_answer = osc_q14_label( sanitize_text_field( $data['goal_answer'] ?? '' ) );

        $admin_sent = osc_send_admin_email( $fullname, $email, $phone, $company, $tier, $score, $answers );

        $user_sent  = osc_send_user_email(
            $fullname, $email, $company, $tier, $tier_body, $goal_line,
            $goal_answer, $insights, $ctas, $pdf_base64, $pdf_filename
        );

        osc_save_to_flamingo( $fullname, $email, $phone, $company, $tier, $tier_body, $score, $answers, $insights );
    }

    return rest_ensure_response( [ 'success' => true, 'admin_sent' => $admin_sent, 'user_sent' => $user_sent ] );
}


/* ═══════════════════════════════════════════════════════════════
   5. FLAMINGO INTEGRATION
═══════════════════════════════════════════════════════════════ */
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

    $channel = 'Outsourcing Scorecard';

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
        osc_save_as_post( $fullname, $email, $phone, $company, $tier, $score, $ordered_fields );
    }

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
   ─────────────────────────────────────────────────────────────
   FIX: magellan-solutions.com was getting "score too low" because:

   a) The reCAPTCHA v3 script loads async/defer. On fast page loads the
      form can be submitted before grecaptcha is fully ready. The JS
      polling loop in recaptcha.js resolves this, but if the script
      hasn't loaded at all (e.g. blocked by a browser extension, strict
      CSP, or slow CDN), the token resolves as an empty string ''.

   b) An empty-string token is caught by the `empty($token)` check below
      and returns the "score too low" error — which is misleading; it
      should say "reCAPTCHA did not load" so the admin knows the cause.

   c) The server-side score threshold (0.5) may be too strict for
      legitimate users on sites with heavy client-side JS (SPAs, page
      builders) that confuse the reCAPTCHA bot-detection heuristics.
      Lowering it to 0.3 provides a safety margin while still blocking
      real bots (which typically score 0.1 or lower).

   d) If the plugin falls back to the Magellan Hub shared reCAPTCHA
      keys, those keys are registered for a different domain, causing
      every token to fail validation. The admin warning in the settings
      page flags this condition clearly.
═══════════════════════════════════════════════════════════════ */
function osc_verify_recaptcha( string $token ): true|WP_Error {
    $secret = osc_get_setting( 'osc_recaptcha_secret_key' );

    // No secret key configured — skip verification entirely (dev / misconfigured).
    if ( empty( $secret ) ) return true;

    // ── Sentinel tokens ──────────────────────────────────────────────────────
    // 'dev-bypass' : injected by dev preview (MagellanConfig.recaptchaSiteKey = '').
    // 'not-loaded' : recaptcha.js fallback when grecaptcha never became available.
    // ''           : recaptcha.js timeout/error path.
    //
    // We distinguish the silent-load-failure ('not-loaded' / '') from the
    // deliberate dev-bypass so the error message is actionable in production.
    if ( $token === 'dev-bypass' ) {
        // Dev preview with no site key — allow through.
        return true;
    }

    if ( empty( $token ) || $token === 'not-loaded' ) {
        // reCAPTCHA script failed to load on the client side.
        // This is the most common cause of the "score too low" symptom on
        // magellan-solutions.com: the script is blocked or times out,
        // recaptcha.js resolves with '' or 'not-loaded', and the server
        // correctly rejects it — but the user message says "score too low"
        // instead of the real cause.
        return new WP_Error(
            'recaptcha_not_loaded',
            'Security check could not complete. Please disable any ad blockers or browser extensions and try again.'
        );
    }

    // ── Remote verification ───────────────────────────────────────────────────
    $res = wp_remote_post( 'https://www.google.com/recaptcha/api/siteverify', [
        'body'    => [ 'secret' => $secret, 'response' => $token ],
        'timeout' => 10,
    ] );

    if ( is_wp_error( $res ) ) {
        // Network failure between the server and Google.  Allow through rather
        // than blocking a legitimate user — the site keeps reCAPTCHA as a
        // soft signal, not a hard gate.
        error_log( '[OSC] reCAPTCHA remote request failed: ' . $res->get_error_message() );
        return true;
    }

    $body = json_decode( wp_remote_retrieve_body( $res ), true );

    if ( empty( $body['success'] ) ) {
        // Google rejected the token (expired, wrong domain, already used, etc.)
        $error_codes = implode( ', ', (array) ( $body['error-codes'] ?? [] ) );
        error_log( '[OSC] reCAPTCHA token invalid. Error codes: ' . $error_codes );
        return new WP_Error( 'recaptcha_invalid', 'Security verification failed. Please refresh and try again.' );
    }

    // ── Score threshold ───────────────────────────────────────────────────────
    // Lowered from 0.5 → 0.3 to accommodate legitimate users on high-JS sites
    // (heavy page builders, third-party scripts, slow connections) where
    // reCAPTCHA's heuristics assign lower-than-average scores to real humans.
    // Real bots consistently score 0.1 or below, so 0.3 still filters them out.
    // If you experience spam at 0.3, raise it back to 0.4 or 0.5.
    $threshold = apply_filters( 'osc_recaptcha_score_threshold', 0.3 );

    if ( isset( $body['score'] ) && (float) $body['score'] < $threshold ) {
        error_log( sprintf(
            '[OSC] reCAPTCHA score too low: %.2f (threshold: %.2f, action: %s, hostname: %s)',
            $body['score'],
            $threshold,
            $body['action']   ?? 'unknown',
            $body['hostname'] ?? 'unknown'
        ) );
        return new WP_Error( 'recaptcha_score', 'reCAPTCHA score too low. Please try again.' );
    }

    return true;
}

/**
 * Server-side geo lookup proxy.
 */
function osc_geo_lookup(): WP_REST_Response {
    $res = wp_remote_get( 'https://ipapi.co/json/', [
        'timeout' => 5,
        'headers' => [ 'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) ],
    ] );
    if ( is_wp_error( $res ) ) {
        return new WP_REST_Response( [ 'country_code' => 'US' ], 200 );
    }
    $body = json_decode( wp_remote_retrieve_body( $res ), true );
    return new WP_REST_Response( [
        'country_code' => strtoupper( $body['country_code'] ?? 'US' ),
    ], 200 );
}


/* ═══════════════════════════════════════════════════════════════
   7. EMAIL CTA HANDLER
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