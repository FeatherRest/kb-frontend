<template>
  <n-message-provider>
    <n-config-provider :theme="darkTheme" :locale="zhCN" :date-locale="dateZhCN">
      <n-layout position="absolute" style="height:100vh;background:#1e1e2e;">
        <NavBar />
        <n-layout-content style="padding:24px;background:#1e1e2e;min-height:calc(100vh - 64px);">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-config-provider>
  </n-message-provider>
</template>

<script setup>
import { darkTheme } from 'naive-ui'
import { zhCN, dateZhCN } from 'naive-ui'
import NavBar from './components/NavBar.vue'
</script>
