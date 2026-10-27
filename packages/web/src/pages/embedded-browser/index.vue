<template>
 <div class="browser-tabs-page">
  <div class="page-tabs" role="tablist" aria-label="网页标签">
   <div v-for="tab in tabs" :key="tab.id" class="page-tab" :class="{active: activeId === tab.id}">
    <button role="tab" :aria-selected="activeId === tab.id" :title="tab.title" @click="activeId = tab.id">{{ tab.title || '新标签页' }}</button>
    <button :aria-label="`关闭标签 ${tab.title || '新标签页'}`" @click="closeTab(tab.id)">×</button>
   </div>
   <button class="new-page-tab" title="新建标签页 (Ctrl+T)" aria-label="新建标签页" @click="addTab()">＋</button>
  </div>
  <EmbeddedTab v-for="tab in tabs" v-show="activeId === tab.id" :key="tab.id" :ref="(el) => setTabRef(tab.id, el)" :uid="uid" :initial-url="tab.url" :active="activeId === tab.id && isVisible" class="tab-guest" @ready="tab.contentsId = $event" @title="tab.title = $event" />
 </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { electron } from '../../utils/node';
import EmbeddedTab from './EmbeddedTab.vue';
const props = defineProps<{ uid: string }>();
const route = useRoute();
const isVisible = computed(() => route.name === 'embedded-browser' && route.params.uid === props.uid);
type Tab = {id: number; title: string; url?: string; contentsId?: number};
let nextId = 1;
const tabs = ref<Tab[]>([{id: nextId, title: '主页'}]);
const activeId = ref(nextId);
const tabRefs = new Map<number, {shortcut(key: string, alt?: boolean): void}>();
function setTabRef(id: number, el: any) { if (el) tabRefs.set(id, el); else tabRefs.delete(id); }
function addTab(url?: string) {
 const tab: Tab = {id: ++nextId, title: url ? '正在加载…' : '主页', url};
 tabs.value.push(tab); activeId.value = tab.id;
}
function closeTab(id: number) {
 const index = tabs.value.findIndex((tab) => tab.id === id);
 if (index < 0) return;
 tabs.value.splice(index, 1);
 if (!tabs.value.length) addTab();
 else if (activeId.value === id) activeId.value = tabs.value[Math.min(index, tabs.value.length - 1)].id;
}
function owns(sourceId: number) { return tabs.value.some((tab) => tab.contentsId === sourceId); }
function openTab(_event: unknown, data: {sourceId: number; url: string}) {
 if (owns(data.sourceId) && /^https?:\/\//i.test(data.url)) addTab(data.url);
}
function shortcut(key: string, alt = false) {
 if (key === 't' && !alt) addTab();
 else if (key === 'w' && !alt) closeTab(activeId.value);
 else tabRefs.get(activeId.value)?.shortcut(key, alt);
}
function guestShortcut(_event: unknown, data: {sourceId: number; key: string; alt: boolean}) {
 if (isVisible.value && owns(data.sourceId)) shortcut(data.key, data.alt);
}
function keydown(event: KeyboardEvent) {
 const key = event.key.toLowerCase();
 if (!isVisible.value || !((event.ctrlKey || event.metaKey) && ['t','w','l','r'].includes(key) || key === 'f5' || event.altKey && ['arrowleft','arrowright','home'].includes(key))) return;
 event.preventDefault(); shortcut(key, event.altKey);
}
onMounted(() => {
 electron.ipcRenderer.on('embedded-browser-open-tab', openTab);
 electron.ipcRenderer.on('embedded-browser-shortcut', guestShortcut);
 document.addEventListener('keydown', keydown);
});
onBeforeUnmount(() => {
 electron.ipcRenderer.removeListener('embedded-browser-open-tab', openTab);
 electron.ipcRenderer.removeListener('embedded-browser-shortcut', guestShortcut);
 document.removeEventListener('keydown', keydown);
});
</script>
<style scoped>
.browser-tabs-page { display:flex; flex-direction:column; height:100%; min-height:0; min-width:0; overflow:hidden; }
.page-tabs { display:flex; flex-shrink:0; gap:4px; overflow-x:auto; background:var(--color-bg-2); padding:6px 8px 0; }
.page-tab { display:flex; border-radius:8px 8px 0 0; background:var(--color-fill-2); flex-shrink:0; }
.page-tab.active { background:rgb(var(--primary-1)); box-shadow:inset 0 -2px rgb(var(--primary-6)); }
.page-tabs button { border:0; background:transparent; cursor:pointer; color:inherit; font:inherit; padding:8px 10px; }
.page-tab button:first-child { max-width:220px; min-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.page-tabs button:focus-visible { outline:2px solid rgb(var(--primary-6)); outline-offset:-2px; }
.tab-guest { flex:1; height:0; min-height:0; }
</style>
