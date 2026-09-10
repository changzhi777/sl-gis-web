<template>
  <view class="page">
    <!-- 当月账单卡 -->
    <view class="bill-hero">
      <view class="bill-head">
        <text class="bill-month">{{ bill.month }}用水账单</text>
        <text class="bill-status" :class="bill.status === '已缴' ? 'paid' : 'unpaid'">{{ bill.status }}</text>
      </view>
      <view class="bill-amount-row">
        <text class="bill-amount">{{ bill.amount.toFixed(2) }}</text>
        <text class="bill-unit">元</text>
      </view>
      <view class="bill-detail">
        <view class="detail-item">
          <text class="detail-value">{{ bill.usage }}</text>
          <text class="detail-label">用水量（m³）</text>
        </view>
        <view class="detail-item">
          <text class="detail-value">{{ bill.price }}</text>
          <text class="detail-label">水价（元/m³）</text>
        </view>
        <view class="detail-item">
          <text class="detail-value">按方计费</text>
          <text class="detail-label">计费方式</text>
        </view>
      </view>
      <button class="pay-btn" @click="onPay">{{ bill.status === '已缴' ? '已缴清' : '立即缴费' }}</button>
    </view>

    <!-- 近 6 个月用量（纯 CSS 柱状，不引图表库） -->
    <view class="card">
      <view class="card-title">近 6 个月用水量（m³）</view>
      <view class="chart">
        <view class="chart-item" v-for="m in usage" :key="m.month">
          <text class="chart-value">{{ m.usage }}</text>
          <view class="chart-track">
            <view
              class="chart-bar"
              :class="{ current: m.month === '9月' }"
              :style="{ height: barHeight(m.usage) }"
            />
          </view>
          <text class="chart-label">{{ m.month }}</text>
        </view>
      </view>
    </view>

    <!-- 缴费记录 -->
    <view class="card">
      <view class="card-title">缴费记录</view>
      <view class="record" v-for="r in records" :key="r.id">
        <view class="record-info">
          <text class="record-channel">{{ r.channel }}</text>
          <text class="record-time">{{ r.time }}</text>
        </view>
        <text class="record-amount">+{{ r.amount.toFixed(2) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { CURRENT_BILL, PAY_RECORDS, USAGE_6M } from '@/api/mock'

const bill = CURRENT_BILL
const usage = USAGE_6M
const records = PAY_RECORDS

const maxUsage = Math.max(...usage.map((m) => m.usage))

function barHeight(value: number): string {
  return `${Math.round((value / maxUsage) * 100)}%`
}

function onPay() {
  uni.showToast({ title: '缴费通道对接中，敬请期待', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 30rpx 40rpx;
  box-sizing: border-box;
}

.bill-hero {
  padding: 32rpx;
  background: $header-grad;
  border-radius: $radius;
  color: #fff;
}

.bill-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bill-month {
  font-size: 26rpx;
  opacity: 0.8;
}

.bill-status {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;

  &.unpaid {
    background: rgba(255, 122, 69, 0.9);
  }

  &.paid {
    background: rgba(47, 191, 113, 0.9);
  }
}

.bill-amount-row {
  display: flex;
  align-items: baseline;
  margin: 20rpx 0 8rpx;
}

.bill-amount {
  font-size: 64rpx;
  font-weight: 700;
}

.bill-unit {
  margin-left: 8rpx;
  font-size: 26rpx;
  opacity: 0.7;
}

.bill-detail {
  display: flex;
  margin: 24rpx 0;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.15);
}

.detail-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.detail-value {
  font-size: 30rpx;
  font-weight: 600;
}

.detail-label {
  margin-top: 6rpx;
  font-size: 22rpx;
  opacity: 0.65;
}

.pay-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: $brand-deep;
  background: $brand;
  border-radius: 999rpx;
}

.card {
  margin-top: 24rpx;
  padding: 28rpx;
  background: $bg-card;
  border-radius: $radius;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 28rpx;
}

.chart {
  display: flex;
  align-items: flex-end;
}

.chart-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-value {
  font-size: 20rpx;
  color: $text-sub;
  margin-bottom: 8rpx;
}

.chart-track {
  width: 36rpx;
  height: 220rpx;
  display: flex;
  align-items: flex-end;
  background: #f0f3f8;
  border-radius: 18rpx;
  overflow: hidden;
}

.chart-bar {
  width: 100%;
  background: linear-gradient(180deg, $brand 0%, rgba(0, 194, 255, 0.35) 100%);
  border-radius: 18rpx;

  &.current {
    background: linear-gradient(180deg, #12d8c0 0%, rgba(0, 255, 224, 0.35) 100%);
  }
}

.chart-label {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $text-sub;
}

.record {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22rpx 0;

  & + .record {
    border-top: 1rpx solid $line;
  }
}

.record-info {
  display: flex;
  flex-direction: column;
}

.record-channel {
  font-size: 28rpx;
  color: $text-main;
}

.record-time {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-sub;
}

.record-amount {
  font-size: 30rpx;
  font-weight: 600;
  color: $ok;
}
</style>
