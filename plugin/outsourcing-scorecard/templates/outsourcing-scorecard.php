<?php
/**
 * templates/page-scorecard.php
 *
 * Dual-mode template:
 *
 *   STANDALONE — Called from osc_maybe_render_page(). Outputs a complete
 *                HTML document: <!DOCTYPE>, <head>, all CSS/JS links, <body>.
 *
 *   HUB MODE   — Included by Magellan Hub's fullpage-wrapper.php, which already
 *                provides <!DOCTYPE html>, <head> with wp_head(), and <body>.
 *                In hub mode we output ONLY the inline config <script> and body
 *                content. CSS is enqueued via mhub_enqueue_project_assets() which
 *                fires before wp_head(). JS is enqueued here for wp_footer().
 *
 * Hub mode is detected by $mhub_current_project being set (by shortcode.php).
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$hub_mode_early = isset( $mhub_current_project );
$dist     = $hub_mode_early ? ( rtrim( $mhub_dist_url, '/' ) . '/' )   : OSC_DIST_URL;
$assets   = $hub_mode_early ? ( rtrim( $mhub_assets_url, '/' ) . '/' ) : OSC_ASSETS_URL;

// osc_get_setting() falls back to Magellan Hub global values when the
// plugin-level option is blank.
$site_key = function_exists( 'osc_get_setting' )
    ? osc_get_setting( 'osc_recaptcha_site_key' )
    : get_option( 'osc_recaptcha_site_key', '' );

$nonce    = wp_create_nonce( 'wp_rest' );
$rest_url = rest_url( 'outsourcing-scorecard/v1/submit' );
$pdf_url  = ( $hub_mode_early ? rtrim( dirname( rtrim( $mhub_dist_url, '/' ) ), '/' ) . '/pdf/readiness-guide.pdf' : OSC_PDF_URL . 'readiness-guide.pdf' );

// Hub mode: this template is included inside fullpage-wrapper.php
$hub_mode = $hub_mode_early;

/* ── STANDALONE ONLY: open full HTML document ──────────── */
if ( ! $hub_mode ) : ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Outsourcing Readiness Scorecard &mdash; <?php bloginfo( 'name' ); ?></title>
    <meta name="robots" content="noindex">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?php echo esc_url( $dist . 'css/vendor/bootstrap.min.css' ); ?>">
    <link rel="stylesheet" href="<?php echo esc_url( $dist . 'css/vendor/bootstrap-icons.min.css' ); ?>">
    <link rel="stylesheet" href="<?php echo esc_url( $dist . 'css/vendor/intlTelInput.css' ); ?>">
    <link rel="stylesheet" href="<?php echo esc_url( $dist . 'css/scorecard.css' ); ?>?v=<?php echo OSC_VERSION; ?>">
<?php endif; ?>

    <!-- JS runtime config — output in both modes -->
    <script>
    window.MagellanConfig = {
        restUrl:          <?php echo wp_json_encode( $rest_url ); ?>,
        nonce:            <?php echo wp_json_encode( $nonce ); ?>,
        recaptchaSiteKey: <?php echo wp_json_encode( $site_key ); ?>,
        readinessPdfUrl:  <?php echo wp_json_encode( $pdf_url ); ?>,
        wpHomeUrl:        <?php echo wp_json_encode( home_url( '/' ) ); ?>,
        itiUtilsUrl:      <?php echo wp_json_encode( $dist . 'js/vendor/utils.js' ); ?>,
        pdfWorkerUrl:     <?php echo wp_json_encode( $dist . 'js/pdf-worker.js' ); ?>,
        jsPDFUrl:         <?php echo wp_json_encode( $dist . 'js/vendor/jspdf.umd.min.js' ); ?>
    };
    </script>
    <?php if ( $site_key ) : ?>
    <script src="https://www.google.com/recaptcha/api.js?render=<?php echo esc_attr( $site_key ); ?>" async defer></script>
    <?php endif; ?>

<?php if ( ! $hub_mode ) : ?>
</head>
<body>
<?php endif; ?>

    <!-- ── LANDING PAGE ──────────────────────────────────────── -->
    <div id="landing" class="d-flex flex-column min-vh-100"
        style="background-image:url('<?php echo esc_url( $assets . 'background.webp' ); ?>');">

        <nav class="landing-nav d-flex align-items-center justify-content-between px-4 px-lg-5 py-4 position-relative" style="z-index:2">
            <span class="nav-logo">
                <img src="<?php echo esc_url( $assets . 'logo.webp' ); ?>" alt="Magellan Solutions Logo" width="300">
            </span>
            <ul class="nav-social d-flex gap-4 list-unstyled mb-0">
                <li><a href="https://www.facebook.com/magellanbpo"       target="_blank" rel="noopener" aria-label="Facebook"><i class="bi bi-facebook"></i></a></li>
                <li><a href="https://www.linkedin.com/company/455507/"    target="_blank" rel="noopener" aria-label="LinkedIn"><i class="bi bi-linkedin"></i></a></li>
                <li><a href="https://www.tiktok.com/@magellanbpo?lang=en" target="_blank" rel="noopener" aria-label="TikTok"><i class="bi bi-tiktok"></i></a></li>
                <li><a href="https://www.youtube.com/@magellanbpo"        target="_blank" rel="noopener" aria-label="YouTube"><i class="bi bi-youtube"></i></a></li>
            </ul>
        </nav>

        <div class="landing-grid flex-grow-1 row align-items-center g-0 px-4 px-lg-5 pb-5 position-relative mx-auto w-100" style="z-index:2;max-width:1280px">
            <div class="landing-left col-12 col-lg-6 pe-lg-5 fade-up">
                <h1 class="landing-headline">
                    Is Your Business<br>
                    <span class="headline-accent">Ready to Outsource?</span>
                </h1>
                <p class="landing-sub">
                    Outsourcing isn't the right fit for every organization. This concise 3&#8209;minute
                    assessment helps leaders determine whether outsourcing will enhance operational
                    efficiency or create unnecessary complexity.
                </p>
                <button id="start-btn" class="cta-btn d-inline-flex align-items-center gap-2">
                    Start Your Free Assessment
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
            </div>
            <div class="landing-right col-lg-6 d-none d-lg-flex justify-content-center align-items-center fade-up-delay">
                <div class="image-frame position-relative w-100">
                    <div class="image-decoration position-absolute"></div>
                    <img src="<?php echo esc_url( $assets . 'outsourcing.webp' ); ?>"
                        alt="Professional team collaborating"
                        class="hero-image position-relative d-block w-100">
                </div>
            </div>
        </div>

        <div id="quizWrapper" class="d-none flex-grow-1 d-flex align-items-center">
            <button type="button" id="prevBtn" class="quiz-arrow quiz-arrow--prev" aria-label="Previous">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div class="quiz-body container py-5">
                <form id="quizForm" novalidate>
                    <div id="clusterContainer"></div>
                    <div class="d-flex justify-content-center mt-4">
                        <button type="submit" id="submitBtn" class="cta-btn d-none d-inline-flex align-items-center gap-2">
                            Check Readiness
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </form>
                <div class="quiz-bottom-nav mt-4 d-flex align-items-center justify-content-center gap-3">
                    <button type="button" id="prevBtnMobile" class="quiz-arrow quiz-arrow--inline" aria-label="Previous">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button id="back-btn" class="quiz-back-link d-inline-flex align-items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                        Back to Home
                    </button>
                    <button type="button" id="nextBtnMobile" class="quiz-arrow quiz-arrow--inline" aria-label="Next">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
            <button type="button" id="nextBtn" class="quiz-arrow quiz-arrow--next" aria-label="Next">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
        </div>

        <div class="trust-bar d-flex align-items-center justify-content-center gap-3 px-4 px-lg-5 py-3 border-top position-relative">
            <span>Magellan Solutions Outsourcing Readiness Assessment</span>
            <div class="trust-divider"></div>
            <span class="text-center">Copyright &copy; <?php echo gmdate( 'Y' ); ?></span>
        </div>

    </div><!-- /#landing -->

    <div id="overlay" class="d-none"></div>
    <div id="popup" class="d-none">
        <button id="closePopup" type="button" class="float-end border-0 bg-transparent fs-4 lh-1">&times;</button>
        <div id="wrapper" class="d-flex justify-content-center align-items-center flex-fill">
            <div id="popupContent"></div>
        </div>
    </div>

<?php if ( ! $hub_mode ) : ?>
    <!-- Standalone: vendor JS loaded directly (wp_footer not available) -->
    <script src="<?php echo esc_url( $dist . 'js/vendor/jquery.min.js' ); ?>"></script>
    <script src="<?php echo esc_url( $dist . 'js/vendor/bootstrap.bundle.min.js' ); ?>"></script>
    <script src="<?php echo esc_url( $dist . 'js/vendor/intlTelInput.min.js' ); ?>"></script>
    <script src="<?php echo esc_url( $dist . 'js/scorecard.js' ); ?>?v=<?php echo OSC_VERSION; ?>"></script>
</body>
</html>
<?php else :
    /*
     * Hub mode: CSS is already enqueued by mhub_enqueue_project_assets() which fires
     * before wp_head() in fullpage-wrapper.php. Enqueue JS here so it lands in
     * wp_footer() — this is the correct WordPress way (no duplicate script tags).
     */
    $pfx = 'osc-vendor';
    wp_enqueue_script( $pfx . '-jquery',    $dist . 'js/vendor/jquery.min.js',           [], defined('OSC_VERSION') ? OSC_VERSION : MHUB_VERSION, true );
    wp_enqueue_script( $pfx . '-bootstrap', $dist . 'js/vendor/bootstrap.bundle.min.js', [ $pfx . '-jquery' ], defined('OSC_VERSION') ? OSC_VERSION : MHUB_VERSION, true );
    wp_enqueue_script( $pfx . '-iti',       $dist . 'js/vendor/intlTelInput.min.js',     [ $pfx . '-jquery' ], defined('OSC_VERSION') ? OSC_VERSION : MHUB_VERSION, true );
    wp_enqueue_script( 'osc-main',          $dist . 'js/scorecard.js',                   [ $pfx . '-jquery', $pfx . '-bootstrap', $pfx . '-iti' ], defined('OSC_VERSION') ? OSC_VERSION : MHUB_VERSION, true );
endif; ?>
