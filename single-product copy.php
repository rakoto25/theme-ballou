<?php if (!defined('ABSPATH')) exit;
get_header(); ?>
<div class="container">
    <?php woocommerce_breadcrumb(); ?>
    <div class="product-layout">
        <div class="product-media" data-island="gallery"></div>
        <div class="product-summary">
            <?php woocommerce_template_single_title(); ?>
            <?php woocommerce_template_single_price(); ?>
            <?php woocommerce_template_single_add_to_cart(); ?>
            <?php woocommerce_template_single_meta(); ?>
            <?php woocommerce_output_product_data_tabs(); ?>
        </div>
    </div>
</div>
<?php get_footer(); ?>