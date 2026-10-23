<template><div class="polished-empty"><span class="empty-symbol"><Icon type="travel_explore" :size="46" /></span><div class="dew-eyebrow">YOUR NEXT CHAPTER</div><h3>为今天的学习，打开一个空间。</h3><p>独立保存课程账号与脚本。准备就绪后，随时开始。</p><button class="dew-button" @click="newBrowserOrInit()">新建学习空间 ↗</button><div style="display:flex;gap:24px;margin-top:24px"><button class="dew-link" @click="about">使用指南</button><button class="dew-link" @click="router.push('/about')">关于软件 ↗</button></div></div></template>
<script lang="ts" setup>
import { about } from '../utils';
import { router } from '../route';
import { newBrowserOrInit } from '../utils/browser';
import Icon from './Icon.vue';
</script>