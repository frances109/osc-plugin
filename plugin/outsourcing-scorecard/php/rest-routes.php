<?php
/**
 * php/rest-routes.php  —  Outsourcing Readiness Scorecard
 *
 * Self-contained REST API layer. Works in two modes:
 *
 *   STANDALONE  — loaded by outsourcing-scorecard.php via require_once.
 *                 Standalone plugin loads: shared-config.php → quiz-email-builder.php
 *                 → this file, in that order.
 *
 *   HUB MODE    — loaded by Magellan Hub's mhub_load_php_dir_ordered() on
 *                 rest_api_init (priority 5), before routes register at priority 10.
 *                 Hub loader respects the same dependency order automatically.
 *
 * Duplicate registration guard:
 *   - define('OSC_ROUTES_REGISTERED') prevents add_action() being queued twice
 *     if both standalone plugin and hub loader call require_once on this file.
 *   - Every function is wrapped with function_exists() — the first-loaded
 *     version wins silently; the second load defines nothing new.
 *   - require_once itself is PHP's own idempotency guarantee.
 *
 * Dependencies (must be loaded before this file):
 *   - php/shared-config.php        (osc_get_setting, osc_running_under_hub)
 *   - php/quiz-email-builder.php   (osc_send_admin_email, osc_send_user_email,
 *                                   osc_send_cta_email)
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// Ensure shared config is available regardless of load order.
require_once __DIR__ . '/shared-config.php';

/* ═══════════════════════════════════════════════════════════════
   ROUTE REGISTRATION
   Guard: define() prevents add_action() being queued more than once
   even if this file is somehow loaded from two different call sites.
═══════════════════════════════════════════════════════════════ */
if ( ! defined( 'OSC_ROUTES_REGISTERED' ) ) {
    define( 'OSC_ROUTES_REGISTERED', true );

    add_action( 'rest_api_init', 'osc_register_rest_routes' );
}

function osc_register_rest_routes(): void {
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
}

/* ═══════════════════════════════════════════════════════════════
   SUBMISSION HANDLER
═══════════════════════════════════════════════════════════════ */
if ( ! function_exists( 'osc_handle_submission' ) ) :

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
    $ctas         = is_array( $data['ctas'] ?? null ) ? $data['ctas'] : [];
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
        $admin_sent  = osc_send_admin_email( $fullname, $email, $phone, $company, $tier, $score, $answers );
        $user_sent   = osc_send_user_email(
            $fullname, $email, $company, $tier, $tier_body, $goal_line,
            $goal_answer, $insights, $ctas, $pdf_base64, $pdf_filename
        );
        osc_save_to_flamingo( $fullname, $email, $phone, $company, $tier, $tier_body, $score, $answers, $insights );
    }

    return rest_ensure_response( [ 'success' => true, 'admin_sent' => $admin_sent, 'user_sent' => $user_sent ] );
}

endif;

/* ═══════════════════════════════════════════════════════════════
   EMAIL CTA HANDLER
═══════════════════════════════════════════════════════════════ */
if ( ! function_exists( 'osc_handle_email_cta' ) ) :

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

endif;

/* ═══════════════════════════════════════════════════════════════
   GEO LOOKUP
═══════════════════════════════════════════════════════════════ */
if ( ! function_exists( 'osc_geo_lookup' ) ) :

function osc_geo_lookup(): WP_REST_Response {
    $res = wp_remote_get( 'https://ipapi.co/json/', [
        'timeout' => 5,
        'headers' => [ 'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) ],
    ] );
    if ( is_wp_error( $res ) ) {
        return new WP_REST_Response( [ 'country_code' => 'US' ], 200 );
    }
    $body = json_decode( wp_remote_retrieve_body( $res ), true );
    return new WP_REST_Response( [ 'country_code' => strtoupper( $body['country_code'] ?? 'US' ) ], 200 );
}

endif;

/* ═══════════════════════════════════════════════════════════════
   RECAPTCHA v3
═══════════════════════════════════════════════════════════════ */
if ( ! function_exists( 'osc_verify_recaptcha' ) ) :

function osc_verify_recaptcha( string $token ): true|WP_Error {
    $secret = osc_get_setting( 'osc_recaptcha_secret_key' );

    // No secret configured — skip verification (dev / unconfigured).
    if ( empty( $secret ) ) return true;

    // Dev preview sentinel — always allow.
    if ( $token === 'dev-bypass' ) return true;

    // Script failed to load on the client (blocked by ad blocker, CSP, timeout).
    if ( empty( $token ) || $token === 'not-loaded' ) {
        return new WP_Error(
            'recaptcha_not_loaded',
            'Security check could not complete. Please disable any ad blockers or browser extensions and try again.'
        );
    }

    $res = wp_remote_post( 'https://www.google.com/recaptcha/api/siteverify', [
        'body'    => [ 'secret' => $secret, 'response' => $token ],
        'timeout' => 10,
    ] );

    // Network failure — allow through rather than blocking legitimate users.
    if ( is_wp_error( $res ) ) {
        error_log( '[OSC] reCAPTCHA remote request failed: ' . $res->get_error_message() );
        return true;
    }

    $body = json_decode( wp_remote_retrieve_body( $res ), true );

    if ( empty( $body['success'] ) ) {
        error_log( '[OSC] reCAPTCHA token invalid. Error codes: ' . implode( ', ', (array) ( $body['error-codes'] ?? [] ) ) );
        return new WP_Error( 'recaptcha_invalid', 'Security verification failed. Please refresh and try again.' );
    }

    // Score threshold: 0.3 accommodates legitimate users on high-JS sites
    // while still blocking real bots (consistently 0.1 or below).
    // Raise to 0.4–0.5 if you experience spam.
    $threshold = apply_filters( 'osc_recaptcha_score_threshold', 0.3 );

    if ( isset( $body['score'] ) && (float) $body['score'] < $threshold ) {
        error_log( sprintf(
            '[OSC] reCAPTCHA score too low: %.2f (threshold: %.2f, action: %s, hostname: %s)',
            $body['score'], $threshold,
            $body['action'] ?? 'unknown', $body['hostname'] ?? 'unknown'
        ) );
        return new WP_Error( 'recaptcha_score', 'reCAPTCHA score too low. Please try again.' );
    }

    return true;
}

endif;

/* ═══════════════════════════════════════════════════════════════
   FLAMINGO
═══════════════════════════════════════════════════════════════ */
if ( ! function_exists( 'osc_save_to_flamingo' ) ) :

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
    $labels  = osc_field_labels();
    $skip    = [ 'fullname', 'email', 'phone', 'company', 'score', 'tier' ];

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

endif;

if ( ! function_exists( 'osc_save_as_post' ) ) :

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

endif;

/* ═══════════════════════════════════════════════════════════════
   DATA HELPERS
═══════════════════════════════════════════════════════════════ */
if ( ! function_exists( 'osc_field_labels' ) ) :

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

endif;

if ( ! function_exists( 'osc_q14_label' ) ) :

function osc_q14_label( string $value ): string {
    return [
        'cost'      => 'Cost reduction',
        'scale'     => 'Scalability',
        'focus'     => 'Focus on core business',
        'expertise' => 'Access to expertise',
    ][ $value ] ?? ucwords( str_replace( '_', ' ', $value ) );
}

endif;

if ( ! function_exists( 'osc_split_addresses' ) ) :

function osc_split_addresses( string $raw ): array {
    return array_values( array_filter(
        array_map( 'trim', explode( ',', $raw ) ),
        'is_email'
    ) );
}

endif;

if ( ! function_exists( 'osc_cta_token' ) ) :

function osc_cta_token( string $action, string $email, string $tier ): string {
    return hash_hmac( 'sha256', "{$action}|{$email}|{$tier}", wp_salt( 'auth' ) );
}

endif;
