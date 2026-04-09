<?php
/**
 * php/quiz-email-builder.php
 * Builds all HTML email bodies and dispatches wp_mail() calls.
 * Required by outsourcing-scorecard.php via require_once.
 *
 * Public functions (called from outsourcing-scorecard.php):
 *   osc_send_admin_email(...)  → bool
 *   osc_send_user_email(...)   → bool   (personalised PDF attached)
 *   osc_send_cta_email(...)    → bool
 *
 * Email design:
 *   - Dark navy card (#0f1f3d) matching the quiz UI colour palette
 *   - Outlook-safe: VML gradient header, no rgba(), inline styles only
 *   - All quotes use html entities — no curly quotes in PHP strings
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* ─────────────────────────────────────────────────────────────
   SHARED: wp_mail() headers builder
───────────────────────────────────────────────────────────── */
function osc_build_headers( string $reply_to = '', string $cc = '', string $bcc = '' ): array {
    $h = [ 'Content-Type: text/html; charset=UTF-8' ];
    if ( $reply_to && is_email( $reply_to ) ) {
        $h[] = 'Reply-To: ' . $reply_to;
    }
    foreach ( osc_split_addresses( $cc ) as $addr ) {
        $h[] = 'Cc: ' . $addr;
    }
    foreach ( osc_split_addresses( $bcc ) as $addr ) {
        $h[] = 'Bcc: ' . $addr;
    }
    return $h;
}

/* ─────────────────────────────────────────────────────────────
   SHARED: full HTML document wrapper
   Dark navy card, max-width 620px, Outlook-compatible table layout.
───────────────────────────────────────────────────────────── */
function osc_email_shell( string $rows ): string {
    return '<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:AllowPNG/>
  <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;
             font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;
             -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#f4f6fb;">
  <tr>
    <td align="center" style="padding-top:40px;padding-bottom:40px;
                               padding-left:16px;padding-right:16px;">
      <!--[if mso]>
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0">
      <tr><td>
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:620px;width:100%;background-color:#0f1f3d;
                    border-radius:16px;overflow:hidden;">
        ' . $rows . '
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body></html>';
}

/* ─────────────────────────────────────────────────────────────
   SHARED: branded header row
   VML gradient for Outlook, CSS gradient for everyone else.
───────────────────────────────────────────────────────────── */
function osc_email_header( string $title, string $subtitle ): string {
    return '
<tr>
  <td style="padding:0;border-bottom-width:3px;border-bottom-style:solid;
             border-bottom-color:#54c8ef;border-radius:16px 16px 0 0;">
    <!--[if mso]>
    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
            style="width:620px;height:110px;">
      <v:fill type="gradient" color="#0f1f3d" color2="#1a3260"
              angle="135" focus="100%"/>
      <v:textbox inset="0,0,0,0">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding-top:36px;padding-bottom:26px;
                     padding-left:40px;padding-right:40px;">
    <![endif]-->
    <div style="background:linear-gradient(135deg,#0f1f3d 0%,#1a3260 100%);
                padding-top:36px;padding-bottom:26px;
                padding-left:40px;padding-right:40px;">
      <h1 style="margin:0;margin-bottom:6px;font-size:22px;font-weight:800;
                 color:#ffffff;font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;
                 letter-spacing:-0.03em;line-height:1.2;">'
            . esc_html( $title ) . '</h1>
      <p style="margin:0;font-size:13px;color:#7aadcc;line-height:1.5;
                font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
            . esc_html( $subtitle ) . '</p>
    </div>
    <!--[if mso]></td></tr></table></v:textbox></v:rect><![endif]-->
  </td>
</tr>';
}

/* ─────────────────────────────────────────────────────────────
   SHARED: footer row
───────────────────────────────────────────────────────────── */
function osc_email_footer( string $note = '' ): string {
    $note_html = $note
        ? '<p style="margin:0 0 14px;font-size:11px;color:#5a7a99;line-height:1.7;
                     font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
            . $note . '</p>'
        : '';

    return '
<tr>
  <td style="padding-top:24px;padding-bottom:32px;padding-left:40px;padding-right:40px;
             border-top-width:1px;border-top-style:solid;border-top-color:#1a2e4a;">
    ' . $note_html . '
    <p style="margin:0;font-size:11px;color:#3a5070;line-height:1.7;
               font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">
      &copy; ' . gmdate('Y') . ' Magellan Solutions &nbsp;|&nbsp;
      <a href="https://www.magellan-solutions.com"
         style="color:#54c8ef;text-decoration:none;">www.magellan-solutions.com</a>
    </p>
  </td>
</tr>';
}

/* ─────────────────────────────────────────────────────────────
   SHARED: contact detail table
   Alternating row backgrounds — used in admin + CTA emails.
───────────────────────────────────────────────────────────── */
function osc_email_contact_card(
    string $fullname,
    string $email,
    string $phone,
    string $company,
    string $extra_rows_html = ''
): string {
    $rows_data = [
        [ 'Name',    esc_html( $fullname ) ],
        [ 'Company', esc_html( $company  ) ],
        [ 'Email',   esc_html( $email    ) ],
        [ 'Phone',   esc_html( $phone    ) ],
    ];

    $html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="border-collapse:collapse;font-size:13px;
                           font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">';

    foreach ( $rows_data as $i => $row ) {
        $bg = ( $i % 2 === 0 ) ? '#162848' : '#1a3060';
        $html .= '
        <tr style="background:' . $bg . ';">
          <td style="padding-top:11px;padding-bottom:11px;padding-left:16px;padding-right:16px;
                     border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:#1e3558;
                     font-weight:700;width:130px;color:#54c8ef;font-size:12px;
                     letter-spacing:0.04em;text-transform:uppercase;">'
                . esc_html( $row[0] ) . '
          </td>
          <td style="padding-top:11px;padding-bottom:11px;padding-left:16px;padding-right:16px;
                     border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:#1e3558;
                     color:#d9e8f5;">'
                . $row[1] . '
          </td>
        </tr>';
    }

    if ( $extra_rows_html ) {
        $html .= $extra_rows_html;
    }

    $html .= '</table>';
    return $html;
}


/* ═══════════════════════════════════════════════════════════════
   EMAIL 1 — ADMIN FULL-ANSWERS NOTIFICATION
   Sent to osc_admin_to on every full quiz submission.
   Contains: contact card, tier + score badge, all 15 quiz answers.
═══════════════════════════════════════════════════════════════ */
function osc_send_admin_email(
    string $fullname,
    string $email,
    string $phone,
    string $company,
    string $tier,
    int    $score,
    array  $answers
): bool {

    $admin_to = osc_split_addresses( get_option( 'osc_admin_to', get_option( 'admin_email' ) ) );
    if ( empty( $admin_to ) ) return false;

    $subject = sprintf( '[Magellan Scorecard] New Lead: %s &#8212; %s', $fullname, $company );

    // Build quiz-answer rows
    $labels      = osc_field_labels();
    $answer_rows = '';
    $row_idx     = 0;
    foreach ( $labels as $key => $label ) {
        if ( ! array_key_exists( $key, $answers ) ) continue;
        $val = is_array( $answers[ $key ] ) ? implode( ', ', $answers[ $key ] ) : (string) $answers[ $key ];
        $bg  = ( $row_idx % 2 === 0 ) ? '#162848' : '#1a3060';
        $answer_rows .= '
        <tr style="background:' . $bg . ';">
          <td style="padding-top:9px;padding-bottom:9px;padding-left:16px;padding-right:16px;
                     border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:#1e3558;
                     font-size:12px;color:#7aadcc;width:260px;
                     font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
                . esc_html( $label ) . '
          </td>
          <td style="padding-top:9px;padding-bottom:9px;padding-left:16px;padding-right:16px;
                     border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:#1e3558;
                     font-size:13px;color:#d9e8f5;
                     font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
                . esc_html( $val ) . '
          </td>
        </tr>';
        $row_idx++;
    }

    $rows =
        osc_email_header(
            'Magellan Solutions: Outsourcing Scorecard',
            'New Submission &#8212; Admin Notification'
        ) . '

        <!-- CONTACT CARD -->
        <tr>
          <td style="padding-top:28px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:12px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Contact Details</p>
            ' . osc_email_contact_card( $fullname, $email, $phone, $company ) . '
          </td>
        </tr>

        <!-- SCORE + TIER -->
        <tr>
          <td style="padding-top:20px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#132030;border-width:1px;border-style:solid;
                          border-color:#1e4060;border-radius:10px;">
              <tr>
                <td style="padding-top:18px;padding-bottom:18px;
                           padding-left:22px;padding-right:22px;">
                  <p style="margin:0;margin-bottom:6px;font-size:11px;font-weight:700;
                             letter-spacing:0.1em;text-transform:uppercase;color:#54c8ef;
                             font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Result</p>
                  <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;
                             font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
                        . esc_html( $tier ) . '
                  </p>
                  <p style="margin:8px 0 0;font-size:13px;color:#7aadcc;
                             font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">
                    Score: <strong style="color:#54c8ef;">' . intval( $score ) . ' / 16</strong>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- QUIZ ANSWERS -->
        <tr>
          <td style="padding-top:20px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:12px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Quiz Answers</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="border-collapse:collapse;">
              ' . $answer_rows . '
            </table>
          </td>
        </tr>' .

        osc_email_footer();

    $headers = osc_build_headers(
        get_option( 'osc_admin_reply_to', $email ),
        get_option( 'osc_admin_cc', '' )
    );

    return wp_mail( $admin_to, $subject, osc_email_shell( $rows ), $headers );
}


/* ═══════════════════════════════════════════════════════════════
   EMAIL 2 — USER RESULTS EMAIL  (personalised PDF attached)
   Sent to the quiz submitter. Admin also receives a copy.
   Contains: tier result, key insights, goal statement, CTA buttons.
═══════════════════════════════════════════════════════════════ */
function osc_send_user_email(
    string $fullname,
    string $email,
    string $company,
    string $tier,
    string $tier_body,
    string $goal_line,
    string $goal_answer,
    array  $insights,
    array  $ctas         = [],
    string $pdf_base64   = '',
    string $pdf_filename = 'Magellan-Readiness-Results.pdf'
): bool {

    $subject = 'Your Outsourcing Readiness Results &#8212; Magellan Solutions';

    // ── Key Insights section ──────────────────────────────────
    $insights_html = '';
    foreach ( $insights as $msg ) {
        $insights_html .= '<li style="margin-bottom:8px;font-size:13px;color:#d9e8f5;'
            . 'line-height:1.65;font-family:Arial,Helvetica,sans-serif;">'
            . esc_html( $msg ) . '</li>';
    }
    $insights_section = $insights_html ? '
        <tr>
          <td style="padding-top:24px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:12px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Your Key Insights</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#162848;border-radius:10px;">
              <tr><td style="padding-top:18px;padding-bottom:18px;
                             padding-left:24px;padding-right:24px;">
                <ul style="margin:0;padding-left:20px;">' . $insights_html . '</ul>
              </td></tr>
            </table>
          </td>
        </tr>' : '';

    // ── Goal section ──────────────────────────────────────────
    $goal_display = $goal_answer
        ? 'Since your primary goal is <strong style="color:#54c8ef;">'
            . esc_html( $goal_answer ) . '</strong>, ' . esc_html( $goal_line )
        : esc_html( $goal_line );

    $goal_section = $goal_line ? '
        <tr>
          <td style="padding-top:24px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:12px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Your Goal</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#162848;border-radius:10px;">
              <tr><td style="padding-top:16px;padding-bottom:16px;
                             padding-left:20px;padding-right:20px;">
                <p style="margin:0;font-size:13px;color:#d9e8f5;line-height:1.7;
                          font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
                        . $goal_display . '
                </p>
              </td></tr>
            </table>
          </td>
        </tr>' : '';

    // ── Decision-maker note ───────────────────────────────────
    $note_section = '
        <tr>
          <td style="padding-top:16px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#111d35;border-left-width:3px;border-left-style:solid;
                          border-left-color:#54c8ef;border-radius:0 6px 6px 0;">
              <tr><td style="padding-top:14px;padding-bottom:14px;
                             padding-left:18px;padding-right:18px;">
                <p style="margin:0;font-size:12px;color:#7aadcc;line-height:1.7;
                          font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">
                  <strong style="color:#54c8ef;">Note:</strong>
                  If you are not the sole decision-maker, you may need buy-in
                  from other stakeholders before proceeding with outsourcing.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>';

    // ── CTA buttons ───────────────────────────────────────────
    $cta_section = '';
    if ( ! empty( $ctas ) ) {
        $btn_html = '';
        foreach ( $ctas as $cta ) {
            $lbl = esc_html( $cta['label']  ?? '' );
            $act = sanitize_text_field( $cta['action'] ?? '' );
            if ( ! $lbl || ! $act ) continue;

            $primary   = ( $act === 'schedule' );
            $btn_bg    = $primary ? '#54c8ef' : 'transparent';
            $btn_color = $primary ? '#0f1f3d' : '#54c8ef';

            $token = osc_cta_token( $act, $email, $tier );
            $href  = rest_url( 'outsourcing-scorecard/v1/cta' ) . '?' . http_build_query( [
                'action'  => $act,
                'email'   => $email,
                'name'    => $fullname,
                'phone'   => '',
                'company' => $company,
                'tier'    => $tier,
                'token'   => $token,
            ] );

            $btn_html .= "
              <td align='center' style='padding-left:6px;padding-right:6px;padding-bottom:8px;'>
                <!--[if mso]>
                <v:roundrect xmlns:v='urn:schemas-microsoft-com:vml' href='{$href}'
                  style='height:44px;v-text-anchor:middle;width:220px;' arcsize='20%'
                  stroke='true' strokecolor='#54c8ef' fillcolor='{$btn_bg}'>
                  <w:anchorlock/>
                  <center style='color:{$btn_color};font-family:Arial,sans-serif;
                                  font-size:13px;font-weight:700;'>{$lbl}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href='{$href}'
                   style='background-color:{$btn_bg};border-width:2px;border-style:solid;
                          border-color:#54c8ef;border-radius:8px;color:{$btn_color};
                          display:inline-block;font-family:Arial,Helvetica,sans-serif;
                          font-size:13px;font-weight:700;padding-top:12px;padding-bottom:12px;
                          padding-left:24px;padding-right:24px;text-decoration:none;
                          -webkit-text-size-adjust:none;mso-hide:all;'>{$lbl}</a>
                <!--<![endif]-->
              </td>";
        }

        if ( $btn_html ) {
            $cta_section = '
        <tr>
          <td style="padding-top:28px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:16px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Next Steps</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr style="vertical-align:top;">' . $btn_html . '</tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>';
        }
    }

    // ── Assemble full body ────────────────────────────────────
    $rows =
        osc_email_header(
            'Magellan Solutions: Outsourcing Scorecard',
            esc_html( $company ) . ' &#8212; Outsourcing Readiness Results'
        ) . '

        <!-- INTRO -->
        <tr>
          <td style="padding-top:30px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#132030;border-width:1px;border-style:solid;
                          border-color:#1e4060;border-radius:10px;">
              <tr><td style="padding-top:20px;padding-bottom:20px;
                             padding-left:24px;padding-right:24px;">
                <p style="margin:0;font-size:14px;color:#d9e8f5;line-height:1.75;
                           font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">
                  Thank you for completing the
                  <strong style="color:#54c8ef;">Outsourcing Readiness Assessment</strong>,
                  ' . esc_html( $fullname ) . '.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- YOUR RESULT -->
        <tr>
          <td style="padding-top:24px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:12px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Your Result</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#162848;border-radius:10px;">
              <tr><td style="padding-top:20px;padding-bottom:20px;
                             padding-left:24px;padding-right:24px;">
                <p style="margin:0;margin-bottom:10px;font-size:18px;font-weight:800;
                           color:#ffffff;letter-spacing:-0.02em;
                           font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
                        . esc_html( $tier ) . '
                </p>
                <p style="margin:0;font-size:13px;color:#d9e8f5;line-height:1.7;
                           font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">'
                        . esc_html( $tier_body ) . '
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        ' . $insights_section . '
        ' . $goal_section . '
        ' . $note_section . '
        ' . $cta_section .

        osc_email_footer(
            'You are receiving this because you completed the Outsourcing Readiness Assessment.<br>
             If you did not submit this form, please ignore this email.'
        );

    $body = osc_email_shell( $rows );

    // ── Write PDF to temp file for attachment ─────────────────
    $attachments = [];
    if ( ! empty( $pdf_base64 ) ) {
        $tmp  = get_temp_dir() . sanitize_file_name( $pdf_filename );
        $data = base64_decode( $pdf_base64, true );
        if ( $data !== false && file_put_contents( $tmp, $data ) !== false ) {
            $attachments[] = $tmp;
        }
    }

    // ── Send to submitter ─────────────────────────────────────
    $user_headers = osc_build_headers( $email, get_option( 'osc_user_cc', '' ) );
    $user_sent    = wp_mail( $email, $subject, $body, $user_headers, $attachments );

    // ── Send copy to each admin (same email — admin sees what user sees) ─────
    $admin_list = osc_split_addresses( get_option( 'osc_admin_to', get_option( 'admin_email' ) ) );
    $admin_copy = array_values( array_filter(
        $admin_list,
        fn( $addr ) => strtolower( trim( $addr ) ) !== strtolower( trim( $email ) )
    ) );

    if ( ! empty( $admin_copy ) ) {
        $admin_headers = osc_build_headers( $email, get_option( 'osc_admin_cc', '' ) );
        wp_mail( $admin_copy, '[Copy] ' . $subject, $body, $admin_headers, $attachments );
    }

    // ── Cleanup temp PDF ──────────────────────────────────────
    if ( ! empty( $attachments[0] ) && file_exists( $attachments[0] ) ) {
        wp_delete_file( $attachments[0] );
    }

    return $user_sent;
}


/* ═══════════════════════════════════════════════════════════════
   EMAIL 3 — CTA CONTACT EMAIL  (admin only)
   Triggered by popup CTA buttons (schedule / consult)
   or by the email CTA link click handler.
   Contains: contact card, tier badge, which CTA was clicked.
   Subjects:
     schedule → "Request for a Discovery Call"
     consult  → "Consultation Request &#8212; <tier>"
═══════════════════════════════════════════════════════════════ */
function osc_send_cta_email(
    string $fullname,
    string $email,
    string $phone,
    string $company,
    string $tier,
    string $action
): bool {

    $admin_to = osc_split_addresses( get_option( 'osc_admin_to', get_option( 'admin_email' ) ) );
    if ( empty( $admin_to ) ) return false;

    $subject = ( $action === 'schedule' )
        ? '[Magellan Scorecard] Request for a Discovery Call'
        : '[Magellan Scorecard] Consultation Request &#8212; ' . $tier;

    $action_label = ( $action === 'schedule' )
        ? 'Discovery Call Request'
        : 'Consultation Request';

    $cta_btn_label = ( $action === 'schedule' )
        ? 'Request your Strategy Call'
        : 'Book a Consultation';

    $rows =
        osc_email_header( 'Magellan Solutions: Outsourcing Scorecard', $action_label ) . '

        <!-- CONTEXT -->
        <tr>
          <td style="padding-top:28px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#132030;border-width:1px;border-style:solid;
                          border-color:#1e4060;border-radius:10px;">
              <tr><td style="padding-top:18px;padding-bottom:18px;
                             padding-left:22px;padding-right:22px;">
                <p style="margin:0;font-size:13px;color:#d9e8f5;line-height:1.7;
                           font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">
                  A visitor clicked
                  <strong style="color:#54c8ef;">'
                        . esc_html( $cta_btn_label )
                        . '</strong> after completing the Readiness Assessment.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- TIER BADGE -->
        <tr>
          <td style="padding-top:16px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#162848;border-radius:8px;">
              <tr><td style="padding-top:12px;padding-bottom:12px;
                             padding-left:20px;padding-right:20px;">
                <p style="margin:0;font-size:12px;color:#7aadcc;
                          font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">
                  Result Tier:
                  <strong style="color:#54c8ef;">' . esc_html( $tier ) . '</strong>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- CONTACT CARD -->
        <tr>
          <td style="padding-top:20px;padding-left:40px;padding-right:40px;padding-bottom:0;">
            <p style="margin:0;margin-bottom:12px;font-size:10px;font-weight:700;
                      letter-spacing:0.12em;text-transform:uppercase;color:#54c8ef;
                      font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">Contact Details</p>
            ' . osc_email_contact_card( $fullname, $email, $phone, $company ) . '
          </td>
        </tr>' .

        osc_email_footer( 'Please follow up within 1 business day.' );

    $headers = osc_build_headers( $email, get_option( 'osc_admin_cc', '' ) );

    return wp_mail( $admin_to, $subject, osc_email_shell( $rows ), $headers );
}
