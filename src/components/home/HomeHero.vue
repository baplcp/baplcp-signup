<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    required: true,
  },
  ctaLabel: {
    type: String,
    required: true,
  },
  ctaTo: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <section class="hero">
    <div class="hero-content">
      <div class="hero-cat" aria-hidden="true">
        <img class="cat-main" src="/images/hero-cat.png" alt="" />
      </div>

      <div class="hero-copy">
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
        <RouterLink :to="ctaTo" class="cta">{{ ctaLabel }}</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 274px;
  padding: 44px 0 106px;
  background: linear-gradient(180deg, var(--primary-700) 0%, var(--primary-400) 100%);
  box-shadow: var(--shadow-primary-card);
  overflow: hidden;
}

.hero-content {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 8px;
  padding: 22px 14px 0 0;
  align-items: center;
  margin-top: -36px;
}

.hero-cat {
  position: relative;
  height: 188px;
  margin-top: 26px;
  overflow: visible;
}

.hero-cat img.cat-main {
  position: absolute;
  left: -2px;
  top: -18px;
  width: 210px;
  height: 224px;
  object-fit: contain;
  filter: drop-shadow(-8px 9px 22.9px rgba(16, 24, 67, 0.45));
}

.hero-copy {
  padding-right: 14px;
  color: #fff;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-copy h1 {
  margin: 0 0 6px;
  font-size: 28px;
  line-height: 1.36;
  font-weight: 700;
  letter-spacing: 0.56px;
}

.hero-copy p {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  text-align: center;
}

.cta {
  margin-top: 10px;
  width: 100%;
  max-width: 182px;
  padding: 12px 24px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent-100) 6.25%, var(--accent-300) 47.596%, var(--accent-500) 100%);
  color: var(--accent-700);
  font-size: 16px;
  font-weight: 500;
  box-shadow: 1px 7px 21.3px rgba(27, 17, 75, 0.45);
}
</style>
