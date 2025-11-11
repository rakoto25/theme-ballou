<?php if (!defined('ABSPATH')) exit;
get_header(); ?>
<div class="container">
    <h1>Recherche</h1>
    <div id="ballou-listing">
        <?php if (have_posts()) : ?>
            <div class="ballou-grid">
                <?php while (have_posts()) : the_post(); ?>
                    <article class="ballou-card">
                        <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                    </article>
                <?php endwhile; ?>
            </div>
            <?php the_posts_pagination(); ?>
        <?php else: ?>
            <p>Aucun résultat.</p>
        <?php endif; ?>
    </div>
</div>
<?php get_footer(); ?>