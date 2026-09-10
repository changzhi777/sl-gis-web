<template>
  <view class="page">
    <!-- 深蓝渐变头部 + 用户卡 -->
    <view class="hero">
      <view class="hero-top">
        <text class="hero-title">供水服务</text>
        <text class="hero-sub">牧区供水通</text>
      </view>
      <view class="user-card">
        <view class="user-info">
          <text class="user-name">{{ user.name }}</text>
          <text class="user-account">户号 {{ user.account }}</text>
          <text class="user-address">{{ user.address }}</text>
        </view>
        <view class="user-balance">
          <text class="balance-label">账户余额（元）</text>
          <text class="balance-value">{{ user.balance.toFixed(2) }}</text>
          <view class="recharge-btn" @click="goRecharge">去充值</view>
        </view>
      </view>
    </view>

    <!-- 快捷入口宫格 -->
    <view class="card">
      <view class="grid">
        <view class="grid-item" v-for="item in quicks" :key="item.name" @click="onQuick(item)">
          <view class="grid-icon" :style="{ backgroundColor: item.bg }">{{ item.tag }}</view>
          <text class="grid-name">{{ item.name }}</text>
        </view>
      </view>
    </view>

    <!-- 停水公告 -->
    <view class="card">
      <view class="card-head">
        <text class="card-title">停水公告</text>
        <text class="card-more" @click="onMore">更多</text>
      </view>
      <view class="notice" v-for="n in notices" :key="n.id" @click="onNotice(n)">
        <view class="notice-badge">{{ n.type || '公告' }}</view>
        <view class="notice-body">
          <text class="notice-title">{{ n.title }}</text>
          <text class="notice-meta">{{ n.area }} · {{ n.date }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NOTICES, USER, type WaterNotice } from '@/api/mock'
import { apiGet, type NoticeRow } from '@/api/client'

interface QuickItem {
  name: string
  tag: string
  bg: string
  url: string // tab 页路径；空串表示占位
}

const user = USER
/** mock 起步 → 后端公告水合覆盖（失败回落 mock） */
const notices = ref<WaterNotice[]>(NOTICES)

/** 后端行 → 页面形状（type 徽标 / date 显示 created 前 16 位） */
async function loadNotices() {
  const data = await apiGet<{ total: number; items: NoticeRow[] }>('/api/portal/notices?limit=5')
  if (!data?.items?.length) return
  notices.value = data.items.map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    area: n.su_mu ?? '全域',
    date: (n.created || '').slice(5, 16).replace('T', ' '),
    content: n.content,
  }))
}
loadNotices()

const quicks: QuickItem[] = [
  { name: '水费缴纳', tag: '缴', bg: '#00a6e0', url: '/pages/bill/index' },
  { name: '水量查询', tag: '量', bg: '#2fbf71', url: '/pages/bill/index' },
  { name: '在线报修', tag: '修', bg: '#ff7a45', url: '/pages/repair/index' },
  { name: '停水公告', tag: '告', bg: '#7a8ca6', url: '' },
]

function goRecharge() {
  uni.switchTab({ url: '/pages/bill/index' })
}

function onQuick(item: QuickItem) {
  if (item.url) {
    uni.switchTab({ url: item.url })
  } else {
    uni.showToast({ title: '公告列表见下方', icon: 'none' })
  }
}

function onNotice(n: WaterNotice) {
  uni.showToast({ title: `${n.title}｜${n.content}`, icon: 'none' })
}

function onMore() {
  uni.showToast({ title: '公告更多页开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding-bottom: 30rpx;
}

.hero {
  padding: calc(var(--status-bar-height) + 30rpx) 30rpx 44rpx;
  background: $header-grad;
  color: #fff;
  border-radius: 0 0 36rpx 36rpx;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 30rpx;
}

.hero-title {
  font-size: 40rpx;
  font-weight: 600;
}

.hero-sub {
  font-size: 22rpx;
  opacity: 0.7;
}

.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: $radius;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 34rpx;
  font-weight: 600;
}

.user-account {
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.8;
}

.user-address {
  margin-top: 6rpx;
  font-size: 22rpx;
  opacity: 0.6;
  max-width: 320rpx;
}

.user-balance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.balance-label {
  font-size: 22rpx;
  opacity: 0.7;
}

.balance-value {
  margin-top: 6rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: $brand-accent;
}

.recharge-btn {
  margin-top: 12rpx;
  padding: 6rpx 24rpx;
  font-size: 24rpx;
  color: $brand-deep;
  background: $brand;
  border-radius: 999rpx;
}

.card {
  margin: 24rpx 30rpx 0;
  padding: 28rpx;
  background: $bg-card;
  border-radius: $radius;
}

.grid {
  display: flex;
}

.grid-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.grid-icon {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 26rpx;
  color: #fff;
  font-size: 34rpx;
  font-weight: 600;
}

.grid-name {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: $text-main;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-main;
}

.card-more {
  font-size: 24rpx;
  color: $text-sub;
}

.notice {
  display: flex;
  align-items: flex-start;
  padding: 20rpx 0;

  & + .notice {
    border-top: 1rpx solid $line;
  }
}

.notice-badge {
  flex-shrink: 0;
  margin-right: 16rpx;
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  color: $warn;
  border: 1rpx solid $warn;
  border-radius: 8rpx;
}

.notice-body {
  display: flex;
  flex-direction: column;
}

.notice-title {
  font-size: 28rpx;
  color: $text-main;
}

.notice-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-sub;
}
</style>
